<script>
    let { label = 'Cargando información...', compact = false } = $props();
</script>

<div class={`text-center text-secondary ${compact ? 'py-2' : 'py-4'}`} role="status" aria-live="polite">
    <span class="spinner-border spinner-border-sm text-primary me-2" aria-hidden="true"></span>{label}
</div>

