<script lang="ts">
	import type { Message } from '$lib/services/db';
	import { renderMarkdown } from '$lib/utils/markdown';

	interface Props {
		message: Message;
		isStreaming?: boolean;
	}

	let { message, isStreaming = false }: Props = $props();

	function formatTime(date: Date): string {
		return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'} mb-3">
	<div class="flex max-w-[85%] {message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-2">
		<div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-auto
			{message.role === 'user' ? 'bg-blue-500' : 'bg-gray-500'}">
			{#if message.role === 'user'}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
				</svg>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
					<path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12zm-1-5a1 1 0 112 0 1 1 0 01-2 0zm3-1a1 1 0 100 2 1 1 0 000-2z" />
				</svg>
			{/if}
		</div>

		<div class="flex flex-col {message.role === 'user' ? 'items-end' : 'items-start'}">
			<div class="px-4 py-2 max-w-full break-words prose prose-sm
				{message.role === 'user' ? 'bg-blue-500 text-white rounded' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded'}">
				{#if message.role === 'assistant'}
					<div class="markdown-content">
						{@html renderMarkdown(message.content)}
					</div>
				{:else}
					{message.content}
				{/if}
				{#if isStreaming}
					<span class="inline-block w-2 h-4 bg-gray-600 animate-pulse ml-0.5"></span>
				{/if}
			</div>
			<span class="text-xs text-gray-400 dark:text-gray-500 mt-1 px-1">
				{formatTime(message.timestamp)}
			</span>
		</div>
	</div>
</div>
