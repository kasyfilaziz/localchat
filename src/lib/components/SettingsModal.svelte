<script lang="ts">
	import { chatStore } from '$lib/stores/chat.svelte';
	import { getApiKey, getApiEndpoint, saveApiKey, saveApiEndpoint, saveDefaultModel, getDefaultModel, getApiMethod, saveApiMethod, type ApiMethod } from '$lib/services/settings';
	import { testConnection, fetchModels } from '$lib/services/api';
	import type { SystemPrompt } from '$lib/services/db';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	let { isOpen, onClose }: Props = $props();

	let activeTab = $state<'api' | 'prompts'>('api');
	let apiKey = $state('');
	let apiEndpoint = $state('');
	let modelName = $state('llama3');
	let apiMethod = $state<ApiMethod>('custom');
	let showApiKey = $state(false);
	let isTesting = $state(false);
	let testResult = $state<{ success: boolean; message: string; models?: string[] } | null>(null);

	let promptName = $state('');
	let promptContent = $state('');
	let editingPrompt = $state<SystemPrompt | null>(null);

	$effect(() => {
		if (isOpen) {
			loadSettings();
		}
	});

	async function loadSettings() {
		const key = await getApiKey();
		const endpoint = await getApiEndpoint();
		const model = await getDefaultModel();
		const method = await getApiMethod();
		apiKey = key || '';
		apiEndpoint = endpoint;
		modelName = model;
		apiMethod = method;
		await chatStore.loadSystemPrompts();
	}

	async function handleSaveOnly() {
		if (!apiKey.trim() || !apiEndpoint.trim()) return;
		
		await saveApiKey(apiKey);
		await saveApiEndpoint(apiEndpoint);
		await saveDefaultModel(modelName);
		await saveApiMethod(apiMethod);
		chatStore.selectedModel = modelName;
		
		testResult = {
			success: true,
			message: 'Settings saved! Enter model name above to start chatting.'
		};
	}

	async function handleTestConnection() {
		if (!apiKey || !apiEndpoint) return;
		isTesting = true;
		testResult = null;
		
		try {
			testResult = await testConnection(apiEndpoint, apiKey);
			if (testResult.success && testResult.models) {
				chatStore.availableModels = testResult.models;
			}
		} catch (e) {
			// Silently fail - user can still use manual model input
			testResult = {
				success: true,
				message: 'Connected but /models not available. Enter model name manually below.'
			};
		}
		
		// Always save settings even if fetch fails
		await saveApiKey(apiKey);
		await saveApiEndpoint(apiEndpoint);
		await saveDefaultModel(modelName);
		await saveApiMethod(apiMethod);
		chatStore.selectedModel = modelName;
		isTesting = false;
	}

	async function handleAddPrompt() {
		if (!promptName.trim() || !promptContent.trim()) return;
		
		const isDefault = chatStore.systemPrompts.length === 0;
		await chatStore.addSystemPrompt(promptName.trim(), promptContent.trim(), isDefault);
		
		promptName = '';
		promptContent = '';
		editingPrompt = null;
	}

	async function handleUpdatePrompt() {
		if (!editingPrompt || !promptName.trim() || !promptContent.trim()) return;
		
		await chatStore.updateSystemPrompt(editingPrompt.id!, promptName.trim(), promptContent.trim());
		
		promptName = '';
		promptContent = '';
		editingPrompt = null;
	}

	async function handleDeletePrompt(prompt: SystemPrompt) {
		if (confirm(`Delete prompt "${prompt.name}"?`)) {
			await chatStore.deleteSystemPrompt(prompt.id!);
		}
	}

	async function handleSetDefault(prompt: SystemPrompt) {
		await chatStore.setDefaultPrompt(prompt.id!);
	}

	function startEditPrompt(prompt: SystemPrompt) {
		editingPrompt = prompt;
		promptName = prompt.name;
		promptContent = prompt.content;
	}

	function cancelEdit() {
		editingPrompt = null;
		promptName = '';
		promptContent = '';
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div 
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
		onclick={onClose}
		role="dialog"
		aria-modal="true"
		aria-labelledby="settings-title"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full h-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
				<h2 id="settings-title" class="text-lg font-semibold text-gray-800 dark:text-gray-100">Settings</h2>
				<button onclick={onClose} class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" aria-label="Close settings">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="flex border-b border-gray-200 dark:border-gray-700">
				<button
					onclick={() => activeTab = 'api'}
					class="flex-1 px-4 py-3 font-medium text-sm transition-colors {activeTab === 'api' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}"
				>
					API
				</button>
				<button
					onclick={() => activeTab = 'prompts'}
					class="flex-1 px-4 py-3 font-medium text-sm transition-colors {activeTab === 'prompts' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}"
				>
					Prompts
				</button>
			</div>

			<div class="p-4 overflow-y-auto flex-1 bg-gray-50 dark:bg-gray-900">
				{#if activeTab === 'api'}
					<div class="space-y-4">
						<div>
							<label for="apiKey" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
							<div class="relative">
								<input
									id="apiKey"
									type={showApiKey ? 'text' : 'password'}
									bind:value={apiKey}
									placeholder="Enter your API key"
									class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
								<button
									onclick={() => showApiKey = !showApiKey}
									class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
									aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
								>
									{#if showApiKey}
										<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
											<path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" />
											<path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
										</svg>
									{:else}
										<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
											<path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
											<path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
										</svg>
									{/if}
								</button>
							</div>
						</div>

						<div>
							<label for="apiEndpoint" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Endpoint</label>
							<input
								id="apiEndpoint"
								type="text"
								bind:value={apiEndpoint}
								placeholder="http://localhost:11434/v1"
								class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Default: http://localhost:11434/v1 (Ollama)</p>
						</div>

						<div>
							<label for="modelName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model</label>
							<input
								id="modelName"
								type="text"
								bind:value={modelName}
								placeholder="llama3"
								class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Enter model name (e.g., llama3, gpt-4o-mini, mistral)</p>
						</div>

						<div>
							<label for="apiMethod" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Method</label>
							<select
								id="apiMethod"
								bind:value={apiMethod}
								class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="custom">Custom Fetch (Recommended)</option>
								<option value="sdk">Vercel AI SDK</option>
							</select>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Custom Fetch is more compatible with various providers like MiniMax</p>
						</div>

						<div class="flex gap-2">
							<button
								onclick={handleSaveOnly}
								disabled={!apiKey.trim() || !apiEndpoint.trim()}
								class="flex-1 py-2 px-4 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors"
							>
								Save
							</button>
							<button
								onclick={handleTestConnection}
								disabled={!apiKey || !apiEndpoint || isTesting}
								class="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors"
							>
								{isTesting ? 'Testing...' : 'Test & Save'}
							</button>
						</div>

						{#if testResult}
							<div class="p-3 rounded-lg {testResult.success ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'}">
								<p class="{testResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'} font-medium">
									{testResult.message}
								</p>
								{#if testResult.models && testResult.models.length > 0}
									<p class="text-sm text-green-600 dark:text-green-500 mt-1">
										Models: {testResult.models.slice(0, 5).join(', ')}{testResult.models.length > 5 ? '...' : ''}
									</p>
								{/if}
							</div>
						{/if}
					</div>

				{:else if activeTab === 'prompts'}
					<div class="space-y-4">
						<div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
							<h3 class="font-medium text-gray-800 dark:text-gray-100 mb-3">
								{editingPrompt ? 'Edit Prompt' : 'Add New Prompt'}
							</h3>
							<div class="space-y-3">
								<input
									type="text"
									bind:value={promptName}
									placeholder="Prompt name (e.g., Code Reviewer)"
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
								<textarea
									bind:value={promptContent}
									placeholder="System prompt content..."
									rows="4"
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
								></textarea>
								<div class="flex gap-2">
									{#if editingPrompt}
										<button
											onclick={handleUpdatePrompt}
											class="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
										>
											Update Prompt
										</button>
										<button
											onclick={cancelEdit}
											class="py-2 px-4 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
										>
											Cancel
										</button>
									{:else}
										<button
											onclick={handleAddPrompt}
											disabled={!promptName.trim() || !promptContent.trim()}
											class="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg transition-colors"
										>
											Add Prompt
										</button>
									{/if}
								</div>
							</div>
						</div>

						<div>
							<h3 class="font-medium text-gray-800 dark:text-gray-100 mb-3">Saved Prompts</h3>
							{#if chatStore.systemPrompts.length === 0}
								<p class="text-gray-500 dark:text-gray-400 text-sm">No prompts saved yet.</p>
							{:else}
								<div class="space-y-2">
									{#each chatStore.systemPrompts as prompt (prompt.id)}
										<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
											<div class="flex items-start justify-between">
												<div class="flex-1">
													<div class="flex items-center gap-2">
														<span class="font-medium text-gray-800 dark:text-gray-100">{prompt.name}</span>
														{#if prompt.isDefault}
															<span class="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">Default</span>
														{/if}
													</div>
													<p class="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{prompt.content}</p>
												</div>
												<div class="flex gap-1 ml-2">
													{#if !prompt.isDefault}
														<button
															onclick={() => handleSetDefault(prompt)}
															class="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
															title="Set as default"
														>
															<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
																<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
															</svg>
														</button>
														<button
															onclick={() => startEditPrompt(prompt)}
															class="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
															title="Edit"
														>
															<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
																<path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
															</svg>
														</button>
														<button
															onclick={() => handleDeletePrompt(prompt)}
															class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
															title="Delete"
														>
															<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
																<path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
															</svg>
														</button>
													{/if}
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
