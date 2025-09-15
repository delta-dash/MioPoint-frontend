<!-- src/Sidebar.svelte -->
<script>
	// Svelte 5 Imports
	import {
		Home,
		Search,
		Tag,
		SendIcon,
		BarChart2,
		Settings,
		UserCog,
		Badge,
		ChevronsLeft,
		ChevronsRight,
		LayoutGrid,
		Eye
	} from 'lucide-svelte';
	import { user } from '$lib/userstore';

	let collapsed = $state(false);

	const navItems = [
		{ name: 'Dashboard', icon: Home, path: '/', permission: 'file:search' },
		{ name: 'Chat', icon: SendIcon, path: '/chat', permission: 'thread:participate' },
		{ name: 'Reverse Search', icon: Search, path: '/search', permission: 'file:reverse_search' },
		{ name: 'Tag', icon: Tag, path: '/admin/tag', permission: 'tag:edit' },
		{ name: 'Roles', icon: Badge, path: '/admin/roles', permission: 'user:manage_roles' },
		{ name: 'Users', icon: UserCog, path: '/admin/users', permission: 'user:view_any' },
		{ name: 'Visibility', icon: Eye, path: '/admin/visibility', permission: 'file:edit' }

		//{ name: 'Analytics', icon: BarChart2, path: '/' },
		//{ name: 'Settings', icon: Settings, path: '/' }
	];

	const userPermissionsSet = $derived(new Set($user?.permissions.map((p) => p.name) ?? []));

	function changeUsername() {
		if (!$user) return;
		const newName = prompt('Enter a new username:', $user.username);
		if (newName && newName.trim() !== '') {
			$user.username = newName;
		}
	}
	//console.log($user);
</script>

<aside
	class="flex h-screen flex-col overflow-x-hidden border-r border-gray-200 bg-gray-100 p-4 transition-all duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-800"
	class:w-64={!collapsed}
	class:w-20={collapsed}
>
	<!-- App Logo and Title -->
	<div class="mb-8 flex items-center overflow-hidden px-2">
		<LayoutGrid class="h-8 w-8 flex-shrink-0 text-indigo-500" />
		<h3
			class="ml-3 text-2xl font-bold whitespace-nowrap text-gray-800 transition-all duration-200 ease-in-out dark:text-gray-100"
			class:opacity-0={collapsed}
			class:w-0={collapsed}
			class:ml-0={collapsed}
		>
			MioPoint
		</h3>
	</div>

	<!-- Navigation Links -->
	<nav class="flex-grow">
		<ul class="space-y-2">
			{#each navItems as item}
				{#if !item.permission || userPermissionsSet.has(item.permission)}
					<li>
						<!-- REMOVED: `class:justify-center={collapsed}` -->
						<a
							href={item.path}
							class="flex items-center rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
							title={item.name}
							aria-label={item.name}
						>
							<item.icon class="h-6 w-6 flex-shrink-0" />
							<span
								class="ml-3 overflow-hidden font-medium whitespace-nowrap transition-all duration-200 ease-in-out"
								class:w-0={collapsed}
								class:opacity-0={collapsed}
								class:ml-0={collapsed}
							>
								{item.name}
							</span>
						</a>
					</li>
				{/if}
			{/each}
		</ul>
	</nav>

	<!-- This container pushes everything below it to the bottom -->
	<div class="mt-auto space-y-2">
		<!-- User Info Section -->
		<div
			class="rounded-lg bg-gray-200 transition-all duration-300 dark:bg-gray-700"
			class:p-4={!collapsed}
			class:p-0={collapsed}
			class:mb-2={!collapsed}
			class:mb-0={collapsed}
		>
			<!-- Inner div handles the smooth collapse and fade animation of the content -->
			<div
				class="overflow-hidden transition-all duration-300 ease-in-out"
				class:max-h-20={!collapsed}
				class:max-h-0={collapsed}
				class:opacity-100={!collapsed}
				class:opacity-0={collapsed}
			>
				<a href="/profile" class="text-sm whitespace-nowrap text-gray-600 dark:text-gray-300">
					Welcome,
					<strong class="block text-lg font-semibold text-indigo-600 dark:text-indigo-400">
						{$user?.username}
					</strong>
				</a>
			</div>
		</div>

		<!-- Change Username Button -->
		<!-- REMOVED: `class:justify-center={collapsed}` -->
		{#if $user == null}
			<a
				class="flex w-full items-center rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
				href="/login"
			>
				<UserCog class="h-6 w-6 flex-shrink-0" />
				<span
					class="ml-3 overflow-hidden font-medium whitespace-nowrap transition-all duration-200 ease-in-out"
					class:w-0={collapsed}
					class:opacity-0={collapsed}
					class:ml-0={collapsed}
				>
					Login
				</span>
			</a>
		{:else}
			<button
				onclick={changeUsername}
				class="!hidden flex w-full items-center rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
			>
				<UserCog class="h-6 w-6 flex-shrink-0" />
				<span
					class="ml-3 overflow-hidden font-medium whitespace-nowrap transition-all duration-200 ease-in-out"
					class:w-0={collapsed}
					class:opacity-0={collapsed}
					class:ml-0={collapsed}
				>
					Change Username
				</span>
			</button>
		{/if}

		<!-- Collapse/Expand Toggle Button -->
		<!-- REMOVED: `class:justify-center={collapsed}` -->
		<button
			onclick={() => (collapsed = !collapsed)}
			class="flex w-full items-center rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
			aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
		>
			{#if !collapsed}
				<ChevronsLeft class="h-6 w-6 flex-shrink-0" />
				<span
					class="ml-3 overflow-hidden font-medium whitespace-nowrap transition-all duration-200 ease-in-out"
					class:w-0={collapsed}
					class:opacity-0={collapsed}
					class:ml-0={collapsed}
				>
					Collapse
				</span>
			{:else}
				<ChevronsRight class="h-6 w-6" />
			{/if}
		</button>
	</div>
</aside>
