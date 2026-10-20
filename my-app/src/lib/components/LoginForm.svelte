<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { apiGet, apiRequest } from '$lib/api.js';
	import { cerrarSesion, guardarPerfilAutenticado, guardarSesion, leerToken } from '$lib/auth.js';
	import { obtenerRutaModulo } from '$lib/modulos.js';

	let roles = $state([]);
	let rolCandidatoId = $state('');
	let correo = $state('');
	let password = $state('');
	let mostrarPassword = $state(false);
	let cargando = $state(true);
	let entrando = $state(false);
	let mensaje = $state('');

	const perfilesVisibles = [
		{ etiqueta: 'Estudiante', nombres: ['estudiante'] },
		{ etiqueta: 'Docente', nombres: ['docente', 'profesor'] },
		{ etiqueta: 'Admin', nombres: ['administrador', 'admin'] },
		{ etiqueta: 'Acudiente', nombres: ['acudiente', 'padre o acudiente', 'padre'] },
		{ etiqueta: 'Coordinador', nombres: ['coordinador'] }
	];

	function normalizarNombreRol(nombre) {
		return String(nombre ?? '')
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.trim()
			.toLowerCase();
	}

	function rutaInicial(perfil) {
		const tienePagina = perfil.modulos.some((modulo) => obtenerRutaModulo(modulo.nombre));
		if (!tienePagina) throw new Error('Este perfil no tiene páginas disponibles en el portal.');
		return '/inicio';
	}

	async function cargarRoles() {
		const respuesta = await apiGet('/auth/roles');
		if (!Array.isArray(respuesta)) throw new Error('La API no devolvió los perfiles disponibles.');
		roles = perfilesVisibles.flatMap((perfil) => {
			const rol = perfil.nombres
				.map((nombre) => respuesta.find((item) => normalizarNombreRol(item.nombre) === nombre))
				.find(Boolean);
			return rol ? [{ ...rol, etiqueta: perfil.etiqueta }] : [];
		});
	}

	async function prepararAcceso() {
		cargando = true;
		mensaje = '';
		try {
			if (leerToken()) {
				try {
					const perfil = await apiGet('/auth/me');
					guardarPerfilAutenticado(perfil);
					await goto(rutaInicial(perfil));
					return;
				} catch {
					cerrarSesion();
				}
			}
			await cargarRoles();
		} catch (error) {
			console.error('No fue posible preparar el acceso:', error);
			mensaje = error instanceof Error ? error.message : 'No pudimos preparar el acceso. Revisa tu conexión e inténtalo nuevamente.';
		} finally {
			cargando = false;
		}
	}

	async function iniciarSesion() {
		mensaje = '';
		const rol = roles.find((item) => Number(item.id) === Number(rolCandidatoId));
		if (!correo.trim() || !password || !rol) {
			mensaje = 'Escribe tu correo, contraseña y perfil para continuar.';
			return;
		}

		entrando = true;
		try {
			const respuesta = await apiRequest('/auth/login', {
				method: 'POST',
				body: { correo: correo.trim(), password, rol_id: Number(rol.id) }
			});
			guardarSesion(respuesta);
			password = '';
			await goto(rutaInicial(respuesta));
		} catch (error) {
			console.error('No fue posible iniciar sesión:', error);
			const detalle = error instanceof Error ? error.message : '';
			mensaje = detalle === 'Correo, contraseña o perfil incorrectos.'
				? 'Correo, contraseña o perfil incorrectos. Si tu cuenta fue restablecida, usa la contraseña nueva asignada a tu cuenta y selecciona tu perfil correcto.'
				: detalle || 'No se pudo iniciar sesión.';
			cerrarSesion();
		} finally {
			entrando = false;
		}
	}

	onMount(() => void prepararAcceso());
</script>

<svelte:head>
	<title>Acceso | Gestión de Eventos Escolares</title>
	<meta name="description" content="Acceso autenticado al portal de eventos escolares" />
</svelte:head>

<div class="login-page flex-grow-1 d-flex flex-column">
	<main class="container my-auto py-4 py-lg-5 flex-grow-1 d-flex align-items-center">
		<div class="row justify-content-center w-100">
			<div class="col-12 col-xxl-10">
				<div class="login-card row g-0 bg-white rounded-4 overflow-hidden">
					<aside class="login-brand-panel col-12 col-lg-5 p-4 p-md-5 d-flex flex-column justify-content-between gap-5">
						<div>
							<span class="badge rounded-pill text-bg-light text-primary mb-4"><i class="bi bi-stars me-2" aria-hidden="true"></i>Portal escolar</span>
							<div class="display-3 text-primary mb-3"><i class="bi bi-mortarboard-fill" aria-hidden="true"></i></div>
							<p class="small fw-semibold text-uppercase text-primary-emphasis mb-2">Colegio San Miguel</p>
							<h1 class="display-6 fw-semibold mb-3">Una comunidad, muchas actividades.</h1>
							<p class="text-secondary mb-0">Organiza la vida escolar y participa en las actividades del colegio desde un solo lugar.</p>
						</div>
						<div class="row g-2">
							<div class="col-12"><div class="bg-white bg-opacity-75 rounded-3 p-3 d-flex align-items-center gap-3"><span class="text-primary fs-4"><i class="bi bi-calendar2-check" aria-hidden="true"></i></span><span class="small fw-semibold">Actividades escolares con fecha y lugar</span></div></div>
							<div class="col-12"><div class="bg-white bg-opacity-75 rounded-3 p-3 d-flex align-items-center gap-3"><span class="text-primary fs-4"><i class="bi bi-people" aria-hidden="true"></i></span><span class="small fw-semibold">Una comunidad conectada</span></div></div>
						</div>
					</aside>

					<section class="login-form-panel col-12 col-lg-7 p-4 p-md-5">
						<div class="d-flex align-items-center gap-2 text-secondary small mb-3"><i class="bi bi-lock-fill text-primary" aria-hidden="true"></i>Acceso seguro al portal</div>
						<h2 class="h2 fw-semibold mb-2">Bienvenido</h2>
						<p class="text-secondary mb-4">Ingresa con el correo registrado, tu contraseña y el perfil de tu cuenta.</p>
						{#if cargando}
							<div class="text-center py-5" role="status"><div class="spinner-border text-primary" aria-hidden="true"></div><p class="text-secondary mt-3 mb-0">Preparando el acceso...</p></div>
						{:else}
							<form onsubmit={(event) => { event.preventDefault(); void iniciarSesion(); }}>
								<div class="mb-3">
									<label for="correo-login" class="form-label fw-semibold">Correo electrónico</label>
									<input id="correo-login" class="form-control form-control-lg" type="email" autocomplete="username" bind:value={correo} required disabled={entrando} />
								</div>
								<div class="mb-3">
									<label for="password-login" class="form-label fw-semibold">Contraseña</label>
					<div class="input-group input-group-lg">
						<input id="password-login" class="form-control" type={mostrarPassword ? 'text' : 'password'} autocomplete="current-password" bind:value={password} required disabled={entrando} />
						<button class="btn btn-outline-secondary" type="button" onclick={() => mostrarPassword = !mostrarPassword} aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={mostrarPassword} disabled={entrando}>
							<i class={`bi ${mostrarPassword ? 'bi-eye' : 'bi-eye-slash'}`} aria-hidden="true"></i>
						</button>
					</div>
								</div>
								<div class="mb-3">
									<label for="rol-candidato" class="form-label fw-semibold">Perfil</label>
									<select id="rol-candidato" class="form-select form-select-lg" bind:value={rolCandidatoId} disabled={entrando} required>
										<option value="">Selecciona tu perfil</option>
										{#each roles as rol (rol.id)}<option value={String(rol.id)}>{rol.etiqueta}</option>{/each}
									</select>
								</div>
								{#if mensaje}<div class="alert alert-danger" role="alert">{mensaje}</div>{/if}
								{#if roles.length === 0}<div class="alert alert-warning" role="status">No hay perfiles activos disponibles.</div>{/if}
								<button class="btn btn-primary btn-lg w-100 rounded-3 mt-2" type="submit" disabled={entrando || roles.length === 0}>
									{#if entrando}<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Validando...{:else}Iniciar sesión <i class="bi bi-arrow-right ms-2" aria-hidden="true"></i>{/if}
								</button>
							</form>
						{/if}
					</section>
				</div>
			</div>
		</div>
	</main>
</div>

