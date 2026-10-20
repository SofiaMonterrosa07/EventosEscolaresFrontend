<script>
    let { title, eyebrow = '', icon = '' } = $props();
</script>

<header class="page-heading d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
    <div>
        {#if eyebrow}<div class="small text-primary text-uppercase fw-bold mb-2 page-heading-eyebrow">{eyebrow}</div>{/if}
        <h1 class="h3 fw-bold mb-0 page-heading-title">{#if icon}<i class={`bi ${icon} text-primary me-2`} aria-hidden="true"></i>{/if}{title}</h1>
    </div>
</header>


