import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { messages, apiKey, endpoint, model, systemPrompt } = await request.json();

		if (!apiKey || !endpoint) {
			return json({ error: 'API key and endpoint are required' }, { status: 400 });
		}

		const url = endpoint.replace(/\/$/, '') + '/chat/completions';

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

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: model || 'llama3',
				messages: formattedMessages,
				stream: true
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			return json({ error: `API Error: ${response.status} - ${errorText}` }, { status: response.status });
		}

		if (!response.body) {
			return json({ error: 'No response body' }, { status: 500 });
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();

		const stream = new ReadableStream({
			async start(controller) {
				let buffer = '';

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
							controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
							controller.close();
							return;
						}

						try {
							const parsed = JSON.parse(data);
							const content = parsed.choices?.[0]?.delta?.content;
							const reasoning = parsed.choices?.[0]?.delta?.reasoning_content || parsed.choices?.[0]?.delta?.reasoning;
							
							let output = '';
							if (content) output += `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
							if (reasoning) output += `data: ${JSON.stringify({ choices: [{ delta: { content: reasoning } }] })}\n\n`;
							
							if (output) {
								controller.enqueue(new TextEncoder().encode(output));
							}
						} catch (e) {
							// Skip malformed JSON
						}
					}
				}

				controller.close();
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive'
			}
		});

	} catch (error) {
		console.error('[API Proxy] Error:', error);
		return json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
	}
};
