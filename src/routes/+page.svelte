<script lang="ts">
	import { onMount } from 'svelte';
	import { chatStore } from '$lib/stores/chat.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { seedDatabase, hasApiKey } from '$lib/services';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ChatHeader from '$lib/components/ChatHeader.svelte';
	import MessageList from '$lib/components/MessageList.svelte';
	import ChatInput from '$lib/components/ChatInput.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';

	let settingsOpen = $state(false);
	let sidebarOpen = $state(false);
	let isInitialized = $state(false);

	onMount(async () => {
		themeStore.init();
		await seedDatabase();
		await chatStore.initialize();
		isInitialized = true;
	});

	function openSettings() {
		settingsOpen = true;
	}

	function closeSettings() {
		settingsOpen = false;
	}

	function openSidebar() {
		sidebarOpen = true;
	}

	function closeSidebar() {
		sidebarOpen = false;
	}
</script>

<div class="h-screen flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
	{#if isInitialized}
		<Sidebar {sidebarOpen} onClose={closeSidebar} onOpenSettings={openSettings} />
		<div class="flex-1 flex flex-col min-h-0">
			<ChatHeader onOpenSidebar={openSidebar} chatTitle={chatStore.currentSession?.title} />
			<MessageList />
			<ChatInput sidebarOpen={sidebarOpen} />
		</div>
		<SettingsModal isOpen={settingsOpen} onClose={closeSettings} />
	{:else}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<svg class="animate-spin h-10 w-10 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<p class="text-gray-500">Loading...</p>
			</div>
		</div>
	{/if}
</div>
