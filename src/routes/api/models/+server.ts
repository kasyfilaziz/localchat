import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { apiKey, endpoint } = await request.json();

		if (!apiKey || !endpoint) {
			return json({ error: 'API key and endpoint are required' }, { status: 400 });
		}

		const url = endpoint.replace(/\/$/, '') + '/models';

		const response = await fetch(url, {
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			const errorText = await response.text();
			return json({ error: `Failed to fetch models: ${response.status} ${errorText}` }, { status: response.status });
		}

		const data = await response.json();
		
		let models: string[] = [];
		
		if (data.data && Array.isArray(data.data)) {
			models = data.data.map((m: any) => m.id).filter((id: string) => typeof id === 'string');
		} else if (data.models && Array.isArray(data.models)) {
			models = data.models.map((m: any) => m.name || m.id).filter((id: string) => typeof id === 'string');
		}

		return json({ models });

	} catch (error) {
		console.error('[API Models Proxy] Error:', error);
		return json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
	}
};
