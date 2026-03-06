import { db, type SystemPrompt } from './db';
import { encrypt, decrypt, type EncryptedData } from './crypto';

const MASTER_PASSWORD = 'localchat-app-key';

export async function saveApiKey(apiKey: string): Promise<void> {
	const encrypted = await encrypt(apiKey, MASTER_PASSWORD);
	await db.settings.put({
		key: 'apiKey',
		value: JSON.stringify(encrypted)
	});
}

export async function getApiKey(): Promise<string | null> {
	const record = await db.settings.get('apiKey');
	if (!record) return null;

	const encrypted: EncryptedData = JSON.parse(record.value);
	return await decrypt(encrypted, MASTER_PASSWORD);
}

export async function saveApiEndpoint(endpoint: string): Promise<void> {
	await db.settings.put({
		key: 'apiEndpoint',
		value: endpoint
	});
}

export async function getApiEndpoint(): Promise<string> {
	const record = await db.settings.get('apiEndpoint');
	return record?.value || 'https://api.minimax.io/v1';
}

export async function hasApiKey(): Promise<boolean> {
	const record = await db.settings.get('apiKey');
	return !!record;
}

export async function saveSelectedModel(model: string): Promise<void> {
	await db.settings.put({
		key: 'selectedModel',
		value: model
	});
}

export async function getSelectedModel(): Promise<string> {
	const record = await db.settings.get('selectedModel');
	return record?.value || 'MiniMax-M2.5';
}

export async function saveDefaultModel(model: string): Promise<void> {
	await db.settings.put({
		key: 'defaultModel',
		value: model
	});
}

export async function getDefaultModel(): Promise<string> {
	const record = await db.settings.get('defaultModel');
	return record?.value || 'MiniMax-M2.5';
}

export async function saveSelectedPromptId(promptId: number | null): Promise<void> {
	await db.settings.put({
		key: 'selectedPromptId',
		value: promptId?.toString() || ''
	});
}

export async function getSelectedPromptId(): Promise<number | null> {
	const record = await db.settings.get('selectedPromptId');
	if (!record?.value) return null;
	const id = parseInt(record.value, 10);
	return isNaN(id) ? null : id;
}

export async function getSystemPrompts(): Promise<SystemPrompt[]> {
	return await db.systemPrompts.orderBy('createdAt').toArray();
}

export async function getSystemPrompt(id: number): Promise<SystemPrompt | undefined> {
	return await db.systemPrompts.get(id);
}

export async function getDefaultSystemPrompt(): Promise<SystemPrompt | undefined> {
	const prompts = await db.systemPrompts.toArray();
	return prompts.find(p => p.isDefault === true);
}

export async function createSystemPrompt(prompt: Omit<SystemPrompt, 'id' | 'createdAt'>): Promise<number> {
	return await db.systemPrompts.add({
		...prompt,
		createdAt: new Date()
	});
}

export async function updateSystemPrompt(id: number, updates: Partial<SystemPrompt>): Promise<void> {
	await db.systemPrompts.update(id, updates);
}

export async function deleteSystemPrompt(id: number): Promise<void> {
	await db.systemPrompts.delete(id);
}

export async function setDefaultSystemPrompt(id: number): Promise<void> {
	await db.systemPrompts.toCollection().modify({ isDefault: false });
	await db.systemPrompts.update(id, { isDefault: true });
}

export type ApiMethod = 'sdk' | 'custom';

export async function saveApiMethod(method: ApiMethod): Promise<void> {
	await db.settings.put({
		key: 'apiMethod',
		value: method
	});
}

export async function getApiMethod(): Promise<ApiMethod> {
	const record = await db.settings.get('apiMethod');
	return (record?.value as ApiMethod) || 'custom';
}
