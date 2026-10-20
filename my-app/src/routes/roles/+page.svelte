
<script>
    import { onMount } from 'svelte';
    import { apiGet, apiRequest, suscribirCambiosApi } from '$lib/api.js';
    import { leerPerfilActivo, leerRolActivo, puedeRealizarAccion } from '$lib/permisos.js';

    let roles = $state([]);
    let modulos = $state([]);
    let relaciones = $state([]);

    let cargando = $state(true);
    let guardando = $state(false);

    let busqueda = $state('');
    let filtroEstado = $state('todos');
    let filtroModulo = $state('todos');
    let fechaDesde = $state('');
    let fechaHasta = $state('');
    let ordenCampo = $state('creado');
    let ordenDireccion = $state('desc');
    let pagina = $state(1);
    const filasPorPagina = 10;

    let mensaje = $state('');
    let tipoMensaje = $state('success');
    let perfilActual = $state(null);
    let rolActual = $state('');
    let puedeAdministrar = $derived(puedeRealizarAccion(rolActual, 'roles', 'crear', perfilActual));

    let formularioAbierto = $state(false);
    let rolEditando = $state(null);
    let nombre = $state('');
    let descripcion = $state('');
    let estadoActivo = $state(true);

    let permisosAbiertos = $state(false);
    let rolPermisos = $state(null);
    let permisosSeleccionados = $state([]);

    function estaActivo(registro) {
        if (registro?.estado == null) return true;

        return (
            registro.estado === true ||
            registro.estado === 1 ||
            registro.estado === '1' ||
            registro.estado === 'true'
        );
    }

    function normalizarTexto(valor) {
        return String(valor ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLocaleLowerCase('es');
    }

    function limpiarMensaje() {
        mensaje = '';
    }

    function mostrarMensaje(texto, tipo = 'success') {
        mensaje = texto;
        tipoMensaje = tipo;
    }

    async function cargarDatos() {
        cargando = true;

        try {
            const [datosRoles, datosModulos, datosRelaciones] =
                await Promise.all([
                    apiGet('/roles/'),
                    apiGet('/modulos/'),
                    apiGet('/modulos-roles/')
                ]);

            if (
                !Array.isArray(datosRoles) ||
                !Array.isArray(datosModulos) ||
                !Array.isArray(datosRelaciones)
            ) {
                throw new Error(
                    'No fue posible cargar los roles y permisos.'
                );
            }

            roles = datosRoles;
            modulos = datosModulos;
            relaciones = datosRelaciones;
        } catch (error) {
            console.error('Error cargando la pantalla Roles:', error);

            mostrarMensaje(
                `No se pudieron cargar los roles: ${error.message}`,
                'error'
            );
        } finally {
            cargando = false;
        }
    }

    let modulosActivos = $derived(
        modulos.filter(estaActivo)
    );

    let rolesFiltrados = $derived.by(() => {
        const filtrados = roles.filter((rol) => {
            const texto = normalizarTexto(busqueda);

            const coincideTexto =
                normalizarTexto(rol.nombre).includes(texto) ||
                normalizarTexto(rol.descripcion).includes(texto);

            const coincideEstado =
                filtroEstado === 'todos' ||
                (filtroEstado === 'activos' && estaActivo(rol)) ||
                (filtroEstado === 'inactivos' && !estaActivo(rol));

            const fecha = String(rol.creado ?? '').slice(0, 10);
            const coincideFecha = (!fechaDesde || fecha >= fechaDesde) && (!fechaHasta || fecha <= fechaHasta);
            const coincideModulo = filtroModulo === 'todos' || tieneModuloAsignado(rol.id, Number(filtroModulo));

            return coincideTexto && coincideEstado && coincideFecha && coincideModulo;
        });
        return filtrados.sort((a, b) => {
            let comparacion = 0;
            if (ordenCampo === 'creado') comparacion = new Date(a.creado ?? 0).getTime() - new Date(b.creado ?? 0).getTime();
            else if (ordenCampo === 'modulos') comparacion = contarModulos(a.id) - contarModulos(b.id);
            else comparacion = normalizarTexto(a.nombre).localeCompare(normalizarTexto(b.nombre), 'es', { numeric: true });
            return ordenDireccion === 'asc' ? comparacion : -comparacion;
        });
    });
    let totalPaginas = $derived(Math.max(1, Math.ceil(rolesFiltrados.length / filasPorPagina)));
    let rolesPagina = $derived(rolesFiltrados.slice((pagina - 1) * filasPorPagina, pagina * filasPorPagina));
    $effect(() => { if (pagina > totalPaginas) pagina = totalPaginas; });
    $effect(() => { busqueda; filtroEstado; filtroModulo; fechaDesde; fechaHasta; ordenCampo; ordenDireccion; pagina = 1; });

    let totalRoles = $derived(roles.length);

    let rolesActivos = $derived(
        roles.filter(estaActivo).length
    );

    let totalModulos = $derived(modulosActivos.length);

    function relacionesActivasDeRol(rolId) {
        return relaciones.filter(
            (relacion) =>
                Number(relacion.rol_id) === Number(rolId) &&
                estaActivo(relacion)
        );
    }

    function contarModulos(rolId) {
        return relacionesActivasDeRol(rolId).length;
    }

    function tieneModuloAsignado(rolId, moduloId) {
        return relacionesActivasDeRol(rolId).some(
            (relacion) =>
                Number(relacion.modulo_id) === Number(moduloId)
        );
    }

    function abrirCrearRol() {
        if (!puedeAdministrar) return;
        limpiarMensaje();

        rolEditando = null;
        nombre = '';
        descripcion = '';
        estadoActivo = true;
        formularioAbierto = true;
    }

    function abrirEditarRol(rol) {
        if (!puedeAdministrar) return;
        limpiarMensaje();

        rolEditando = rol;
        nombre = rol.nombre ?? '';
        descripcion = rol.descripcion ?? '';
        estadoActivo = estaActivo(rol);
        formularioAbierto = true;
    }

    function cerrarFormulario() {
        if (guardando) return;

        formularioAbierto = false;
        rolEditando = null;
        nombre = '';
        descripcion = '';
        estadoActivo = true;
    }

    async function guardarRol(evento) {
        evento.preventDefault();

        if (guardando || !puedeAdministrar) return;

        const nombreLimpio = nombre.trim();
        const descripcionLimpia = descripcion.trim();

        if (!nombreLimpio) {
            mostrarMensaje(
                'Escribe el nombre del rol.',
                'error'
            );
            return;
        }

        guardando = true;
        limpiarMensaje();

        const datos = {
            nombre: nombreLimpio,
            descripcion: descripcionLimpia || null,
            estado: estadoActivo
        };

        try {
            if (rolEditando) {
                await apiRequest(`/roles/${rolEditando.id}`, {
                    method: 'PUT',
                    body: datos
                });
            } else {
                await apiRequest('/roles/', {
                    method: 'POST',
                    body: datos
                });
            }

            formularioAbierto = false;
            rolEditando = null;
            nombre = '';
            descripcion = '';

            await cargarDatos();

            mostrarMensaje(
                datos.nombre
                    ? 'El rol se guardó correctamente.'
                    : 'Operación completada.',
                'success'
            );
        } catch (error) {
            console.error('Error guardando el rol:', error);

            mostrarMensaje(
                `No se pudo guardar el rol: ${error.message}`,
                'error'
            );
        } finally {
            guardando = false;
        }
    }

    async function eliminarRol(rol) {
        if (guardando || !puedeAdministrar) return;

        const confirmado = window.confirm(
            `¿Seguro que deseas desactivar el rol "${rol.nombre}"?`
        );

        if (!confirmado) return;

        guardando = true;
        limpiarMensaje();

        try {
            await apiRequest(`/roles/${rol.id}`, {
                method: 'DELETE'
            });

            await cargarDatos();

            mostrarMensaje(
                `El rol "${rol.nombre}" se desactivó correctamente.`,
                'success'
            );
        } catch (error) {
            console.error('Error eliminando el rol:', error);

            mostrarMensaje(
                `No se pudo desactivar el rol. Detalle: ${error.message}`,
                'error'
            );
        } finally {
            guardando = false;
        }
    }

    function abrirPermisos(rol) {
        if (!puedeAdministrar) return;
        limpiarMensaje();

        rolPermisos = rol;

        permisosSeleccionados = [
            ...new Set(
                relacionesActivasDeRol(rol.id).map(
                    (relacion) => Number(relacion.modulo_id)
                )
            )
        ];

        permisosAbiertos = true;
    }

    function cerrarPermisos() {
        if (guardando) return;

        permisosAbiertos = false;
        rolPermisos = null;
        permisosSeleccionados = [];
    }

    function cambiarPermiso(moduloId, marcado) {
        const id = Number(moduloId);

        if (marcado) {
            if (!permisosSeleccionados.includes(id)) {
                permisosSeleccionados = [
                    ...permisosSeleccionados,
                    id
                ];
            }
        } else {
            permisosSeleccionados =
                permisosSeleccionados.filter(
                    (actual) => Number(actual) !== id
                );
        }
    }

    function seleccionarTodos() {
        permisosSeleccionados = modulosActivos.map(
            (modulo) => Number(modulo.id)
        );
    }

    function quitarTodos() {
        permisosSeleccionados = [];
    }

    async function guardarPermisos() {
        if (!rolPermisos || guardando || !puedeAdministrar) return;

        guardando = true;
        limpiarMensaje();

        try {
            const rolId = Number(rolPermisos.id);
            const seleccionados = [
                ...new Set(permisosSeleccionados.map(Number))
            ];

            const actuales = relacionesActivasDeRol(rolId);

            const idsActuales = actuales.map(
                (relacion) => Number(relacion.modulo_id)
            );

            const paraAgregar = seleccionados.filter(
                (id) => !idsActuales.includes(id)
            );

            const paraEliminar = actuales.filter(
                (relacion) =>
                    !seleccionados.includes(
                        Number(relacion.modulo_id)
                    )
            );

            const relacionesInactivas = relaciones.filter(
                (relacion) =>
                    Number(relacion.rol_id) === rolId &&
                    !estaActivo(relacion) &&
                    paraAgregar.includes(
                        Number(relacion.modulo_id)
                    )
            );
            const modulosPorReactivar = new Set(
                relacionesInactivas.map((relacion) => Number(relacion.modulo_id))
            );
            /*
             * Las altas, bajas y reactivaciones se envían a los endpoints reales
             * de la API. Nunca se modifica un permiso de otro rol.
             */
            for (const relacion of paraEliminar) {
                await apiRequest(
                    `/modulos-roles/${relacion.id}`,
                    { method: 'DELETE' }
                );
            }

            for (const relacion of relacionesInactivas) {
                await apiRequest(`/modulos-roles/${relacion.id}`, {
                    method: 'PUT',
                    body: {
                        rol_id: rolId,
                        modulo_id: Number(relacion.modulo_id),
                        estado: true
                    }
                });
            }

            for (const moduloId of paraAgregar) {
                if (modulosPorReactivar.has(moduloId)) continue;
                await apiRequest('/modulos-roles/', {
                    method: 'POST',
                    body: {
                        rol_id: rolId,
                        modulo_id: moduloId,
                        estado: true
                    }
                });
            }

            permisosAbiertos = false;
            rolPermisos = null;
            permisosSeleccionados = [];

            await cargarDatos();

            mostrarMensaje(
                'Los permisos del rol se actualizaron correctamente.',
                'success'
            );

            /*
             * Si el usuario actual tiene abierto el portal, notificamos
             * que los permisos pueden haber cambiado.
             */
            if (typeof window !== 'undefined') {
                window.dispatchEvent(
                    new Event('perfil-portal-cambiado')
                );
            }
        } catch (error) {
            console.error('Error guardando permisos:', error);

            mostrarMensaje(
                `No se pudieron guardar todos los permisos: ${error.message}. Si hubo varias operaciones, revisa la lista y vuelve a cargarla.`,
                'error'
            );

            await cargarDatos();
        } finally {
            guardando = false;
        }
    }

    function actualizarRol() {
        perfilActual = leerPerfilActivo();
        rolActual = leerRolActivo();
        if (!puedeAdministrar) {
            formularioAbierto = false;
            permisosAbiertos = false;
        }
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
</script>

<svelte:head>
	<title>Roles y permisos | Gestión de Eventos Escolares</title>
	<meta name="description" content="Administración de roles y asignación de módulos" />
</svelte:head>

<main class="container-fluid px-3 px-lg-4 py-4">
	<header class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
		<div class="d-flex align-items-start gap-3"><span class="rounded bg-primary-subtle text-primary p-3 fs-4"><i class="bi bi-shield-lock-fill" aria-hidden="true"></i></span><div><p class="small text-uppercase text-secondary mb-1">Administración</p><h1 class="h2 mb-1">Roles y permisos</h1></div></div>
		{#if puedeAdministrar}<button class="btn btn-primary" type="button" onclick={abrirCrearRol}><i class="bi bi-plus-lg me-2" aria-hidden="true"></i>Crear rol</button>{/if}
	</header>

	<div class="row g-3 mb-4">
		<div class="col-12 col-md-4"><article class="card border-0 shadow-sm h-100"><div class="card-body d-flex align-items-center gap-3"><span class="rounded-circle bg-primary-subtle text-primary p-3 fs-4"><i class="bi bi-person-badge-fill" aria-hidden="true"></i></span><div><p class="text-secondary mb-1">Total de roles</p><strong class="fs-3">{totalRoles}</strong></div></div></article></div>
		<div class="col-12 col-md-4"><article class="card border-0 shadow-sm h-100"><div class="card-body d-flex align-items-center gap-3"><span class="rounded-circle bg-success-subtle text-success p-3 fs-4"><i class="bi bi-check-circle-fill" aria-hidden="true"></i></span><div><p class="text-secondary mb-1">Roles activos</p><strong class="fs-3">{rolesActivos}</strong></div></div></article></div>
		<div class="col-12 col-md-4"><article class="card border-0 shadow-sm h-100"><div class="card-body d-flex align-items-center gap-3"><span class="rounded-circle bg-info-subtle text-info-emphasis p-3 fs-4"><i class="bi bi-grid-fill" aria-hidden="true"></i></span><div><p class="text-secondary mb-1">Módulos disponibles</p><strong class="fs-3">{totalModulos}</strong></div></div></article></div>
	</div>

	{#if mensaje}
		<div class="alert d-flex align-items-center gap-2" class:alert-danger={tipoMensaje === 'error'} class:alert-success={tipoMensaje === 'success'} role="status"><i class={tipoMensaje === 'error' ? 'bi bi-exclamation-circle-fill' : 'bi bi-check-circle-fill'} aria-hidden="true"></i><span class="flex-grow-1">{mensaje}</span><button type="button" class="btn-close" aria-label="Cerrar aviso" onclick={limpiarMensaje}></button></div>
	{/if}

	<section class="card border-0 shadow-sm">
		<div class="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-3 py-3"><div><h2 class="h5 mb-1">Roles registrados</h2></div><button class="btn btn-outline-primary" type="button" onclick={cargarDatos} disabled={cargando}><i class="bi bi-arrow-clockwise me-2" aria-hidden="true"></i>Actualizar</button></div>
		<div class="card-body border-bottom"><div class="row g-3 align-items-end">
			<div class="col-12 col-md-4"><label class="form-label" for="buscar-rol">Buscar rol</label><div class="input-group"><span class="input-group-text"><i class="bi bi-search" aria-hidden="true"></i></span><input id="buscar-rol" class="form-control" type="search" placeholder="Nombre o descripción..." value={busqueda} oninput={(event) => { busqueda = event.currentTarget.value; pagina = 1; }} /></div></div>
			<div class="col-6 col-md-2"><label class="form-label" for="filtro-estado">Estado</label><select id="filtro-estado" class="form-select" value={filtroEstado} onchange={(event) => { filtroEstado = event.currentTarget.value; pagina = 1; }}><option value="todos">Todos</option><option value="activos">Activos</option><option value="inactivos">Inactivos</option></select></div>
			<div class="col-6 col-md-3"><label class="form-label" for="filtro-modulo">Módulo asignado</label><select id="filtro-modulo" class="form-select" value={filtroModulo} onchange={(event) => { filtroModulo = event.currentTarget.value; pagina = 1; }}><option value="todos">Todos los módulos</option>{#each modulosActivos as modulo (modulo.id)}<option value={String(modulo.id)}>{modulo.nombre}</option>{/each}</select></div>
			<div class="col-6 col-md-2"><label class="form-label" for="roles-desde">Creado desde</label><input id="roles-desde" class="form-control" type="date" value={fechaDesde} onchange={(event) => { fechaDesde = event.currentTarget.value; pagina = 1; }} /></div>
			<div class="col-6 col-md-2"><label class="form-label" for="roles-hasta">Creado hasta</label><input id="roles-hasta" class="form-control" type="date" value={fechaHasta} onchange={(event) => { fechaHasta = event.currentTarget.value; pagina = 1; }} /></div>
			<div class="col-8 col-md-3"><label class="form-label" for="orden-roles">Ordenar por</label><select id="orden-roles" class="form-select" value={ordenCampo} onchange={(event) => { ordenCampo = event.currentTarget.value; pagina = 1; }}><option value="creado">Fecha de creación</option><option value="nombre">Nombre</option><option value="modulos">Cantidad de módulos</option></select></div>
			<div class="col-4 col-md-2"><label class="form-label" for="direccion-roles">Orden</label><select id="direccion-roles" class="form-select" value={ordenDireccion} onchange={(event) => { ordenDireccion = event.currentTarget.value; pagina = 1; }}><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></div>
			<div class="col-12 col-md-auto"><button class="btn btn-outline-secondary" type="button" onclick={() => { busqueda = ''; filtroEstado = 'todos'; filtroModulo = 'todos'; fechaDesde = ''; fechaHasta = ''; ordenCampo = 'creado'; ordenDireccion = 'desc'; pagina = 1; }}>Limpiar filtros</button></div>
		</div></div>
		{#if cargando}<div class="p-4 text-center text-secondary" role="status"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Cargando roles y permisos...</div>
		{:else if rolesFiltrados.length === 0}<div class="p-4 text-center"><i class="bi bi-person-badge fs-2 text-secondary" aria-hidden="true"></i><h3 class="h5 mt-2">No hay roles para mostrar</h3>{#if puedeAdministrar}<button class="btn btn-primary" type="button" onclick={abrirCrearRol}><i class="bi bi-plus-lg me-2" aria-hidden="true"></i>Crear rol</button>{/if}</div>
		{:else}
			<div class="table-responsive p-3"><table class="table table-striped table-hover align-middle mb-0"><thead class="table-light"><tr><th>Rol</th><th>Descripción</th><th>Módulos permitidos</th><th>Estado</th>{#if puedeAdministrar}<th>Acciones</th>{/if}</tr></thead><tbody>
				{#each rolesPagina as rol (rol.id)}<tr>
					<td><strong>{rol.nombre}</strong></td><td>{rol.descripcion || 'Sin descripción'}</td>
					<td><button class="btn btn-sm btn-outline-primary" type="button" onclick={() => abrirPermisos(rol)} title="Administrar módulos de este rol"><i class="bi bi-grid-3x3-gap-fill me-1" aria-hidden="true"></i>{contarModulos(rol.id)} módulos</button></td>
					<td><span class="badge" class:text-bg-success={estaActivo(rol)} class:text-bg-secondary={!estaActivo(rol)}>{estaActivo(rol) ? 'Activo' : 'Inactivo'}</span></td>
					{#if puedeAdministrar}<td class="text-nowrap"><button class="btn btn-sm btn-outline-primary me-1" type="button" title="Editar rol" aria-label={`Editar ${rol.nombre}`} onclick={() => abrirEditarRol(rol)}><i class="bi bi-pencil-square" aria-hidden="true"></i></button><button class="btn btn-sm btn-outline-info me-1" type="button" title="Administrar permisos" aria-label={`Administrar permisos de ${rol.nombre}`} onclick={() => abrirPermisos(rol)}><i class="bi bi-shield-check" aria-hidden="true"></i></button>{#if estaActivo(rol)}<button class="btn btn-sm btn-outline-danger" type="button" title="Desactivar rol" aria-label={`Desactivar ${rol.nombre}`} onclick={() => eliminarRol(rol)} disabled={guardando}><i class="bi bi-trash3" aria-hidden="true"></i></button>{/if}</td>{/if}
				</tr>{/each}
			</tbody></table></div>
			<div class="card-footer bg-white d-flex flex-wrap justify-content-between align-items-center gap-2 small text-secondary"><span>Mostrando {rolesFiltrados.length ? (pagina - 1) * filasPorPagina + 1 : 0}–{Math.min(pagina * filasPorPagina, rolesFiltrados.length)} de {rolesFiltrados.length} roles filtrados ({roles.length} en total).</span>{#if rolesFiltrados.length > filasPorPagina}<nav class="d-flex align-items-center gap-2" aria-label="Paginación de roles"><button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página anterior" onclick={() => pagina = Math.max(1, pagina - 1)} disabled={pagina <= 1}><i class="bi bi-chevron-left" aria-hidden="true"></i></button><span>Página {pagina} de {totalPaginas}</span><button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página siguiente" onclick={() => pagina = Math.min(totalPaginas, pagina + 1)} disabled={pagina >= totalPaginas}><i class="bi bi-chevron-right" aria-hidden="true"></i></button></nav>{/if}</div>
		{/if}
	</section>
</main>

{#if formularioAbierto}
	<div class="modal d-block bg-dark bg-opacity-50" role="presentation" onclick={(evento) => { if (evento.target === evento.currentTarget) cerrarFormulario(); }}>
		<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="titulo-formulario">
			<div class="modal-header"><div><p class="small text-uppercase text-secondary mb-1">Gestión de roles</p><h2 class="modal-title fs-5" id="titulo-formulario">{rolEditando ? 'Editar rol' : 'Crear rol'}</h2></div><button class="btn-close" type="button" aria-label="Cerrar formulario" onclick={cerrarFormulario} disabled={guardando}></button></div>
			<form class="modal-body" onsubmit={guardarRol}>
				<div class="mb-3"><label class="form-label" for="nombre-rol">Nombre del rol *</label><input id="nombre-rol" class="form-control" type="text" bind:value={nombre} maxlength="100" placeholder="Ej. Coordinador" required /></div>
				<div class="mb-3"><label class="form-label" for="descripcion-rol">Descripción</label><textarea id="descripcion-rol" class="form-control" bind:value={descripcion} rows="4" maxlength="500" placeholder="Describe las responsabilidades de este rol..."></textarea></div>
				<div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" role="switch" id="estado-rol" bind:checked={estadoActivo} /><label class="form-check-label" for="estado-rol">Rol activo</label></div>
				{#if rolEditando}{/if}
				<div class="modal-footer px-0 pb-0 mt-3"><button class="btn btn-outline-secondary" type="button" onclick={cerrarFormulario} disabled={guardando}>Cancelar</button><button class="btn btn-primary" type="submit" disabled={guardando}>{#if guardando}<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Guardando...{:else}<i class="bi bi-check-lg me-2" aria-hidden="true"></i>{rolEditando ? 'Guardar cambios' : 'Crear rol'}{/if}</button></div>
			</form>
		</div></div>
	</div>
{/if}

{#if permisosAbiertos && rolPermisos}
	<div class="modal d-block bg-dark bg-opacity-50" role="presentation" onclick={(evento) => { if (evento.target === evento.currentTarget) cerrarPermisos(); }}>
		<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg"><div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="titulo-permisos">
			<div class="modal-header"><div><p class="small text-uppercase text-secondary mb-1">Control de acceso</p><h2 class="modal-title fs-5" id="titulo-permisos">Permisos de {rolPermisos.nombre}</h2></div><button class="btn-close" type="button" aria-label="Cerrar permisos" onclick={cerrarPermisos} disabled={guardando}></button></div>
			<div class="modal-body">
				<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><span class="badge text-bg-primary"><i class="bi bi-grid-3x3-gap-fill me-1" aria-hidden="true"></i>{permisosSeleccionados.length} seleccionados</span><div class="btn-group btn-group-sm"><button type="button" class="btn btn-outline-secondary" onclick={seleccionarTodos} disabled={guardando}>Seleccionar todos</button><button type="button" class="btn btn-outline-secondary" onclick={quitarTodos} disabled={guardando}>Quitar todos</button></div></div>
				{#if modulosActivos.length === 0}<div class="alert alert-secondary mb-0">No hay módulos activos.</div>{:else}<div class="row g-2">{#each modulosActivos as modulo (modulo.id)}<div class="col-12 col-md-6"><label class="form-check border rounded p-3 d-flex align-items-center gap-2"><input class="form-check-input ms-0 mt-0" type="checkbox" checked={permisosSeleccionados.includes(Number(modulo.id))} onchange={(evento) => cambiarPermiso(modulo.id, evento.currentTarget.checked)} disabled={guardando} /><span class="form-check-label flex-grow-1"><i class="bi bi-grid-1x2 me-2 text-primary" aria-hidden="true"></i>{modulo.nombre}</span></label></div>{/each}</div>{/if}
			</div>
			<div class="modal-footer"><button class="btn btn-outline-secondary" type="button" onclick={cerrarPermisos} disabled={guardando}>Cancelar</button><button class="btn btn-primary" type="button" onclick={guardarPermisos} disabled={guardando}>{#if guardando}<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Guardando...{:else}<i class="bi bi-shield-check me-2" aria-hidden="true"></i>Guardar permisos{/if}</button></div>
		</div></div>
	</div>
{/if}



