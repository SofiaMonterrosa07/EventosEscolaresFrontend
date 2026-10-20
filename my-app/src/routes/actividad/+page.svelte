<script>
	import { onMount } from 'svelte';
	import ApiCrudTable from '$lib/components/ApiCrudTable.svelte';
	import StudentActividades from '$lib/components/StudentActividades.svelte';
	import LoadingState from '$lib/components/LoadingState.svelte';
	import { actividadFields as fields } from '$lib/resourceFields.js';
	import { leerRolActivo } from '$lib/permisos.js';
	import { normalizarNombre } from '$lib/modulos.js';

	let rolActual = $state('');
	let cargandoPerfil = $state(true);
	let tituloActividades = $derived(
		['docente', 'profesor', 'entrenador'].includes(rolActual) ? 'Mis actividades asociadas' : 'Actividades'
	);
	const caregiverActivityFields = fields.filter((field) =>
		['nombre', 'descripcion', 'fecha', 'hora', 'lugar'].includes(field.key)
	);

	function actualizarRol() {
		rolActual = leerRolActivo();
		cargandoPerfil = false;
	}

	onMount(() => {
		actualizarRol();
		window.addEventListener('perfil-portal-cambiado', actualizarRol);
		return () => window.removeEventListener('perfil-portal-cambiado', actualizarRol);
	});
</script>

{#if cargandoPerfil}
	<main class="container py-4"><LoadingState label="Preparando las actividades..." /></main>
{:else if ['acudiente', 'padre o acudiente'].some((rol) => normalizarNombre(rol) === rolActual)}
	<ApiCrudTable
		endpoint="/actividades/"
		title="Actividades de mis acudidos"
		fields={caregiverActivityFields}
		moduleKey="actividades"
		sinCrearEditarRoles={['acudiente', 'padre o acudiente']}
		camposSoloLectura={caregiverActivityFields}
	/>
{:else if normalizarNombre('estudiante') === rolActual}
	<StudentActividades />
{:else}
	<div class="container-fluid px-3 px-lg-4 pt-4"><a class="btn btn-outline-primary" href="/calendario"><i class="bi bi-calendar3 me-2" aria-hidden="true"></i>Calendario y cupos</a></div>
	<ApiCrudTable endpoint="/actividades/" title={tituloActividades} {fields} moduleKey="actividades" associationType="actividad" />
{/if}

