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

<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4">
	<div class="max-w-[85%] {message.role === 'user' ? 'text-right' : 'text-left'}">
		{#if message.role === 'assistant'}
			<div class="markdown-content mb-1">
				{@html renderMarkdown(message.content)}
			</div>

			{#if toolCalls.length > 0}
				<div class="mt-2 space-y-1">
					{#each toolCalls as tc}
						<div class="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono">
							<span class="text-blue-600 dark:text-blue-400">🔧</span>
							<span class="text-gray-700 dark:text-gray-300">{tc.function.name}</span>
							{#if tc.function.arguments}
								<span class="text-gray-500 dark:text-gray-400">({tc.function.arguments})</span>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			{#if toolResults.length > 0}
				<div class="mt-2 space-y-1">
					{#each toolResults as tr}
						{@const result = JSON.parse(tr.output)}
						<div class="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm">
							<span class="text-green-600 dark:text-green-400">{result.success ? '✓' : '✗'}</span>
							<span class="text-gray-600 dark:text-gray-400 font-mono text-xs">
								{result.result || result.error || tr.output}
							</span>
						</div>
					{/each}
				</div>
			{/if}

			{#if isStreaming}
				<span class="inline-block w-2 h-4 bg-gray-600 animate-pulse ml-0.5"></span>
			{/if}
		{:else}
			<span class="text-gray-900 dark:text-gray-100">
				{message.content}
			</span>
		{/if}
		
		<span class="text-xs text-gray-400 dark:text-gray-500 mt-1 block">
			{formatTime(message.timestamp)}
		</span>
	</div>
</div>
