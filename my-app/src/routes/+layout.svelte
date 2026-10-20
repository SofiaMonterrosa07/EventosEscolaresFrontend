<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import { apiGet, suscribirCambiosApi } from '$lib/api.js';
	import { guardarPerfilAutenticado, leerToken } from '$lib/auth.js';
	import 'bootstrap/dist/css/bootstrap.min.css';
	import 'bootstrap-icons/font/bootstrap-icons.css';
	import 'datatables.net-bs5/css';
	import 'datatables.net-responsive-bs5/css';
	import '$lib/styles/theme.css';
	import { obtenerRutaModulo } from '$lib/modulos.js';

	let { children } = $props();
	let esInicio = $derived(page.url.pathname === '/');
	let validandoPermiso = $state(false);
	let errorPermiso = $state('');
	let accesoDenegado = $state(false);
	let solicitudPermiso = 0;

	async function validarAcceso(ruta) {
		const solicitud = ++solicitudPermiso;
		validandoPermiso = true;
		errorPermiso = '';
		accesoDenegado = false;

		if (!leerToken()) {
			accesoDenegado = true;
			validandoPermiso = false;
			await goto('/', { replaceState: true });
			return;
		}

		try {
			// El perfil y sus permisos se vuelven a consultar a la API en cada ruta.
			const perfil = await apiGet('/auth/me');
			if (solicitud !== solicitudPermiso) return;
			guardarPerfilAutenticado(perfil);

			const modulos = Array.isArray(perfil?.modulos) ? perfil.modulos : [];
			const permitido = ruta === '/inicio'
				? modulos.some((modulo) => obtenerRutaModulo(modulo?.nombre))
				: ruta === '/calendario'
					? modulos.some((modulo) => obtenerRutaModulo(modulo?.nombre) === '/actividades')
				: modulos.some((modulo) => obtenerRutaModulo(modulo?.nombre) === ruta);
			accesoDenegado = !permitido;
		} catch (cause) {
			if (solicitud !== solicitudPermiso) return;
			console.error('Error validando la sesión y los permisos:', cause);
			if (!leerToken()) {
				await goto('/', { replaceState: true });
			} else {
				errorPermiso = 'No fue posible validar la sesión con la API. Revisa la conexión e inténtalo de nuevo.';
			}
		} finally {
			if (solicitud === solicitudPermiso) validandoPermiso = false;
		}
	}

	$effect(() => {
		const ruta = page.url.pathname;
		if (ruta === '/') {
			solicitudPermiso++;
			validandoPermiso = false;
			errorPermiso = '';
			accesoDenegado = false;
			return;
		}
		void validarAcceso(ruta);
	});

	onMount(() => {
		function revalidarRutaActual() {
			const ruta = page.url.pathname;
			if (ruta !== '/') void validarAcceso(ruta);
		}

		function redirigirAlLogin() {
			void goto('/', { replaceState: true });
		}

		const unsubscribeData = suscribirCambiosApi(revalidarRutaActual);
		window.addEventListener('portal-sesion-expirada', redirigirAlLogin);
		return () => {
			unsubscribeData();
			window.removeEventListener('portal-sesion-expirada', redirigirAlLogin);
		};
	});
</script>

<svelte:head>
	<title>Eventos Escolares</title>
</svelte:head>

<div class="portal-shell min-vh-100 d-flex flex-column bg-body-tertiary">
	<Header />
	{#if !esInicio}
		<Navbar />
	{/if}
	<div class="flex-grow-1 portal-content">
		{#if validandoPermiso}
			<div class="container py-5" role="status"><div class="spinner-border text-primary" aria-hidden="true"></div><p class="mt-3 mb-0">Validando sesión y permisos del rol...</p></div>
		{:else if errorPermiso}
			<div class="container py-4"><div class="alert alert-danger" role="alert">{errorPermiso} <button type="button" class="btn btn-sm btn-outline-danger ms-2" onclick={() => validarAcceso(page.url.pathname)}>Reintentar</button></div></div>
		{:else if accesoDenegado}
			<div class="container py-4"><div class="alert alert-warning" role="alert"><h1 class="h5">Acceso no disponible</h1><p class="mb-0">Este rol no tiene asignado el módulo solicitado en la base de datos.</p></div></div>
		{:else}
			{@render children()}
		{/if}
	</div>
	<Footer />
</div>

<style>
	:global(.modal-dialog-scrollable .modal-content) {
		max-height: calc(100vh - 2rem);
		max-height: calc(100dvh - 2rem);
	}

	:global(.modal-dialog-scrollable .modal-content > form) {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	:global(.modal-dialog-scrollable .modal-body) {
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
	}

	:global(.modal-dialog-scrollable .modal-content > form > .modal-body) {
		flex: 1 1 auto;
	}
</style>

