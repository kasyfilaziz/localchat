<script lang="ts">
	import type { Message } from '$lib/services/db';
	import { renderMarkdown } from '$lib/utils/markdown';
	import type { ToolCall, ToolCallResult } from '$lib/tools';

	interface Props {
		message: Message;
		isStreaming?: boolean;
	}

	let { message, isStreaming = false }: Props = $props();

	let toolCallsExpanded = $state(false);
	let toolResultsExpanded = $state(true);

	function formatTime(date: Date): string {
		return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function parseToolCalls(): ToolCall[] {
		if (!message.tool_calls) return [];
		try {
			return JSON.parse(message.tool_calls);
		} catch {
			return [];
		}
	}

	function parseToolResults(): ToolCallResult[] {
		if (!message.tool_results) return [];
		try {
			return JSON.parse(message.tool_results);
		} catch {
			return [];
		}
	}

	const toolCalls = $derived(parseToolCalls());
	const toolResults = $derived(parseToolResults());
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
			{#if toolCalls.length > 0}
				<button
					class="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg mb-2 w-full text-left border border-gray-200 dark:border-gray-700"
					onclick={() => toolCallsExpanded = !toolCallsExpanded}
				>
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
							🔧 Tools Called ({toolCalls.length})
						</span>
						<svg 
							class="w-4 h-4 text-gray-500 transition-transform {toolCallsExpanded ? 'rotate-180' : ''}" 
							fill="none" stroke="currentColor" viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</div>
					{#if toolCallsExpanded}
						<div class="mt-2 space-y-2">
							{#each toolCalls as tc}
								<div class="text-xs bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700">
									<p class="font-semibold text-blue-600 dark:text-blue-400">{tc.function.name}</p>
									{#if tc.function.arguments}
										<p class="text-gray-600 dark:text-gray-400 font-mono text-xs mt-1 whitespace-pre-wrap">{tc.function.arguments}</p>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</button>
			{/if}

			{#if toolResults.length > 0}
				<button
					class="px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg mb-2 w-full text-left border border-green-200 dark:border-green-800"
					onclick={() => toolResultsExpanded = !toolResultsExpanded}
				>
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-green-700 dark:text-green-400">
							📥 Tool Results ({toolResults.length})
						</span>
						<svg 
							class="w-4 h-4 text-green-600 transition-transform {toolResultsExpanded ? 'rotate-180' : ''}" 
							fill="none" stroke="currentColor" viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</div>
					{#if toolResultsExpanded}
						<div class="mt-2 space-y-2">
							{#each toolResults as tr}
								{@const result = JSON.parse(tr.output)}
								<div class="text-xs bg-white dark:bg-gray-900 p-2 rounded border border-green-200 dark:border-green-800">
									<p class="font-semibold text-green-700 dark:text-green-400">{result.success ? '✓ Success' : '✗ Error'}</p>
									<p class="text-gray-600 dark:text-gray-400 font-mono text-xs mt-1 whitespace-pre-wrap max-h-32 overflow-y-auto">
										{result.result || result.error || tr.output}
									</p>
								</div>
							{/each}
						</div>
					{/if}
				</button>
			{/if}

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
