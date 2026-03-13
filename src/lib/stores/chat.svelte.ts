import type { Session, Message, SystemPrompt } from '$lib/services/db';
import * as chat from '$lib/services/chat';
import * as settings from '$lib/services/settings';
import { sendMessage } from '$lib/services/api';
import type { ToolCall, ToolCallResult } from '$lib/tools';

class ChatStore {
	sessions = $state<Session[]>([]);
	currentSession = $state<Session | null>(null);
	messages = $state<Message[]>([]);
	isLoading = $state(false);
	streamingContent = $state('');
	streamingMessageId = $state<number | null>(null);
	error = $state<string | null>(null);
	pendingToolCalls = $state<ToolCall[]>([]);
	toolResults = $state<ToolCallResult[]>([]);

	systemPrompts = $state<SystemPrompt[]>([]);
	selectedModel = $state('MiniMax-M2.5');
	selectedPromptId = $state<number | null>(null);
	availableModels = $state<string[]>([]);
	toolsEnabled = $state(true);

	async initialize() {
		this.systemPrompts = await settings.getSystemPrompts();
		this.selectedModel = await settings.getSelectedModel();
		this.selectedPromptId = await settings.getSelectedPromptId();
		await this.loadSessions();
		
		const lastSessionId = localStorage.getItem('lastSessionId');
		if (lastSessionId) {
			const sessionId = parseInt(lastSessionId, 10);
			if (!isNaN(sessionId)) {
				await this.loadSession(sessionId);
			}
		}
	}

	async loadSessions() {
		this.sessions = await chat.getSessions();
	}

	async saveLastSessionId(sessionId: number) {
		localStorage.setItem('lastSessionId', sessionId.toString());
	}

	async loadSession(sessionId: number) {
		const session = await chat.getSession(sessionId);
		if (session) {
			this.currentSession = session;
			this.messages = await chat.getSessionMessages(sessionId);
			this.selectedModel = session.model;
			this.selectedPromptId = session.systemPromptId;
			this.saveLastSessionId(sessionId);
		}
	}

	async createNewSession() {
		const defaultPrompt = this.systemPrompts.find(p => p.isDefault) || this.systemPrompts[0];
		const sessionId = await chat.createSession(
			'New Chat',
			this.selectedModel,
			defaultPrompt?.id || null
		);
		await this.loadSessions();
		await this.loadSession(sessionId);
	}

	async selectSession(sessionId: number) {
		await this.loadSession(sessionId);
	}

	async deleteSession(sessionId: number) {
		await chat.deleteSession(sessionId);
		await this.loadSessions();
		if (this.currentSession?.id === sessionId) {
			this.currentSession = null;
			this.messages = [];
		}
	}

	async updateSessionModel(model: string) {
		if (!this.currentSession) return;
		this.selectedModel = model;
		await chat.updateSession(this.currentSession.id!, { model });
		await settings.saveSelectedModel(model);
	}

	async updateSessionPrompt(promptId: number | null) {
		if (!this.currentSession) return;
		this.selectedPromptId = promptId;
		await chat.updateSession(this.currentSession.id!, { systemPromptId: promptId });
		await settings.saveSelectedPromptId(promptId);
	}

	async updateSessionTitle(title: string, sessionId?: number) {
		const id = sessionId || this.currentSession?.id;
		if (!id || !title.trim()) return;
		await chat.updateSessionTitle(id, title.trim());
		if (this.currentSession?.id === id) {
			this.currentSession.title = title.trim();
		}
		await this.loadSessions();
	}

	async sendMessage(content: string) {
		if (!this.currentSession || !content.trim()) return;

		this.isLoading = true;
		this.error = null;
		this.streamingContent = '';
		this.pendingToolCalls = [];
		this.toolResults = [];

		const userMessageId = await chat.addMessage(this.currentSession.id!, 'user', content.trim());
		
		const userMessage: Message = {
			id: userMessageId,
			sessionId: this.currentSession.id!,
			role: 'user',
			content: content.trim(),
			timestamp: new Date()
		};

		this.messages = [...this.messages, userMessage];

		const title = chat.generateTitleFromMessage(content);
		if (this.currentSession.title === 'New Chat') {
			await chat.updateSessionTitle(this.currentSession.id!, title);
			this.currentSession.title = title;
			await this.loadSessions();
		}

		const assistantMessageId = await chat.addMessage(
			this.currentSession.id!,
			'assistant',
			''
		);

		const assistantMessage: Message = {
			id: assistantMessageId,
			sessionId: this.currentSession.id!,
			role: 'assistant',
			content: '',
			timestamp: new Date()
		};
		this.messages = [...this.messages, assistantMessage];
		this.streamingMessageId = assistantMessageId;

		const systemPrompt = this.selectedPromptId
			? this.systemPrompts.find(p => p.id === this.selectedPromptId)?.content
			: this.systemPrompts.find(p => p.isDefault)?.content;

		let lastSaveTime = Date.now();
		let saveTimeout: ReturnType<typeof setTimeout> | null = null;
		const SAVE_INTERVAL = 500;

		const throttleSave = async (content: string, toolCalls?: string, toolResults?: string) => {
			const now = Date.now();
			if (now - lastSaveTime > SAVE_INTERVAL) {
				if (saveTimeout) {
					clearTimeout(saveTimeout);
					saveTimeout = null;
				}
				await chat.updateMessage(assistantMessageId, content, toolCalls, toolResults);
				lastSaveTime = now;
			} else if (!saveTimeout) {
				saveTimeout = setTimeout(async () => {
					await chat.updateMessage(assistantMessageId, content, toolCalls, toolResults);
					lastSaveTime = Date.now();
					saveTimeout = null;
				}, SAVE_INTERVAL - (now - lastSaveTime));
			}
		};

		try {
			await sendMessage(this.selectedModel, {
				messages: this.messages.filter(m => {
					if (m.role !== 'assistant') return true;
					const content = typeof m.content === 'string' ? m.content : '';
					return content.trim().length > 0;
				}),
				systemPrompt,
				toolsEnabled: this.toolsEnabled,
				onChunk: async (chunk) => {
					this.streamingContent += chunk;
					
					// Update UI immediately
					this.messages = this.messages.map(m => 
						m.id === assistantMessageId 
							? { ...m, content: this.streamingContent }
							: m
					);

					// Throttle DB write
					throttleSave(this.streamingContent);
				},
				onToolCall: async (toolCalls) => {
					this.pendingToolCalls = toolCalls;
					const toolCallsStr = JSON.stringify(toolCalls);
					
					// Update UI immediately
					this.messages = this.messages.map(m => 
						m.id === assistantMessageId 
							? { ...m, content: this.streamingContent, tool_calls: toolCallsStr }
							: m
					);

					// Force save on tool call
					if (saveTimeout) {
						clearTimeout(saveTimeout);
						saveTimeout = null;
					}
					await chat.updateMessage(assistantMessageId, this.streamingContent, toolCallsStr);
					lastSaveTime = Date.now();
				},
				onToolResult: async (results) => {
					this.toolResults = results;
					const toolResultsStr = JSON.stringify(results);
					const toolCallsStr = this.pendingToolCalls.length > 0 ? JSON.stringify(this.pendingToolCalls) : undefined;
					
					// Update UI immediately
					this.messages = this.messages.map(m => 
						m.id === assistantMessageId 
							? { ...m, content: this.streamingContent, tool_results: toolResultsStr }
							: m
					);

					// Force save on tool result
					if (saveTimeout) {
						clearTimeout(saveTimeout);
						saveTimeout = null;
					}
					await chat.updateMessage(
						assistantMessageId, 
						this.streamingContent, 
						toolCallsStr, 
						toolResultsStr
					);
					lastSaveTime = Date.now();
				},
				onComplete: async (finalContent: string, toolCalls?: ToolCall[]) => {
					try {
						if (saveTimeout) {
							clearTimeout(saveTimeout);
							saveTimeout = null;
						}

						const toolCallsStr = toolCalls && toolCalls.length > 0 ? JSON.stringify(toolCalls) : undefined;
						const toolResultsStr = this.toolResults.length > 0 ? JSON.stringify(this.toolResults) : undefined;
						
						await chat.updateMessage(
							assistantMessageId, 
							finalContent, 
							toolCallsStr,
							toolResultsStr
						);
						
						this.messages = this.messages.map(m => 
							m.id === assistantMessageId 
								? { 
									...m, 
									content: finalContent,
									tool_calls: toolCallsStr || m.tool_calls,
									tool_results: toolResultsStr || m.tool_results
								}
								: m
						);
					} catch (err) {
						console.error('Error in onComplete:', err);
						this.error = err instanceof Error ? err.message : 'Failed to save response';
					} finally {
						this.isLoading = false;
						this.streamingContent = '';
						this.streamingMessageId = null;
					}
				},
				onError: async (err) => {
					this.error = err.message;
					await chat.updateMessage(assistantMessageId, `Error: ${err.message}`);
					this.messages = this.messages.map(m => 
						m.id === assistantMessageId 
							? { ...m, content: `Error: ${err.message}` }
							: m
					);
					this.isLoading = false;
					this.streamingContent = '';
					this.streamingMessageId = null;
				}
			});
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to send message';
			this.isLoading = false;
			this.streamingContent = '';
			this.streamingMessageId = null;
		}
	}

	async loadSystemPrompts() {
		this.systemPrompts = await settings.getSystemPrompts();
	}

	async addSystemPrompt(name: string, content: string, isDefault: boolean = false) {
		if (isDefault) {
			await settings.setDefaultSystemPrompt(0);
		}
		const id = await settings.createSystemPrompt({ name, content, isDefault });
		await this.loadSystemPrompts();
		return id;
	}

	async updateSystemPrompt(id: number, name: string, content: string) {
		await settings.updateSystemPrompt(id, { name, content });
		await this.loadSystemPrompts();
	}

	async deleteSystemPrompt(id: number) {
		await settings.deleteSystemPrompt(id);
		await this.loadSystemPrompts();
	}

	async setDefaultPrompt(id: number) {
		await settings.setDefaultSystemPrompt(id);
		await this.loadSystemPrompts();
	}
}

export const chatStore = new ChatStore();
