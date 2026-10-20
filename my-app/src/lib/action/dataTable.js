import { tick } from 'svelte';

const defaults = {
    responsive: true,
    pageLength: 10,
    lengthMenu: [5, 10, 25, 50],
    autoWidth: false,
    language: {
        search: 'Buscar:',
        lengthMenu: 'Mostrar _MENU_ registros',
        info: 'Mostrando _START_–_END_ de _TOTAL_ registros',
        infoEmpty: 'Sin registros para mostrar',
        infoFiltered: '(filtrado de _MAX_ registros)',
        zeroRecords: 'No se encontraron resultados',
        emptyTable: 'No hay datos disponibles',
        loadingRecords: 'Cargando…',
        processing: 'Procesando…',
        paginate: { first: 'Primera', last: 'Última', next: 'Siguiente', previous: 'Anterior' }
    }
};

/** Inicializa DataTables cuando Svelte termina de pintar la tabla. */
export function dataTable(node) {
    let instance;
    let destroyed = false;

    async function initialize() {
        await tick();
        const [{ default: DataTable }] = await Promise.all([
            import('datatables.net-bs5'),
            import('datatables.net-responsive-bs5')
        ]);
        if (destroyed || !node.isConnected) return;
        instance = new DataTable(node, defaults);
    }

    void initialize();

    return {
        destroy() {
            destroyed = true;
            instance?.destroy();
        }
    };
}
