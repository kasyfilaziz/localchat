import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { messages, apiKey, endpoint, model, systemPrompt } = await request.json();

		if (!apiKey || !endpoint) {
			return json({ error: 'API key and endpoint are required' }, { status: 400 });
		}

		console.log('[MiniMax Proxy] Using endpoint:', endpoint);
		console.log('[MiniMax Proxy] Using model:', model || 'MiniMax-M2');

		// Build the URL - MiniMax uses /v1/chat/completions
		const baseURL = endpoint.replace(/\/$/, '');
		const url = `${baseURL}/chat/completions`;

		// Build messages - MiniMax format
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

		// Only send supported parameters for MiniMax
		const requestBody: Record<string, unknown> = {
			model: model || 'MiniMax-M2',
			messages: formattedMessages,
			stream: true
		};

		console.log('[MiniMax Proxy] Request body:', JSON.stringify(requestBody));

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
			console.error('[MiniMax Proxy] HTTP Error:', response.status, errorText);
			return json({ 
				error: `MiniMax API Error: ${response.status}`,
				details: errorText
			}, { status: response.status });
		}

		if (!response.body) {
			return json({ error: 'No response body' }, { status: 500 });
		}

		// Stream the response
		return new Response(response.body, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive'
			}
		});

	} catch (error) {
		console.error('[MiniMax Proxy] Error:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: errorMessage }, { status: 500 });
	}
};
