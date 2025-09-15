<script lang="ts">
	import { goto } from '$app/navigation';
	import { login } from '$lib/services/authapi';

	// --- Component State ---
	let username = $state('');
	let password = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');

	// --- Form Submission Handler ---
	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (isLoading) return;

		isLoading = true;
		errorMessage = '';

		// Basic client-side validation
		if (!username || !password) {
			errorMessage = 'Please enter both username and password.';
			isLoading = false;
			return;
		}

		try {
			// Use the centralized login function
			await login(username, password);

			// On success, authapi.ts handles the store. We just need to navigate.
			// invalidateAll is important to re-run load functions and get user-specific data.
			await goto('/', { invalidateAll: true });
		} catch (error: any) {
			errorMessage = error.message;
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
	<div class="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-lg">
		<div>
			<h2 class="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
				Sign in to your account
			</h2>
		</div>

		<form class="mt-8 space-y-6" onsubmit={handleSubmit}>
			<!-- Display General Error Messages -->
			{#if errorMessage}
				<div class="rounded-md bg-red-50 p-4">
					<div class="flex">
						<div class="flex-shrink-0">
							<!-- XCircleIcon -->
							<svg
								class="h-5 w-5 text-red-400"
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								fill="currentColor"
								aria-hidden="true"
							>
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<p class="text-sm font-medium text-red-800">{errorMessage}</p>
						</div>
					</div>
				</div>
			{/if}

			<div class="space-y-4 rounded-md shadow-sm">
				<div>
					<label for="username" class="sr-only">username</label>
					<input
						id="username"
						name="username"
						type="username"
						autocomplete="username"
						required
						bind:value={username}
						disabled={isLoading}
						class="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
						placeholder="username address"
					/>
				</div>
				<div>
					<label for="password" class="sr-only">Password</label>
					<input
						id="password"
						name="password"
						type="password"
						autocomplete="current-password"
						required
						bind:value={password}
						disabled={isLoading}
						class="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
						placeholder="Password"
					/>
				</div>
			</div>

			<div>
				<button
					type="submit"
					disabled={isLoading}
					class="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-400"
				>
					{#if isLoading}
						<span class="absolute inset-y-0 left-0 flex items-center pl-3">
							<!-- Loading spinner -->
							<svg
								class="h-5 w-5 animate-spin text-white"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
						</span>
						Signing in...
					{:else}
						Sign in
					{/if}
				</button>
			</div>
			<div class="text-center text-sm">
				<a href="/register" class="font-medium text-indigo-600 hover:text-indigo-500">
					Dont have a account? register
				</a>
			</div>
		</form>
	</div>
</div>
