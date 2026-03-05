import Dexie, { type Table } from 'dexie';

export interface Setting {
	key: string;
	value: string;
}

export interface SystemPrompt {
	id?: number;
	name: string;
	content: string;
	isDefault: boolean;
	createdAt: Date;
}

export interface Session {
	id?: number;
	title: string;
	systemPromptId: number | null;
	model: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface Message {
	id?: number;
	sessionId: number;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: Date;
}

export interface MCPTool {
	id?: number;
	name: string;
	type: 'javascript' | 'python';
	config: string;
}

export class LocalChatDB extends Dexie {
	settings!: Table<Setting>;
	systemPrompts!: Table<SystemPrompt>;
	sessions!: Table<Session>;
	messages!: Table<Message>;
	mcpTools!: Table<MCPTool>;

	constructor() {
		super('LocalChatDB');
		this.version(1).stores({
			settings: 'key, value',
			sessions: '++id, title, createdAt, updatedAt',
			messages: '++id, sessionId, role, timestamp',
			mcpTools: '++id, name, type, config'
		});
		this.version(2).stores({
			settings: 'key, value',
			systemPrompts: '++id, name, isDefault, createdAt',
			sessions: '++id, title, createdAt, updatedAt',
			messages: '++id, sessionId, role, timestamp',
			mcpTools: '++id, name, type, config'
		});
	}
}

export const db = new LocalChatDB();

export async function seedDatabase(): Promise<void> {
	const existingPrompts = await db.systemPrompts.count();
	if (existingPrompts > 0) return;

	const defaultPrompts: SystemPrompt[] = [
		{
			name: 'Default Assistant',
			content: 'You are a helpful assistant.',
			isDefault: true,
			createdAt: new Date()
		},
		{
			name: 'Code Reviewer',
			content: 'You are an expert code reviewer. Analyze code for bugs, security issues, and best practices. Provide constructive feedback with specific recommendations.',
			isDefault: false,
			createdAt: new Date()
		},
		{
			name: 'Translator',
			content: 'You are a professional translator. Translate text accurately while preserving meaning, tone, and nuance. If unsure about a translation, explain the alternatives.',
			isDefault: false,
			createdAt: new Date()
		},
		{
			name: 'Sales Manager',
			content: 'You are a Sales Manager at a retail clothing company. Your goal is to drive sales, understand customer needs, and recommend appropriate clothing items. Be professional, persuasive, and customer-focused. Ask clarifying questions about customer preferences, size, style, and budget to provide personalized recommendations. Always aim to close sales while ensuring customer satisfaction.',
			isDefault: false,
			createdAt: new Date()
		},
		{
			name: 'Marketing Manager',
			content: 'You are a Marketing Manager at a retail clothing company. Your goal is to develop marketing strategies, create compelling campaigns, and analyze market trends. Be creative, data-driven, and strategic. Provide insights on customer segmentation, brand positioning, promotional strategies, and market analysis. Help develop marketing plans that align with business objectives and drive customer engagement.',
			isDefault: false,
			createdAt: new Date()
		}
	];

	await db.systemPrompts.bulkAdd(defaultPrompts);
}
