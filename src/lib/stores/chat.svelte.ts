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
	}

	async loadSessions() {
		this.sessions = await chat.getSessions();
	}

	async loadSession(sessionId: number) {
		const session = await chat.getSession(sessionId);
		if (session) {
			this.currentSession = session;
			this.messages = await chat.getSessionMessages(sessionId);
			this.selectedModel = session.model;
			this.selectedPromptId = session.systemPromptId;
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

	async updateSessionTitle(title: string) {
		if (!this.currentSession || !title.trim()) return;
		await chat.updateSessionTitle(this.currentSession.id!, title.trim());
		this.currentSession.title = title.trim();
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

		const systemPrompt = this.selectedPromptId
			? this.systemPrompts.find(p => p.id === this.selectedPromptId)?.content
			: this.systemPrompts.find(p => p.isDefault)?.content;

		try {
			await sendMessage(this.selectedModel, {
				messages: this.messages.filter(m => m.role !== 'tool'),
				systemPrompt,
				toolsEnabled: this.toolsEnabled,
				onChunk: (chunk) => {
					this.streamingContent += chunk;
				},
				onToolCall: async (toolCalls) => {
					this.pendingToolCalls = toolCalls;
					const toolCallsStr = JSON.stringify(toolCalls);
					await chat.updateMessage(assistantMessageId, '', toolCallsStr);
				},
				onToolResult: async (results) => {
					this.toolResults = results;
					const toolResultsStr = JSON.stringify(results);
					await chat.updateMessage(assistantMessageId, '', undefined, toolResultsStr);
					
					this.messages = this.messages.map(m => 
						m.id === assistantMessageId 
							? { ...m, tool_calls: JSON.stringify(this.pendingToolCalls), tool_results: toolResultsStr }
							: m
					);
				},
				onComplete: async () => {
					try {
						const finalContent = this.streamingContent;
						await chat.updateMessage(assistantMessageId, finalContent, this.pendingToolCalls.length > 0 ? JSON.stringify(this.pendingToolCalls) : undefined);
						this.messages = this.messages.map(m => 
							m.id === assistantMessageId 
								? { ...m, content: finalContent }
								: m
						);
					} catch (err) {
						console.error('Error in onComplete:', err);
						this.error = err instanceof Error ? err.message : 'Failed to save response';
					} finally {
						this.isLoading = false;
						this.streamingContent = '';
					}
				},
				onError: async (err) => {
					this.error = err.message;
					this.isLoading = false;
					this.streamingContent = '';
				}
			});
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to send message';
			this.isLoading = false;
			this.streamingContent = '';
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
