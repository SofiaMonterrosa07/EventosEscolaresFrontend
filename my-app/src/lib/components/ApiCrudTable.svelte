<script>
    import { onMount } from 'svelte';
    import { apiGet, apiRequest, suscribirCambiosApi } from '$lib/api.js';
    import { leerPerfilActivo, leerRolActivo, puedeRealizarAccion } from '$lib/permisos.js';
    import { normalizarNombre } from '$lib/modulos.js';
    import EmptyState from '$lib/components/EmptyState.svelte';
    import FeedbackMessage from '$lib/components/FeedbackMessage.svelte';
    import LoadingState from '$lib/components/LoadingState.svelte';
    import PageHeading from '$lib/components/PageHeading.svelte';
    import CaregiverStudentAssociationEditor from '$lib/components/CaregiverStudentAssociationEditor.svelte';
    import ActivityAssociationEditor from '$lib/components/ActivityAssociationEditor.svelte';

    let {
        endpoint,
        title,
        fields,
        moduleKey,
        sinCrearEditarRoles = [],
        sinEliminarRoles = [],
        camposSoloLectura = null,
        associationType = null,
        emptyDescription = ''
    } = $props();
    let rows = $state([]);
    let references = $state({});
    let draft = $state({});
    let perfilActual = $state(null);
    let rolActual = $state('');
    let editing = $state(null);
    let modalOpen = $state(false);
    let loading = $state(true);
    let saving = $state(false);
    let error = $state('');
    let notice = $state('');
    let associationDraft = $state([]);
    let associationReady = $state(false);
    let associationRecordId = $state(null);
    let recordSaved = $state(false);
    let busqueda = $state('');
    let filtros = $state({});
    let ordenCampo = $state('creado');
    let ordenDireccion = $state('desc');
    let pagina = $state(1);
    const registrosPorPagina = 10;
    function rolEstaIncluido(roles) {
        return roles.some((rol) => normalizarNombre(rol) === rolActual);
    }

    let sinCrearEditar = $derived(rolEstaIncluido(sinCrearEditarRoles));
    let puedeCrear = $derived(!sinCrearEditar && puedeRealizarAccion(rolActual, moduleKey, 'crear', perfilActual));
    let puedeEditar = $derived(!sinCrearEditar && puedeRealizarAccion(rolActual, moduleKey, 'editar', perfilActual));
    let hayFilasEditables = $derived(puedeEditar && rows.length > 0);
    let puedeEliminar = $derived(!rolEstaIncluido(sinEliminarRoles) && puedeRealizarAccion(rolActual, moduleKey, 'eliminar', perfilActual));
    let camposFuente = $derived(sinCrearEditar && Array.isArray(camposSoloLectura) ? camposSoloLectura : fields);
    let camposTablaFuente = $derived(camposFuente);
    let camposVisibles = $derived(camposTablaFuente.filter((field) =>
        field.key !== 'id' && (!/_id$/i.test(field.key) || Boolean(field.optionsEndpoint))
    ));
    let camposFormulario = $derived(camposFuente.filter((field) =>
        field.key !== 'id' && field.readOnly !== true && (!/_id$/i.test(field.key) || Boolean(field.optionsEndpoint))
    ));

    $effect(() => {
        if (modalOpen && (editing ? !puedeEditar : !puedeCrear)) modalOpen = false;
    });

    let lookupEndpoints = $derived([
        ...new Set(camposVisibles.flatMap((field) => [field.optionsEndpoint, ...(field.referenceEndpoints ?? [])]).filter(Boolean))
    ]);
    let camposFiltro = $derived(camposVisibles.filter((field) =>
        field.filterable && (!field.filterableWhen || field.filterableWhen({ rows, references }))
    ));
    let opcionesOrden = $derived([
        ...(rows.some((row) => row.creado) ? [{ key: 'creado', label: 'Fecha de creación' }] : []),
        ...camposVisibles.filter((field) => field.sortable || field.type === 'date').map((field) => ({ key: field.key, label: field.label }))
    ]);

    function normalizar(valor) {
        return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
    }

    function valorBooleano(valor) {
        return valor === true || valor === 1 || ['true', '1', 'si', 'sí', 'presente', 'activo'].includes(normalizar(valor));
    }

    function opcionesFiltro(field) {
        if (field.type === 'checkbox') return [{ value: 'true', label: 'Activo / Sí' }, { value: 'false', label: 'Inactivo / No' }];
        if (field.type === 'select') return field.options ?? [];
        if (field.filterOptionsFromReference && field.optionsEndpoint) {
            return optionsFor(field).map((option) => ({
                value: String(option[field.optionValue ?? 'id']),
                label: labelFor(option, field)
            }));
        }
        if (field.optionsEndpoint) {
            const ids = [...new Set(rows.map((row) => row[field.key]).filter((value) => value !== null && value !== undefined))];
            if (ids.length > 20) return [];
            return ids.map((value) => {
                const opcion = optionsFor(field).find((item) => String(item[field.optionValue ?? 'id']) === String(value));
                return { value: String(value), label: opcion ? labelFor(opcion, field) : String(value) };
            }).sort((a, b) => String(a.label).localeCompare(String(b.label), 'es', { numeric: true }));
        }
        const values = [...new Set(rows.map((row) => row[field.key]).filter((value) => value !== null && value !== undefined && value !== ''))];
        if (values.length > 20) return [];
        return values.map((value) => ({ value: String(value), label: String(value) }))
            .sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }));
    }

    function pasaFiltro(row, field) {
        const filtro = filtros[field.key];
        if (filtro === undefined || filtro === null || filtro === '') return true;
        if (field.type === 'date') {
            const fecha = String(row[field.key] ?? '').slice(0, 10);
            return (!filtro.desde || fecha >= filtro.desde) && (!filtro.hasta || fecha <= filtro.hasta);
        }
        if (field.type === 'checkbox') return valorBooleano(row[field.key]) === (filtro === 'true');
        if (field.type === 'select' || (field.optionsEndpoint && opcionesFiltro(field).length)) {
            return String(row[field.key]) === String(filtro);
        }
        return normalizar(displayValue(row, field)).includes(normalizar(filtro));
    }

    let registrosFiltrados = $derived.by(() => {
        const texto = normalizar(busqueda);
        const desdeCreacion = filtros.creado?.desde ?? '';
        const hastaCreacion = filtros.creado?.hasta ?? '';
        const filtrados = rows.filter((row) => {
            const textoRegistro = normalizar([
                ...camposVisibles.map((field) => displayValue(row, field)),
                row.creado,
                row.actualizado
            ].join(' '));
            if (texto && !textoRegistro.includes(texto)) return false;
            if (row.creado) {
                const fechaCreacion = String(row.creado).slice(0, 10);
                if (desdeCreacion && fechaCreacion < desdeCreacion) return false;
                if (hastaCreacion && fechaCreacion > hastaCreacion) return false;
            }
            return camposFiltro.every((field) => pasaFiltro(row, field));
        });

        if (!ordenCampo) return filtrados;
        const field = camposVisibles.find((item) => item.key === ordenCampo);
        return filtrados.sort((a, b) => {
            const valorA = ordenCampo === 'creado' ? a.creado : field ? (field.optionsEndpoint ? displayValue(a, field) : a[ordenCampo]) : a[ordenCampo];
            const valorB = ordenCampo === 'creado' ? b.creado : field ? (field.optionsEndpoint ? displayValue(b, field) : b[ordenCampo]) : b[ordenCampo];
            const esFecha = ordenCampo === 'creado' || field?.type === 'date';
            let comparacion;
            if (esFecha) comparacion = new Date(valorA ?? 0).getTime() - new Date(valorB ?? 0).getTime();
            else if (typeof valorA === 'number' && typeof valorB === 'number') comparacion = valorA - valorB;
            else comparacion = String(valorA ?? '').localeCompare(String(valorB ?? ''), 'es', { numeric: true, sensitivity: 'base' });
            return ordenDireccion === 'asc' ? comparacion : -comparacion;
        });
    });
    let totalPaginas = $derived(Math.max(1, Math.ceil(registrosFiltrados.length / registrosPorPagina)));
    let registrosPagina = $derived(registrosFiltrados.slice((pagina - 1) * registrosPorPagina, pagina * registrosPorPagina));

    $effect(() => {
        if (pagina > totalPaginas) pagina = totalPaginas;
    });

    function actualizarFiltro(key, value) {
        filtros = { ...filtros, [key]: value };
        pagina = 1;
    }

    function limpiarFiltros() {
        busqueda = '';
        filtros = {};
        ordenCampo = opcionesOrden.some((option) => option.key === 'creado') ? 'creado' : (opcionesOrden[0]?.key ?? '');
        ordenDireccion = 'desc';
        pagina = 1;
    }

    async function loadRows() {
        loading = true;
        error = '';
        try {
            const [records, ...lookups] = await Promise.all([
                apiGet(endpoint),
                ...lookupEndpoints.map((path) => apiGet(path))
            ]);
            if (!Array.isArray(records) || lookups.some((items) => !Array.isArray(items))) {
                throw new Error('No fue posible cargar la información.');
            }
            rows = records;
            references = Object.fromEntries(lookupEndpoints.map((path, index) => [path, lookups[index]]));
            pagina = 1;
            if (!opcionesOrden.some((option) => option.key === ordenCampo)) {
                ordenCampo = opcionesOrden.some((option) => option.key === 'creado') ? 'creado' : (opcionesOrden[0]?.key ?? '');
            }
        } catch (cause) {
            console.error(`Error cargando ${endpoint}:`, cause);
            error = cause instanceof Error ? cause.message : 'No fue posible cargar los datos.';
        } finally {
            loading = false;
        }
    }

    function optionsFor(field) {
        return references[field.optionsEndpoint] ?? [];
    }

    function opcionesFormulario(field) {
        const opciones = optionsFor(field);
        const endpointPerfiles = {
            estudiantes: '/usuarios/?rol=estudiante',
            acudientes: '/usuarios/?rol=acudiente'
        }[moduleKey];
        if (!endpointPerfiles || field.optionsEndpoint !== endpointPerfiles) return opciones;

        const perfilesEnUso = new Set(rows
            .filter((row) => !editing || Number(row.id) !== Number(editing.id))
            .map((row) => String(row.usuario_id)));
        return opciones.filter((option) => !perfilesEnUso.has(String(option.id)));
    }

    function labelFor(option, field) {
        return typeof field.optionLabel === 'function'
            ? field.optionLabel(option, references)
            : option[field.optionLabel ?? 'nombre'];
    }

    function displayValue(row, field) {
        if (field.optionsEndpoint) {
            const option = optionsFor(field).find(
                (item) => String(item[field.optionValue ?? 'id']) === String(row[field.key])
            );
            return option ? labelFor(option, field) : 'Sin referencia';
        }
        const value = row[field.key];
        if (value === null || value === undefined || value === '') return '—';
        if (field.type === 'select') {
            const option = field.options?.find((item) => String(item.value) === String(value));
            if (option) return option.label;
        }
        if (typeof value === 'boolean') return value ? 'Sí' : 'No';
        return String(value);
    }

    function estaActivo(registro) {
        return registro?.estado === true || registro?.estado === 1 || ['true', '1', 'activo', 'active'].includes(String(registro?.estado ?? '').trim().toLowerCase());
    }

    function openCreate() {
        if (!puedeCrear) return;
        editing = null;
        error = '';
        notice = '';
        draft = Object.fromEntries(camposFormulario.map((field) => [field.key, field.defaultValue ?? '']));
        associationDraft = [];
        associationReady = !associationType;
        associationRecordId = null;
        recordSaved = false;
        modalOpen = true;
    }

    function openEdit(row) {
        if (!puedeEditar) return;
        editing = row;
        error = '';
        notice = '';
        draft = Object.fromEntries(camposFormulario.map((field) => [field.key, row[field.key] ?? field.defaultValue ?? '']));
        associationDraft = [];
        associationReady = !associationType;
        associationRecordId = null;
        recordSaved = false;
        modalOpen = true;
    }

    function closeModal() {
        if (!saving) modalOpen = false;
    }

    function payloadFromDraft() {
        return Object.fromEntries(camposFormulario.map((field) => {
            let value = draft[field.key];
            if (value === '') value = null;
            if (field.type === 'number' && value !== null) value = Number(value);
            if (field.type === 'checkbox') value = Boolean(value);
            if (field.optionsEndpoint && value !== null && /^\d+$/.test(String(value))) value = Number(value);
            return [field.key, value];
        }));
    }

    async function save(event) {
        event.preventDefault();
        if (editing ? !puedeEditar : !puedeCrear) return;
        saving = true;
        error = '';
        notice = '';
        try {
            const isEditing = editing !== null;
            if (!recordSaved) {
                const response = await apiRequest(isEditing ? `${endpoint}${editing.id}` : endpoint, {
                    method: isEditing ? 'PUT' : 'POST',
                    body: payloadFromDraft()
                });
                associationRecordId = isEditing ? editing.id : response?.id ?? null;
                recordSaved = true;
            }
            if (associationType) {
                if (!associationRecordId) throw new Error('El registro se guardó, pero la API no devolvió su identificador.');
                if (associationType === 'actividad') {
                    await apiRequest(`${endpoint}${associationRecordId}/asociaciones`, {
                        method: 'PUT',
                        body: associationDraft
                    });
                } else {
                    const vinculos = associationDraft.map((item) => ({
                        [associationType === 'estudiante' ? 'acudiente_id' : 'estudiante_id']: Number(item.id),
                        parentesco: item.parentesco || null
                    }));
                    const rutaVinculos = associationType === 'estudiante' ? 'acudientes' : 'estudiantes';
                    await apiRequest(`${endpoint}${associationRecordId}/${rutaVinculos}`, {
                        method: 'PUT',
                        body: { vinculos }
                    });
                }
            }
            modalOpen = false;
            recordSaved = false;
            associationRecordId = null;
            await loadRows();
            notice = associationType ? (isEditing ? 'Cambios y vínculos guardados.' : 'Registro y vínculos creados.') : (isEditing ? 'Cambios guardados.' : 'Registro creado.');
        } catch (cause) {
            console.error(`Error guardando en ${endpoint}:`, cause);
            const detalle = cause instanceof Error ? cause.message : 'No fue posible guardar el registro.';
            error = recordSaved && associationType
                ? `El registro ya se guardó, pero falló la asociación: ${detalle} Puedes corregirla y volver a guardar sin duplicar el registro.`
                : detalle;
        } finally {
            saving = false;
        }
    }

    async function remove(row) {
        if (!puedeEliminar) return;
        const nombre = row[camposVisibles[0]?.key] ?? 'este registro';
        const confirmacion = `Desactivar "${nombre}"?`;
        if (!window.confirm(confirmacion)) return;
        error = '';
        notice = '';
        try {
            await apiRequest(`${endpoint}${row.id}`, { method: 'DELETE' });
            notice = 'Registro desactivado.';
        } catch (cause) {
            console.error(`Error desactivando en ${endpoint}:`, cause);
            error = cause instanceof Error ? cause.message : 'No fue posible desactivar el registro.';
        }
    }

    function cargarPerfil() {
        perfilActual = leerPerfilActivo();
        rolActual = leerRolActivo();
    }

    onMount(() => {
        cargarPerfil();
        void loadRows();
        const unsubscribeData = suscribirCambiosApi(() => {
            cargarPerfil();
            void loadRows();
        });
        window.addEventListener('perfil-portal-cambiado', cargarPerfil);
        window.addEventListener('perfil-modulos-actualizados', cargarPerfil);
        return () => {
            unsubscribeData();
            window.removeEventListener('perfil-portal-cambiado', cargarPerfil);
            window.removeEventListener('perfil-modulos-actualizados', cargarPerfil);
        };
    });
</script>

<svelte:head><title>{title} | Eventos Escolares</title></svelte:head>

<main class="container-fluid px-3 px-lg-4 py-4">
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <PageHeading {title} />
        <div class="d-flex gap-2">
            <button class="btn btn-outline-primary" type="button" onclick={loadRows} disabled={loading}>
                <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Actualizar
            </button>
            {#if puedeCrear}<button class="btn btn-primary" type="button" onclick={openCreate}>
                <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Nuevo
            </button>{/if}
        </div>
    </div>

    {#if notice}<FeedbackMessage variant="success" message={notice} />{/if}
    {#if error}<FeedbackMessage variant="danger" message={error} />{/if}
    {#if loading}
        <LoadingState label="Cargando información..." />
    {:else if rows.length === 0}
        <div class="card border-0 shadow-sm"><EmptyState title={`No hay registros de ${title.toLocaleLowerCase()}`} {emptyDescription} /></div>
    {:else}
        <div class="card border-0 shadow-sm">
            <div class="card-body border-bottom">
                <div class="row g-3 align-items-end">
                    <div class="col-12 col-lg-4">
                        <label class="form-label" for="buscar-registros">Buscar en {title.toLocaleLowerCase()}</label>
                        <div class="input-group"><span class="input-group-text"><i class="bi bi-search" aria-hidden="true"></i></span><input id="buscar-registros" class="form-control" type="search" placeholder="Nombre, código, estado, fecha..." value={busqueda} oninput={(event) => { busqueda = event.currentTarget.value; pagina = 1; }} /></div>
                    </div>
                    {#if rows.some((row) => row.creado)}
                        <div class="col-6 col-lg-2"><label class="form-label" for="creado-desde">Creado desde</label><input id="creado-desde" class="form-control" type="date" value={filtros.creado?.desde ?? ''} onchange={(event) => actualizarFiltro('creado', { ...(filtros.creado ?? {}), desde: event.currentTarget.value })} /></div>
                        <div class="col-6 col-lg-2"><label class="form-label" for="creado-hasta">Creado hasta</label><input id="creado-hasta" class="form-control" type="date" value={filtros.creado?.hasta ?? ''} onchange={(event) => actualizarFiltro('creado', { ...(filtros.creado ?? {}), hasta: event.currentTarget.value })} /></div>
                    {/if}
                    {#each camposFiltro as field (field.key)}
                        {@const opciones = opcionesFiltro(field)}
                        <div class="col-12 col-sm-6 col-lg-2">
                            <label class="form-label" for={`filtro-${field.key}`}>Filtrar: {field.label}</label>
                            {#if field.type === 'date'}
                                <input id={`filtro-${field.key}`} class="form-control" type="date" value={filtros[field.key]?.desde ?? ''} aria-label={`Fecha desde ${field.label}`} onchange={(event) => actualizarFiltro(field.key, { ...(filtros[field.key] ?? {}), desde: event.currentTarget.value })} />
                                <input class="form-control mt-1" type="date" value={filtros[field.key]?.hasta ?? ''} aria-label={`Fecha hasta ${field.label}`} onchange={(event) => actualizarFiltro(field.key, { ...(filtros[field.key] ?? {}), hasta: event.currentTarget.value })} />
                            {:else if opciones.length}
                                <select id={`filtro-${field.key}`} class="form-select" value={filtros[field.key] ?? ''} onchange={(event) => actualizarFiltro(field.key, event.currentTarget.value)}>
                                    <option value="">Todos</option>
                                    {#each opciones as opcion (String(opcion.value))}<option value={String(opcion.value)}>{opcion.label}</option>{/each}
                                </select>
                            {:else}
                                <input id={`filtro-${field.key}`} class="form-control" type="search" placeholder={`Buscar ${field.label.toLocaleLowerCase()}...`} value={filtros[field.key] ?? ''} oninput={(event) => actualizarFiltro(field.key, event.currentTarget.value)} />
                            {/if}
                        </div>
                    {/each}
                    {#if opcionesOrden.length}
                        <div class="col-8 col-sm-6 col-lg-2"><label class="form-label" for="orden-registros">Ordenar por</label><select id="orden-registros" class="form-select" value={ordenCampo} onchange={(event) => { ordenCampo = event.currentTarget.value; pagina = 1; }}>
                            {#each opcionesOrden as opcion (opcion.key)}<option value={opcion.key}>{opcion.label}</option>{/each}
                        </select></div>
                        <div class="col-4 col-sm-3 col-lg-1"><label class="form-label" for="direccion-registros">Orden</label><select id="direccion-registros" class="form-select" value={ordenDireccion} onchange={(event) => { ordenDireccion = event.currentTarget.value; pagina = 1; }}><option value="desc">Desc.</option><option value="asc">Asc.</option></select></div>
                    {/if}
                    <div class="col-12 col-lg-auto"><button class="btn btn-outline-secondary" type="button" onclick={limpiarFiltros}><i class="bi bi-x-circle me-1" aria-hidden="true"></i>Limpiar filtros</button></div>
                </div>
            </div>
            {#if registrosFiltrados.length === 0}
                <div class="p-4 text-center text-secondary">No hay registros que coincidan con la búsqueda y los filtros.</div>
            {:else}
            <div class="table-responsive p-3">
                <table class="table table-hover align-middle w-100 mb-0">
                        <thead><tr>{#each camposVisibles as field (field.key)}<th scope="col">{field.label}</th>{/each}{#if hayFilasEditables || puedeEliminar}<th scope="col">Acciones</th>{/if}</tr></thead>
                    <tbody>
                        {#each registrosPagina as row (row.id)}
                            <tr>
                                {#each camposVisibles as field (field.key)}<td>{displayValue(row, field)}</td>{/each}
                                {#if hayFilasEditables || puedeEliminar}<td class="text-nowrap">
                                    {#if puedeEditar}<button class="btn btn-sm btn-outline-primary me-1" type="button" aria-label={`Editar ${title}`} onclick={() => openEdit(row)}><i class="bi bi-pencil" aria-hidden="true"></i></button>{/if}
                                    {#if puedeEliminar && estaActivo(row)}<button class="btn btn-sm btn-outline-danger" type="button" aria-label={`Desactivar ${title}`} title="Desactivar registro" onclick={() => remove(row)}><i class="bi bi-trash" aria-hidden="true"></i></button>{/if}
                                </td>{/if}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
            {/if}
            <div class="card-footer bg-white d-flex flex-wrap justify-content-between align-items-center gap-2 text-secondary small">
                <span>Mostrando {registrosFiltrados.length ? (pagina - 1) * registrosPorPagina + 1 : 0}–{Math.min(pagina * registrosPorPagina, registrosFiltrados.length)} de {registrosFiltrados.length} filtrados ({rows.length} en total).</span>
                {#if registrosFiltrados.length > registrosPorPagina}
                    <nav class="d-flex align-items-center gap-2" aria-label={`Paginación de ${title}`}>
                        <button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página anterior" onclick={() => pagina = Math.max(1, pagina - 1)} disabled={pagina <= 1}><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
                        <span>Página {pagina} de {totalPaginas}</span>
                        <button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página siguiente" onclick={() => pagina = Math.min(totalPaginas, pagina + 1)} disabled={pagina >= totalPaginas}><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
                    </nav>
                {/if}
            </div>
        </div>
    {/if}
</main>

{#if modalOpen}
    <div class="modal-backdrop fade show"></div>
    <div class="modal d-block" role="dialog" aria-modal="true" aria-labelledby="crud-modal-title">
        <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div class="modal-content border-0 shadow">
                <form onsubmit={save}>
                    <div class="modal-header"><h2 class="modal-title fs-5" id="crud-modal-title">{editing ? 'Editar' : 'Nuevo'}: {title}</h2><button class="btn-close" type="button" aria-label="Cerrar" onclick={closeModal}></button></div>
                    <div class="modal-body"><div class="row g-3">
                        {#each camposFormulario as field (field.key)}
                            <div class={field.type === 'textarea' ? 'col-12' : 'col-12 col-md-6'}>
                                <label class="form-label" for={`field-${field.key}`}>{field.label}{#if field.required}<span class="text-danger ms-1">*</span>{/if}</label>
                                {#if field.type === 'textarea'}
                                    <textarea class="form-control" id={`field-${field.key}`} rows="3" bind:value={draft[field.key]} required={field.required} maxlength={field.maxlength}></textarea>
                                {:else if field.optionsEndpoint}
                                    <select class="form-select" id={`field-${field.key}`} bind:value={draft[field.key]} required={field.required}>
                                        <option value="">Selecciona una opción</option>
                                        {#each opcionesFormulario(field) as option (option[field.optionValue ?? 'id'])}
                                            <option value={option[field.optionValue ?? 'id']}>{labelFor(option, field)}</option>
                                        {/each}
                                    </select>
                                {:else if field.type === 'select'}
                                    <select class="form-select" id={`field-${field.key}`} bind:value={draft[field.key]} required={field.required}>
                                        <option value="">Selecciona una opción</option>
                                        {#each field.options as option (option.value)}<option value={option.value}>{option.label}</option>{/each}
                                    </select>
                                {:else if field.type === 'checkbox'}
                                    <div class="form-check form-switch mt-2"><input class="form-check-input" type="checkbox" role="switch" id={`field-${field.key}`} bind:checked={draft[field.key]} disabled={field.disabled === true} /><label class="form-check-label" for={`field-${field.key}`}>{field.checkboxLabel ?? 'Sí'}</label></div>
                                {:else}
                                    <input class="form-control" id={`field-${field.key}`} type={field.type ?? 'text'} bind:value={draft[field.key]} required={field.required} min={field.min} max={field.max} step={field.step} maxlength={field.maxlength} />
                                {/if}
                            </div>
                        {/each}
                        {#if associationType}
                            {#if associationType === 'actividad'}
                                <ActivityAssociationEditor recordId={editing?.id ?? null} bind:value={associationDraft} bind:ready={associationReady} />
                            {:else}
                                <CaregiverStudentAssociationEditor associationType={associationType} recordId={editing?.id ?? null} bind:value={associationDraft} bind:ready={associationReady} />
                            {/if}
                        {/if}
                    </div>
                    {#if error}<FeedbackMessage variant="danger" message={error} />{/if}
                    </div>
                    <div class="modal-footer"><button class="btn btn-outline-secondary" type="button" onclick={closeModal} disabled={saving}>Cancelar</button><button class="btn btn-primary" type="submit" disabled={saving || !associationReady}>{saving ? 'Guardando...' : associationType && !associationReady ? 'Cargando asociaciones...' : 'Guardar'}</button></div>
                </form>
            </div>
        </div>
    </div>
{/if}



