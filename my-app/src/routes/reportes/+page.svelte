<script>
	import { onMount } from 'svelte';
	import { apiGet, suscribirCambiosApi } from '$lib/api.js';
	let periodo = $state('Todas');
	let tipoActividad = $state('Todas');
	let busquedaActividad = $state('');
	let fechaDesde = $state('');
	let fechaHasta = $state('');
	let ordenCampo = $state('fecha');
	let ordenDireccion = $state('desc');
	let pagina = $state(1);
	const filasPorPagina = 10;


	// =========================================================
	// Información consultada en la API
	// =========================================================

	let actividades = $state([]);
	let categoriasActividad = $state([]);
	let cargandoApi = $state(true);
	let errorCarga = $state('');

	async function cargarDatosReporte() {
		cargandoApi = true;
		errorCarga = '';
		try {
			const reporteApi = await apiGet('/inscripciones/resumen-institucional');
			if (!Array.isArray(reporteApi)) {
				throw new Error('No fue posible cargar la información necesaria.');
			}
			actividades = reporteApi.map((actividad) => ({
				...actividad,
				tipo: actividad.tipo ?? 'Sin categoría',
				cupos: Number(actividad.cupos) || 0,
				inscritos: Number(actividad.inscritos) || 0,
				autorizadas: Number(actividad.autorizadas) || 0,
				pendientes: Number(actividad.pendientes) || 0,
				rechazadas: Number(actividad.rechazadas) || 0
			}));
			categoriasActividad = [...new Set(actividades.map((actividad) => actividad.tipo))]
				.map((nombre) => ({ nombre }));
		} catch (error) {
			console.error('Error cargando los reportes desde la API:', error);
			errorCarga = error instanceof Error ? error.message : 'No fue posible cargar los reportes.';
		} finally {
			cargandoApi = false;
		}
	}
	onMount(() => {
		void cargarDatosReporte();
		const unsubscribeApi = suscribirCambiosApi(() => void cargarDatosReporte());
		return () => unsubscribeApi();
	});


	// =========================================================
	// FILTROS
	// =========================================================
	function normalizarBusqueda(valor) {
		return String(valor ?? '')
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.trim()
			.toLocaleLowerCase('es');
	}

	let actividadesFiltradas = $derived.by(() => {
		const filtradas = actividades.filter((actividad) => {
			const texto = normalizarBusqueda(busquedaActividad);
			const coincideTexto = !texto || [actividad.nombre, actividad.tipo, actividad.fecha]
				.some((valor) => normalizarBusqueda(valor).includes(texto));
			const fecha = String(actividad.fecha ?? '').slice(0, 10);
			const coincideRango = (!fechaDesde || fecha >= fechaDesde) && (!fechaHasta || fecha <= fechaHasta);
			return coincideTexto &&
				coincideRango &&
				(tipoActividad === 'Todas' || actividad.tipo === tipoActividad) &&
				(periodo === 'Todas' || String(actividad.fecha ?? '').slice(0, 7) === periodo);
		});
		return filtradas.sort((a, b) => {
			let comparacion = 0;
			if (ordenCampo === 'fecha') comparacion = String(a.fecha ?? '').localeCompare(String(b.fecha ?? ''));
			else if (ordenCampo === 'inscritos') comparacion = a.inscritos - b.inscritos;
			else if (ordenCampo === 'ocupacion') comparacion = (a.cupos ? a.inscritos / a.cupos : 0) - (b.cupos ? b.inscritos / b.cupos : 0);
			else if (ordenCampo === 'categoria') comparacion = normalizarBusqueda(a.tipo).localeCompare(normalizarBusqueda(b.tipo), 'es');
			else comparacion = normalizarBusqueda(a.nombre).localeCompare(normalizarBusqueda(b.nombre), 'es', { numeric: true });
			return ordenDireccion === 'asc' ? comparacion : -comparacion;
		});
	});
	let totalPaginas = $derived(Math.max(1, Math.ceil(actividadesFiltradas.length / filasPorPagina)));
	let actividadesPagina = $derived(actividadesFiltradas.slice((pagina - 1) * filasPorPagina, pagina * filasPorPagina));
	$effect(() => { if (pagina > totalPaginas) pagina = totalPaginas; });
	$effect(() => { busquedaActividad; periodo; tipoActividad; fechaDesde; fechaHasta; ordenCampo; ordenDireccion; pagina = 1; });

	let periodosDisponibles = $derived(
		[...new Set(actividades.map((actividad) => String(actividad.fecha ?? '').slice(0, 7)).filter(Boolean))]
			.sort()
			.reverse()
	);

	function nombrePeriodo(valor) {
		const [anio, mes] = valor.split('-').map(Number);
		return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
			.format(new Date(Date.UTC(anio, mes - 1, 1)));
	}

	let periodoVisible = $derived(periodo === 'Todas' ? 'Todas las fechas' : nombrePeriodo(periodo));


	// =========================================================
	// TOTALES
	// =========================================================

	let totalActividades = $derived(
		actividadesFiltradas.length
	);


	let totalInscritos = $derived(
		actividadesFiltradas.reduce(
			(total, actividad) =>
				total + actividad.inscritos,
			0
		)
	);


	let totalAutorizadas = $derived(
		actividadesFiltradas.reduce(
			(total, actividad) =>
				total + actividad.autorizadas,
			0
		)
	);


	let totalPendientes = $derived(
		actividadesFiltradas.reduce(
			(total, actividad) =>
				total + actividad.pendientes,
			0
		)
	);


	let totalRechazadas = $derived(
		actividadesFiltradas.reduce(
			(total, actividad) =>
				total + actividad.rechazadas,
			0
		)
	);


	let totalCupos = $derived(
		actividadesFiltradas.reduce(
			(total, actividad) =>
				total + actividad.cupos,
			0
		)
	);


	let cuposDisponibles = $derived(
		totalCupos - totalInscritos
	);


	let porcentajeAutorizacion = $derived(
		totalInscritos > 0
			? Math.round(
					(totalAutorizadas / totalInscritos) * 100
				)
			: 0
	);


	let actividadMasPopular = $derived(
		actividadesFiltradas.length > 0
			? actividadesFiltradas.reduce(
					(anterior, actual) =>
						actual.inscritos >
						anterior.inscritos
							? actual
							: anterior
				)
			: null
	);


	// =========================================================
	// FUNCIONES
	// =========================================================

	function porcentajeOcupacion(actividad) {

		if (actividad.cupos === 0) {
			return 0;
		}

		return Math.round(
			(actividad.inscritos / actividad.cupos) * 100
		);
	}


</script>


<svelte:head><title>Reportes | Colegio San Miguel</title></svelte:head>

<main class="container-fluid px-3 px-lg-4 py-4">
	{#if cargandoApi}<div class="alert alert-info" role="status"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Cargando información...</div>{:else if errorCarga}<div class="alert alert-danger" role="alert">{errorCarga} Revisa tu conexión e inténtalo de nuevo.</div>{/if}

	<header class="mb-4"><h1 class="h2 mb-1">Resumen de actividades</h1></header>

	<section class="card border-0 shadow-sm mb-4"><div class="card-header bg-white"><h2 class="h5 mb-1">Búsqueda y filtros</h2></div><div class="card-body"><div class="row g-3 align-items-end">
		<div class="col-12 col-md-4"><label class="form-label" for="buscar-actividad">Buscar actividad</label><div class="input-group"><span class="input-group-text"><i class="bi bi-search" aria-hidden="true"></i></span><input id="buscar-actividad" class="form-control" type="search" placeholder="Nombre, categoría o fecha..." value={busquedaActividad} oninput={(event) => { busquedaActividad = event.currentTarget.value; pagina = 1; }} /></div></div>
		<div class="col-6 col-md-2"><label class="form-label" for="periodo">Período</label><select id="periodo" class="form-select" value={periodo} onchange={(event) => { periodo = event.currentTarget.value; pagina = 1; }}><option value="Todas">Todos</option>{#each periodosDisponibles as valor (valor)}<option value={valor}>{nombrePeriodo(valor)}</option>{/each}</select></div>
		<div class="col-6 col-md-2"><label class="form-label" for="tipoActividad">Categoría</label><select id="tipoActividad" class="form-select" value={tipoActividad} onchange={(event) => { tipoActividad = event.currentTarget.value; pagina = 1; }}><option value="Todas">Todas</option>{#each categoriasActividad as categoria (categoria.nombre)}<option value={categoria.nombre}>{categoria.nombre}</option>{/each}</select></div>
		<div class="col-6 col-md-2"><label class="form-label" for="actividad-desde">Fecha desde</label><input id="actividad-desde" class="form-control" type="date" value={fechaDesde} onchange={(event) => { fechaDesde = event.currentTarget.value; pagina = 1; }} /></div>
		<div class="col-6 col-md-2"><label class="form-label" for="actividad-hasta">Fecha hasta</label><input id="actividad-hasta" class="form-control" type="date" value={fechaHasta} onchange={(event) => { fechaHasta = event.currentTarget.value; pagina = 1; }} /></div>
		<div class="col-8 col-md-3"><label class="form-label" for="orden-actividades">Ordenar por</label><select id="orden-actividades" class="form-select" value={ordenCampo} onchange={(event) => { ordenCampo = event.currentTarget.value; pagina = 1; }}><option value="fecha">Fecha</option><option value="nombre">Nombre</option><option value="categoria">Categoría</option><option value="inscritos">Inscritos</option><option value="ocupacion">Ocupación</option></select></div>
		<div class="col-4 col-md-2"><label class="form-label" for="direccion-actividades">Orden</label><select id="direccion-actividades" class="form-select" value={ordenDireccion} onchange={(event) => { ordenDireccion = event.currentTarget.value; pagina = 1; }}><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></div>
		<div class="col-12 col-md-auto"><button class="btn btn-outline-secondary" type="button" onclick={() => { periodo = 'Todas'; tipoActividad = 'Todas'; busquedaActividad = ''; fechaDesde = ''; fechaHasta = ''; ordenCampo = 'fecha'; ordenDireccion = 'desc'; pagina = 1; }}>Limpiar filtros</button></div>
	</div></div></section>

	<div class="row g-3 mb-4">
		<div class="col-12 col-sm-6 col-xl-3"><article class="card border-0 shadow-sm h-100"><div class="card-body"><div class="text-secondary">Actividades</div><strong class="fs-2">{totalActividades}</strong></div></article></div>
		<div class="col-12 col-sm-6 col-xl-3"><article class="card border-0 shadow-sm h-100"><div class="card-body"><div class="text-secondary">Inscripciones</div><strong class="fs-2">{totalInscritos}</strong></div></article></div>
		<div class="col-12 col-sm-6 col-xl-3"><article class="card border-0 shadow-sm h-100"><div class="card-body"><div class="text-secondary">Autorizadas</div><strong class="fs-2">{totalAutorizadas}</strong><div class="small text-secondary">{porcentajeAutorizacion}% del total</div></div></article></div>
		<div class="col-12 col-sm-6 col-xl-3"><article class="card border-0 shadow-sm h-100"><div class="card-body"><div class="text-secondary">Pendientes</div><strong class="fs-2">{totalPendientes}</strong></div></article></div>
	</div>

	<section class="card border-0 shadow-sm"><div class="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2"><div><h2 class="h5 mb-1">Actividades</h2><span class="small text-secondary">Período: {periodoVisible}</span></div><span class="badge text-bg-primary">{actividadesFiltradas.length} registros</span></div><div class="table-responsive p-3"><table class="table table-striped table-hover align-middle mb-0"><thead class="table-light"><tr><th>Actividad</th><th>Categoría</th><th>Fecha</th><th>Cupos</th><th>Inscritos</th><th>Ocupación</th><th>Autorizadas</th><th>Pendientes</th></tr></thead><tbody>
		{#each actividadesPagina as actividad}<tr><td><strong>{actividad.nombre}</strong></td><td>{actividad.tipo}</td><td>{actividad.fecha || 'Sin fecha'}</td><td>{actividad.cupos}</td><td>{actividad.inscritos}</td><td>{porcentajeOcupacion(actividad)}%</td><td>{actividad.autorizadas}</td><td>{actividad.pendientes}</td></tr>{/each}
	{#if actividadesFiltradas.length === 0}<tr><td colspan="8" class="text-center text-secondary py-4">No hay actividades que coincidan con esos filtros.</td></tr>{/if}</tbody></table></div><div class="card-footer bg-white d-flex flex-wrap justify-content-between align-items-center gap-2 small text-secondary"><span>Mostrando {actividadesFiltradas.length ? (pagina - 1) * filasPorPagina + 1 : 0}–{Math.min(pagina * filasPorPagina, actividadesFiltradas.length)} de {actividadesFiltradas.length} actividades.</span>{#if actividadesFiltradas.length > filasPorPagina}<nav class="d-flex align-items-center gap-2" aria-label="Paginación de actividades"><button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página anterior" onclick={() => pagina = Math.max(1, pagina - 1)} disabled={pagina <= 1}><i class="bi bi-chevron-left" aria-hidden="true"></i></button><span>Página {pagina} de {totalPaginas}</span><button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página siguiente" onclick={() => pagina = Math.min(totalPaginas, pagina + 1)} disabled={pagina >= totalPaginas}><i class="bi bi-chevron-right" aria-hidden="true"></i></button></nav>{/if}</div></section>
</main>



