<script>
	import { onMount } from 'svelte';
	import { apiGet, suscribirCambiosApi } from '$lib/api.js';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FeedbackMessage from '$lib/components/FeedbackMessage.svelte';
	import LoadingState from '$lib/components/LoadingState.svelte';
	import PageHeading from '$lib/components/PageHeading.svelte';

	let autorizaciones = $state([]);
	let cargando = $state(true);
	let error = $state('');
	let busqueda = $state('');
	let filtroEstado = $state('todos');
	let fechaDesde = $state('');
	let fechaHasta = $state('');
	let ordenDireccion = $state('desc');
	let pagina = $state(1);
	const filasPorPagina = 10;

	function fechaLegible(valor) {
		if (!valor) return 'Sin fecha';
		const fecha = new Date(`${String(valor).slice(0, 10)}T12:00:00`);
		return Number.isNaN(fecha.getTime())
			? String(valor)
			: new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(fecha);
	}

	function estado(registro) {
		if (registro.estado === true || registro.estado === 1 || ['true', '1'].includes(String(registro.estado).toLowerCase())) {
			return { texto: 'Autorizada', clase: 'text-bg-success' };
		}
		if (!registro.fecha_autorizacion) return { texto: 'Pendiente', clase: 'text-bg-warning' };
		return { texto: 'No autorizada', clase: 'text-bg-secondary' };
	}

	async function cargar() {
		cargando = true;
		error = '';
		try {
			const registros = await apiGet('/autorizaciones/');
			if (!Array.isArray(registros)) throw new Error('La API no devolvió una lista válida.');
			autorizaciones = registros;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'No fue posible cargar tus autorizaciones.';
		} finally {
			cargando = false;
		}
	}

	let autorizacionesFiltradas = $derived.by(() => {
		const texto = String(busqueda).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
		return autorizaciones.filter((registro) => {
			const resultado = estado(registro);
			const actividad = String(registro.actividad_nombre ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
			const coincideTexto = !texto || actividad.includes(texto);
			const coincideEstado = filtroEstado === 'todos' || (filtroEstado === 'autorizada' && resultado.texto === 'Autorizada') || (filtroEstado === 'pendiente' && resultado.texto === 'Pendiente') || (filtroEstado === 'no-autorizada' && resultado.texto === 'No autorizada');
			const fecha = String(registro.actividad_fecha ?? '').slice(0, 10);
			return coincideTexto && coincideEstado && (!fechaDesde || fecha >= fechaDesde) && (!fechaHasta || fecha <= fechaHasta);
		}).sort((a, b) => {
			const diferencia = String(a.actividad_fecha ?? '').localeCompare(String(b.actividad_fecha ?? ''));
			return ordenDireccion === 'asc' ? diferencia : -diferencia;
		});
	});
	let totalPaginas = $derived(Math.max(1, Math.ceil(autorizacionesFiltradas.length / filasPorPagina)));
	let autorizacionesPagina = $derived(autorizacionesFiltradas.slice((pagina - 1) * filasPorPagina, pagina * filasPorPagina));
	$effect(() => { if (pagina > totalPaginas) pagina = totalPaginas; });

	onMount(() => {
		void cargar();
		const unsubscribeApi = suscribirCambiosApi(() => void cargar());
		return () => unsubscribeApi();
	});
</script>

<svelte:head><title>Mis autorizaciones | Eventos Escolares</title></svelte:head>

<main class="container-fluid px-3 px-lg-4 py-4">
	<div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
		<PageHeading title="Mis autorizaciones" />
		<button class="btn btn-outline-primary" type="button" onclick={cargar} disabled={cargando}>
			<i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Actualizar
		</button>
	</div>
	{#if error}<FeedbackMessage variant="danger" message={error} />{/if}
	{#if cargando}
		<LoadingState label="Cargando tus autorizaciones..." />
	{:else if autorizaciones.length === 0}
		<div class="card border-0 shadow-sm"><EmptyState title="No hay autorizaciones registradas" /></div>
	{:else}
		<div class="card border-0 shadow-sm">
			<div class="card-body border-bottom"><div class="row g-3 align-items-end">
				<div class="col-12 col-md-4"><label class="form-label" for="buscar-autorizacion-estudiante">Buscar actividad</label><input id="buscar-autorizacion-estudiante" class="form-control" type="search" placeholder="Nombre de actividad..." value={busqueda} oninput={(event) => { busqueda = event.currentTarget.value; pagina = 1; }} /></div>
				<div class="col-6 col-md-2"><label class="form-label" for="estado-autorizacion-estudiante">Estado</label><select id="estado-autorizacion-estudiante" class="form-select" value={filtroEstado} onchange={(event) => { filtroEstado = event.currentTarget.value; pagina = 1; }}><option value="todos">Todos</option><option value="autorizada">Autorizada</option><option value="pendiente">Pendiente</option><option value="no-autorizada">No autorizada</option></select></div>
				<div class="col-6 col-md-2"><label class="form-label" for="autorizacion-desde">Actividad desde</label><input id="autorizacion-desde" class="form-control" type="date" value={fechaDesde} onchange={(event) => { fechaDesde = event.currentTarget.value; pagina = 1; }} /></div>
				<div class="col-6 col-md-2"><label class="form-label" for="autorizacion-hasta">Actividad hasta</label><input id="autorizacion-hasta" class="form-control" type="date" value={fechaHasta} onchange={(event) => { fechaHasta = event.currentTarget.value; pagina = 1; }} /></div>
				<div class="col-6 col-md-2"><label class="form-label" for="orden-autorizaciones">Fecha</label><select id="orden-autorizaciones" class="form-select" value={ordenDireccion} onchange={(event) => { ordenDireccion = event.currentTarget.value; pagina = 1; }}><option value="desc">Más reciente</option><option value="asc">Más antigua</option></select></div>
				<div class="col-12 col-md-auto"><button class="btn btn-outline-secondary" type="button" onclick={() => { busqueda = ''; filtroEstado = 'todos'; fechaDesde = ''; fechaHasta = ''; ordenDireccion = 'desc'; pagina = 1; }}>Limpiar filtros</button></div>
			</div></div>
			{#if autorizacionesFiltradas.length === 0}<div class="p-4 text-center text-secondary">No hay autorizaciones que coincidan con los filtros.</div>{:else}<div class="table-responsive p-3">
			<table class="table table-hover align-middle mb-0">
				<thead><tr><th>Actividad</th><th>Fecha de actividad</th><th>Estado</th><th>Fecha de respuesta</th></tr></thead>
				<tbody>
					{#each autorizacionesPagina as registro (registro.id)}
						{@const resultado = estado(registro)}
						<tr>
							<td>{registro.actividad_nombre ?? 'Actividad'}</td>
							<td>{fechaLegible(registro.actividad_fecha)}</td>
							<td><span class={`badge ${resultado.clase}`}>{resultado.texto}</span></td>
							<td>{fechaLegible(registro.fecha_autorizacion)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>{/if}<div class="card-footer bg-white d-flex flex-wrap justify-content-between align-items-center gap-2 text-secondary small"><span>Mostrando {autorizacionesFiltradas.length ? (pagina - 1) * filasPorPagina + 1 : 0}–{Math.min(pagina * filasPorPagina, autorizacionesFiltradas.length)} de {autorizacionesFiltradas.length} autorizaciones. Solo ves las de tus inscripciones.</span>{#if autorizacionesFiltradas.length > filasPorPagina}<nav class="d-flex align-items-center gap-2" aria-label="Paginación de autorizaciones"><button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página anterior" onclick={() => pagina = Math.max(1, pagina - 1)} disabled={pagina <= 1}><i class="bi bi-chevron-left" aria-hidden="true"></i></button><span>Página {pagina} de {totalPaginas}</span><button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página siguiente" onclick={() => pagina = Math.min(totalPaginas, pagina + 1)} disabled={pagina >= totalPaginas}><i class="bi bi-chevron-right" aria-hidden="true"></i></button></nav>{/if}</div></div>
	{/if}
</main>

