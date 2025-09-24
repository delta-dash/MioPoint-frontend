<script lang="ts">
	let { src }: { src: string } = $props();
</script>

<div class="h-[80vh] w-full rounded-md bg-slate-100">
	<object data={src} type="application/pdf" width="100%" height="100%">
		<div class="flex h-full flex-col items-center justify-center p-8 text-center text-slate-500">
			<p class="mb-4">Your browser does not support embedded PDFs.</p>
			<a
				href={src}
				class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
				target="_blank"
				rel="noopener noreferrer">Download the PDF</a
			>
		</div>
	</object>
</div>
