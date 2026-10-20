<script>
    import { onMount } from 'svelte';
    import { apiGet, suscribirCambiosApi } from '$lib/api.js';
    import PageHeading from '$lib/components/PageHeading.svelte';
    import FeedbackMessage from '$lib/components/FeedbackMessage.svelte';
    import LoadingState from '$lib/components/LoadingState.svelte';
    import StatCard from '$lib/components/StatCard.svelte';

    let { title, datasets } = $props();
    let counts = $state([]);
    let loading = $state(true);
    let error = $state('');

    async function loadCounts() {
        loading = true;
        error = '';
        try {
            counts = await Promise.all(datasets.map(async (dataset) => {
                const rows = await apiGet(dataset.endpoint);
                if (!Array.isArray(rows)) throw new Error('La API no devolvió una lista válida.');
                const resumenes = dataset.countField
                    ? rows.filter((row) => row?.[dataset.countField] !== null && row?.[dataset.countField] !== undefined)
                    : [];
                const count = resumenes.length > 0
                    ? resumenes.reduce((total, row) => total + Number(row[dataset.countField] ?? 0), 0)
                    : rows.length;
                return { ...dataset, count };
            }));
        } catch (cause) {
            console.error('Error cargando indicadores:', cause);
            error = cause instanceof Error ? cause.message : 'No fue posible cargar los indicadores.';
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        void loadCounts();
        const unsubscribeApi = suscribirCambiosApi(() => void loadCounts());
        return () => unsubscribeApi();
    });
</script>

<svelte:head><title>{title} | Eventos Escolares</title></svelte:head>

<main class="container py-4">
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <PageHeading {title} />
        <button class="btn btn-outline-primary" type="button" onclick={loadCounts} disabled={loading}>
            <i class="bi bi-arrow-clockwise me-2" aria-hidden="true"></i>Actualizar
        </button>
    </div>
    {#if loading}
        <LoadingState />
    {:else if error}
        <FeedbackMessage variant="danger" message={error} />
    {:else}
        <div class="row g-3">
            {#each counts as item, index (item.endpoint)}
                <div class="col-12 col-sm-6 col-xl-3">
                    <StatCard label={item.label} value={item.count} icon={['bi-calendar-event', 'bi-people', 'bi-person-check', 'bi-clipboard-data'][index % 4]} hint="registros" />
                </div>
            {/each}
        </div>
    {/if}
</main>



