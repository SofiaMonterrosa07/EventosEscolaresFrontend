<script>
    let { label, value, icon = 'bi-bar-chart', tone = 'primary', hint = '' } = $props();
</script>

<article class="card stat-card h-100">
	<div class="card-body d-flex align-items-center gap-3">
		<span class={`stat-card-icon rounded-4 bg-${tone}-subtle text-${tone} fs-4 flex-shrink-0`}><i class={`bi ${icon}`} aria-hidden="true"></i></span>
		<div class="min-w-0"><div class="text-secondary small fw-semibold">{label}</div><strong class="stat-card-value d-block fs-2 lh-sm mt-1">{value}</strong>{#if hint}<div class="small text-secondary mt-1">{hint}</div>{/if}</div>
    </div>
</article>

