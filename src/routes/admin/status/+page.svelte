<script lang="ts">
	import { fetchWithAuth } from '$lib/services/authapi';

	let status = $state<ScannerStatusData | null>(null);
	let error = $state<string | null>(null);
	let lastUpdated = $state<Date | null>(null);

	async function fetchStatus() {
		try {
			status = await fetchWithAuth<ScannerStatusData>('/api/scanner/status');
			lastUpdated = new Date();
			error = null;
		} catch (e) {
			if (e instanceof Error) {
				error = e.message;
			} else {
				error = 'An unknown error occurred';
			}
			console.error('Failed to fetch scanner status:', e);
		}
	}

	// Fetch status on component mount and then periodically
	$effect(() => {
		fetchStatus();
		const interval = setInterval(fetchStatus, 5000); // Refresh every 5 seconds

		return () => {
			clearInterval(interval);
		};
	});

	function formatDuration(seconds: number | null | undefined): string {
		if (seconds == null || !isFinite(seconds)) {
			return '...';
		}
		if (seconds < 0) seconds = 0;

		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = Math.floor(seconds % 60);

		const paddedMinutes = String(minutes).padStart(2, '0');
		const paddedSeconds = String(remainingSeconds).padStart(2, '0');

		return `${paddedMinutes}:${paddedSeconds}`;
	}
</script>

<div class="scanner-status-page">
	<h1>Media Scanner Status</h1>

	{#if error}
		<div class="error-box">
			<p><strong>Error fetching status:</strong> {error}</p>
			<p>Please ensure the backend service is running and the status API is available.</p>
		</div>
	{/if}

	{#if status}
		<div class="status-grid">
			<div class="card">
				<h2>Overall Status</h2>
				<p>
					Processing:
					<span
						class:enabled={status.processing_enabled}
						class:disabled={!status.processing_enabled}
					>
						{status.processing_enabled ? 'ENABLED' : 'DISABLED'}
					</span>
				</p>
				<p>Files Processed (Session): <strong>{status.files_processed_session}</strong></p>
				<p>Intake Queue: <strong>{status.intake_queue_size}</strong></p>
				<p>Currently Processing: <strong>{status.currently_processing_count}</strong></p>
				{#if lastUpdated}
					<p class="last-updated">Last updated: {lastUpdated.toLocaleTimeString()}</p>
				{/if}
			</div>

			<div class="card">
				<h2>Configuration</h2>
				<p>CLIP Model: <strong>{status.config.clip_model}</strong></p>
				<p>Tagger Model: <strong>{status.config.tagger_model}</strong></p>
				<p>
					Index Rebuild Interval: <strong
						>{status.config.index_rebuild_interval_minutes} mins</strong
					>
				</p>
				<p>Model Idle Unload: <strong>{status.config.model_idle_unload_seconds} secs</strong></p>
			</div>

			<div class="card card-full-width">
				<h2>Watched Directories</h2>
				<ul>
					{#each status.watched_directories as dir}
						<li>{dir}</li>
					{/each}
				</ul>
			</div>

			<div class="card card-full-width">
				<h2>Worker Pools</h2>
				<table>
					<thead>
						<tr>
							<th>Pool Type</th>
							<th>Workers</th>
							<th>Queued</th>
							<th>Active</th>
						</tr>
					</thead>
					<tbody>
						{#each Object.entries(status.worker_pools) as [name, pool]}
							<tr>
								<td>{name}</td>
								<td>{pool.workers}</td>
								<td>{pool.queue_size}</td>
								<td>{pool.active_tasks}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if status.currently_processing.length > 0}
				<div class="card card-full-width">
					<h2>Currently Processing Files ({status.currently_processing.length})</h2>
					<ul class="file-list">
						{#each status.currently_processing as file}
							<li>
								<div class="file-progress-item">
									<div class="file-details">
										<div class="file-path" title={file.path}>{file.path}</div>
										<div class="file-meta">
											<span>Source: {file.ingest_source}</span>
											<span class="priority-{file.priority.toLowerCase()}"
												>Priority: {file.priority}</span
											>
										</div>
									</div>
									<div class="progress-text">
										<span>{file.progress.toFixed(0)}% - {file.message}</span>
										<span class="time-stats">
											(Elapsed: {formatDuration(file.elapsed)} / ETA: {formatDuration(file.eta)})
										</span>
									</div>
									<div class="progress-bar-container">
										<div
											class="progress-bar"
											class:bg-green-500={!['conversion', 'retagging', 'transcoding'].includes(
												file.ingest_source
											)}
											class:bg-yellow-500={file.ingest_source === 'transcoding'}
											class:bg-blue-500={file.ingest_source === 'conversion'}
											class:bg-purple-500={file.ingest_source === 'retagging'}
											style="width: {file.progress}%"
										/>
									</div>
								</div>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{:else if !error}
		<p>Loading scanner status...</p>
	{/if}
</div>

<style>
	.scanner-status-page {
		font-family: sans-serif;
		padding: 1rem;
		color: #333;
	}
	.status-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1rem;
	}
	.card {
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}
	.card-full-width {
		grid-column: 1 / -1;
	}
	.card h2 {
		margin-top: 0;
		font-size: 1.2rem;
		color: #555;
		border-bottom: 1px solid #eee;
		padding-bottom: 0.5rem;
		margin-bottom: 1rem;
	}
	.enabled {
		color: green;
		font-weight: bold;
	}
	.disabled {
		color: red;
		font-weight: bold;
	}
	.error-box {
		background-color: #fff0f0;
		border: 1px solid #ffbaba;
		color: #d8000c;
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 1rem;
	}
	ul {
		padding-left: 1.2rem;
		margin: 0;
		list-style: none;
	}
	.file-list {
		max-height: 300px;
		overflow-y: auto;
		background: #f9f9f9;
		border: 1px solid #eee;
		padding: 0;
		border-radius: 4px;
	}
	.file-list li {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #eee;
	}
	.file-list li:last-child {
		border-bottom: none;
	}
	.file-progress-item {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-areas:
			'details text'
			'bar bar';
		gap: 0.25rem 1rem;
		align-items: center;
	}
	.file-details {
		grid-area: details;
		overflow: hidden;
	}
	.file-path {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.9rem;
	}
	.file-meta {
		display: flex;
		gap: 1rem;
		font-size: 0.75rem;
		color: #777;
		margin-top: 0.2rem;
	}
	.priority-high {
		font-weight: bold;
		color: #ff6f00;
	}
	.priority-normal {
		color: #4caf50;
	}
	.priority-low {
		color: #2196f3;
	}
	.progress-text {
		grid-area: text;
		font-size: 0.8rem;
		color: #666;
		white-space: nowrap;
		display: flex;
		justify-content: flex-end;
		align-items: baseline;
		gap: 0.5rem;
	}
	.time-stats {
		font-size: 0.75rem;
		color: #888;
	}
	.progress-bar-container {
		grid-area: bar;
		width: 100%;
		background-color: #e0e0e0;
		border-radius: 4px;
		height: 8px;
		margin-top: 4px;
	}
	.progress-bar {
		height: 100%;
		border-radius: 4px;
		transition: width 0.3s ease-in-out;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		text-align: left;
		padding: 0.5rem;
		border-bottom: 1px solid #eee;
	}
	th {
		background-color: #f9f9f9;
	}
	tbody tr:last-child td {
		border-bottom: none;
	}
	.last-updated {
		font-size: 0.8rem;
		color: #888;
		margin-top: 1rem;
		text-align: right;
	}
</style>
