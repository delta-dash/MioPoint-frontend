<!-- routes/profile/page.svelte -->
<script lang="ts">
	// REFACTORED: Removed onMount and local state variables.
	import { goto } from '$app/navigation';
	import { Circle, ShieldCheck, KeyRound } from 'lucide-svelte';
	import UserRoles from '$lib/components/RoleManager.svelte';
	// REFACTORED: Import the new UserProfile store.
	import { user } from '$lib/userstore.ts';

	// --- Logout Handler ---
	async function handleLogout() {
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
		} catch (e) {
			console.error('Logout API call failed, but proceeding:', e);
		} finally {
			// REFACTORED: Clear the store on logout to update the UI instantly.
			$user = null;
			await goto('/login');
		}
	}
</script>

<div class="flex min-h-screen items-start justify-center bg-gray-100 px-4 py-12">
	<div class="w-full max-w-2xl space-y-8">
		<!-- REFACTORED: Main conditional now just checks if the user profile exists in the store. -->
		{#if $user}
			<!-- Main Profile Card -->
			<div class="space-y-6 rounded-xl bg-white p-8 shadow-lg">
				<div>
					<h2 class="text-3xl font-bold tracking-tight text-gray-900">
						<!-- REFACTORED: All references now use $user directly. -->
						{#if $user.is_guest}
							Welcome, Guest!
						{:else}
							Welcome, <span class="text-indigo-600">{$user.username}</span>!
						{/if}
					</h2>
					<p class="mt-2 text-gray-500">
						Here is a summary of your account status and permissions.
					</p>
				</div>
				<div class="border-t border-gray-200 pt-6">
					<!-- Roles Section -->
					<div class="mb-6">
						<h3 class="flex items-center gap-2 text-lg font-semibold text-gray-800">
							<ShieldCheck class="h-5 w-5 text-blue-600" />
							Your Roles
						</h3>
						{#if $user.roles?.length > 0}
							<UserRoles roles={$user.roles} entityId={$user.id} entityType='user'/>
						{:else}
							<p class="mt-3 text-sm text-gray-500">You have not been assigned any roles.</p>
						{/if}
					</div>

					<!-- Permissions Section -->
					<div>
						<h3 class="flex items-center gap-2 text-lg font-semibold text-gray-800">
							<KeyRound class="h-5 w-5 text-green-600" />
							Your Permissions
						</h3>
						<div class="mt-3 columns-2 gap-4 sm:columns-3">
							{#each $user.permissions as permission (permission.id)}
								<div class="mb-1 flex break-inside-avoid items-center gap-2">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="shrink-0 text-green-500"><path d="M20 6 9 17l-5-5"></path></svg
									>
									<span class="text-sm text-gray-600">{permission.name}</span>
								</div>
							{:else}
								<p class="text-sm text-gray-500">You do not have any specific permissions.</p>
							{/each}
						</div>
					</div>
				</div>

				<!-- Conditional Actions Section -->
				<div class="border-t border-gray-200 pt-6">
					<h3 class="text-lg font-semibold text-gray-800">Actions</h3>
					{#if $user.permissions.some((p) => p.name === 'admin' || p.name === 'user:manage_roles')}
						<p class="mt-2 text-sm text-gray-600">
							As an administrator, you have access to the management panel.
						</p>
						<a
							href="/admin/settings"
							class="mt-3 inline-block rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
						>
							Go to Admin Panel
						</a>
					{:else if $user.permissions.some((p) => p.name === 'file:add')}
						<p class="mt-2 text-sm text-gray-600">You have permission to add new files.</p>
						<a
							href="/upload"
							class="mt-3 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
						>
							Upload a File
						</a>
					{:else}
						<p class="mt-2 text-sm text-gray-600">
							You have standard user access with no special actions available.
						</p>
					{/if}
				</div>

				<div class="border-t border-gray-200 pt-6">
					<button
						onclick={handleLogout}
						class="w-full rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none sm:w-auto"
					>
						Sign Out
					</button>
				</div>
			</div>
		{:else}
			<!-- Optional: Show this when the user is not logged in ($user is null) -->
			<div class="rounded-xl bg-white p-10 text-center shadow-lg">
				<p class="text-gray-600">You are not signed in.</p>
				<a
					href="/login"
					class="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
					>Go to Login</a
				>
			</div>
		{/if}
	</div>
</div>
