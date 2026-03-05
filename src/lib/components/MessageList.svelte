<script lang="ts">
	import { chatStore } from '$lib/stores/chat.svelte';
	import MessageBubble from './MessageBubble.svelte';

	let messagesContainer: HTMLDivElement;

	$effect(() => {
		if (chatStore.messages.length || chatStore.streamingContent) {
			setTimeout(() => {
				if (messagesContainer) {
					messagesContainer.scrollTop = messagesContainer.scrollHeight;
				}
			}, 10);
		}
	});
</script>

<div bind:this={messagesContainer} class="flex-1 overflow-y-auto p-3 bg-white dark:bg-gray-900">
	{#if !chatStore.currentSession}
		<div class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
			<div class="text-center px-4">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-14 w-14 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
				</svg>
				<p class="text-base">Select a chat or start a new conversation</p>
				<p class="text-sm mt-2">Click the menu icon to see your chats</p>
			</div>
		</div>
	{:else if chatStore.messages.length === 0 && !chatStore.streamingContent}
		<div class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
			<div class="text-center px-4">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-14 w-14 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M13 10V3L4 14h7v7l9-11h-7z" />
				</svg>
				<p class="text-base">Start a new conversation</p>
				<p class="text-sm mt-2">Send a message to begin chatting with AI</p>
			</div>
		</div>
	{:else}
		{#each chatStore.messages as message (message.id)}
			<MessageBubble {message} />
		{/each}

		{#if chatStore.streamingContent}
			<MessageBubble
				message={{
					id: -1,
					sessionId: chatStore.currentSession.id!,
					role: 'assistant',
					content: chatStore.streamingContent,
					timestamp: new Date()
				}}
				isStreaming={true}
			/>
		{/if}

		{#if chatStore.error}
			<div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4">
				<p class="font-medium">Error</p>
				<p class="text-sm">{chatStore.error}</p>
			</div>
		{/if}
	{/if}
</div>
