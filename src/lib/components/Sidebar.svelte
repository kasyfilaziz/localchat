<script lang="ts">
	import { chatStore } from '$lib/stores/chat.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { fetchModels } from '$lib/services/api';
	import { getApiKey, getApiEndpoint } from '$lib/services/settings';

	interface Props {
		sidebarOpen?: boolean;
		onClose?: () => void;
		onOpenSettings: () => void;
	}

	let { sidebarOpen = false, onClose, onOpenSettings }: Props = $props();

	let isFetchingModels = $state(false);

	function formatDate(date: Date): string {
		const now = new Date();
		const diff = now.getTime() - new Date(date).getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		
		if (days === 0) return 'Today';
		if (days === 1) return 'Yesterday';
		if (days < 7) return `${days} days ago`;
		return new Date(date).toLocaleDateString();
	}

	async function handleNewChat() {
		await chatStore.createNewSession();
		onClose?.();
	}

	async function handleSelectSession(id: number) {
		await chatStore.selectSession(id);
		onClose?.();
	}

	async function handleDeleteSession(e: Event, id: number) {
		e.stopPropagation();
		if (confirm('Yakin ingin menghapus chat ini?')) {
			await chatStore.deleteSession(id);
		}
	}

	async function handleRenameSession(e: Event, id: number) {
		e.stopPropagation();
		const session = chatStore.sessions.find(s => s.id === id);
		if (!session) return;
		
		const newTitle = prompt('Masukkan nama baru untuk chat:', session.title);
		if (newTitle && newTitle.trim() && newTitle.trim() !== session.title) {
			await chatStore.updateSessionTitle(newTitle.trim());
		}
	}

	function handleBackdropClick() {
		onClose?.();
	}

	async function handleModelChange(e: Event) {
		const select = e.target as HTMLSelectElement;
		await chatStore.updateSessionModel(select.value);
	}

	async function handlePromptChange(e: Event) {
		const select = e.target as HTMLSelectElement;
		const value = select.value;
		const promptId = value ? parseInt(value, 10) : null;
		await chatStore.updateSessionPrompt(promptId);
	}

	async function refreshModels() {
		isFetchingModels = true;
		try {
			const apiKey = await getApiKey();
			const endpoint = await getApiEndpoint();
			if (apiKey) {
				const models = await fetchModels(endpoint, apiKey);
				chatStore.availableModels = models;
			}
		} catch (e) {
			console.error('Failed to fetch models:', e);
		}
		isFetchingModels = false;
	}

	function getSelectedPromptName(): string {
		if (!chatStore.selectedPromptId) return 'Default';
		const prompt = chatStore.systemPrompts.find(p => p.id === chatStore.selectedPromptId);
		return prompt?.name || 'Default';
	}
</script>

{#if sidebarOpen}
	<div 
		class="fixed inset-0 bg-black/50 z-40 transition-opacity"
		onclick={handleBackdropClick}
		onkeydown={(e) => e.key === 'Escape' && handleBackdropClick()}
		role="button"
		tabindex="0"
		aria-label="Close sidebar"
	></div>
{/if}

<aside 
	class="fixed top-0 left-0 h-full w-72 bg-gray-900 text-white flex flex-col z-50 transform transition-transform duration-300 ease-in-out
		{sidebarOpen ? 'translate-x-0' : '-translate-x-full'}"
>
	<!-- Header / Title -->
	<div class="p-4 border-b border-gray-700">
		<h1 class="text-lg font-semibold">LocalChat</h1>
	</div>

	<!-- Model Selection -->
	<div class="p-3 border-b border-gray-700">
		<label for="model-select" class="text-xs text-gray-400 block mb-1">Model</label>
		<div class="relative">
			<select
				id="model-select"
				value={chatStore.selectedModel}
				onchange={handleModelChange}
				class="w-full bg-gray-800 text-white text-sm px-3 py-2 pr-8 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				{#if chatStore.availableModels.length > 0}
					{#each chatStore.availableModels as model}
						<option value={model}>{model}</option>
					{/each}
				{/if}
				<option value={chatStore.selectedModel}>{chatStore.selectedModel}</option>
			</select>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
			</svg>
		</div>
		<button
			onclick={refreshModels}
			disabled={isFetchingModels}
			class="text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors"
		>
			{isFetchingModels ? 'Loading...' : '↻ Refresh Models'}
		</button>
	</div>

	<!-- System Prompt Selection -->
	<div class="p-3 border-b border-gray-700">
		<label for="prompt-select" class="text-xs text-gray-400 block mb-1">System Prompt</label>
		<div class="relative">
			<select
				id="prompt-select"
				value={chatStore.selectedPromptId?.toString() || ''}
				onchange={handlePromptChange}
				class="w-full bg-gray-800 text-white text-sm px-3 py-2 pr-8 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				<option value="">Default</option>
				{#each chatStore.systemPrompts as prompt}
					<option value={prompt.id?.toString()}>
						{prompt.name}{prompt.isDefault ? ' (default)' : ''}
					</option>
				{/each}
			</select>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
			</svg>
		</div>
	</div>

	<!-- New Chat Button -->
	<div class="p-3 border-b border-gray-700">
		<button
			onclick={handleNewChat}
			class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
			</svg>
			New Chat
		</button>
	</div>

	<!-- Chat History -->
	<div class="flex-1 overflow-y-auto">
		<div class="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-2">
			Chat History
		</div>
		
		{#each chatStore.sessions as session (session.id)}
			<div
				role="button"
				tabindex="0"
				onclick={() => handleSelectSession(session.id!)}
				onkeydown={(e) => e.key === 'Enter' && handleSelectSession(session.id!)}
				class="flex items-center justify-between px-3 py-3 mb-1 transition-colors cursor-pointer
					{chatStore.currentSession?.id === session.id ? 'bg-gray-800' : 'hover:bg-gray-800'}"
			>
				<div class="flex-1 min-w-0 mr-2">
					<div class="font-medium truncate">
						{session.title}
					</div>
					<div class="text-xs text-gray-400">
						{formatDate(session.updatedAt)}
					</div>
				</div>
				<div class="flex gap-1 ml-2">
					<button
						onclick={(e) => handleRenameSession(e, session.id!)}
						class="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded transition-colors flex-shrink-0"
						title="Rename chat"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
						</svg>
					</button>
					<button
						onclick={(e) => handleDeleteSession(e, session.id!)}
						class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
						title="Delete chat"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
						</svg>
					</button>
				</div>
			</div>
		{/each}

		{#if chatStore.sessions.length === 0}
			<div class="text-center text-gray-500 py-8 text-sm px-3">
				No chats yet. Start a new conversation!
			</div>
		{/if}
	</div>

	<!-- Dark Mode Toggle -->
	<div class="p-3 border-b border-gray-700">
		<button
			onclick={() => themeStore.toggle()}
			class="w-full flex items-center gap-3 px-3 py-2.5 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
		>
			{#if $themeStore}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
				</svg>
				<span>Light Mode</span>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
				</svg>
				<span>Dark Mode</span>
			{/if}
		</button>
	</div>

	<!-- Settings Button -->
	<div class="p-3 border-t border-gray-700">
		<button
			onclick={onOpenSettings}
			class="w-full flex items-center gap-3 px-3 py-2.5 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
			<span>Settings</span>
		</button>
	</div>
</aside>
