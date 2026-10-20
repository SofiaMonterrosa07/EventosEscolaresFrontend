<script>
	import { onMount } from 'svelte';
	import ApiCrudTable from '$lib/components/ApiCrudTable.svelte';
	import { asistenciaFields as fields } from '$lib/resourceFields.js';
	import { leerRolActivo } from '$lib/permisos.js';

	let rolActual = $state('');
	let perfilListo = $state(false);
	const teacherFields = [
		{
			key: 'inscripcion_id', label: 'Estudiante y actividad', required: true,
			optionsEndpoint: '/inscripciones/',
			optionLabel: (inscripcion) => `${inscripcion.estudiante_nombre ?? 'Estudiante'} · ${inscripcion.actividad_nombre ?? 'Actividad'}`
		},
		...fields.filter((field) => field.key !== 'inscripcion_id').map((field) =>
			field.key === 'estado' ? { ...field, disabled: true } : field
		)
	];
	const studentFields = [
		{ key: 'actividad_nombre', label: 'Actividad' },
		{ key: 'actividad_fecha', label: 'Fecha' },
		...fields.filter((field) => ['asistio', 'observacion', 'nota', 'retroalimentacion'].includes(field.key))
	];
	const caregiverFields = [
		{ key: 'estudiante_nombre', label: 'Estudiante', sortable: true },
		...studentFields
	];
	const coordinatorFields = fields.map((field) =>
		['nota', 'retroalimentacion'].includes(field.key) ? { ...field, readOnly: true } : field
	);
	const fieldsForRole = $derived(
		['docente', 'profesor', 'entrenador'].includes(rolActual)
			? teacherFields
			: ['acudiente', 'padre o acudiente'].includes(rolActual)
				? caregiverFields
			: rolActual === 'coordinador'
				? coordinatorFields
				: fields
	);
	const readOnlyFieldsForRole = $derived(
		['acudiente', 'padre o acudiente'].includes(rolActual) ? caregiverFields : studentFields
	);

	onMount(() => {
		function actualizarRol() { rolActual = leerRolActivo(); perfilListo = true; }
		actualizarRol();
		window.addEventListener('perfil-portal-cambiado', actualizarRol);
		return () => window.removeEventListener('perfil-portal-cambiado', actualizarRol);
	});
</script>

{#if !perfilListo}
	<main class="container py-4"><div class="alert alert-info" role="status">Cargando permisos del perfil...</div></main>
{:else}
<ApiCrudTable
	endpoint="/asistencias/"
	title={rolActual === 'estudiante' ? 'Mi asistencia a actividades' : ['acudiente', 'padre o acudiente'].includes(rolActual) ? 'Asistencia de mis acudidos' : 'Asistencia'}
	fields={fieldsForRole}
	moduleKey="asistencia"
	sinCrearEditarRoles={['estudiante', 'acudiente', 'padre o acudiente']}
	sinEliminarRoles={['estudiante', 'docente', 'profesor', 'entrenador']}
	camposSoloLectura={readOnlyFieldsForRole}
	emptyDescription={rolActual === 'estudiante'
		? 'Cuando el docente registre tu asistencia y envíe su retroalimentación, aparecerán aquí.'
		: ['acudiente', 'padre o acudiente'].includes(rolActual)
			? 'Aquí aparecerá la asistencia de tus acudidos cuando sus docentes la registren.'
			: ''}
/>
{/if}

