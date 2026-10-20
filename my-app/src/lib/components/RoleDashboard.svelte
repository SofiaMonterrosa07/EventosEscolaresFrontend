<script>
	import { onMount } from 'svelte';
	import ApiOverview from '$lib/components/ApiOverview.svelte';
	import PageHeading from '$lib/components/PageHeading.svelte';
	import { leerRolActivo } from '$lib/permisos.js';

	const conjuntosPorRol = {
		administrador: [
			{ endpoint: '/actividades/', label: 'Actividades' },
			{ endpoint: '/inscripciones/resumen', label: 'Inscripciones activas', countField: 'inscritos' },
			{ endpoint: '/asistencias/resumen', label: 'Registros de asistencia', countField: 'cantidad' },
			{ endpoint: '/autorizaciones/resumen', label: 'Autorizaciones', countField: 'cantidad' }
		],
		coordinador: [
			{ endpoint: '/actividades/', label: 'Actividades' },
			{ endpoint: '/inscripciones/resumen', label: 'Inscripciones activas', countField: 'inscritos' },
			{ endpoint: '/asistencias/resumen', label: 'Registros de asistencia', countField: 'cantidad' },
			{ endpoint: '/autorizaciones/resumen', label: 'Autorizaciones', countField: 'cantidad' }
		],
		docente: [
			{ endpoint: '/actividades/', label: 'Mis actividades' },
			{ endpoint: '/inscripciones/', label: 'Estudiantes inscritos' },
			{ endpoint: '/asistencias/', label: 'Registros de asistencia' }
		],
		profesor: [
			{ endpoint: '/actividades/', label: 'Mis actividades' },
			{ endpoint: '/inscripciones/', label: 'Estudiantes inscritos' },
			{ endpoint: '/asistencias/', label: 'Registros de asistencia' }
		],
		entrenador: [
			{ endpoint: '/actividades/', label: 'Mis actividades' },
			{ endpoint: '/inscripciones/', label: 'Estudiantes inscritos' },
			{ endpoint: '/asistencias/', label: 'Registros de asistencia' }
		],
		estudiante: [
			{ endpoint: '/actividades/', label: 'Actividades disponibles' },
			{ endpoint: '/inscripciones/', label: 'Mis inscripciones' },
			{ endpoint: '/asistencias/', label: 'Mi asistencia' }
		],
		acudiente: [
			{ endpoint: '/actividades/', label: 'Actividades de mis acudidos' },
			{ endpoint: '/estudiantes/', label: 'Estudiantes vinculados' },
			{ endpoint: '/inscripciones/', label: 'Inscripciones vinculadas' },
			{ endpoint: '/autorizaciones/', label: 'Autorizaciones vinculadas' },
			{ endpoint: '/asistencias/', label: 'Asistencia de mis acudidos' }
		],
		'padre o acudiente': [
			{ endpoint: '/actividades/', label: 'Actividades de mis acudidos' },
			{ endpoint: '/estudiantes/', label: 'Estudiantes vinculados' },
			{ endpoint: '/inscripciones/', label: 'Inscripciones vinculadas' },
			{ endpoint: '/autorizaciones/', label: 'Autorizaciones vinculadas' },
			{ endpoint: '/asistencias/', label: 'Asistencia de mis acudidos' }
		],
		director: [
			{ endpoint: '/inscripciones/resumen-institucional', label: 'Inscripciones', countField: 'inscritos' },
			{ endpoint: '/asistencias/resumen', label: 'Registros de asistencia', countField: 'cantidad' },
			{ endpoint: '/autorizaciones/resumen', label: 'Autorizaciones', countField: 'cantidad' }
		],
		bienestar: [
			{ endpoint: '/estudiantes/resumen', label: 'Estudiantes', countField: 'cantidad' },
			{ endpoint: '/inscripciones/resumen', label: 'Participaciones', countField: 'inscritos' },
			{ endpoint: '/asistencias/resumen', label: 'Registros de asistencia', countField: 'cantidad' }
		],
		orientador: [
			{ endpoint: '/estudiantes/resumen', label: 'Estudiantes', countField: 'cantidad' },
			{ endpoint: '/inscripciones/resumen', label: 'Participaciones', countField: 'inscritos' },
			{ endpoint: '/asistencias/resumen', label: 'Registros de asistencia', countField: 'cantidad' }
		],
		secretaria: [
			{ endpoint: '/estudiantes/resumen', label: 'Estudiantes', countField: 'cantidad' },
			{ endpoint: '/acudientes/resumen', label: 'Acudientes', countField: 'cantidad' },
			{ endpoint: '/usuarios/resumen', label: 'Cuentas gestionadas', countField: 'cantidad' }
		]
	};

	const nombresPorRol = {
		administrador: 'Administración escolar',
		coordinador: 'Coordinación escolar',
		docente: 'Espacio docente', profesor: 'Espacio docente', entrenador: 'Espacio docente',
		estudiante: 'Mi espacio escolar', acudiente: 'Espacio familiar', 'padre o acudiente': 'Espacio familiar',
		director: 'Resumen de dirección', bienestar: 'Seguimiento de bienestar', orientador: 'Seguimiento de bienestar',
		secretaria: 'Gestión de matrículas y contactos'
	};

	let rol = $state('');
	let datasets = $derived(conjuntosPorRol[rol] ?? []);

	function actualizarPerfil() {
		rol = leerRolActivo();
	}

	onMount(() => {
		actualizarPerfil();
		window.addEventListener('perfil-portal-cambiado', actualizarPerfil);
		return () => window.removeEventListener('perfil-portal-cambiado', actualizarPerfil);
	});
</script>

<svelte:head><title>{nombresPorRol[rol] ?? 'Inicio'} | Eventos Escolares</title></svelte:head>

<main class="container-fluid px-3 px-lg-4 py-4 py-xl-5">
	<PageHeading title={nombresPorRol[rol] ?? 'Inicio'} eyebrow="Portal escolar" icon="bi-grid-1x2" />
</main>

{#if datasets.length}
	<ApiOverview title="Resumen" {datasets} />
{/if}


