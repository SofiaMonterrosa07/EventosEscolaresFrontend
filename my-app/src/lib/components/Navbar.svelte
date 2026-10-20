
<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { apiGet, suscribirCambiosApi } from '$lib/api.js';
	import { guardarPerfilAutenticado, leerPerfilAutenticado, leerToken } from '$lib/auth.js';
	import { normalizarNombre, obtenerRutaModulo } from '$lib/modulos.js';

	let menuAbierto = $state(false);
	let grupoAbierto = $state('');
	let modulosPermitidos = $state([]);
	let errorModulos = $state('');
	let cargandoModulos = $state(true);
	let perfilActivo = $state(false);
	let solicitudActual = 0;

	const iconosModulo = Object.freeze({
		usuarios: 'bi-people', roles: 'bi-shield-lock', actividades: 'bi-calendar-event',
		inscripciones: 'bi-pencil-square', autorizaciones: 'bi-file-earmark-check', asistencia: 'bi-person-check',
		reportes: 'bi-card-list', analitica: 'bi-clipboard-data',
		estudiantes: 'bi-mortarboard', acudientes: 'bi-people-fill',
		categorias: 'bi-tags', bienestar: 'bi-heart-pulse', notificaciones: 'bi-bell'
	});

	const gruposMenu = [
		{ key: 'gestion', nombre: 'Gestión escolar', icono: 'bi-calendar2-check', modulos: new Set(['actividades', 'categorias', 'estudiantes', 'acudientes', 'inscripciones', 'asistencia', 'autorizaciones']) },
		{ key: 'seguimiento', nombre: 'Seguimiento', icono: 'bi-graph-up-arrow', modulos: new Set(['reportes', 'analitica', 'bienestar']) },
		{ key: 'comunicaciones', nombre: 'Comunicaciones', icono: 'bi-chat-left-text', modulos: new Set(['notificaciones']) },
		{ key: 'administracion', nombre: 'Administración', icono: 'bi-shield-lock', modulos: new Set(['usuarios', 'roles']) }
	];

	let rutasVisibles = $derived(
		modulosPermitidos.flatMap((modulo) => {
			const clave = normalizarNombre(modulo.nombre);
			const ruta = obtenerRutaModulo(modulo.nombre);
			return ruta ? [{ key: clave, ruta, icono: iconosModulo[clave] ?? 'bi-grid', nombre: modulo.nombre }] : [];
		})
	);
	let gruposVisibles = $derived(
		gruposMenu
			.map((grupo) => ({ ...grupo, items: rutasVisibles.filter((item) => grupo.modulos.has(item.key)) }))
			.filter((grupo) => grupo.items.length > 0)
	);

	function leerPerfilGuardado() {
		const perfil = leerPerfilAutenticado();
		perfilActivo = Boolean(leerToken() && perfil);
		modulosPermitidos = perfilActivo && Array.isArray(perfil?.modulos) ? perfil.modulos : [];
	}

	async function actualizarPerfilDesdeApi() {
		const solicitud = ++solicitudActual;
		if (!leerToken()) {
			modulosPermitidos = [];
			perfilActivo = false;
			cargandoModulos = false;
			return;
		}
		cargandoModulos = true;
		try {
			const perfil = await apiGet('/auth/me');
			if (solicitud !== solicitudActual) return;
			guardarPerfilAutenticado(perfil);
			perfilActivo = true;
			modulosPermitidos = Array.isArray(perfil?.modulos) ? perfil.modulos : [];
			errorModulos = '';
		} catch (error) {
			if (solicitud === solicitudActual) {
				console.error('Error cargando los módulos del perfil:', error);
				perfilActivo = Boolean(leerToken());
				errorModulos = 'No se pudieron actualizar los módulos asignados a tu perfil.';
			}
		} finally {
			if (solicitud === solicitudActual) cargandoModulos = false;
		}
	}

	function cerrarMenu() {
		menuAbierto = false;
		grupoAbierto = '';
	}

	function cerrarMenuAlHacerClickFuera(evento) {
		if (evento.target instanceof Element && !evento.target.closest('.navbar')) cerrarMenu();
	}

	function alternarGrupo(key) {
		grupoAbierto = grupoAbierto === key ? '' : key;
	}

	function grupoEstaActivo(items) {
		return items.some((item) => esRutaActiva(item.ruta));
	}

	function esRutaActiva(ruta) {
		return page.url.pathname === ruta;
	}

	onMount(() => {
		leerPerfilGuardado();
		void actualizarPerfilDesdeApi();
		document.addEventListener('pointerdown', cerrarMenuAlHacerClickFuera);
		const unsubscribeData = suscribirCambiosApi(() => void actualizarPerfilDesdeApi());

		function actualizarPerfil() {
			leerPerfilGuardado();
			if (leerToken()) void actualizarPerfilDesdeApi();
		}
		window.addEventListener('perfil-portal-cambiado', leerPerfilGuardado);
		window.addEventListener('portal-sesion-cambiada', actualizarPerfil);

		return () => {
			solicitudActual++;
			unsubscribeData();
			document.removeEventListener('pointerdown', cerrarMenuAlHacerClickFuera);
			window.removeEventListener('perfil-portal-cambiado', leerPerfilGuardado);
			window.removeEventListener('portal-sesion-cambiada', actualizarPerfil);
		};
	});
</script>
<nav class="navbar navbar-expand-lg portal-navbar bg-white border-bottom py-2" aria-label="Menú principal">
	<div class="container-fluid px-3 px-lg-5">
		<div class="d-flex align-items-center gap-2 me-lg-4">
			<a class="portal-home-link bg-primary-subtle text-primary rounded-3 d-inline-flex align-items-center justify-content-center fs-5" href="/inicio" aria-label="Ir al inicio"><i class="bi bi-grid-1x2-fill" aria-hidden="true"></i></a>
			<div class="lh-sm"><strong class="d-block small">Explorar módulos</strong><span class="text-secondary small">{rutasVisibles.length} disponibles</span></div>
		</div>
		<button
			class="navbar-toggler"
			type="button"
			aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
			aria-expanded={menuAbierto}
			onclick={() => menuAbierto = !menuAbierto}
		>
			<span class="navbar-toggler-icon"></span>
		</button>

		<div class:show={menuAbierto} class="collapse navbar-collapse">
			<div class="navbar-nav flex-column flex-lg-row align-items-stretch align-items-lg-center gap-2 py-3 py-lg-0">
				{#each gruposVisibles as grupo (grupo.key)}
					<div class="dropdown">
						<button
							class="btn btn-light border d-flex align-items-center justify-content-between gap-3 w-100 rounded-3 px-3 py-2 text-start"
							class:border-primary={grupoEstaActivo(grupo.items)}
							class:text-primary-emphasis={grupoEstaActivo(grupo.items)}
							class:shadow-sm={grupoEstaActivo(grupo.items)}
							class:show={grupoAbierto === grupo.key}
							type="button"
							aria-expanded={grupoAbierto === grupo.key}
							onclick={() => alternarGrupo(grupo.key)}
						>
							<span><i class={`bi ${grupo.icono} me-2`} aria-hidden="true"></i>{grupo.nombre}</span>
							<span class="badge rounded-pill bg-white text-primary">{grupo.items.length}</span>
						</button>
						<div class:show={grupoAbierto === grupo.key} class="dropdown-menu border-0 shadow-sm p-2 mt-2">
							{#each grupo.items as item (item.key)}
								<a
									href={item.ruta}
									class:active={esRutaActiva(item.ruta)}
									class="dropdown-item rounded-2 py-2"
									aria-current={esRutaActiva(item.ruta) ? 'page' : undefined}
									onclick={cerrarMenu}
								>
									<i class={`bi ${item.icono} me-2`} aria-hidden="true"></i>{item.nombre}
								</a>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			{#if cargandoModulos}
				<div class="navbar-text small text-secondary" role="status"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Cargando módulos...</div>
			{:else if perfilActivo && errorModulos}
				<div class="alert alert-danger py-2 px-3 mb-0 small" role="alert">{errorModulos}</div>
			{:else if perfilActivo && rutasVisibles.length === 0}
				<div class="alert alert-warning py-2 px-3 mb-0 small" role="status">Este rol no tiene módulos asignados.</div>
			{/if}
		</div>
	</div>
</nav>

