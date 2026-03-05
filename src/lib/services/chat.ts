import { db, type Session, type Message } from './db';
import { getDefaultSystemPrompt, getSelectedPromptId } from './settings';

export async function getSessions(): Promise<Session[]> {
	return await db.sessions.orderBy('updatedAt').reverse().toArray();
}

export async function getSession(id: number): Promise<Session | undefined> {
	return await db.sessions.get(id);
}

export async function createSession(
	title: string = 'New Chat',
	model: string = 'llama3',
	systemPromptId: number | null = null
): Promise<number> {
	const now = new Date();
	const sessionId = await db.sessions.add({
		title,
		model,
		systemPromptId,
		createdAt: now,
		updatedAt: now
	});
	return sessionId;
}

export async function updateSession(
	id: number,
	updates: Partial<Pick<Session, 'title' | 'model' | 'systemPromptId'>>
): Promise<void> {
	await db.sessions.update(id, {
		...updates,
		updatedAt: new Date()
	});
}

export async function deleteSession(id: number): Promise<void> {
	await db.transaction('rw', [db.sessions, db.messages], async () => {
		try {
			await db.messages.where('sessionId').equals(id).delete();
			await db.sessions.delete(id);
		} catch (error) {
			console.error('Failed to delete session:', error);
			throw error;
		}
	});
}

export async function getSessionMessages(sessionId: number): Promise<Message[]> {
	return await db.messages
		.where('sessionId')
		.equals(sessionId)
		.sortBy('timestamp');
}

export async function addMessage(
	sessionId: number,
	role: Message['role'],
	content: string
): Promise<number> {
	const id = await db.messages.add({
		sessionId,
		role,
		content,
		timestamp: new Date()
	});

	await db.sessions.update(sessionId, {
		updatedAt: new Date()
	});

	return id;
}

export async function updateSessionTitle(sessionId: number, title: string): Promise<void> {
	await db.sessions.update(sessionId, {
		title,
		updatedAt: new Date()
	});
}

export async function updateMessage(id: number, content: string): Promise<void> {
	await db.messages.update(id, { content });
}

export function generateTitleFromMessage(content: string): string {
	const firstLine = content.split('\n')[0].trim();
	if (firstLine.length <= 50) {
		return firstLine || 'New Chat';
	}
	return firstLine.substring(0, 47) + '...';
}
