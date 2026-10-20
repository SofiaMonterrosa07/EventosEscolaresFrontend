<script>
	import { onMount } from 'svelte';
	import { apiGet, apiRequest, suscribirCambiosApi } from '$lib/api.js';
	import { dataTable } from '$lib/actions/dataTable.js';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FeedbackMessage from '$lib/components/FeedbackMessage.svelte';
	import LoadingState from '$lib/components/LoadingState.svelte';
	import PageHeading from '$lib/components/PageHeading.svelte';
	import { leerRolActivo } from '$lib/permisos.js';

	let actividades = $state([]);
	let resumenInscripciones = $state([]);
	let categorias = $state([]);
	let estudiantes = $state([]);
	let inscripciones = $state([]);
	let rolActual = $state('');
	let estudianteSeleccionado = $state('');
	let inscripcionEnCurso = $state(null);
	let cargando = $state(true);
	let error = $state('');
	let aviso = $state('');

	let esAcudiente = $derived(['acudiente', 'padre o acudiente'].includes(rolActual));
	let estudianteObjetivo = $derived(
		esAcudiente
			? estudiantes.find((estudiante) => String(estudiante.id) === String(estudianteSeleccionado))
			: estudiantes[0]
	);

	let actividadesVisibles = $derived(
		actividades
			.filter((actividad) => estaActivo(actividad.estado) && esFutura(actividad.fecha))
			.map((actividad) => {
				const inscritos = Number(
					resumenInscripciones.find((item) => Number(item.actividad_id) === Number(actividad.id))?.inscritos ?? 0
				);
				const cupo = Number(actividad.cupo) || 0;
				return { ...actividad, inscritos, disponibles: Math.max(cupo - inscritos, 0) };
			})
	);

	function estaActivo(estado) {
		return estado === true || estado === 1 || ['true', '1', 'activo', 'active'].includes(String(estado).trim().toLowerCase());
	}

	function esFutura(fecha) {
		if (!fecha) return false;
		const hoy = new Date();
		hoy.setHours(0, 0, 0, 0);
		const fechaActividad = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
		return !Number.isNaN(fechaActividad.getTime()) && fechaActividad >= hoy;
	}

	function formatoFecha(fecha) {
		if (!fecha) return 'Fecha por confirmar';
		const valor = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
		return Number.isNaN(valor.getTime())
			? String(fecha)
			: new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(valor);
	}

	function nombreCategoria(actividad) {
		return categorias.find((categoria) => Number(categoria.id) === Number(actividad?.categoria_id))?.nombre ?? 'Actividad escolar';
	}

	async function cargarActividades() {
		cargando = true;
		error = '';
		try {
			const [actividadesApi, resumenApi, categoriasApi, estudiantesApi, inscripcionesApi] = await Promise.all([
				apiGet('/actividades/'),
				apiGet('/inscripciones/resumen'),
				apiGet('/categorias-actividades/'),
				apiGet('/estudiantes/'),
				apiGet('/inscripciones/')
			]);
			if (![actividadesApi, resumenApi, categoriasApi, estudiantesApi, inscripcionesApi].every(Array.isArray)) {
				throw new Error('La API devolvió información incompleta de las actividades.');
			}
			actividades = actividadesApi;
			resumenInscripciones = resumenApi;
			categorias = categoriasApi;
			estudiantes = estudiantesApi;
			inscripciones = inscripcionesApi;
			if (esAcudiente && !estudianteSeleccionado && estudiantesApi.length) {
				estudianteSeleccionado = String(estudiantesApi[0].id);
			}
		} catch (cause) {
			console.error('Error cargando el catálogo de actividades:', cause);
			error = cause instanceof Error ? cause.message : 'No fue posible cargar las actividades.';
		} finally {
			cargando = false;
		}
	}

	async function inscribir(actividad) {
		if (!estudianteObjetivo) return;
		inscripcionEnCurso = actividad.id;
		error = '';
		aviso = '';
		try {
			await apiRequest(esAcudiente ? '/inscripciones/acudidos' : '/inscripciones/propias', {
				method: 'POST',
				body: esAcudiente
					? { estudiante_id: Number(estudianteObjetivo.id), actividad_id: Number(actividad.id) }
					: { actividad_id: Number(actividad.id) }
			});
			aviso = esAcudiente
				? `Inscripción registrada para ${estudianteObjetivo.usuario_nombre ?? 'el estudiante'}. La autorización quedó pendiente.`
				: 'Inscripción registrada.';
			await cargarActividades();
		} catch (cause) {
			console.error('Error al solicitar la inscripción:', cause);
			error = cause instanceof Error ? cause.message : 'No fue posible registrar la inscripción.';
		} finally {
			inscripcionEnCurso = null;
		}
	}

	function inscripcionExistente(actividadId) {
		return inscripciones.find((item) =>
			Number(item.actividad_id) === Number(actividadId) &&
			Number(item.estudiante_id) === Number(estudianteObjetivo?.id)
		);
	}

	onMount(() => {
		rolActual = leerRolActivo();
		void cargarActividades();
		const unsubscribeApi = suscribirCambiosApi(() => void cargarActividades());
		return () => unsubscribeApi();
	});
</script>

<svelte:head><title>Actividades | Eventos Escolares</title></svelte:head>

<main class="container-fluid px-3 px-lg-4 py-4">
	<div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
		<PageHeading title="Actividades escolares" />
		<div class="d-flex flex-wrap gap-2"><a class="btn btn-outline-primary" href="/calendario"><i class="bi bi-calendar3 me-1" aria-hidden="true"></i>Calendario</a><button class="btn btn-outline-primary" type="button" onclick={cargarActividades} disabled={cargando}><i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Actualizar</button></div>
	</div>

	{#if aviso}<div class="alert alert-success" role="status">{aviso}</div>{/if}
	{#if error}<FeedbackMessage variant="danger" message={error} />{/if}
	{#if esAcudiente && !cargando}
		{#if estudiantes.length === 0}
			<div class="alert alert-info" role="status">No encontramos estudiantes vinculados a tu cuenta. Pide a administración o secretaría que te vincule desde el módulo Acudientes.</div>
		{:else}
			<div class="row mb-3"><div class="col-12 col-md-6 col-lg-4"><label class="form-label fw-semibold" for="estudiante-acudido">Inscribir a</label><select id="estudiante-acudido" class="form-select" bind:value={estudianteSeleccionado}><option value="" disabled>Selecciona un estudiante</option>{#each estudiantes as estudiante (estudiante.id)}<option value={String(estudiante.id)}>{estudiante.usuario_nombre ?? 'Estudiante'} · {estudiante.grado}</option>{/each}</select></div></div>
		{/if}
	{:else if !cargando && !estudianteObjetivo}
		<div class="alert alert-info" role="status">Tu cuenta no tiene un perfil escolar activo asociado; coordinación debe completar esa ficha.</div>
	{/if}
	{#if cargando}
		<LoadingState label="Cargando actividades..." />
	{:else if actividadesVisibles.length === 0}
		<div class="card border-0 shadow-sm"><EmptyState title="No hay actividades próximas" /></div>
	{:else}
		<div class="d-flex justify-content-end mb-3"><span class="badge text-bg-primary">{actividadesVisibles.length} actividades</span></div>
		<div class="card border-0 shadow-sm"><div class="table-responsive p-3">
			{#key JSON.stringify(actividadesVisibles.map((actividad) => [actividad.id, actividad.inscritos, actividad.disponibles]))}
				<table use:dataTable={actividadesVisibles} class="table table-hover align-middle w-100 mb-0">
					<thead class="table-light"><tr><th>Actividad</th><th>Categoría</th><th>Fecha y hora</th><th>Lugar</th><th>Cupos</th><th>Inscripción</th></tr></thead>
					<tbody>
						{#each actividadesVisibles as actividad (actividad.id)}
							{@const existente = inscripcionExistente(actividad.id)}
							<tr>
								<td><strong>{actividad.nombre}</strong></td>
								<td>{nombreCategoria(actividad)}</td>
								<td>{formatoFecha(actividad.fecha)}<span class="d-block small text-secondary">{actividad.hora || 'Hora por confirmar'}</span></td>
								<td>{actividad.lugar || 'Por confirmar'}</td>
								<td><span class="badge" class:text-bg-success={actividad.disponibles > 0} class:text-bg-secondary={actividad.disponibles === 0}>{actividad.disponibles} disponibles</span><span class="d-block small text-secondary">{actividad.inscritos} de {actividad.cupo} inscritos</span></td>
								<td class="text-nowrap">
									{#if existente}<span class="badge" class:text-bg-success={estaActivo(existente.estado)} class:text-bg-secondary={!estaActivo(existente.estado)}>{estaActivo(existente.estado) ? 'Inscrito' : 'Registro anterior'}</span>
									{:else}<button class="btn btn-sm btn-primary" type="button" onclick={() => inscribir(actividad)} disabled={!actividad.disponibles || !estudianteObjetivo || (esAcudiente && !estudianteSeleccionado) || inscripcionEnCurso !== null}>{inscripcionEnCurso === actividad.id ? 'Guardando...' : esAcudiente ? 'Inscribir acudido' : 'Inscribirme'}</button>{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/key}
		</div><div class="card-footer bg-white small text-secondary">Las actividades y sus cupos se consultan desde la API.</div></div>
	{/if}
</main>

