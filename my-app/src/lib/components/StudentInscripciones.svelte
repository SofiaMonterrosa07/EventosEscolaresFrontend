<script>
	import { onMount } from 'svelte';
	import { apiGet, apiRequest, suscribirCambiosApi } from '$lib/api.js';
	import { dataTable } from '$lib/actions/dataTable.js';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FeedbackMessage from '$lib/components/FeedbackMessage.svelte';
	import LoadingState from '$lib/components/LoadingState.svelte';
	import PageHeading from '$lib/components/PageHeading.svelte';

	let inscripciones = $state([]);
	let actividades = $state([]);
	let cargando = $state(true);
	let error = $state('');
	let aviso = $state('');
	let cancelandoId = $state(null);

	let participaciones = $derived(
		inscripciones.map((inscripcion) => {
			return {
				...inscripcion,
				actividad: actividades.find(
					(item) => Number(item.id) === Number(inscripcion.actividad_id)
				) ?? null
			};
		})
	);

	function estaActivo(estado) {
		return estado === true || estado === 1 || ['true', '1', 'activo', 'active'].includes(String(estado).trim().toLowerCase());
	}

	function formatoFecha(fecha) {
		if (!fecha) return 'Fecha por confirmar';
		const valor = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
		return Number.isNaN(valor.getTime())
			? String(fecha)
			: new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(valor);
	}

	function puedeCancelar(participacion) {
		if (!estaActivo(participacion.estado) || !participacion.actividad?.fecha) return false;
		const hoy = new Date();
		const hoyTexto = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
		return String(participacion.actividad.fecha).slice(0, 10) > hoyTexto;
	}

	async function cargarDatos() {
		cargando = true;
		error = '';
		try {
			const [inscripcionesApi, actividadesApi] = await Promise.all([
				apiGet('/inscripciones/'),
				apiGet('/actividades/')
			]);
			if (![inscripcionesApi, actividadesApi].every(Array.isArray)) {
				throw new Error('La API devolvió información incompleta para las inscripciones.');
			}

			inscripciones = inscripcionesApi;
			actividades = actividadesApi;
		} catch (cause) {
			console.error('Error cargando las participaciones:', cause);
			error = cause instanceof Error ? cause.message : 'No fue posible cargar las inscripciones.';
		} finally {
			cargando = false;
		}
	}

	async function cancelar(participacion) {
		if (!puedeCancelar(participacion)) return;
		if (!window.confirm(`¿Deseas cancelar tu inscripción a ${participacion.actividad?.nombre ?? 'esta actividad'}?`)) return;
		cancelandoId = participacion.id;
		error = '';
		aviso = '';
		try {
			await apiRequest(`/inscripciones/propias/${participacion.id}`, { method: 'DELETE' });
			aviso = 'Inscripción cancelada.';
			await cargarDatos();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'No fue posible cancelar la inscripción.';
		} finally {
			cancelandoId = null;
		}
	}

	onMount(() => {
		void cargarDatos();
		const unsubscribeApi = suscribirCambiosApi(() => void cargarDatos());
		return () => unsubscribeApi();
	});
</script>

<svelte:head><title>Inscripciones | Eventos Escolares</title></svelte:head>

<main class="container-fluid px-3 px-lg-4 py-4">
	<div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
		<PageHeading title="Mis participaciones" />
		<button class="btn btn-outline-primary" type="button" onclick={cargarDatos} disabled={cargando}>
			<i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Actualizar
		</button>
	</div>

	{#if error}<FeedbackMessage variant="danger" message={error} />{/if}
	{#if aviso}<FeedbackMessage variant="success" message={aviso} />{/if}

	{#if cargando}
		<LoadingState label="Cargando participaciones..." />
	{:else if participaciones.length === 0}
		<div class="card border-0 shadow-sm"><EmptyState title="Aún no tienes participaciones" /></div>
	{:else}
		<section class="card border-0 shadow-sm" aria-labelledby="participaciones-title">
			<div class="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
				<div><h2 class="h5 mb-1" id="participaciones-title">Mis registros</h2><p class="small text-secondary mb-0">La información se actualiza desde la API.</p></div>
				<span class="badge text-bg-primary">{participaciones.length} registros</span>
			</div>
			<div class="table-responsive p-3">
				{#key JSON.stringify(participaciones.map((item) => [item.id, item.estado]))}
					<table use:dataTable={participaciones} class="table table-hover align-middle w-100 mb-0">
						<thead class="table-light"><tr><th>Actividad</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
						<tbody>
							{#each participaciones as participacion (participacion.id)}
								<tr>
									<td>{participacion.actividad?.nombre ?? 'Actividad no disponible'}</td>
									<td>{formatoFecha(participacion.actividad?.fecha)}</td>
									<td>{#if estaActivo(participacion.estado)}<span class="badge text-bg-success">Vigente</span>{:else}<span class="badge text-bg-secondary">Inactiva</span>{/if}</td>
									<td>{#if puedeCancelar(participacion)}<button class="btn btn-sm btn-outline-danger" type="button" onclick={() => cancelar(participacion)} disabled={cancelandoId !== null}>{cancelandoId === participacion.id ? 'Cancelando...' : 'Cancelar'}</button>{:else}<span class="text-secondary small">—</span>{/if}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/key}
			</div>
		</section>
	{/if}
</main>

