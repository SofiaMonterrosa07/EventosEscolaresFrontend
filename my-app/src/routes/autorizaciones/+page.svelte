<script>
	import { onMount } from 'svelte';
	import ApiCrudTable from '$lib/components/ApiCrudTable.svelte';
	import CaregiverAuthorizations from '$lib/components/CaregiverAuthorizations.svelte';
	import StudentAuthorizations from '$lib/components/StudentAuthorizations.svelte';
	import LoadingState from '$lib/components/LoadingState.svelte';
	import { autorizacionFields as fields } from '$lib/resourceFields.js';
	import { leerRolActivo } from '$lib/permisos.js';
	import { normalizarNombre } from '$lib/modulos.js';
	let rolActual = $state('');
	let perfilListo = $state(false);
	onMount(() => {
		function actualizarRol() { rolActual = leerRolActivo(); perfilListo = true; }
		actualizarRol();
		window.addEventListener('perfil-portal-cambiado', actualizarRol);
		return () => window.removeEventListener('perfil-portal-cambiado', actualizarRol);
	});
</script>

{#if !perfilListo}
	<main class="container py-4"><LoadingState label="Preparando autorizaciones..." /></main>
{:else if ['acudiente', 'padre o acudiente'].some((rol) => normalizarNombre(rol) === rolActual)}
	<CaregiverAuthorizations />
{:else if rolActual === 'estudiante'}
	<StudentAuthorizations />
{:else}
<ApiCrudTable endpoint="/autorizaciones/" title="Autorizaciones" {fields} moduleKey="autorizaciones" sinEliminarRoles={['administrador', 'coordinador']} />
{/if}

