<script lang="ts">
	import { chatStore } from '$lib/stores/chat.svelte';

	interface Props {
		onOpenSidebar: () => void;
		chatTitle?: string;
	}

	let { onOpenSidebar, chatTitle }: Props = $props();

	let isEditing = $state(false);
	let editValue = $state('');
	let inputRef: HTMLInputElement;

	function startEdit() {
		if (!chatTitle) return;
		editValue = chatTitle;
		isEditing = true;
		setTimeout(() => {
			inputRef?.select();
		}, 0);
	}

	async function saveEdit() {
		if (editValue.trim() && editValue.trim() !== chatTitle) {
			await chatStore.updateSessionTitle(editValue.trim());
		}
		isEditing = false;
	}

	function cancelEdit() {
		isEditing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			saveEdit();
		} else if (e.key === 'Escape') {
			cancelEdit();
		}
	}
</script>

<header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-3 flex items-center">
	<button
		onclick={onOpenSidebar}
		class="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
		aria-label="Open menu"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
		</svg>
	</button>
	
	{#if isEditing}
		<input
			bind:this={inputRef}
			bind:value={editValue}
			onkeydown={handleKeydown}
			onblur={saveEdit}
			class="flex-1 ml-2 px-2 py-1 text-lg font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
		/>
	{:else if chatTitle}
		<button
			onclick={startEdit}
			class="flex items-center ml-2 px-2 py-1 text-lg font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors max-w-[200px]"
		>
			<span class="truncate">{chatTitle}</span>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
			</svg>
		</button>
	{:else}
		<h1 class="text-lg font-semibold text-gray-800 dark:text-gray-100 ml-2">LocalChat</h1>
	{/if}
</header>
