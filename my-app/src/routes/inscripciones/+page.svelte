<script>
	import { onMount } from 'svelte';
	import ApiCrudTable from '$lib/components/ApiCrudTable.svelte';
	import CaregiverInscripciones from '$lib/components/CaregiverInscripciones.svelte';
	import StudentInscripciones from '$lib/components/StudentInscripciones.svelte';
	import LoadingState from '$lib/components/LoadingState.svelte';
	import { inscripcionFields as fields } from '$lib/resourceFields.js';
	import { leerRolActivo } from '$lib/permisos.js';
	import { normalizarNombre } from '$lib/modulos.js';
	const rolesAcudiente = ['acudiente', 'padre o acudiente'].map(normalizarNombre);
	const inscripcionAcudienteFields = [
		{ key: 'estudiante_nombre', label: 'Estudiante' },
		{ key: 'actividad_nombre', label: 'Actividad' },
		{ key: 'actividad_fecha', label: 'Fecha de la actividad', type: 'date' },
		{ key: 'fecha_inscripcion', label: 'Fecha de inscripción', type: 'date' },
		{ key: 'estado', label: 'Inscripción activa' }
	];

	const inscripcionDocenteFields = [
		{ key: 'estudiante_nombre', label: 'Estudiante', sortable: true },
		{
			key: 'actividad_id', label: 'Actividad', optionsEndpoint: '/actividades/',
			optionLabel: 'nombre', filterable: true, filterOptionsFromReference: true,
			filterableWhen: ({ references }) => (references['/actividades/'] ?? []).length > 2,
			sortable: true
		},
		{ key: 'actividad_fecha', label: 'Fecha de la actividad', type: 'date' },
		{ key: 'fecha_inscripcion', label: 'Fecha de inscripción', type: 'date' },
		{ key: 'estado', label: 'Inscripción activa' }
	];

	let rolActual = $state('');
	let cargandoPerfil = $state(true);

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
	<main class="container py-4"><LoadingState label="Preparando las inscripciones..." /></main>
{:else if rolActual === 'estudiante'}
	<StudentInscripciones />
{:else if rolesAcudiente.includes(rolActual)}
	<CaregiverInscripciones />
{:else if ['docente', 'profesor', 'entrenador'].includes(rolActual)}
	<ApiCrudTable
		endpoint="/inscripciones/"
		title="Estudiantes inscritos en mis actividades"
		fields={inscripcionDocenteFields}
		moduleKey="inscripciones"
		sinCrearEditarRoles={['docente', 'profesor', 'entrenador']}
		camposSoloLectura={inscripcionDocenteFields}
		sinEliminarRoles={['docente', 'profesor', 'entrenador']}
	/>
{:else}
<ApiCrudTable endpoint="/inscripciones/" title="Inscripciones" {fields} moduleKey="inscripciones" />
{/if}

