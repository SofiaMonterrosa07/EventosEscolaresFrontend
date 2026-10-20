<script>
	import { onMount } from 'svelte';
	import { apiGet, apiRequest, suscribirCambiosApi } from '$lib/api.js';
	import { dataTable } from '$lib/actions/dataTable.js';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FeedbackMessage from '$lib/components/FeedbackMessage.svelte';
	import LoadingState from '$lib/components/LoadingState.svelte';
	import PageHeading from '$lib/components/PageHeading.svelte';

	let autorizaciones = $state([]);
	let cargando = $state(true);
	let guardandoId = $state(null);
	let error = $state('');
	let aviso = $state('');

	function estaAutorizada(valor) {
		return valor === true || valor === 1 || ['true', '1', 'autorizada', 'autorizado'].includes(String(valor ?? '').trim().toLowerCase());
	}

	function textoEstado(registro) {
		if (estaAutorizada(registro.estado)) return 'Autorizada';
		return registro.fecha_autorizacion ? 'Revocada o no autorizada' : 'Pendiente de respuesta';
	}

	function textoAccion(registro) {
		if (estaAutorizada(registro.estado)) return 'Revocar autorización';
		return registro.fecha_autorizacion ? 'Renovar autorización' : 'Autorizar actividad';
	}

	function fechaLegible(valor) {
		if (!valor) return 'Pendiente de respuesta';
		const fecha = new Date(`${String(valor).slice(0, 10)}T12:00:00`);
		return Number.isNaN(fecha.getTime())
			? String(valor)
			: new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(fecha);
	}

	async function cargar() {
		cargando = true;
		error = '';
		try {
			const registros = await apiGet('/autorizaciones/');
			if (!Array.isArray(registros)) throw new Error('La API no devolvió una lista válida.');
			autorizaciones = registros;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'No fue posible cargar las autorizaciones.';
		} finally {
			cargando = false;
		}
	}

	async function responder(registro) {
		guardandoId = registro.id;
		error = '';
		aviso = '';
		try {
			const estado = !estaAutorizada(registro.estado);
			await apiRequest(`/autorizaciones/${registro.id}/consentimiento`, {
				method: 'PATCH',
				body: { estado }
			});
			await cargar();
			aviso = estado ? 'Autorización registrada.' : 'Autorización revocada.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'No fue posible guardar la respuesta.';
		} finally {
			guardandoId = null;
		}
	}

	onMount(() => {
		void cargar();
		const unsubscribeApi = suscribirCambiosApi(() => void cargar());
		return () => unsubscribeApi();
	});
</script>

<svelte:head><title>Autorizaciones | Eventos Escolares</title></svelte:head>

<main class="container-fluid px-3 px-lg-4 py-4">
	<div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
		<PageHeading title="Autorizaciones" />
		<button class="btn btn-outline-primary" type="button" onclick={cargar} disabled={cargando}>
			<i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Actualizar
		</button>
	</div>
	{#if aviso}<FeedbackMessage variant="success" message={aviso} />{/if}
	{#if error}<FeedbackMessage variant="danger" message={error} />{/if}
	{#if cargando}
		<LoadingState label="Cargando autorizaciones..." />
	{:else if autorizaciones.length === 0}
		<div class="card border-0 shadow-sm"><EmptyState title="No hay autorizaciones pendientes o registradas" /></div>
	{:else}
		<div class="card border-0 shadow-sm"><div class="table-responsive p-3">
			<table use:dataTable={autorizaciones} class="table table-hover align-middle w-100 mb-0">
				<thead><tr><th>Estudiante</th><th>Actividad</th><th>Fecha de la actividad</th><th>Respuesta</th><th>Fecha de respuesta</th><th>Acción</th></tr></thead>
				<tbody>
					{#each autorizaciones as registro (registro.id)}
						<tr>
							<td>{registro.estudiante_nombre ?? 'Estudiante'}</td>
							<td>{registro.actividad_nombre ?? 'Actividad'}</td>
							<td>{fechaLegible(registro.actividad_fecha)}</td>
							<td><span class={`badge ${estaAutorizada(registro.estado) ? 'text-bg-success' : 'text-bg-warning'}`}>{textoEstado(registro)}</span></td>
							<td>{fechaLegible(registro.fecha_autorizacion)}</td>
							<td class="text-nowrap">
								<button class={`btn btn-sm ${estaAutorizada(registro.estado) ? 'btn-outline-danger' : 'btn-success'}`} type="button" onclick={() => responder(registro)} disabled={guardandoId !== null}>
									{guardandoId === registro.id ? 'Guardando...' : textoAccion(registro)}
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div><div class="card-footer bg-white text-secondary small">{autorizaciones.length} autorizaciones vinculadas</div></div>
	{/if}
</main>

