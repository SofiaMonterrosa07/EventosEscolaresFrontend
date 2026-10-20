<script>
	import ApiCrudTable from '$lib/components/ApiCrudTable.svelte';
	import { categoriaFields as fields } from '$lib/resourceFields.js';
</script>

<ApiCrudTable endpoint="/categorias-actividades/" title="Categorías" {fields} moduleKey="categorias" />

