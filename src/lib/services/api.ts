import { getApiKey, getApiEndpoint } from './settings';
import type { Message } from './db';
import { getToolDefinitions, executeToolCalls, type ToolCall, type ToolCallResult } from '../tools';

export interface ChatMessage {
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string | ToolResultContent[];
	tool_call_id?: string;
	tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
	name?: string;
}

export interface ToolResultContent {
	type: 'tool_result';
	tool_use_id: string;
	content: string;
}

export interface StreamOptions {
	messages: Message[];
	systemPrompt?: string;
	toolsEnabled?: boolean;
	contextMessages?: ChatMessage[];
	toolResults?: ToolCallResult[];
	onChunk: (text: string) => void;
	onToolCall?: (toolCalls: ToolCall[]) => void | Promise<void>;
	onToolResult?: (results: ToolCallResult[]) => void | Promise<void>;
	onComplete?: (finalContent: string, toolCalls?: ToolCall[]) => void | Promise<void>;
	onError?: (error: Error) => void | Promise<void>;
}

function formatMessages(options: StreamOptions): ChatMessage[] {
	const formatted: ChatMessage[] = [];

	if (options.systemPrompt) {
		formatted.push({
			role: 'system',
			content: options.systemPrompt
		});
	}

	for (const msg of options.messages) {
		if (msg.role === 'tool') {
			formatted.push({
				role: 'user',
				content: [
					{
						type: 'tool_result' as const,
						tool_use_id: msg.tool_call_id || '',
						content: msg.content
					}
				]
			});
		} else if (msg.role === 'assistant' && msg.tool_calls) {
			try {
				const tcs = JSON.parse(msg.tool_calls);
				const contentValue = typeof msg.content === 'string' ? msg.content : '';
				formatted.push({
					role: 'assistant',
					content: contentValue,
					tool_calls: tcs
				});
			} catch {
				const contentValue = typeof msg.content === 'string' ? msg.content : '';
				formatted.push({
					role: msg.role,
					content: contentValue
				});
			}
		} else if (msg.role === 'user' && Array.isArray(msg.content)) {
			formatted.push({
				role: msg.role,
				content: msg.content
			});
		} else if (msg.role === 'assistant' && msg.content) {
			const contentValue = typeof msg.content === 'string' ? msg.content : '';
			formatted.push({
				role: msg.role,
				content: contentValue
			});
		} else if (msg.role !== 'assistant') {
			const contentValue = typeof msg.content === 'string' ? msg.content : '';
			formatted.push({
				role: msg.role,
				content: contentValue
			});
		}
	}

	if (options.contextMessages) {
		formatted.push(...options.contextMessages);
	}

	if (options.toolResults) {
		for (const tr of options.toolResults) {
			formatted.push({
				role: 'user',
				content: [
					{
						type: 'tool_result' as const,
						tool_use_id: tr.tool_call_id,
						content: tr.output
					}
				]
			});
		}
	}

	return formatted;
}

async function sendRequest(
	model: string,
	messages: ChatMessage[],
	toolsEnabled: boolean,
	onChunk: (text: string) => void
): Promise<{ content: string; toolCalls?: ToolCall[] }> {
	const apiKey = await getApiKey();
	const endpoint = await getApiEndpoint();

	if (!apiKey) {
		throw new Error('API key not configured');
	}

	const url = endpoint.replace(/\/$/, '') + '/chat/completions';

	const requestBody: Record<string, unknown> = {
		model,
		messages,
		stream: true,
		extra_body: {
			reasoning_split: true
		}
	};

	if (toolsEnabled) {
		requestBody.tools = getToolDefinitions();
	}

	console.log('[API] Sending request:', { model, url, toolsEnabled, messageCount: messages.length });

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`
		},
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error('[API] HTTP Error:', response.status, errorText);
		throw new Error(`API Error: ${response.status} - ${errorText}`);
	}

	if (!response.body) {
		throw new Error('No response body');
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	let currentToolCalls: ToolCall[] = [];
	let currentToolCallId = '';
	let currentToolName = '';
	let currentToolArguments = '';
	let content = '';

	while (true) {
		const { done, value } = await reader.read();

		if (done) {
			break;
		}

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || !trimmed.startsWith('data: ')) {
				continue;
			}

			const data = trimmed.slice(6);

			if (data === '[DONE]') {
				if (currentToolCallId && currentToolName) {
					currentToolCalls.push({
						id: currentToolCallId,
						type: 'function',
						function: {
							name: currentToolName,
							arguments: currentToolArguments
						}
					});
				}
				return { content, toolCalls: currentToolCalls.length > 0 ? currentToolCalls : undefined };
			}

			try {
				const parsed = JSON.parse(data);
				const delta = parsed.choices?.[0]?.delta;

				const deltaContent = delta?.content;
				const reasoning = delta?.reasoning_content || delta?.reasoning;

				if (deltaContent) {
					content += deltaContent;
					onChunk(deltaContent);
				}
				if (reasoning) {
					content += reasoning;
					onChunk(reasoning);
				}

				if (delta?.tool_calls) {
					for (const tc of delta.tool_calls) {
						if (tc.id && tc.id !== currentToolCallId) {
							if (currentToolCallId && currentToolName) {
								currentToolCalls.push({
									id: currentToolCallId,
									type: 'function',
									function: {
										name: currentToolName,
										arguments: currentToolArguments
									}
								});
							}
							currentToolCallId = tc.id;
							currentToolName = tc.function?.name || '';
							currentToolArguments = tc.function?.arguments || '';
						} else if (tc.function?.arguments) {
							currentToolArguments += tc.function.arguments;
						}
					}
				}
			} catch (e) {
				// Skip malformed JSON
			}
		}
	}

	if (currentToolCallId && currentToolName) {
		currentToolCalls.push({
			id: currentToolCallId,
			type: 'function',
			function: {
				name: currentToolName,
				arguments: currentToolArguments
			}
		});
	}

	return { content, toolCalls: currentToolCalls.length > 0 ? currentToolCalls : undefined };
}

async function executeWithTools(
	model: string,
	options: StreamOptions,
	initialMessages: ChatMessage[]
): Promise<{ content: string; toolCalls: ToolCall[] }> {
	let currentMessages = structuredClone(initialMessages);
	let accumulatedContent = '';
	let allToolCalls: ToolCall[] = [];
	let hasMoreToolCalls = true;
	let toolCallIteration = 0;
	const maxToolIterations = 5;

	while (hasMoreToolCalls && toolCallIteration < maxToolIterations) {
		console.log(`[API] Tool iteration ${toolCallIteration + 1}, messages: ${currentMessages.length}`);

		const result = await sendRequest(
			model,
			currentMessages,
			true,
			(chunk) => {
				accumulatedContent += chunk;
				options.onChunk(chunk);
			}
		);

		if (result.toolCalls && result.toolCalls.length > 0) {
			console.log(`[API] Tool calls detected (iteration ${toolCallIteration + 1}):`, result.toolCalls);

			allToolCalls = [...allToolCalls, ...result.toolCalls];
			await options.onToolCall?.(result.toolCalls);

			const toolResults = await executeToolCalls(result.toolCalls);
			await options.onToolResult?.(toolResults);

			const toolCallMessage: ChatMessage = {
				role: 'assistant',
				content: result.content,
				tool_calls: result.toolCalls.map(tc => ({
					id: tc.id,
					type: tc.type,
					function: tc.function
				}))
			};

			const toolResultMessages: ChatMessage[] = toolResults.map(tr => ({
				role: 'user' as const,
				content: [
					{
						type: 'tool_result' as const,
						tool_use_id: tr.tool_call_id,
						content: tr.output
					}
				]
			}));

			currentMessages = [
				...currentMessages,
				toolCallMessage,
				...toolResultMessages
			];

			toolCallIteration++;
		} else {
			hasMoreToolCalls = false;
		}
	}

	return { content: accumulatedContent, toolCalls: allToolCalls };
}

export async function sendMessage(
	model: string,
	options: StreamOptions
): Promise<void> {
	let finalContent = '';
	let finalToolCalls: ToolCall[] | undefined;

	try {
		const formattedMessages = formatMessages(options);

		if (options.toolsEnabled && !options.contextMessages && !options.toolResults) {
			const result = await executeWithTools(model, options, formattedMessages);
			finalContent = result.content;
			finalToolCalls = result.toolCalls;
		} else {
			const result = await sendRequest(
				model,
				formattedMessages,
				Boolean(options.toolsEnabled),
				options.onChunk
			);
			finalContent = result.content;
		}

		await options.onComplete?.(finalContent, finalToolCalls);

	} catch (error) {
		console.error('[API] Error:', error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		await options.onError?.(new Error(errorMessage));
		// Still call onComplete with empty content to signal completion
		await options.onComplete?.(finalContent, finalToolCalls);
	}
}

export async function fetchModels(
	endpoint: string,
	apiKey: string
): Promise<string[]> {
	const url = endpoint.replace(/\/$/, '') + '/models';

	try {
		const response = await fetch(url, {
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();

		if (data.data && Array.isArray(data.data)) {
			return data.data.map((m: unknown) => (m as { id: string }).id).filter((id: string) => typeof id === 'string');
		}

		if (data.models && Array.isArray(data.models)) {
			return data.models
				.map((m: unknown) => (m as { name?: string; id: string }).name || (m as { id: string }).id)
				.filter((id: string) => typeof id === 'string');
		}

		return [];
	} catch (error) {
		throw new Error(error instanceof Error ? error.message : 'Failed to fetch models');
	}
}

export async function testConnection(
	endpoint: string,
	apiKey: string
): Promise<{ success: boolean; message: string; models?: string[] }> {
	try {
		const models = await fetchModels(endpoint, apiKey);
		if (models.length === 0) {
			return {
				success: true,
				message: 'Connected but no models found',
				models: []
			};
		}
		return {
			success: true,
			message: `Connected! Found ${models.length} models`,
			models
		};
	} catch (error) {
		return {
			success: false,
			message: error instanceof Error ? error.message : 'Connection failed'
		};
	}
}
