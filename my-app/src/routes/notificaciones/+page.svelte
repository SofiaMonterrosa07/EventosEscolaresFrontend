<script>
	import { onMount } from 'svelte';
	import { apiGet, apiRequest, suscribirCambiosApi } from '$lib/api.js';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FeedbackMessage from '$lib/components/FeedbackMessage.svelte';
	import LoadingState from '$lib/components/LoadingState.svelte';
	import PageHeading from '$lib/components/PageHeading.svelte';
	import { leerPerfilActivo, leerRolActivo } from '$lib/permisos.js';

	let notificaciones = $state([]);
	let usuarios = $state([]);
	let actividades = $state([]);
	let perfil = $state(null);
	let rol = $state('');
	let cargando = $state(true);
	let guardando = $state(false);
	let marcandoId = $state(null);
	let error = $state('');
	let aviso = $state('');
	let buscarNotificacion = $state('');
	let filtroLectura = $state('todas');
	let filtroActividad = $state('todas');
	let fechaDesde = $state('');
	let fechaHasta = $state('');
	let ordenDireccion = $state('desc');
	let pagina = $state(1);
	const filasPorPagina = 10;
	let formulario = $state({ usuario_id: '', actividad_id: '', titulo: '', mensaje: '' });

	let esAdministrador = $derived(rol === 'administrador');
	let usuariosActivos = $derived(usuarios.filter((item) => item.estado === true || item.estado === 1));
	let actividadesActivas = $derived(actividades.filter((item) => item.estado === true || item.estado === 1));
	let actividadesNotificadas = $derived([...new Set(notificaciones.map((item) => item.actividad_nombre).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')));
	let notificacionesFiltradas = $derived.by(() => {
		const texto = buscarNotificacion.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
		return notificaciones.filter((item) => {
			const coincideTexto = !texto || [item.titulo, item.mensaje, item.actividad_nombre].some((valor) => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(texto));
			const coincideEstado = filtroLectura === 'todas' || (filtroLectura === 'leidas' && item.leida) || (filtroLectura === 'pendientes' && !item.leida);
			const coincideActividad = filtroActividad === 'todas' || String(item.actividad_nombre ?? '') === filtroActividad;
			const fecha = String(item.fecha_envio ?? '').slice(0, 10);
			return coincideTexto && coincideEstado && coincideActividad && (!fechaDesde || fecha >= fechaDesde) && (!fechaHasta || fecha <= fechaHasta);
		}).sort((a, b) => {
			const diferencia = new Date(a.fecha_envio ?? 0).getTime() - new Date(b.fecha_envio ?? 0).getTime();
			return ordenDireccion === 'asc' ? diferencia : -diferencia;
		});
	});
	let totalPaginas = $derived(Math.max(1, Math.ceil(notificacionesFiltradas.length / filasPorPagina)));
	let notificacionesPagina = $derived(notificacionesFiltradas.slice((pagina - 1) * filasPorPagina, pagina * filasPorPagina));
	$effect(() => { if (pagina > totalPaginas) pagina = totalPaginas; });

	function actualizarPerfil() {
		perfil = leerPerfilActivo();
		rol = leerRolActivo();
	}

	async function cargar() {
		cargando = true;
		error = '';
		try {
			const peticiones = [apiGet('/notificaciones/')];
			if (esAdministrador) peticiones.push(apiGet('/usuarios/'), apiGet('/actividades/'));
			const [notificacionesApi, usuariosApi = [], actividadesApi = []] = await Promise.all(peticiones);
			if (!Array.isArray(notificacionesApi) || !Array.isArray(usuariosApi) || !Array.isArray(actividadesApi)) {
				throw new Error('La API devolvió información incompleta de las notificaciones.');
			}
			notificaciones = notificacionesApi;
			usuarios = usuariosApi;
			actividades = actividadesApi;
			if (esAdministrador && !formulario.usuario_id && usuariosActivos.length) {
				formulario.usuario_id = String(usuariosActivos[0].id);
			}
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'No fue posible cargar las notificaciones.';
		} finally {
			cargando = false;
		}
	}

	function fechaLegible(valor) {
		if (!valor) return 'Sin fecha';
		const fecha = new Date(valor);
		return Number.isNaN(fecha.getTime()) ? String(valor) : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(fecha);
	}

	async function enviar() {
		if (!esAdministrador || !formulario.usuario_id || !formulario.titulo.trim() || !formulario.mensaje.trim()) return;
		guardando = true;
		error = '';
		aviso = '';
		try {
			await apiRequest('/notificaciones/', {
				method: 'POST',
				body: {
					usuario_id: Number(formulario.usuario_id),
					actividad_id: formulario.actividad_id ? Number(formulario.actividad_id) : null,
					titulo: formulario.titulo.trim(),
					mensaje: formulario.mensaje.trim()
				}
			});
			formulario = { ...formulario, titulo: '', mensaje: '' };
			aviso = 'Notificación enviada.';
			await cargar();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'No fue posible enviar la notificación.';
		} finally {
			guardando = false;
		}
	}

	async function marcarLeida(registro) {
		if (Number(registro.usuario_id) !== Number(perfil?.usuario?.id) || registro.leida) return;
		marcandoId = registro.id;
		error = '';
		try {
			await apiRequest(`/notificaciones/${registro.id}/leida`, { method: 'PATCH' });
			aviso = 'Notificación marcada como leída.';
			await cargar();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'No fue posible actualizar la notificación.';
		} finally {
			marcandoId = null;
		}
	}

	onMount(() => {
		actualizarPerfil();
		void cargar();
		const unsubscribeData = suscribirCambiosApi(() => void cargar());
		window.addEventListener('perfil-portal-cambiado', actualizarPerfil);
		return () => {
			unsubscribeData();
			window.removeEventListener('perfil-portal-cambiado', actualizarPerfil);
		};
	});
</script>

<svelte:head><title>Notificaciones | Eventos Escolares</title></svelte:head>

<main class="container-fluid px-3 px-lg-4 py-4">
	<PageHeading title="Notificaciones" />
	{#if aviso}<FeedbackMessage variant="success" message={aviso} />{/if}
	{#if error}<FeedbackMessage variant="danger" message={error} />{/if}
	{#if esAdministrador}
		<section class="card border-0 shadow-sm my-4" aria-labelledby="crear-notificacion">
			<div class="card-header bg-white"><h2 class="h5 mb-0" id="crear-notificacion">Enviar notificación</h2></div>
			<div class="card-body">
				<form onsubmit={(event) => { event.preventDefault(); void enviar(); }}>
					<div class="row g-3">
						<div class="col-12 col-md-6"><label class="form-label" for="destinatario">Destinatario</label><select id="destinatario" class="form-select" bind:value={formulario.usuario_id} required><option value="">Selecciona una cuenta</option>{#each usuariosActivos as usuario (usuario.id)}<option value={String(usuario.id)}>{usuario.nombre} · {usuario.rol_nombre}</option>{/each}</select></div>
						<div class="col-12 col-md-6"><label class="form-label" for="actividad-notificacion">Actividad (opcional)</label><select id="actividad-notificacion" class="form-select" bind:value={formulario.actividad_id}><option value="">Sin actividad asociada</option>{#each actividadesActivas as actividad (actividad.id)}<option value={String(actividad.id)}>{actividad.nombre}</option>{/each}</select></div>
						<div class="col-12"><label class="form-label" for="titulo-notificacion">Título</label><input id="titulo-notificacion" class="form-control" bind:value={formulario.titulo} maxlength="150" required /></div>
						<div class="col-12"><label class="form-label" for="mensaje-notificacion">Mensaje</label><textarea id="mensaje-notificacion" class="form-control" rows="3" bind:value={formulario.mensaje} maxlength="2000" required></textarea></div>
					</div>
					<div class="d-flex justify-content-end mt-3"><button class="btn btn-primary" type="submit" disabled={guardando || !usuariosActivos.length}>{guardando ? 'Enviando...' : 'Enviar'}</button></div>
				</form>
			</div>
		</section>
	{/if}
	{#if cargando}
		<LoadingState label="Cargando notificaciones..." />
	{:else if notificaciones.length === 0}
		<div class="card border-0 shadow-sm mt-4"><EmptyState title="No tienes notificaciones" /></div>
	{:else}
		<div class="card border-0 shadow-sm mt-4">
			<div class="card-body border-bottom"><div class="row g-3 align-items-end">
				<div class="col-12 col-md-4"><label class="form-label" for="buscar-notificacion">Buscar</label><input id="buscar-notificacion" class="form-control" type="search" placeholder="Título, mensaje o actividad..." value={buscarNotificacion} oninput={(event) => { buscarNotificacion = event.currentTarget.value; pagina = 1; }} /></div>
				<div class="col-6 col-md-2"><label class="form-label" for="filtro-leida">Estado</label><select id="filtro-leida" class="form-select" value={filtroLectura} onchange={(event) => { filtroLectura = event.currentTarget.value; pagina = 1; }}><option value="todas">Todas</option><option value="leidas">Leídas</option><option value="pendientes">Pendientes</option></select></div>
				<div class="col-6 col-md-3"><label class="form-label" for="filtro-actividad-notificacion">Actividad</label><select id="filtro-actividad-notificacion" class="form-select" value={filtroActividad} onchange={(event) => { filtroActividad = event.currentTarget.value; pagina = 1; }}><option value="todas">Todas</option>{#each actividadesNotificadas as actividad (actividad)}<option value={actividad}>{actividad}</option>{/each}</select></div>
				<div class="col-6 col-md-2"><label class="form-label" for="notificacion-desde">Desde</label><input id="notificacion-desde" class="form-control" type="date" value={fechaDesde} onchange={(event) => { fechaDesde = event.currentTarget.value; pagina = 1; }} /></div>
				<div class="col-6 col-md-2"><label class="form-label" for="notificacion-hasta">Hasta</label><input id="notificacion-hasta" class="form-control" type="date" value={fechaHasta} onchange={(event) => { fechaHasta = event.currentTarget.value; pagina = 1; }} /></div>
				<div class="col-6 col-md-2"><label class="form-label" for="orden-notificaciones">Fecha</label><select id="orden-notificaciones" class="form-select" value={ordenDireccion} onchange={(event) => { ordenDireccion = event.currentTarget.value; pagina = 1; }}><option value="desc">Más recientes</option><option value="asc">Más antiguas</option></select></div>
				<div class="col-12 col-md-auto"><button class="btn btn-outline-secondary" type="button" onclick={() => { buscarNotificacion = ''; filtroLectura = 'todas'; filtroActividad = 'todas'; fechaDesde = ''; fechaHasta = ''; ordenDireccion = 'desc'; pagina = 1; }}>Limpiar filtros</button></div>
			</div></div>
			{#if notificacionesFiltradas.length === 0}<div class="p-4 text-center text-secondary">No hay notificaciones que coincidan con esos filtros.</div>{:else}<div class="table-responsive p-3">
			<table class="table table-hover align-middle mb-0"><thead><tr><th>Mensaje</th><th>Actividad</th><th>Fecha</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
				{#each notificacionesPagina as notificacion (notificacion.id)}
					<tr class:table-light={!notificacion.leida}><td><strong>{notificacion.titulo}</strong><span class="d-block text-secondary small">{notificacion.mensaje}</span></td><td>{notificacion.actividad_nombre ?? '—'}</td><td>{fechaLegible(notificacion.fecha_envio)}</td><td>{notificacion.leida ? 'Leída' : 'Pendiente'}</td><td>{#if Number(notificacion.usuario_id) === Number(perfil?.usuario?.id) && !notificacion.leida}<button class="btn btn-sm btn-outline-primary" type="button" onclick={() => marcarLeida(notificacion)} disabled={marcandoId !== null}>{marcandoId === notificacion.id ? 'Guardando...' : 'Marcar leída'}</button>{:else}<span class="text-secondary small">—</span>{/if}</td></tr>
				{/each}
			</tbody></table>
		</div>{/if}<div class="card-footer bg-white d-flex flex-wrap justify-content-between align-items-center gap-2 text-secondary small"><span>Mostrando {notificacionesFiltradas.length ? (pagina - 1) * filasPorPagina + 1 : 0}–{Math.min(pagina * filasPorPagina, notificacionesFiltradas.length)} de {notificacionesFiltradas.length} notificaciones.</span>{#if notificacionesFiltradas.length > filasPorPagina}<nav class="d-flex align-items-center gap-2" aria-label="Paginación de notificaciones"><button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página anterior" onclick={() => pagina = Math.max(1, pagina - 1)} disabled={pagina <= 1}><i class="bi bi-chevron-left" aria-hidden="true"></i></button><span>Página {pagina} de {totalPaginas}</span><button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página siguiente" onclick={() => pagina = Math.min(totalPaginas, pagina + 1)} disabled={pagina >= totalPaginas}><i class="bi bi-chevron-right" aria-hidden="true"></i></button></nav>{/if}</div></div>
	{/if}
</main>

