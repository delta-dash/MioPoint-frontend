<script lang="ts">
	import { goto } from '$app/navigation';
	import { register } from '$lib/services/authapi';

	// --- Component State ---
	let username = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let isLoading = $state(false);

	// Use an object for more specific error messages
	let errors = $state({
		general: '',
		username: '',
		password: '',
		confirmPassword: ''
	});

	// --- Form Submission Handler ---
	async function handleSubmit(event: Event) {
		event.preventDefault();
		// Reset errors on new submission
		errors = { general: '', username: '', password: '', confirmPassword: '' };

		// --- Client-Side Validation ---
		let hasClientError = false;
		if (password !== confirmPassword) {
			errors.confirmPassword = 'Passwords do not match.';
			hasClientError = true;
		}
		if (password.length < 8) {
			errors.password = 'Password must be at least 8 characters long.';
			hasClientError = true;
		}
		if (!username || !password || !confirmPassword) {
			errors.general = 'Please fill out all fields.';
			hasClientError = true;
		}

		if (hasClientError) {
			return; // Stop if there are client-side errors
		}

		isLoading = true;

		try {
			// The register function now handles logging the user in and setting the store.
			await register(username, password);

			// Registration was successful and the user is now logged in.
			// Redirect to the home page, invalidating all loaders to refresh data.
			await goto('/', { invalidateAll: true });
		} catch (error: any) {
			errors.general = error.message;
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
	<div class="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-lg">
		<div>
			<h2 class="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
				Create a new account
			</h2>
		</div>

		<form class="mt-8 space-y-6" onsubmit={handleSubmit}>
			<!-- Display General Error Messages -->
			{#if errors.general}
				<div class="rounded-md bg-red-50 p-4 text-sm font-medium text-red-800">
					{errors.general}
				</div>
			{/if}

			<div class="space-y-4 rounded-md">
				<div>
					<label for="username" class="sr-only">Username</label>
					<input
						id="username"
						name="username"
						type="text"
						autocomplete="username"
						required
						bind:value={username}
						disabled={isLoading}
						class="relative block w-full appearance-none rounded-md border px-3 py-2 placeholder-gray-500 focus:z-10 focus:outline-none sm:text-sm {errors.username ? 'border-red-500' : 'border-gray-300'}"
						placeholder="Username"
					/>
				</div>

				<div>
					<label for="password" class="sr-only">Password</label>
					<input
						id="password"
						name="password"
						type="password"
						autocomplete="new-password"
						required
						bind:value={password}
						disabled={isLoading}
						class="relative block w-full appearance-none rounded-md border px-3 py-2 placeholder-gray-500 focus:z-10 focus:outline-none sm:text-sm {errors.password ? 'border-red-500' : 'border-gray-300'}"
						placeholder="Password (min. 8 characters)"
					/>
					{#if errors.password}
						<p class="mt-1 text-xs text-red-600">{errors.password}</p>
					{/if}
				</div>
				<div>
					<label for="confirm-password" class="sr-only">Confirm Password</label>
					<input
						id="confirm-password"
						name="confirm-password"
						type="password"
						autocomplete="new-password"
						required
						bind:value={confirmPassword}
						disabled={isLoading}
						class="relative block w-full appearance-none rounded-md border px-3 py-2 placeholder-gray-500 focus:z-10 focus:outline-none sm:text-sm {errors.confirmPassword ? 'border-red-500' : 'border-gray-300'}"
						placeholder="Confirm Password"
					/>
					{#if errors.confirmPassword}
						<p class="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>
					{/if}
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
						Creating account...
					{:else}
						Create Account
					{/if}
				</button>
			</div>
			<div class="text-center text-sm">
				<a href="/login" class="font-medium text-indigo-600 hover:text-indigo-500">
					Already have an account? Sign In
				</a>
			</div>
		</form>
	</div>
</div>