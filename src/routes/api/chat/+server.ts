import { streamText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { messages, apiKey, endpoint, model, systemPrompt } = await request.json();

		if (!apiKey || !endpoint) {
			return json({ error: 'API key and endpoint are required' }, { status: 400 });
		}

		console.log('[Vercel SDK] Using endpoint:', endpoint);
		console.log('[Vercel SDK] Using model:', model || 'MiniMax-M2.5');

		// Determine the correct baseURL based on the provider
		let baseURL = endpoint.replace(/\/$/, '');

		const provider = createOpenAICompatible({
			name: 'custom',
			baseURL: baseURL,
			apiKey
		});

		const formattedMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
		
		if (systemPrompt) {
			formattedMessages.push({ role: 'system', content: systemPrompt });
		}
		
		for (const msg of messages) {
			formattedMessages.push({
				role: msg.role as 'system' | 'user' | 'assistant',
				content: msg.content
			});
		}

		const modelName = model || 'MiniMax-M2.5';

		const result = streamText({
			model: provider(modelName) as any,
			messages: formattedMessages as any
		});

		return new Response(result.toTextStreamResponse().body, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive'
			}
		});

	} catch (error) {
		console.error('[Vercel SDK] Error:', error);
		
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		
		if (errorMessage.includes('invalid params')) {
			return json({ 
				error: 'MiniMax API Error: invalid parameters. Please check your model name and settings.',
				details: errorMessage
			}, { status: 400 });
		}
		
		return json({ error: errorMessage }, { status: 500 });
	}
};
