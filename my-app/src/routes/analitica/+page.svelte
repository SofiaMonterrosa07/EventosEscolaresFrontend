<script>
	import ApiOverview from '$lib/components/ApiOverview.svelte';
	const datasets = [
		{ endpoint: '/estudiantes/resumen', label: 'Estudiantes', countField: 'cantidad' },
		{ endpoint: '/actividades/', label: 'Actividades' },
		{ endpoint: '/inscripciones/resumen', label: 'Inscripciones', countField: 'inscritos' },
		{ endpoint: '/asistencias/resumen', label: 'Asistencias', countField: 'cantidad' },
		{ endpoint: '/autorizaciones/resumen', label: 'Autorizaciones', countField: 'cantidad' }
	];
</script>
<ApiOverview title="Analítica" {datasets} />

