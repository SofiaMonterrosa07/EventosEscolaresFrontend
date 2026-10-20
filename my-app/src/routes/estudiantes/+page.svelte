<script>
	import ApiCrudTable from '$lib/components/ApiCrudTable.svelte';
	import { estudianteFields as fields } from '$lib/resourceFields.js';
</script>

<ApiCrudTable endpoint="/estudiantes/" title="Estudiantes" {fields} moduleKey="estudiantes" associationType="estudiante" />

