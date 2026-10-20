<script>
    let { variant = 'info', title = '', message = '', dismissible = false, onDismiss = () => {} } = $props();
    let classes = $derived(`alert alert-${variant} ${dismissible ? 'alert-dismissible' : ''} mb-3`);
    let role = $derived(variant === 'danger' ? 'alert' : 'status');
</script>

<div class={classes} {role}>
    {#if title}<strong class="d-block">{title}</strong>{/if}
    {message}
    {#if dismissible}<button type="button" class="btn-close" aria-label="Cerrar aviso" onclick={onDismiss}></button>{/if}
</div>

