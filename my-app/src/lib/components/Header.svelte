<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { cerrarSesion as limpiarSesion } from '$lib/auth.js';

	let perfil = $state(null);
	let cuentaAbierta = $state(false);
	let rutaActual = $derived(page.url.pathname);
	let nombreModulo = $derived(
		rutaActual === '/'
			? 'Portal escolar'
			: decodeURIComponent(rutaActual.split('/').filter(Boolean).at(-1) ?? '')
				.replace(/[-_]/g, ' ')
				.replace(/\b\p{L}/gu, (letra) => letra.toLocaleUpperCase())
	);

	function leerPerfil() {
		try {
			const raw = sessionStorage.getItem('perfilPortal');
			perfil = raw ? JSON.parse(raw) : null;
		} catch {
			perfil = null;
		}
	}

	function cerrarSesion() {
		limpiarSesion();
		cuentaAbierta = false;
		void goto('/');
	}

	function cerrarCuentaAlHacerClickFuera(evento) {
		if (evento.target instanceof Element && !evento.target.closest('.header-account-menu')) {
			cuentaAbierta = false;
		}
	}

	onMount(() => {
		leerPerfil();
		window.addEventListener('perfil-portal-cambiado', leerPerfil);
		document.addEventListener('pointerdown', cerrarCuentaAlHacerClickFuera);
		return () => {
			window.removeEventListener('perfil-portal-cambiado', leerPerfil);
			document.removeEventListener('pointerdown', cerrarCuentaAlHacerClickFuera);
		};
	});
</script>

<header class="portal-header bg-white border-bottom position-relative z-3">
	<div class="container-fluid px-3 px-lg-5 py-3 d-flex align-items-center justify-content-between gap-3">
		<a href={perfil?.rol?.nombre ? rutaActual : '/'} class="text-decoration-none text-dark d-flex align-items-center gap-3">
			<span class="portal-brand-mark rounded-4 bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center fs-4">
				<i class="bi bi-mortarboard-fill" aria-hidden="true"></i>
			</span>
			<span>
				<strong class="d-block fs-5 lh-sm">Eventos Escolares</strong>
				<span class="small text-secondary">Colegio San Miguel <span class="mx-1">·</span> {nombreModulo}</span>
			</span>
		</a>

		{#if perfil?.rol?.nombre}
			<div class="dropdown header-account-menu">
				<button
					class="btn btn-white border rounded-pill d-flex align-items-center gap-2 py-2 px-3 portal-account-button"
					type="button"
					aria-expanded={cuentaAbierta}
					aria-haspopup="true"
					onclick={() => cuentaAbierta = !cuentaAbierta}
				>
					<span class="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center fw-semibold flex-shrink-0 portal-avatar">
						{(perfil.usuario?.nombre ?? perfil.rol.nombre).slice(0, 1).toLocaleUpperCase()}
					</span>
					<span class="text-start d-none d-sm-block">
						<strong class="d-block small text-dark">{perfil.usuario?.nombre ?? perfil.rol.nombre}</strong>
						<span class="small text-secondary">{perfil.rol.nombre}</span>
					</span>
					<i class={`bi ${cuentaAbierta ? 'bi-chevron-up' : 'bi-chevron-down'} text-secondary`} aria-hidden="true"></i>
				</button>

				{#if cuentaAbierta}
					<div class="dropdown-menu dropdown-menu-end show mt-2 p-2 border-0 shadow">
						<div class="px-3 py-2">
							<p class="small text-secondary text-uppercase fw-semibold mb-1">Sesión iniciada</p>
							<p class="mb-1 fw-semibold">{perfil.usuario?.nombre ?? perfil.rol.nombre}</p>
							<p class="small text-secondary mb-1">{perfil.usuario?.correo ?? ''}</p>
							<p class="small text-secondary mb-0">Perfil: {perfil.rol.nombre}</p>
						</div>
						<hr class="dropdown-divider" />
						<button class="dropdown-item rounded-2 py-2 text-danger" type="button" onclick={cerrarSesion}>
							<i class="bi bi-box-arrow-right me-2" aria-hidden="true"></i>Cerrar sesión
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</header>

