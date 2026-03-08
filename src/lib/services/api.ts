import { getApiKey, getApiEndpoint, getApiMode, type ApiMode } from './settings';
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

export type AnthropicContentBlock = 
	| { type: 'text'; text: string }
	| { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
	| { type: 'tool_result'; tool_use_id: string; content: string };

export type AnthropicMessage = {
	role: 'user' | 'assistant';
	content: AnthropicContentBlock[];
};

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
				role: 'tool',
				tool_call_id: msg.tool_call_id || '',
				content: msg.content
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
		} else if (msg.role === 'assistant' && msg.tool_results) {
			try {
				const toolResults = JSON.parse(msg.tool_results);
				for (const tr of toolResults) {
					formatted.push({
						role: 'tool' as const,
						tool_call_id: tr.tool_call_id,
						content: tr.output
					});
				}
			} catch {
				// Ignore parse errors
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
				role: 'tool',
				tool_call_id: tr.tool_call_id,
				content: tr.output
			});
		}
	}

	return formatted;
}

function formatMessagesForAnthropic(options: StreamOptions): {
	system: string | undefined;
	messages: AnthropicMessage[];
} {
	const messages: AnthropicMessage[] = [];
	let systemPrompt: string | undefined;

	if (options.systemPrompt) {
		systemPrompt = options.systemPrompt;
	}

	for (const msg of options.messages) {
		if (msg.role === 'tool') {
			messages.push({
				role: 'user',
				content: [
					{
						type: 'tool_result' as const,
						tool_use_id: msg.tool_call_id || '',
						content: typeof msg.content === 'string' ? msg.content : ''
					}
				]
			});
		} else if (msg.role === 'assistant' && msg.tool_calls) {
			try {
				const tcs = JSON.parse(msg.tool_calls);
				const contentBlocks: AnthropicContentBlock[] = [];
				
				if (msg.content) {
					const contentValue = typeof msg.content === 'string' ? msg.content : '';
					if (contentValue) {
						contentBlocks.push({ type: 'text', text: contentValue });
					}
				}
				
				for (const tc of tcs) {
					let input: Record<string, unknown> = {};
					try {
						input = JSON.parse(tc.function.arguments || '{}');
					} catch {}
					
					contentBlocks.push({
						type: 'tool_use',
						id: tc.id,
						name: tc.function.name,
						input
					});
				}
				
				if (contentBlocks.length > 0) {
					messages.push({
						role: 'assistant',
						content: contentBlocks
					});
				}
			} catch {
				// Skip malformed
			}
		} else if (msg.role === 'assistant' && msg.tool_results) {
			try {
				const toolResults = JSON.parse(msg.tool_results);
				const contentBlocks: AnthropicContentBlock[] = [];
				
				for (const tr of toolResults) {
					contentBlocks.push({
						type: 'tool_result',
						tool_use_id: tr.tool_call_id,
						content: tr.output
					});
				}
				
				if (contentBlocks.length > 0) {
					messages.push({
						role: 'user',
						content: contentBlocks
					});
				}
			} catch {}
		} else if (msg.role === 'user') {
			if (Array.isArray(msg.content)) {
				const contentBlocks: AnthropicContentBlock[] = [];
				for (const block of msg.content) {
					if (typeof block === 'object' && 'type' in block) {
						if (block.type === 'tool_result') {
							contentBlocks.push({
								type: 'tool_result',
								tool_use_id: block.tool_use_id,
								content: block.content
							});
						} else if ('text' in block) {
							contentBlocks.push({
								type: 'text',
								text: String(block.text)
							});
						}
					} else {
						contentBlocks.push({
							type: 'text',
							text: String(block)
						});
					}
				}
				messages.push({ role: 'user', content: contentBlocks });
			} else {
				const contentValue = typeof msg.content === 'string' ? msg.content : '';
				messages.push({
					role: 'user',
					content: [{ type: 'text', text: contentValue }]
				});
			}
		} else if (msg.role === 'assistant' && msg.content) {
			const contentValue = typeof msg.content === 'string' ? msg.content : '';
			messages.push({
				role: 'assistant',
				content: [{ type: 'text', text: contentValue }]
			});
		}
	}

	if (options.contextMessages) {
		for (const msg of options.contextMessages) {
			if (msg.role === 'tool') {
				messages.push({
					role: 'user',
					content: [
						{
							type: 'tool_result' as const,
							tool_use_id: msg.tool_call_id || '',
							content: typeof msg.content === 'string' ? msg.content : ''
						}
					]
				});
			} else if (msg.tool_calls) {
				const contentBlocks: AnthropicContentBlock[] = [];
				for (const tc of msg.tool_calls) {
					let input: Record<string, unknown> = {};
					try {
						input = JSON.parse(tc.function.arguments || '{}');
					} catch {}
					contentBlocks.push({
						type: 'tool_use',
						id: tc.id,
						name: tc.function.name,
						input
					});
				}
				if (contentBlocks.length > 0) {
					messages.push({ role: 'assistant', content: contentBlocks });
				}
			} else {
				const contentValue = typeof msg.content === 'string' ? msg.content : '';
				messages.push({
					role: msg.role as 'user' | 'assistant',
					content: [{ type: 'text', text: contentValue }]
				});
			}
		}
	}

	if (options.toolResults) {
		for (const tr of options.toolResults) {
			messages.push({
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

	return { system: systemPrompt, messages };
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

		accumulatedContent += result.content;

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
				role: 'tool' as const,
				tool_call_id: tr.tool_call_id,
				content: tr.output
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

async function sendRequestAnthropic(
	model: string,
	messages: AnthropicMessage[],
	system: string | undefined,
	toolsEnabled: boolean,
	onChunk: (text: string) => void
): Promise<{ content: string; toolCalls?: ToolCall[] }> {
	const apiKey = await getApiKey();
	const endpoint = await getApiEndpoint();

	if (!apiKey) {
		throw new Error('API key not configured');
	}

	const url = endpoint.replace(/\/$/, '') + '/anthropic/v1/messages';

	const requestBody: Record<string, unknown> = {
		model,
		max_tokens: 131072,
		stream: true,
		messages
	};

	if (system) {
		requestBody.system = system;
	}

	if (toolsEnabled) {
		requestBody.tools = getToolDefinitions();
	}

	console.log('[API] Sending Anthropic request:', { model, url, toolsEnabled, messageCount: messages.length });

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
		console.error('[API] Anthropic HTTP Error:', response.status, errorText);
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
	let currentBlockType = '';

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
				const eventType = parsed.type;

				if (eventType === 'content_block_delta') {
					const delta = parsed.delta;

					if (delta?.type === 'text_delta') {
						const text = delta.text;
						if (text) {
							content += text;
							onChunk(text);
						}
					} else if (delta?.type === 'thinking_delta') {
						const thinking = delta.thinking;
						if (thinking) {
							content += thinking;
							onChunk(thinking);
						}
					} else if (delta?.type === 'input_json_delta') {
						if (currentToolCallId) {
							currentToolArguments += delta.partial_json || '';
						}
					}
				} else if (eventType === 'content_block_start') {
					currentBlockType = parsed.content_block?.type || '';
					if (currentBlockType === 'tool_use') {
						currentToolCallId = parsed.content_block.id || '';
						currentToolName = parsed.content_block.name || '';
						currentToolArguments = '';
					}
				} else if (eventType === 'content_block_stop') {
					if (currentBlockType === 'tool_use' && currentToolCallId && currentToolName) {
						currentToolCalls.push({
							id: currentToolCallId,
							type: 'function',
							function: {
								name: currentToolName,
								arguments: currentToolArguments
							}
						});
						currentToolCallId = '';
						currentToolName = '';
						currentToolArguments = '';
					}
					currentBlockType = '';
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

async function executeWithToolsAnthropic(
	model: string,
	options: StreamOptions,
	initialFormatted: { system: string | undefined; messages: AnthropicMessage[] }
): Promise<{ content: string; toolCalls: ToolCall[] }> {
	let currentMessages = [...initialFormatted.messages];
	let accumulatedContent = '';
	let allToolCalls: ToolCall[] = [];
	let hasMoreToolCalls = true;
	let toolCallIteration = 0;
	const maxToolIterations = 5;

	while (hasMoreToolCalls && toolCallIteration < maxToolIterations) {
		console.log(`[API] Anthropic Tool iteration ${toolCallIteration + 1}, messages: ${currentMessages.length}`);

		const result = await sendRequestAnthropic(
			model,
			currentMessages,
			initialFormatted.system,
			true,
			(chunk) => {
				accumulatedContent += chunk;
				options.onChunk(chunk);
			}
		);

		accumulatedContent += result.content;

		if (result.toolCalls && result.toolCalls.length > 0) {
			console.log(`[API] Anthropic Tool calls detected (iteration ${toolCallIteration + 1}):`, result.toolCalls);

			allToolCalls = [...allToolCalls, ...result.toolCalls];
			await options.onToolCall?.(result.toolCalls);

			const toolResults = await executeToolCalls(result.toolCalls);
			await options.onToolResult?.(toolResults);

			const toolCallBlocks: AnthropicContentBlock[] = result.toolCalls.map(tc => ({
				type: 'tool_use' as const,
				id: tc.id,
				name: tc.function.name,
				input: JSON.parse(tc.function.arguments || '{}')
			}));

			if (result.content) {
				toolCallBlocks.unshift({ type: 'text', text: result.content });
			}

			const toolCallMessage: AnthropicMessage = {
				role: 'assistant',
				content: toolCallBlocks
			};

			const toolResultMessages: AnthropicMessage[] = toolResults.map(tr => ({
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
		const apiMode = await getApiMode();

		if (apiMode === 'anthropic') {
			const formatted = formatMessagesForAnthropic(options);

			if (options.toolsEnabled && !options.contextMessages && !options.toolResults) {
				const result = await executeWithToolsAnthropic(model, options, formatted);
				finalContent = result.content;
				finalToolCalls = result.toolCalls;
			} else {
				const result = await sendRequestAnthropic(
					model,
					formatted.messages,
					formatted.system,
					Boolean(options.toolsEnabled),
					options.onChunk
				);
				finalContent = result.content;
			}
		} else {
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
		}

		await options.onComplete?.(finalContent, finalToolCalls);

	} catch (error) {
		console.error('[API] Error:', error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		await options.onError?.(new Error(errorMessage));
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

export async function testConnectionWithCompletion(
	endpoint: string,
	apiKey: string,
	model: string,
	prompt: string = 'hi what can you do?'
): Promise<{ success: boolean; message: string; response?: string }> {
	const url = endpoint.replace(/\/$/, '') + '/chat/completions';

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model,
				messages: [{ role: 'user', content: prompt }],
				stream: false
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			return {
				success: false,
				message: `API Error: ${response.status} - ${errorText}`
			};
		}

		const data = await response.json();
		const content = data.choices?.[0]?.message?.content || 'No response content';

		return {
			success: true,
			message: 'Connection successful!',
			response: content
		};
	} catch (error) {
		return {
			success: false,
			message: error instanceof Error ? error.message : 'Connection failed'
		};
	}
}

export async function testConnectionAnthropic(
	endpoint: string,
	apiKey: string,
	model: string,
	prompt: string = 'hi what can you do?'
): Promise<{ success: boolean; message: string; response?: string }> {
	const url = endpoint.replace(/\/$/, '') + '/anthropic/v1/messages';

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model,
				max_tokens: 1024,
				messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
				stream: false
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			return {
				success: false,
				message: `API Error: ${response.status} - ${errorText}`
			};
		}

		const data = await response.json();
		const content = data.content?.[0]?.text || 'No response content';

		return {
			success: true,
			message: 'Connection successful!',
			response: content
		};
	} catch (error) {
		return {
			success: false,
			message: error instanceof Error ? error.message : 'Connection failed'
		};
	}
}
