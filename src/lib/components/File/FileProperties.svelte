<!-- src/lib/components/FileProperties.svelte -->
<script lang="ts">
	import { formatDate, formatDuration, formatBytes } from '$lib/utils/formatters';
	import { user } from '$lib/userstore.js';
	import RoleManager from '$lib/components/RoleManager.svelte';

	let { fileData }: { fileData: FileDetails } = $props();

	// --- Derived State ---
	// Check if the current user has permission to edit file properties
	const canManageFileRoles = $derived(
		$user?.permissions.some((p) => p.name === 'file:edit') ?? false
	);
</script>

<section>
	<h2 class="mb-4 text-2xl font-semibold text-slate-700">File Properties</h2>
	<div
		class="grid grid-cols-1 gap-x-6 gap-y-4 rounded-lg border border-slate-200 bg-slate-50 p-6 sm:grid-cols-2"
	>
		<!-- Existing and formatted fields -->
		<div><strong>File ID:</strong> {fileData.id}</div>
		<div><strong>Type:</strong> <span class="capitalize">{fileData.file_type || 'N/A'}</span></div>
		<div><strong>Extension:</strong> {fileData.extension || 'N/A'}</div>
		<div><strong>Duration:</strong> {formatDuration(fileData.duration_seconds)}</div>
		<div><strong>Discovered:</strong> {formatDate(fileData.discovered_at)}</div>
		<div><strong>Processed:</strong> {formatDate(fileData.processed_at)}</div>

		<div><strong>Size:</strong> {formatBytes(fileData.size_in_bytes)}</div>
		<div><strong>Encrypted:</strong> {fileData.is_encrypted ? 'Yes' : 'No'}</div>
		<div><strong>Source:</strong> <span class="capitalize">{fileData.ingest_source}</span></div>

		{#if fileData.uploader}
			<div>
				<strong>Uploader:</strong> {fileData.uploader.username} (ID: {fileData.uploader.id})
			</div>
		{/if}

		<div class="sm:col-span-2">
			<strong>Original Created:</strong> {formatDate(fileData.original_created_at)}
		</div>
		<div class="sm:col-span-2">
			<strong>Original Modified:</strong> {formatDate(fileData.original_modified_at)}
		</div>

		<!-- --- UPDATED SECTION: Replaced static list with RoleManager --- -->
		<div class="sm:col-span-2">
			<strong>Visible To:</strong>
			<div class="mt-1">
				<RoleManager
					roles={fileData.visibility_roles}
					entityId={fileData.id}
					entityType={'file'}
					canAdd={canManageFileRoles}
					canRemove={canManageFileRoles}
					canEdit={false}
				/>
			</div>
		</div>

		<!-- Hash and Path at the bottom -->
		<div class="sm:col-span-2">
			<strong>Hash (SHA256):</strong>
			<span class="mt-1 block break-all rounded bg-slate-200 px-2 py-1 font-mono text-xs">
				{fileData.file_hash}
			</span>
		</div>
		<div class="sm:col-span-2">
			<strong>Stored Path:</strong>
			<span class="mt-1 block break-all rounded bg-slate-200 px-2 py-1 font-mono text-xs">
				{fileData.stored_path}
			</span>
		</div>
	</div>
</section>