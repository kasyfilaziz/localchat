<script lang="ts">
	import { chatStore } from '$lib/stores/chat.svelte';

	let inputValue = $state('');
	let textareaRef: HTMLTextAreaElement;

	async function handleSubmit() {
		if (!inputValue.trim() || chatStore.isLoading || !chatStore.currentSession) return;
		const content = inputValue;
		inputValue = '';
		await chatStore.sendMessage(content);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}

	function adjustTextareaHeight() {
		if (textareaRef) {
			textareaRef.style.height = 'auto';
			textareaRef.style.height = Math.min(textareaRef.scrollHeight, 200) + 'px';
		}
	}

	$effect(() => {
		inputValue;
		adjustTextareaHeight();
	});
</script>

<div class="fixed bottom-6 left-4 right-4 z-50">
	<div class="max-w-4xl mx-auto">
		<div class="flex gap-2 items-end rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
			<div class="flex-1 relative">
				<textarea
					bind:this={textareaRef}
					bind:value={inputValue}
					onkeydown={handleKeydown}
					placeholder="{chatStore.currentSession ? 'Type a message...' : 'Select or create a chat to start...'}"
					disabled={!chatStore.currentSession || chatStore.isLoading}
					rows="1"
					class="w-full px-4 py-3 bg-transparent border-0 text-gray-900 dark:text-gray-100 resize-none focus:outline-none disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:text-gray-400 text-base"
				></textarea>
			</div>

			<button
				onclick={handleSubmit}
				disabled={!inputValue.trim() || chatStore.isLoading || !chatStore.currentSession}
				class="p-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl transition-colors"
				aria-label="Send message"
			>
				{#if chatStore.isLoading}
					<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
						<path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
					</svg>
				{/if}
			</button>
		</div>
		
		<p class="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
			Enter to send, Shift+Enter for new line
		</p>
	</div>
</div>
