<script>
	import { onMount } from 'svelte';
	import { apiGet } from '$lib/api.js';

	let { recordId = null, value = $bindable({ docente_ids: [], estudiante_ids: [] }), ready = $bindable(false) } = $props();
	let docentes = $state([]);
	let estudiantes = $state([]);
	let docentesSeleccionados = $state({});
	let estudiantesSeleccionados = $state({});
	let buscarDocente = $state('');
	let buscarEstudiante = $state('');
	let paginaDocentes = $state(1);
	let paginaEstudiantes = $state(1);
	let cargando = $state(true);
	let error = $state('');
	const porPagina = 10;
	const docentesFiltrados = $derived.by(() => {
		const texto = buscarDocente.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
		return docentes.filter((item) => !texto || String(item.nombre ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(texto));
	});
	const estudiantesFiltrados = $derived.by(() => {
		const texto = buscarEstudiante.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
		return estudiantes.filter((item) => {
			const nombre = String(item.usuario_nombre ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
			const codigo = String(item.codigo_estudiante ?? '').toLowerCase();
			return !texto || nombre.includes(texto) || codigo.includes(texto);
		});
	});
	const totalPaginasDocentes = $derived(Math.max(1, Math.ceil(docentesFiltrados.length / porPagina)));
	const totalPaginasEstudiantes = $derived(Math.max(1, Math.ceil(estudiantesFiltrados.length / porPagina)));
	const paginaActualDocentes = $derived(docentesFiltrados.slice((paginaDocentes - 1) * porPagina, paginaDocentes * porPagina));
	const paginaActualEstudiantes = $derived(estudiantesFiltrados.slice((paginaEstudiantes - 1) * porPagina, paginaEstudiantes * porPagina));

	function sincronizar() {
		value = {
			docente_ids: docentes.filter((item) => docentesSeleccionados[String(item.id)]).map((item) => Number(item.id)),
			estudiante_ids: estudiantes.filter((item) => estudiantesSeleccionados[String(item.id)]).map((item) => Number(item.id))
		};
	}

	function cambiarDocente(id, seleccionado) {
		docentesSeleccionados = { ...docentesSeleccionados, [String(id)]: seleccionado };
		sincronizar();
	}

	function cambiarEstudiante(id, seleccionado) {
		estudiantesSeleccionados = { ...estudiantesSeleccionados, [String(id)]: seleccionado };
		sincronizar();
	}

	async function cargarAsociaciones() {
		cargando = true;
		ready = false;
		error = '';
		try {
			const [docentesApi, estudiantesApi, asociaciones] = await Promise.all([
				apiGet('/actividades-docentes/opciones/docentes'),
				apiGet('/estudiantes/'),
				recordId ? apiGet(`/actividades/${recordId}/asociaciones`) : Promise.resolve({ docente_ids: [], estudiante_ids: [] })
			]);
			docentes = docentesApi;
			estudiantes = estudiantesApi.filter((item) => item.estado === true);
			docentesSeleccionados = Object.fromEntries(asociaciones.docente_ids.map((id) => [String(id), true]));
			estudiantesSeleccionados = Object.fromEntries(asociaciones.estudiante_ids.map((id) => [String(id), true]));
			value = {
				docente_ids: asociaciones.docente_ids.map(Number),
				estudiante_ids: asociaciones.estudiante_ids.map(Number)
			};
			ready = true;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'No fue posible cargar docentes y estudiantes.';
		}
		finally {
			cargando = false;
		}
	}

	onMount(cargarAsociaciones);
</script>

<div class="col-12">
	<div class="border rounded p-3">
		<h3 class="h6 mb-1">Docentes asociados</h3>
		<p class="small text-secondary">Selecciona los docentes responsables de la actividad.</p>
		{#if error}<div class="alert alert-danger py-2" role="alert">{error}<button class="btn btn-sm btn-outline-danger ms-2" type="button" onclick={cargarAsociaciones} disabled={cargando}>Reintentar</button></div>{/if}
		{#if cargando}
			<div class="small text-secondary" role="status">Cargando asociaciones...</div>
		{:else}
			{#if docentes.length}
				<input class="form-control form-control-sm mb-2" type="search" aria-label="Buscar docentes" placeholder="Buscar docente..." bind:value={buscarDocente} oninput={() => paginaDocentes = 1} />
				<div class="table-responsive"><table class="table table-sm table-hover align-middle mb-2"><thead><tr><th>Asociar</th><th>Docente</th><th>Rol</th></tr></thead><tbody>
					{#each paginaActualDocentes as docente (docente.id)}<tr><td><input class="form-check-input" type="checkbox" aria-label={`Asociar ${docente.nombre}`} checked={Boolean(docentesSeleccionados[String(docente.id)])} onchange={(event) => cambiarDocente(docente.id, event.currentTarget.checked)} /></td><td>{docente.nombre}</td><td>{docente.rol_nombre}</td></tr>{/each}
				</tbody></table></div>
				{#if docentesFiltrados.length > porPagina}<div class="d-flex justify-content-end align-items-center gap-2 small mb-3"><button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página anterior de docentes" onclick={() => paginaDocentes = Math.max(1, paginaDocentes - 1)} disabled={paginaDocentes <= 1}><i class="bi bi-chevron-left" aria-hidden="true"></i></button><span>Página {paginaDocentes} de {totalPaginasDocentes}</span><button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página siguiente de docentes" onclick={() => paginaDocentes = Math.min(totalPaginasDocentes, paginaDocentes + 1)} disabled={paginaDocentes >= totalPaginasDocentes}><i class="bi bi-chevron-right" aria-hidden="true"></i></button></div>{/if}
			{:else}<div class="alert alert-secondary py-2">No hay docentes activos disponibles.</div>{/if}

			<hr />
			<h3 class="h6 mb-1">Estudiantes inscritos</h3>
			<p class="small text-secondary">Selecciona los estudiantes inscritos. Al desmarcar uno, su inscripción queda inactiva y conserva su historial.</p>
			{#if estudiantes.length}
				<input class="form-control form-control-sm mb-2" type="search" aria-label="Buscar estudiantes" placeholder="Buscar por nombre o código EST..." bind:value={buscarEstudiante} oninput={() => paginaEstudiantes = 1} />
				<div class="table-responsive"><table class="table table-sm table-hover align-middle mb-2"><thead><tr><th>Inscribir</th><th>Estudiante</th><th>Código</th><th>Grado</th></tr></thead><tbody>
					{#each paginaActualEstudiantes as estudiante (estudiante.id)}<tr><td><input class="form-check-input" type="checkbox" aria-label={`Inscribir a ${estudiante.usuario_nombre}`} checked={Boolean(estudiantesSeleccionados[String(estudiante.id)])} onchange={(event) => cambiarEstudiante(estudiante.id, event.currentTarget.checked)} /></td><td>{estudiante.usuario_nombre}</td><td>{estudiante.codigo_estudiante}</td><td>{estudiante.grado}</td></tr>{/each}
				</tbody></table></div>
				{#if estudiantesFiltrados.length > porPagina}<div class="d-flex justify-content-end align-items-center gap-2 small"><button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página anterior de estudiantes" onclick={() => paginaEstudiantes = Math.max(1, paginaEstudiantes - 1)} disabled={paginaEstudiantes <= 1}><i class="bi bi-chevron-left" aria-hidden="true"></i></button><span>Página {paginaEstudiantes} de {totalPaginasEstudiantes}</span><button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página siguiente de estudiantes" onclick={() => paginaEstudiantes = Math.min(totalPaginasEstudiantes, paginaEstudiantes + 1)} disabled={paginaEstudiantes >= totalPaginasEstudiantes}><i class="bi bi-chevron-right" aria-hidden="true"></i></button></div>{/if}
			{:else}<div class="alert alert-secondary py-2">No hay estudiantes activos disponibles.</div>{/if}
			<div class="small text-secondary mt-2">Seleccionados: {value.docente_ids.length} docente(s) y {value.estudiante_ids.length} estudiante(s).</div>
		{/if}
	</div>
</div>
