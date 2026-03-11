import { db, type Session, type Message, type SystemPrompt } from './db';

export interface ChatExport {
	version: number;
	exportedAt: string;
	sessions: Session[];
	messages: Message[];
	systemPrompts: SystemPrompt[];
}

export async function exportAllChats(): Promise<ChatExport> {
	const sessions = await db.sessions.toArray();
	const allMessages = await db.messages.toArray();
	const systemPrompts = await db.systemPrompts.toArray();

	const exportData: ChatExport = {
		version: 1,
		exportedAt: new Date().toISOString(),
		sessions: sessions.map(s => ({
			title: s.title,
			systemPromptId: s.systemPromptId,
			model: s.model,
			createdAt: s.createdAt,
			updatedAt: s.updatedAt
		})),
		messages: allMessages.map(m => ({
			sessionId: m.sessionId,
			role: m.role,
			content: m.content,
			timestamp: m.timestamp,
			tool_call_id: m.tool_call_id,
			tool_calls: m.tool_calls,
			tool_results: m.tool_results
		})),
		systemPrompts: systemPrompts.map(p => ({
			name: p.name,
			content: p.content,
			isDefault: p.isDefault,
			createdAt: p.createdAt
		}))
	};

	return exportData;
}

export async function exportChat(sessionId: number): Promise<ChatExport> {
	const session = await db.sessions.get(sessionId);
	if (!session) {
		throw new Error('Session not found');
	}

	const messages = await db.messages
		.where('sessionId')
		.equals(sessionId)
		.toArray();

	const exportData: ChatExport = {
		version: 1,
		exportedAt: new Date().toISOString(),
		sessions: [{
			title: session.title,
			systemPromptId: session.systemPromptId,
			model: session.model,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt
		}],
		messages: messages.map(m => ({
			sessionId: m.sessionId,
			role: m.role,
			content: m.content,
			timestamp: m.timestamp,
			tool_call_id: m.tool_call_id,
			tool_calls: m.tool_calls,
			tool_results: m.tool_results
		})),
		systemPrompts: []
	};

	return exportData;
}

export async function importChat(
	data: ChatExport,
	options: { merge?: boolean; importPrompts?: boolean } = {}
): Promise<number[]> {
	const { merge = false, importPrompts = false } = options;

	if (!data.version || !data.sessions || !data.messages) {
		throw new Error('Invalid import file format');
	}

	const importedSessionIds: number[] = [];

		await db.transaction('rw', [db.sessions, db.messages, db.systemPrompts], async () => {
		const sessionIdMap: Record<number, number> = {};

		if (importPrompts && data.systemPrompts && data.systemPrompts.length > 0) {
			const existingPrompts = await db.systemPrompts.toArray();
			const promptNameSet = new Set(existingPrompts.map(p => p.name.toLowerCase()));

			for (const prompt of data.systemPrompts) {
				if (!promptNameSet.has(prompt.name.toLowerCase())) {
					await db.systemPrompts.add({
						name: prompt.name,
						content: prompt.content,
						isDefault: false,
						createdAt: new Date(prompt.createdAt)
					});
				}
			}
		}

		for (let i = 0; i < data.sessions.length; i++) {
			const session = data.sessions[i];
			const originalSessionId = i;
			let targetSessionId: number;

			if (merge) {
				const existingSession = await db.sessions
					.where('title')
					.equals(session.title)
					.first();

				if (existingSession) {
					targetSessionId = existingSession.id!;
					await db.sessions.update(targetSessionId, {
						updatedAt: new Date()
					});
				} else {
					targetSessionId = await db.sessions.add({
						title: session.title,
						systemPromptId: session.systemPromptId,
						model: session.model,
						createdAt: new Date(session.createdAt),
						updatedAt: new Date()
					});
				}
			} else {
				targetSessionId = await db.sessions.add({
					title: session.title,
					systemPromptId: session.systemPromptId,
					model: session.model,
					createdAt: new Date(session.createdAt),
					updatedAt: new Date()
				});
			}

			sessionIdMap[originalSessionId] = targetSessionId;
			importedSessionIds.push(targetSessionId);
		}

		const sessionMessageMap: Record<number, Message[]> = {};
		for (const msg of data.messages) {
			const originalSessionIdx = msg.sessionId;
			if (sessionIdMap[originalSessionIdx] !== undefined) {
				const newSessionId = sessionIdMap[originalSessionIdx];
				if (!sessionMessageMap[newSessionId]) {
					sessionMessageMap[newSessionId] = [];
				}
				sessionMessageMap[newSessionId].push({
					sessionId: newSessionId,
					role: msg.role,
					content: msg.content,
					timestamp: new Date(msg.timestamp),
					tool_call_id: msg.tool_call_id,
					tool_calls: msg.tool_calls,
					tool_results: msg.tool_results
				});
			}
		}

		for (const [sessionId, messages] of Object.entries(sessionMessageMap)) {
			await db.messages.bulkAdd(messages);
		}
	});

	return importedSessionIds;
}

export function downloadExport(data: ChatExport, filename?: string): void {
	const jsonStr = JSON.stringify(data, null, 2);
	const blob = new Blob([jsonStr], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	
	const a = document.createElement('a');
	a.href = url;
	a.download = filename || `localchat-export-${new Date().toISOString().split('T')[0]}.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

export async function readImportFile(file: File): Promise<ChatExport> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		
		reader.onload = (e) => {
			try {
				const content = e.target?.result as string;
				const data = JSON.parse(content) as ChatExport;
				
				if (!data.sessions || !data.messages) {
					reject(new Error('Invalid file format: missing sessions or messages'));
					return;
				}
				
				resolve(data);
			} catch (err) {
				reject(new Error('Failed to parse JSON file'));
			}
		};
		
		reader.onerror = () => reject(new Error('Failed to read file'));
		reader.readAsText(file);
	});
}
