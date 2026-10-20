<script>
	import ApiOverview from '$lib/components/ApiOverview.svelte';
	const datasets = [
		{ endpoint: '/estudiantes/resumen', label: 'Estudiantes', countField: 'cantidad' },
		{ endpoint: '/asistencias/resumen', label: 'Registros de asistencia', countField: 'cantidad' },
		{ endpoint: '/inscripciones/resumen', label: 'Participaciones', countField: 'inscritos' }
	];
</script>
<ApiOverview title="Bienestar" {datasets} />

