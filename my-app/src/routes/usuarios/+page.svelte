
<script>
	import { onMount } from 'svelte';
	import { apiGet, apiRequest, suscribirCambiosApi } from '$lib/api.js';
	import { leerPerfilActivo, leerRolActivo, puedeRealizarAccion } from '$lib/permisos.js';

	let busqueda = $state('');
	let filtroRol = $state('Todos');
	let filtroEstado = $state('todos');
	let fechaDesde = $state('');
	let fechaHasta = $state('');
	let ordenCampo = $state('creado');
	let ordenDireccion = $state('desc');
	let pagina = $state(1);
	const usuariosPorPagina = 10;

	let mostrarFormulario = $state(false);
	let modoEdicion = $state(false);
	let usuarioEditando = $state(null);

	let usuarios = $state([]);
	let roles = $state([]);

	let cargando = $state(true);
	let guardando = $state(false);
	let error = $state('');
	let mensaje = $state('');
	let perfilActual = $state(null);
	let rolActual = $state('');
	let puedeAdministrar = $derived(puedeRealizarAccion(rolActual, 'usuarios', 'crear', perfilActual));

	let formulario = $state({
		nombre: '',
		correo: '',
		password: '',
		rol_id: '',
		grado: '',
		documento: '',
		telefono: '',
		parentesco: '',
		estado: true
	});

	// =========================================================
	// NORMALIZAR TEXTO
	// =========================================================

	function normalizar(texto = '') {
		return String(texto)
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.trim()
			.toLowerCase();
	}

	function rolPermitidoParaSecretaria(rol) {
		const nombre = normalizar(rol?.nombre);
		return ['estudiante', 'acudiente', 'padre o acudiente'].includes(nombre);
	}

	// =========================================================
	// OBTENER NOMBRE DEL ROL
	// =========================================================

	function nombreRol(rolId) {
		const rol = roles.find(
			(item) => Number(item.id) === Number(rolId)
		);

		return rol?.nombre ?? 'Rol no identificado';
	}

	// =========================================================
	// CONVERTIR USUARIO DE LA API AL FORMATO VISUAL
	// =========================================================

	function convertirUsuario(usuario) {
		return {
			id: usuario.id,
			nombre: usuario.nombre ?? '',
			correo: usuario.correo ?? '',
			rol_id: Number(usuario.rol_id),
			rol: usuario.rol_nombre ?? nombreRol(usuario.rol_id),
			creado: usuario.creado ?? null,
			estadoApi: usuario.estado === true || usuario.estado === 1,
			estado:
				usuario.estado === true ||
				usuario.estado === 1 ||
				normalizar(usuario.estado) === 'activo'
					? 'Activo'
					: 'Inactivo'
		};
	}

	// =========================================================
	// CARGAR USUARIOS Y ROLES DESDE FASTAPI
	// =========================================================

	async function cargarDatos() {
		cargando = true;
		error = '';

		try {
			const [datosRoles, datosUsuarios] = await Promise.all([
				apiGet('/auth/roles'),
				apiGet('/usuarios/')
			]);

			// /auth/roles ya devuelve únicamente los roles activos.
			const rolesActivos = datosRoles;
			roles = rolActual === 'secretaria'
				? rolesActivos.filter(rolPermitidoParaSecretaria)
				: rolesActivos;

			const usuariosApi = datosUsuarios.map(convertirUsuario);
			usuarios = rolActual === 'secretaria'
				? usuariosApi.filter((usuario) =>
					['estudiante', 'acudiente', 'padre o acudiente'].includes(normalizar(usuario.rol))
					)
				: usuariosApi;
			pagina = 1;
		} catch (e) {
			console.error('Error cargando datos:', e);
			error =
				'No fue posible cargar los usuarios. Revisa tu conexión e inténtalo de nuevo.';
		} finally {
			cargando = false;
		}
	}

	function actualizarRol() {
		perfilActual = leerPerfilActivo();
		rolActual = leerRolActivo();
		if (!puedeAdministrar) mostrarFormulario = false;
	}

	onMount(() => {
		actualizarRol();
		void cargarDatos();
		const unsubscribeData = suscribirCambiosApi(() => {
			actualizarRol();
			if (!guardando) void cargarDatos();
		});
		window.addEventListener('perfil-portal-cambiado', actualizarRol);
		window.addEventListener('perfil-modulos-actualizados', actualizarRol);
		return () => {
			unsubscribeData();
			window.removeEventListener('perfil-portal-cambiado', actualizarRol);
			window.removeEventListener('perfil-modulos-actualizados', actualizarRol);
		};
	});

	// =========================================================
	// FILTROS
	// =========================================================

	let usuariosFiltrados = $derived.by(() => {
		const texto = normalizar(busqueda);
		const filtrados = usuarios.filter((usuario) => {
			const coincideBusqueda =
				!texto || [usuario.nombre, usuario.correo, usuario.rol].some((valor) => normalizar(valor).includes(texto));

			const coincideRol =
				filtroRol === 'Todos' ||
				String(usuario.rol_id) === filtroRol;
			const coincideEstado = filtroEstado === 'todos' || (filtroEstado === 'activos' && usuario.estadoApi) || (filtroEstado === 'inactivos' && !usuario.estadoApi);
			const fecha = String(usuario.creado ?? '').slice(0, 10);
			const coincideFecha = (!fechaDesde || fecha >= fechaDesde) && (!fechaHasta || fecha <= fechaHasta);

			return coincideBusqueda && coincideRol && coincideEstado && coincideFecha;
		});
		return filtrados.sort((a, b) => {
			const valorA = ordenCampo === 'creado' ? a.creado : a[ordenCampo];
			const valorB = ordenCampo === 'creado' ? b.creado : b[ordenCampo];
			let comparacion;
			if (ordenCampo === 'creado') comparacion = new Date(valorA ?? 0).getTime() - new Date(valorB ?? 0).getTime();
			else comparacion = String(valorA ?? '').localeCompare(String(valorB ?? ''), 'es', { numeric: true, sensitivity: 'base' });
			return ordenDireccion === 'asc' ? comparacion : -comparacion;
		});
	});
	let totalPaginas = $derived(Math.max(1, Math.ceil(usuariosFiltrados.length / usuariosPorPagina)));
	let usuariosPagina = $derived(usuariosFiltrados.slice((pagina - 1) * usuariosPorPagina, pagina * usuariosPorPagina));
	$effect(() => { if (pagina > totalPaginas) pagina = totalPaginas; });
	$effect(() => { busqueda; filtroRol; filtroEstado; fechaDesde; fechaHasta; ordenCampo; ordenDireccion; pagina = 1; });

	// =========================================================
	// INDICADORES
	// =========================================================

	let totalUsuarios = $derived(usuarios.length);

	let totalEstudiantes = $derived(
		usuarios.filter(
			(usuario) =>
				normalizar(usuario.rol) === 'estudiante'
		).length
	);

	let totalPadres = $derived(
		usuarios.filter((usuario) => {
			const rol = normalizar(usuario.rol);

			return (
				rol.includes('padre') ||
				rol.includes('acudiente')
			);
		}).length
	);

	let totalCoordinacion = $derived(
		usuarios.filter(
			(usuario) =>
				normalizar(usuario.rol).includes('coordinador')
		).length
	);

	// =========================================================
	// NUEVO USUARIO
	// =========================================================

	function abrirNuevoUsuario() {
		if (!puedeAdministrar) return;
		modoEdicion = false;
		usuarioEditando = null;
		error = '';
		mensaje = '';

		formulario = {
			nombre: '',
			correo: '',
			password: '',
			rol_id: roles.length ? String(roles[0].id) : '',
			grado: '',
			documento: '',
			telefono: '',
			parentesco: '',
			estado: true
		};

		mostrarFormulario = true;
	}

	// =========================================================
	// EDITAR USUARIO
	// =========================================================

	function editarUsuario(usuario) {
		if (!puedeAdministrar) return;
		modoEdicion = true;
		usuarioEditando = usuario;
		error = '';
		mensaje = '';

		formulario = {
			nombre: usuario.nombre,
			correo: usuario.correo,
			password: '',
			rol_id: String(usuario.rol_id),
			grado: '',
			documento: '',
			telefono: '',
			parentesco: '',
			estado: usuario.estadoApi
		};

		mostrarFormulario = true;
	}

	// =========================================================
	// GUARDAR USUARIO
	// La API genera el id al crear el usuario; solo se envía al editar.
	// =========================================================

	async function guardarUsuario() {
		if (!puedeAdministrar) return;
		error = '';
		mensaje = '';

		if (
			!formulario.nombre.trim() ||
			!formulario.correo.trim() ||
			(!modoEdicion && !formulario.password) ||
			!formulario.rol_id
		) {
			error = 'Completa todos los campos del formulario.';
			return;
		}

		if (formulario.password && formulario.password.length < 8) {
			error = 'La contraseña debe tener al menos 8 caracteres.';
			return;
		}

		if (!Number.isInteger(Number(formulario.rol_id))) {
			error = 'Selecciona un rol válido.';
			return;
		}

		const crearPerfilEstudiante = !modoEdicion && normalizar(nombreRol(formulario.rol_id)) === 'estudiante';
/*  */		if (crearPerfilEstudiante && !formulario.grado.trim()) {
			error = 'Completa el grado del estudiante.';
			return;
		}
		const rolSeleccionado = normalizar(nombreRol(formulario.rol_id));
		const crearPerfilAcudiente = !modoEdicion && ['acudiente', 'padre o acudiente'].includes(rolSeleccionado);
		if (crearPerfilAcudiente && (!formulario.documento.trim() || !formulario.telefono.trim())) {
			error = 'Completa el documento y el teléfono del acudiente.';
			return;
		}

		guardando = true;

		const datos = {
			nombre: formulario.nombre.trim(),
			correo: formulario.correo.trim(),
			rol_id: Number(formulario.rol_id),
			estado: Boolean(formulario.estado)
		};
		if (!modoEdicion || formulario.password) datos.password = formulario.password;
		if (crearPerfilEstudiante) {
			datos.grado = formulario.grado.trim();
		}
		if (crearPerfilAcudiente) {
			datos.documento = formulario.documento.trim();
			datos.telefono = formulario.telefono.trim();
			datos.parentesco = formulario.parentesco.trim();
		}

		try {
			await apiRequest(
				modoEdicion ? `/usuarios/${usuarioEditando.id}` : '/usuarios/',
				{
					method: modoEdicion ? 'PUT' : 'POST',
					body: datos
				}
			);

			const operacion = modoEdicion
				? 'actualizado'
				: 'creado';

			cerrarFormulario();
			await cargarDatos();

			if (!error) {
				mensaje = `Usuario ${operacion} correctamente.`;
			}
		} catch (e) {
			console.error('Error guardando usuario:', e);
			error = e.message || 'No se pudo guardar el usuario.';
		} finally {
			guardando = false;
		}
	}

	// =========================================================
	// ELIMINAR USUARIO
	// =========================================================

	async function eliminarUsuario(usuario) {
		if (!puedeAdministrar) return;
		const confirmar = confirm(
			`¿Deseas desactivar a ${usuario.nombre}?`
		);

		if (!confirmar) return;

		error = '';
		mensaje = '';

		try {
			await apiRequest(`/usuarios/${usuario.id}`, { method: 'DELETE' });

			await cargarDatos();

			if (!error) {
				mensaje = 'Usuario desactivado correctamente.';
			}
		} catch (e) {
			console.error('Error desactivando usuario:', e);
			error = e.message || 'No se pudo desactivar el usuario.';
		}
	}

	// =========================================================
	// CERRAR FORMULARIO
	// =========================================================

	function cerrarFormulario() {
		mostrarFormulario = false;
		modoEdicion = false;
		usuarioEditando = null;

		formulario = {
			nombre: '',
			correo: '',
			password: '',
			rol_id: '',
			grado: '',
			documento: '',
			telefono: '',
			parentesco: '',
			estado: true
		};
	}

	// =========================================================
	// INICIALES
	// =========================================================

	function obtenerIniciales(nombre) {
		return nombre
			.split(' ')
			.filter(Boolean)
			.slice(0, 2)
			.map((parte) => parte.charAt(0))
			.join('')
			.toUpperCase();
	}

	// =========================================================
	// ICONO DEL ROL
	// =========================================================

	function iconoRol(rol) {
		const nombre = normalizar(rol);

		if (nombre === 'estudiante') {
			return 'bi-mortarboard';
		}

		if (
			nombre.includes('padre') ||
			nombre.includes('acudiente')
		) {
			return 'bi-person-heart';
		}

		if (nombre.includes('coordinador')) {
			return 'bi-person-workspace';
		}

		return 'bi-person';
	}

</script>

<svelte:head><title>Usuarios | Colegio San Miguel</title></svelte:head>

<main class="container-fluid px-3 px-lg-4 py-4">
	{#if cargando}<div class="alert alert-info" role="status"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Cargando usuarios...</div>{/if}
	{#if error}<div class="alert alert-danger" role="alert">{error}<button class="btn btn-sm btn-outline-danger ms-2" type="button" onclick={cargarDatos}>Reintentar</button></div>{/if}
	{#if mensaje}<div class="alert alert-success" role="status">{mensaje}</div>{/if}

	<header class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
		<div><h1 class="h2 mb-1">Usuarios</h1></div>
		{#if puedeAdministrar}<button class="btn btn-primary" type="button" onclick={abrirNuevoUsuario}><i class="bi bi-person-plus me-2" aria-hidden="true"></i>Nuevo usuario</button>{/if}
	</header>

	<div class="row g-3 mb-4">
		<div class="col-12 col-sm-6 col-xl-3"><article class="card border-0 shadow-sm h-100"><div class="card-body d-flex align-items-center gap-3"><span class="rounded-circle bg-primary-subtle text-primary p-3 fs-4"><i class="bi bi-people" aria-hidden="true"></i></span><div><p class="text-secondary mb-1">Total</p><strong class="fs-3">{totalUsuarios}</strong></div></div></article></div>
		<div class="col-12 col-sm-6 col-xl-3"><article class="card border-0 shadow-sm h-100"><div class="card-body d-flex align-items-center gap-3"><span class="rounded-circle bg-success-subtle text-success p-3 fs-4"><i class="bi bi-mortarboard" aria-hidden="true"></i></span><div><p class="text-secondary mb-1">Estudiantes</p><strong class="fs-3">{totalEstudiantes}</strong></div></div></article></div>
		<div class="col-12 col-sm-6 col-xl-3"><article class="card border-0 shadow-sm h-100"><div class="card-body d-flex align-items-center gap-3"><span class="rounded-circle bg-info-subtle text-info-emphasis p-3 fs-4"><i class="bi bi-person-heart" aria-hidden="true"></i></span><div><p class="text-secondary mb-1">Acudientes</p><strong class="fs-3">{totalPadres}</strong></div></div></article></div>
		<div class="col-12 col-sm-6 col-xl-3"><article class="card border-0 shadow-sm h-100"><div class="card-body d-flex align-items-center gap-3"><span class="rounded-circle bg-warning-subtle text-warning-emphasis p-3 fs-4"><i class="bi bi-person-workspace" aria-hidden="true"></i></span><div><p class="text-secondary mb-1">Coordinación</p><strong class="fs-3">{totalCoordinacion}</strong></div></div></article></div>
	</div>

	<section class="card border-0 shadow-sm">
		<div class="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-3 py-3">
			<div><h2 class="h5 mb-1">Usuarios registrados</h2><span class="small text-secondary">{usuariosFiltrados.length} resultados</span></div>
		</div>
		<div class="card-body border-bottom"><div class="row g-3 align-items-end">
			<div class="col-12 col-md-4"><label class="form-label" for="buscar-usuario">Buscar usuario</label><div class="input-group"><span class="input-group-text"><i class="bi bi-search" aria-hidden="true"></i></span><input id="buscar-usuario" class="form-control" type="search" placeholder="Nombre, correo o rol..." value={busqueda} oninput={(event) => { busqueda = event.currentTarget.value; pagina = 1; }} /></div></div>
			<div class="col-6 col-md-2"><label class="form-label" for="filtro-rol-usuario">Rol</label><select id="filtro-rol-usuario" class="form-select" value={filtroRol} onchange={(event) => { filtroRol = event.currentTarget.value; pagina = 1; }}><option value="Todos">Todos</option>{#each roles as rol (rol.id)}<option value={String(rol.id)}>{rol.nombre}</option>{/each}</select></div>
			<div class="col-6 col-md-2"><label class="form-label" for="filtro-estado-usuario">Estado</label><select id="filtro-estado-usuario" class="form-select" value={filtroEstado} onchange={(event) => { filtroEstado = event.currentTarget.value; pagina = 1; }}><option value="todos">Todos</option><option value="activos">Activos</option><option value="inactivos">Inactivos</option></select></div>
			<div class="col-6 col-md-2"><label class="form-label" for="usuario-creado-desde">Creado desde</label><input id="usuario-creado-desde" class="form-control" type="date" value={fechaDesde} onchange={(event) => { fechaDesde = event.currentTarget.value; pagina = 1; }} /></div>
			<div class="col-6 col-md-2"><label class="form-label" for="usuario-creado-hasta">Creado hasta</label><input id="usuario-creado-hasta" class="form-control" type="date" value={fechaHasta} onchange={(event) => { fechaHasta = event.currentTarget.value; pagina = 1; }} /></div>
			<div class="col-8 col-md-3"><label class="form-label" for="orden-usuario">Ordenar por</label><select id="orden-usuario" class="form-select" value={ordenCampo} onchange={(event) => { ordenCampo = event.currentTarget.value; pagina = 1; }}><option value="creado">Fecha de creación</option><option value="nombre">Nombre</option><option value="correo">Correo</option><option value="rol">Rol</option></select></div>
			<div class="col-4 col-md-2"><label class="form-label" for="direccion-usuario">Orden</label><select id="direccion-usuario" class="form-select" value={ordenDireccion} onchange={(event) => { ordenDireccion = event.currentTarget.value; pagina = 1; }}><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></div>
			<div class="col-12 col-md-auto"><button class="btn btn-outline-secondary" type="button" onclick={() => { busqueda = ''; filtroRol = 'Todos'; filtroEstado = 'todos'; fechaDesde = ''; fechaHasta = ''; ordenCampo = 'creado'; ordenDireccion = 'desc'; pagina = 1; }}>Limpiar filtros</button></div>
		</div></div>
		<div class="table-responsive p-3">
			{#if usuariosFiltrados.length === 0}
				<p class="text-center text-secondary py-4 mb-0">No hay usuarios que coincidan con la búsqueda y el rol seleccionado.</p>
			{:else}
			<table class="table table-striped table-hover align-middle mb-0">
				<thead class="table-light"><tr><th>Usuario</th><th>Rol</th><th>Creado</th><th>Estado</th>{#if puedeAdministrar}<th class="text-end">Acciones</th>{/if}</tr></thead>
				<tbody>
					{#each usuariosPagina as usuario (usuario.id)}
						<tr>
							<td><div class="d-flex align-items-center gap-3"><span class="rounded-circle bg-primary-subtle text-primary px-2 py-1 fw-semibold">{obtenerIniciales(usuario.nombre)}</span><div><strong class="d-block">{usuario.nombre}</strong><span class="small text-secondary">{usuario.correo}</span></div></div></td>
							<td><span class="badge text-bg-primary"><i class={`bi ${iconoRol(usuario.rol)} me-1`} aria-hidden="true"></i>{usuario.rol}</span></td>
							<td>{usuario.creado ? new Date(usuario.creado).toLocaleDateString('es-CO') : '—'}</td>
							<td><span class="badge" class:text-bg-success={usuario.estado === 'Activo'} class:text-bg-secondary={usuario.estado !== 'Activo'}>{usuario.estado}</span></td>
							{#if puedeAdministrar}<td class="text-end text-nowrap"><button class="btn btn-sm btn-outline-primary me-1" type="button" title="Editar usuario" aria-label={`Editar ${usuario.nombre}`} onclick={() => editarUsuario(usuario)}><i class="bi bi-pencil" aria-hidden="true"></i></button>{#if usuario.estado === 'Activo'}<button class="btn btn-sm btn-outline-danger" type="button" title="Desactivar usuario" aria-label={`Desactivar ${usuario.nombre}`} onclick={() => eliminarUsuario(usuario)}><i class="bi bi-trash3" aria-hidden="true"></i></button>{/if}</td>{/if}
						</tr>
					{/each}
				</tbody>
			</table>
			{/if}
		</div>
		<div class="card-footer bg-white d-flex flex-wrap justify-content-between align-items-center gap-2 small text-secondary"><span>Mostrando {usuariosFiltrados.length ? (pagina - 1) * usuariosPorPagina + 1 : 0}–{Math.min(pagina * usuariosPorPagina, usuariosFiltrados.length)} de {usuariosFiltrados.length} usuarios filtrados.</span>{#if usuariosFiltrados.length > usuariosPorPagina}<nav class="d-flex align-items-center gap-2" aria-label="Paginación de usuarios"><button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página anterior" onclick={() => pagina = Math.max(1, pagina - 1)} disabled={pagina <= 1}><i class="bi bi-chevron-left" aria-hidden="true"></i></button><span>Página {pagina} de {totalPaginas}</span><button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página siguiente" onclick={() => pagina = Math.min(totalPaginas, pagina + 1)} disabled={pagina >= totalPaginas}><i class="bi bi-chevron-right" aria-hidden="true"></i></button></nav>{/if}</div>
	</section>
</main>

{#if mostrarFormulario}
	<div class="modal d-block bg-dark bg-opacity-50" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) cerrarFormulario(); }}>
		<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
			<div class="modal-content">
				<div class="modal-header"><div><h2 class="modal-title fs-5" id="modal-title">{modoEdicion ? 'Editar usuario' : 'Nuevo usuario'}</h2><p class="text-secondary small mb-0">Completa la información del usuario.</p></div><button class="btn-close" type="button" aria-label="Cerrar" onclick={cerrarFormulario}></button></div>
				<div class="modal-body">
					<div class="mb-3"><label class="form-label" for="nombre">Nombre completo</label><input id="nombre" type="text" class="form-control" placeholder="Ej. Juan Pérez" bind:value={formulario.nombre} required /></div>
					<div class="mb-3"><label class="form-label" for="correo">Correo electrónico</label><input id="correo" type="email" class="form-control" placeholder="usuario@colegiosanmiguel.edu.co" bind:value={formulario.correo} required /></div>
					<div class="mb-3"><label class="form-label" for="password">{modoEdicion ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label><input id="password" type="password" class="form-control" placeholder={modoEdicion ? 'Déjala vacía para conservarla' : 'Crea una contraseña'} bind:value={formulario.password} autocomplete="new-password" minlength="8" required={!modoEdicion} />{#if modoEdicion}<div class="form-text">Si escribes una nueva contraseña, debe tener al menos 8 caracteres.</div>{/if}</div>
					<div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" role="switch" id="estado-usuario" bind:checked={formulario.estado} /><label class="form-check-label" for="estado-usuario">Usuario activo</label></div>
					<div><label class="form-label" for="rol">Rol</label><select id="rol" class="form-select" bind:value={formulario.rol_id} required disabled={modoEdicion && rolActual === 'secretaria'}><option value="" disabled>Selecciona un rol</option>{#each roles as rol (rol.id)}<option value={String(rol.id)}>{rol.nombre}</option>{/each}</select></div>
					{#if !modoEdicion && normalizar(nombreRol(formulario.rol_id)) === 'estudiante'}
						<div class="mb-3 mt-3"><label class="form-label" for="grado-estudiante">Grado</label><input id="grado-estudiante" class="form-control" type="text" maxlength="30" placeholder="Ej. 8°" bind:value={formulario.grado} required /></div>
					{/if}
					{#if !modoEdicion && ['acudiente', 'padre o acudiente'].includes(normalizar(nombreRol(formulario.rol_id)))}
						<div class="mb-3 mt-3"><label class="form-label" for="documento-acudiente">Documento</label><input id="documento-acudiente" class="form-control" type="text" maxlength="30" bind:value={formulario.documento} required /></div>
						<div class="mb-3"><label class="form-label" for="telefono-acudiente">Teléfono</label><input id="telefono-acudiente" class="form-control" type="tel" maxlength="30" bind:value={formulario.telefono} required /></div>
						<div class="mb-3"><label class="form-label" for="parentesco-acudiente">Parentesco</label><input id="parentesco-acudiente" class="form-control" type="text" maxlength="50" placeholder="Ej. Madre, padre, tutor" bind:value={formulario.parentesco} /></div>
					{/if}
				</div>
				<div class="modal-footer"><button type="button" class="btn btn-outline-secondary" onclick={cerrarFormulario} disabled={guardando}>Cancelar</button><button type="button" class="btn btn-primary" onclick={guardarUsuario} disabled={guardando}><i class={`bi ${modoEdicion ? 'bi-check2' : 'bi-person-plus'} me-2`} aria-hidden="true"></i>{guardando ? 'Guardando...' : modoEdicion ? 'Guardar cambios' : 'Crear usuario'}</button></div>
			</div>
		</div>
	</div>
{/if}


