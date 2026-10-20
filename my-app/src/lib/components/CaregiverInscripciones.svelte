<script>
	import { onMount } from 'svelte';
	import { apiGet, apiRequest, suscribirCambiosApi } from '$lib/api.js';
	import { dataTable } from '$lib/actions/dataTable.js';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FeedbackMessage from '$lib/components/FeedbackMessage.svelte';
	import LoadingState from '$lib/components/LoadingState.svelte';
	import PageHeading from '$lib/components/PageHeading.svelte';

	let inscripciones = $state([]);
	let autorizaciones = $state([]);
	let cargando = $state(true);
	let error = $state('');
	let aviso = $state('');
	let cancelandoId = $state(null);

	function activo(estado) {
		return estado === true || estado === 1 || ['true', '1', 'activo', 'active'].includes(String(estado ?? '').trim().toLowerCase());
	}

	function fechaLegible(valor) {
		if (!valor) return 'Sin fecha';
		const fecha = new Date(`${String(valor).slice(0, 10)}T12:00:00`);
		return Number.isNaN(fecha.getTime()) ? String(valor) : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(fecha);
	}

	function puedeCancelar(inscripcion) {
		if (!activo(inscripcion.estado) || !inscripcion.actividad_fecha) return false;
		const hoy = new Date();
		const hoyTexto = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
		return String(inscripcion.actividad_fecha).slice(0, 10) > hoyTexto;
	}

	function estadoAutorizacion(inscripcionId) {
		const autorizacion = autorizaciones.find((item) => Number(item.inscripcion_id) === Number(inscripcionId));
		if (!autorizacion) return 'Sin autorización registrada';
		if (activo(autorizacion.estado)) return 'Autorizada';
		return autorizacion.fecha_autorizacion ? 'No autorizada / revocada' : 'Pendiente de respuesta';
	}

	async function cargar() {
		cargando = true;
		error = '';
		try {
			const [inscripcionesApi, autorizacionesApi] = await Promise.all([
				apiGet('/inscripciones/'),
				apiGet('/autorizaciones/')
			]);
			if (!Array.isArray(inscripcionesApi) || !Array.isArray(autorizacionesApi)) {
				throw new Error('La API devolvió información incompleta de las participaciones.');
			}
			inscripciones = inscripcionesApi;
			autorizaciones = autorizacionesApi;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'No fue posible cargar las inscripciones.';
		} finally {
			cargando = false;
		}
	}

	async function cancelar(inscripcion) {
		if (!puedeCancelar(inscripcion)) return;
		if (!window.confirm(`¿Deseas cancelar la inscripción de ${inscripcion.estudiante_nombre ?? 'tu acudido'} a ${inscripcion.actividad_nombre ?? 'esta actividad'}?`)) return;
		cancelandoId = inscripcion.id;
		error = '';
		aviso = '';
		try {
			await apiRequest(`/inscripciones/acudidos/${inscripcion.id}`, { method: 'DELETE' });
			aviso = 'Inscripción cancelada.';
			await cargar();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'No fue posible cancelar la inscripción.';
		} finally {
			cancelandoId = null;
		}
	}

	onMount(() => {
		void cargar();
		const unsubscribeApi = suscribirCambiosApi(() => void cargar());
		return () => unsubscribeApi();
	});
</script>

<svelte:head><title>Inscripciones vinculadas | Eventos Escolares</title></svelte:head>

<main class="container-fluid px-3 px-lg-4 py-4">
	<div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
		<PageHeading title="Inscripciones vinculadas" />
		<button class="btn btn-outline-primary" type="button" onclick={cargar} disabled={cargando}><i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Actualizar</button>
	</div>
	{#if aviso}<FeedbackMessage variant="success" message={aviso} />{/if}
	{#if error}<FeedbackMessage variant="danger" message={error} />{/if}
	{#if cargando}
		<LoadingState label="Cargando inscripciones vinculadas..." />
	{:else if inscripciones.length === 0}
		<div class="card border-0 shadow-sm"><EmptyState title="No hay inscripciones vinculadas" /></div>
	{:else}
		<div class="card border-0 shadow-sm"><div class="table-responsive p-3">
			{#key JSON.stringify(inscripciones.map((item) => [item.id, item.estado]))}
				<table use:dataTable={inscripciones} class="table table-hover align-middle w-100 mb-0">
					<thead><tr><th>Estudiante</th><th>Actividad</th><th>Fecha</th><th>Inscripción</th><th>Autorización</th><th>Acción</th></tr></thead>
					<tbody>{#each inscripciones as inscripcion (inscripcion.id)}
						<tr>
							<td>{inscripcion.estudiante_nombre ?? 'Estudiante'}</td>
							<td>{inscripcion.actividad_nombre ?? 'Actividad'}</td>
							<td>{fechaLegible(inscripcion.actividad_fecha)}</td>
							<td>{#if activo(inscripcion.estado)}<span class="badge text-bg-success">Vigente</span>{:else}<span class="badge text-bg-secondary">Cancelada</span>{/if}</td>
							<td>{estadoAutorizacion(inscripcion.id)}</td>
							<td>{#if puedeCancelar(inscripcion)}<button class="btn btn-sm btn-outline-danger" type="button" onclick={() => cancelar(inscripcion)} disabled={cancelandoId !== null}>{cancelandoId === inscripcion.id ? 'Cancelando...' : 'Cancelar'}</button>{:else}<span class="text-secondary small">—</span>{/if}</td>
						</tr>
					{/each}</tbody>
				</table>
			{/key}
		</div><div class="card-footer bg-white small text-secondary">Se muestran únicamente inscripciones vinculadas mediante autorizaciones asociadas a tu cuenta.</div></div>
	{/if}
</main>

