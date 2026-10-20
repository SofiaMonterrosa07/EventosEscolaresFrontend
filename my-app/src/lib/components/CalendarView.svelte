<script>
	import { onMount } from 'svelte';
	import { apiGet, suscribirCambiosApi } from '$lib/api.js';
	import FeedbackMessage from '$lib/components/FeedbackMessage.svelte';
	import LoadingState from '$lib/components/LoadingState.svelte';
	import PageHeading from '$lib/components/PageHeading.svelte';

	let actividades = $state([]);
	let cupos = $state([]);
	let fechaVista = $state(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
	let cargando = $state(true);
	let error = $state('');

	const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
	let nombreMes = $derived(new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(fechaVista));
	let celdas = $derived.by(() => {
		const primerDia = new Date(fechaVista.getFullYear(), fechaVista.getMonth(), 1);
		const inicio = new Date(fechaVista.getFullYear(), fechaVista.getMonth(), 1 - ((primerDia.getDay() + 6) % 7));
		return Array.from({ length: 42 }, (_, indice) => {
			const fecha = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + indice);
			const clave = claveFecha(fecha);
			const eventos = actividades.filter((item) => String(item.fecha ?? '').slice(0, 10) === clave);
			return { fecha, clave, perteneceAlMes: fecha.getMonth() === fechaVista.getMonth(), eventos };
		});
	});

	function activo(estado) {
		return estado === true || estado === 1 || ['true', '1', 'activo', 'active'].includes(String(estado ?? '').trim().toLowerCase());
	}

	function claveFecha(fecha) {
		return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
	}

	function moverMes(delta) {
		fechaVista = new Date(fechaVista.getFullYear(), fechaVista.getMonth() + delta, 1);
	}

	function volverAHoy() {
		const hoy = new Date();
		fechaVista = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
	}

	function inscritos(actividadId) {
		return Number(cupos.find((item) => Number(item.actividad_id) === Number(actividadId))?.inscritos ?? 0);
	}

	function formatoFecha(fecha) {
		return new Intl.DateTimeFormat('es-CO', { dateStyle: 'full' }).format(fecha);
	}

	async function cargar() {
		cargando = true;
		error = '';
		try {
			const [actividadesApi, cuposApi] = await Promise.all([
				apiGet('/actividades/'),
				apiGet('/inscripciones/resumen')
			]);
			if (!Array.isArray(actividadesApi) || !Array.isArray(cuposApi)) {
				throw new Error('La API devolvió información incompleta del calendario.');
			}
			actividades = actividadesApi;
			cupos = cuposApi;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'No fue posible cargar el calendario.';
		} finally {
			cargando = false;
		}
	}

	onMount(() => {
		void cargar();
		const unsubscribeApi = suscribirCambiosApi(() => void cargar());
		return () => unsubscribeApi();
	});
</script>

<svelte:head><title>Calendario y cupos | Eventos Escolares</title></svelte:head>

<main class="container-fluid px-3 px-lg-4 py-4">
	<div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
		<PageHeading title="Calendario y eventos" />
		<div class="d-flex flex-wrap gap-2"><a class="btn btn-outline-primary" href="/actividades"><i class="bi bi-arrow-left me-1" aria-hidden="true"></i>Actividades</a><button class="btn btn-outline-primary" type="button" onclick={cargar} disabled={cargando}><i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Actualizar</button></div>
	</div>
	{#if error}<FeedbackMessage variant="danger" message={error} />{/if}
	{#if cargando}<LoadingState label="Cargando calendario..." />{:else if actividades.length === 0}<div class="alert alert-info" role="status">No hay actividades disponibles para este perfil.</div>{:else}
		<section class="card border-0 shadow-sm" aria-labelledby="calendario-titulo">
			<div class="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
				<div><h2 class="h5 mb-0" id="calendario-titulo">{nombreMes}</h2><span class="small text-secondary">{actividades.length} actividades visibles</span></div>
				<div class="btn-group" role="group" aria-label="Cambiar mes"><button class="btn btn-outline-secondary" type="button" onclick={() => moverMes(-1)} aria-label="Mes anterior"><i class="bi bi-chevron-left" aria-hidden="true"></i></button><button class="btn btn-outline-secondary" type="button" onclick={volverAHoy}>Hoy</button><button class="btn btn-outline-secondary" type="button" onclick={() => moverMes(1)} aria-label="Mes siguiente"><i class="bi bi-chevron-right" aria-hidden="true"></i></button></div>
			</div>
			<div class="table-responsive"><div class="calendar-grid">
				{#each diasSemana as dia (dia)}<div class="calendar-weekday">{dia}</div>{/each}
				{#each celdas as celda (celda.clave)}
					<section class="calendar-day" class:calendar-day-muted={!celda.perteneceAlMes} aria-label={formatoFecha(celda.fecha)}>
						<strong class="calendar-date">{celda.fecha.getDate()}</strong>
						{#each celda.eventos as actividad (actividad.id)}
							<article class="calendar-event" class:calendar-event-inactive={!activo(actividad.estado)}>
								<strong>{actividad.nombre}</strong><span>{actividad.hora ?? 'Hora por confirmar'} · {actividad.lugar ?? 'Lugar por confirmar'}</span>
								{#if activo(actividad.estado) && String(actividad.fecha).slice(0, 10) >= claveFecha(new Date())}
									<small>{Math.max(Number(actividad.cupo ?? 0) - inscritos(actividad.id), 0)} cupos disponibles</small>
								{:else}<small>{activo(actividad.estado) ? 'Actividad finalizada' : 'Actividad inactiva'}</small>{/if}
							</article>
						{/each}
					</section>
				{/each}
			</div></div>
		</section>
	{/if}
</main>

<style>
	.calendar-grid { min-width: 980px; display: grid; grid-template-columns: repeat(7, minmax(130px, 1fr)); }
	.calendar-weekday { padding: .65rem; text-align: center; font-weight: 600; background: var(--bs-light); border: 1px solid var(--bs-border-color); }
	.calendar-day { min-height: 145px; padding: .45rem; border: 1px solid var(--bs-border-color); overflow: hidden; }
	.calendar-day-muted { background: #f8f9fa; color: #8a929b; }
	.calendar-date { display: block; margin-bottom: .35rem; }
	.calendar-event { display: grid; gap: .12rem; margin-bottom: .3rem; padding: .35rem; border-left: 3px solid var(--bs-primary); border-radius: .25rem; background: var(--bs-primary-bg-subtle); color: var(--bs-emphasis-color); font-size: .72rem; line-height: 1.2; }
	.calendar-event-inactive { border-left-color: var(--bs-secondary); background: var(--bs-secondary-bg-subtle); }
	.calendar-event span, .calendar-event small { color: var(--bs-secondary-color); }
</style>

