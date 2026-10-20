<script>
	import { onMount } from 'svelte';
	import { apiGet } from '$lib/api.js';

	let { associationType, recordId = null, value = $bindable([]), ready = $bindable(false) } = $props();
	let opciones = $state([]);
	let seleccionados = $state({});
	let parentescos = $state({});
	let busqueda = $state('');
	let pagina = $state(1);
	let cargando = $state(true);
	let error = $state('');
	const porPagina = 10;
	const esEstudiante = $derived(associationType === 'estudiante');
	const titulo = $derived(esEstudiante ? 'Acudientes asociados' : 'Estudiantes asociados');
	const etiqueta = $derived(esEstudiante ? 'acudiente' : 'estudiante');
	const visibles = $derived.by(() => {
		const texto = busqueda.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
		return opciones.filter((item) => {
			const nombre = String(item.usuario_nombre ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
			const codigo = String(item.codigo_estudiante ?? '').toLowerCase();
			return !texto || nombre.includes(texto) || codigo.includes(texto);
		}).sort((a, b) => String(a.usuario_nombre ?? '').localeCompare(String(b.usuario_nombre ?? ''), 'es', { numeric: true }));
	});
	const totalPaginas = $derived(Math.max(1, Math.ceil(visibles.length / porPagina)));
	const paginaVisible = $derived(visibles.slice((pagina - 1) * porPagina, pagina * porPagina));

	function guardarValor() {
		value = opciones
			.filter((item) => seleccionados[String(item.id)])
			.map((item) => ({ id: Number(item.id), parentesco: parentescos[String(item.id)]?.trim() || null }));
	}

	function cambiarSeleccion(id, marcado) {
		const key = String(id);
		seleccionados = { ...seleccionados, [key]: marcado };
		if (!marcado) parentescos = { ...parentescos, [key]: '' };
		guardarValor();
	}

	function cambiarParentesco(id, texto) {
		parentescos = { ...parentescos, [String(id)]: texto };
		guardarValor();
	}

	onMount(async () => {
		cargando = true;
		error = '';
		try {
			const endpointOpciones = esEstudiante ? '/acudientes/' : '/estudiantes/';
			const registros = await apiGet(endpointOpciones);
			opciones = registros.filter((item) => item.estado === true);
			if (recordId) {
				const endpointVinculos = esEstudiante
					? `/estudiantes/${recordId}/acudientes`
					: `/acudientes/${recordId}/estudiantes`;
				const vinculos = await apiGet(endpointVinculos);
				seleccionados = Object.fromEntries(vinculos.map((item) => [String(esEstudiante ? item.acudiente_id : item.estudiante_id), true]));
				parentescos = Object.fromEntries(vinculos.map((item) => [String(esEstudiante ? item.acudiente_id : item.estudiante_id), item.parentesco ?? '']));
				value = vinculos.map((item) => ({
					id: Number(esEstudiante ? item.acudiente_id : item.estudiante_id),
					parentesco: item.parentesco ?? null
				}));
			}
			ready = true;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'No fue posible cargar las asociaciones.';
		}
		finally {
			cargando = false;
		}
	});
</script>

<div class="col-12">
	<div class="border rounded p-3">
		<h3 class="h6 mb-1">{titulo}</h3>
		<p class="small text-secondary">Marca los {etiqueta}s asociados. Puedes dejarlo sin vínculos y agregarlo después al editar.</p>
		{#if error}<div class="alert alert-danger py-2" role="alert">{error}</div>{/if}
		{#if cargando}
			<div class="small text-secondary" role="status">Cargando opciones y vínculos...</div>
		{:else if opciones.length === 0}
			<div class="alert alert-secondary mb-0">No hay {etiqueta}s activos disponibles.</div>
		{:else}
			<label class="form-label" for="buscar-asociacion">Buscar {etiqueta}</label>
			<input id="buscar-asociacion" class="form-control mb-2" type="search" placeholder={esEstudiante ? 'Nombre del acudiente...' : 'Nombre o código EST...'} bind:value={busqueda} oninput={() => pagina = 1} />
			<div class="table-responsive">
				<table class="table table-sm table-hover align-middle mb-2">
					<thead><tr><th>Asociar</th><th>{esEstudiante ? 'Acudiente' : 'Estudiante'}</th><th>Parentesco</th></tr></thead>
					<tbody>
						{#each paginaVisible as item (item.id)}
							{@const key = String(item.id)}
							<tr>
								<td><input class="form-check-input" type="checkbox" aria-label={`Asociar ${item.usuario_nombre}`} checked={Boolean(seleccionados[key])} onchange={(event) => cambiarSeleccion(item.id, event.currentTarget.checked)} /></td>
								<td>{item.usuario_nombre}{#if !esEstudiante}<span class="small text-secondary"> · {item.codigo_estudiante}</span>{/if}</td>
								<td><input class="form-control form-control-sm" type="text" maxlength="50" placeholder="Madre, padre, tutor..." aria-label={`Parentesco de ${item.usuario_nombre}`} value={parentescos[key] ?? ''} disabled={!seleccionados[key]} oninput={(event) => cambiarParentesco(item.id, event.currentTarget.value)} /></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="d-flex justify-content-between align-items-center small text-secondary">
				<span>{Object.values(seleccionados).filter(Boolean).length} asociado(s) seleccionado(s).</span>
				{#if visibles.length > porPagina}
					<nav class="d-flex align-items-center gap-2" aria-label="Paginación de asociaciones">
						<button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página anterior" onclick={() => pagina = Math.max(1, pagina - 1)} disabled={pagina <= 1}><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
						<span>Página {pagina} de {totalPaginas}</span>
						<button class="btn btn-sm btn-outline-primary" type="button" aria-label="Página siguiente" onclick={() => pagina = Math.min(totalPaginas, pagina + 1)} disabled={pagina >= totalPaginas}><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
					</nav>
				{/if}
			</div>
		{/if}
	</div>
</div>
