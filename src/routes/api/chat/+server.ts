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
		console.log('[Vercel SDK] Using model:', model || 'llama3');

		const provider = createOpenAICompatible({
			name: 'custom',
			baseURL: endpoint,
			apiKey
		});

		const formattedMessages: { role: string; content: string }[] = [];
		
		if (systemPrompt) {
			formattedMessages.push({ role: 'system', content: systemPrompt });
		}
		
		for (const msg of messages) {
			formattedMessages.push({
				role: msg.role,
				content: msg.content
			});
		}

		const result = streamText({
			model: provider(model || 'llama3') as any,
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
		return json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
	}
};
