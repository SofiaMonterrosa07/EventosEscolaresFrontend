<script>
	import ApiCrudTable from '$lib/components/ApiCrudTable.svelte';
	import { acudienteFields as fields } from '$lib/resourceFields.js';
</script>

<ApiCrudTable endpoint="/acudientes/" title="Acudientes" {fields} moduleKey="acudientes" associationType="acudiente" />

