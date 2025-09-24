<!-- src/lib/components/FeedbackToast.svelte -->
<script lang="ts">
    import { slide } from "svelte/transition";

    type Feedback = {
        type: "error" | "success";
        message: string;
    } | null;

    let { feedback }: { feedback: Feedback } = $props();
</script>

{#if feedback}
    <div
        transition:slide={{ duration: 300 }}
        class="fixed right-4 bottom-4 z-50 max-w-sm rounded-lg p-4 text-sm font-medium shadow-lg"
        class:bg-red-100={feedback.type === "error"}
        class:text-red-800={feedback.type === "error"}
        class:border-red-300={feedback.type === "error"}
        class:bg-green-100={feedback.type === "success"}
        class:text-green-800={feedback.type === "success"}
        class:border-green-300={feedback.type === "success"}
        role="alert"
    >
        {feedback.message}
    </div>
{/if}
