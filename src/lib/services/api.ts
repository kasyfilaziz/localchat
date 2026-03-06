import { getApiKey, getApiEndpoint } from './settings';
import type { Message } from './db';
import { getToolDefinitions, executeToolCalls, type ToolCall, type ToolCallResult } from '../tools';

export interface ChatMessage {
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string;
	tool_call_id?: string;
	tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
	name?: string;
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
	onComplete?: () => void | Promise<void>;
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
		// If we have contextMessages, skip ONLY empty assistant messages (without tool_calls)
		// Keep assistant messages that have tool_calls from previous response
		if (options.contextMessages && msg.role === 'assistant') {
			const hasToolCalls = msg.tool_calls && msg.tool_calls.trim().length > 0;
			if (!hasToolCalls) {
				continue; // Skip empty assistant message
			}
		}
		
		if (msg.role === 'tool') {
			formatted.push({
				role: 'tool',
				content: msg.content,
				tool_call_id: msg.tool_call_id
			});
		} else if (msg.role === 'assistant' && msg.tool_calls) {
			try {
				const tcs = JSON.parse(msg.tool_calls);
				formatted.push({
					role: 'assistant',
					content: '',
					tool_calls: tcs
				});
			} catch {
				formatted.push({
					role: msg.role,
					content: msg.content
				});
			}
		} else {
			formatted.push({
				role: msg.role,
				content: msg.content
			});
		}
	}

	if (options.contextMessages) {
		formatted.push(...options.contextMessages);
	}

	if (options.toolResults) {
		for (const tr of options.toolResults) {
			formatted.push({
				role: 'tool',
				content: tr.output,
				tool_call_id: tr.tool_call_id
			});
		}
	}

	return formatted;
}

async function sendRequest(
	model: string,
	messages: ChatMessage[],
	toolsEnabled: boolean,
	callbacks: {
		onChunk: (text: string) => void;
		onToolCall?: (toolCalls: ToolCall[]) => void;
	}
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
		stream: true
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
					callbacks.onChunk(deltaContent);
				}
				if (reasoning) {
					content += reasoning;
					callbacks.onChunk(reasoning);
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

export async function sendMessage(
	model: string,
	options: StreamOptions
): Promise<void> {
	try {
		const result = await sendRequest(
			model,
			formatMessages(options),
			Boolean(options.toolsEnabled),
			{
				onChunk: options.onChunk,
				onToolCall: options.onToolCall
			}
		);

		if (result.toolCalls && result.toolCalls.length > 0) {
			await options.onToolCall?.(result.toolCalls);
			
			const toolResults = await executeToolCalls(result.toolCalls);
			await options.onToolResult?.(toolResults);

			const contextMessages: ChatMessage[] = [
				{
					role: 'assistant',
					content: '',
					tool_calls: result.toolCalls.map(tc => ({
						id: tc.id,
						type: tc.type,
						function: tc.function
					}))
				}
			];

			await sendMessage(model, {
				...options,
				toolsEnabled: false,
				contextMessages,
				toolResults,
				onToolCall: undefined
			});
		} else {
			await options.onComplete?.();
		}
	} catch (error) {
		console.error('[API] Error:', error);
		await options.onError?.(error instanceof Error ? error : new Error(String(error)));
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
			return data.data.map((m: any) => m.id).filter((id: string) => typeof id === 'string');
		}

		if (data.models && Array.isArray(data.models)) {
			return data.models
				.map((m: any) => m.name || m.id)
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
