import { streamText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { getApiKey, getApiEndpoint, getApiMethod } from './settings';
import { type Message } from './db';

export interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export interface StreamOptions {
	messages: Message[];
	systemPrompt?: string;
	onChunk: (text: string) => void;
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
		formatted.push({
			role: msg.role,
			content: msg.content
		});
	}

	return formatted;
}

async function sendWithSDK(
	model: string,
	options: StreamOptions
): Promise<void> {
	const apiKey = await getApiKey();
	const endpoint = await getApiEndpoint();

	if (!apiKey) {
		throw new Error('API key not configured');
	}

	console.log('[SDK] Sending request:', { model, endpoint });

	const provider = createOpenAICompatible({
		name: 'custom',
		baseURL: endpoint,
		apiKey
	});

	const formattedMessages = formatMessages(options);

	try {
		const result = streamText({
			model: provider(model) as any,
			messages: formattedMessages as any,
			onError({ error }) {
				console.error('[SDK] Error:', error);
				options.onError?.(error instanceof Error ? error : new Error(String(error)));
			}
		});

		for await (const chunk of result.textStream) {
			options.onChunk(chunk);
		}

		await options.onComplete?.();
		console.log('[SDK] Stream completed');
	} catch (error) {
		console.error('[SDK] Catch error:', error);
		await options.onError?.(error instanceof Error ? error : new Error(String(error)));
	}
}

async function sendWithCustomFetch(
	model: string,
	options: StreamOptions
): Promise<void> {
	const apiKey = await getApiKey();
	const endpoint = await getApiEndpoint();

	if (!apiKey) {
		throw new Error('API key not configured');
	}

	const formattedMessages = formatMessages(options);
	const url = endpoint.replace(/\/$/, '') + '/chat/completions';

	console.log('[CustomFetch] Sending request:', { model, url });

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model,
				messages: formattedMessages,
				stream: true
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[CustomFetch] HTTP Error:', response.status, errorText);
			throw new Error(`API Error: ${response.status} - ${errorText}`);
		}

		if (!response.body) {
			throw new Error('No response body');
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		console.log('[CustomFetch] Reading stream...');

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
					console.log('[CustomFetch] Stream done');
					await options.onComplete?.();
					return;
				}

				try {
					const parsed = JSON.parse(data);
					const content = parsed.choices?.[0]?.delta?.content;
					const reasoning = parsed.choices?.[0]?.delta?.reasoning_content || parsed.choices?.[0]?.delta?.reasoning;
					if (content) {
						options.onChunk(content);
					}
					if (reasoning) {
						options.onChunk(reasoning);
					}
				} catch (e) {
					// Skip malformed JSON
				}
			}
		}

		await options.onComplete?.();
		console.log('[CustomFetch] Stream completed');
	} catch (error) {
		console.error('[CustomFetch] Error:', error);
		await options.onError?.(error instanceof Error ? error : new Error(String(error)));
	}
}

export async function sendMessage(
	model: string,
	options: StreamOptions
): Promise<void> {
	const method = await getApiMethod();
	console.log('[API] Using method:', method);

	if (method === 'custom') {
		return sendWithCustomFetch(model, options);
	}

	return sendWithSDK(model, options);
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
			return data.models.map((m: any) => m.name || m.id).filter((id: string) => typeof id === 'string');
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
