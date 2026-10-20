<script>
    let { title = 'Aún no hay registros', description = '', icon = 'bi-inbox' } = $props();
</script>

<div class="text-center p-4 p-md-5" role="status">
    <i class={`bi ${icon} display-5 text-secondary`} aria-hidden="true"></i>
    <h2 class="h5 mt-3 mb-2">{title}</h2>
    {#if description}<p class="text-secondary mb-0">{description}</p>{/if}
</div>


