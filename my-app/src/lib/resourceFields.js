export const categoriaFields = [
    { key: 'nombre', label: 'Nombre', required: true, maxlength: 100, sortable: true },
    { key: 'descripcion', label: 'Descripción', type: 'textarea', maxlength: 500 },
    { key: 'estado', label: 'Estado', type: 'checkbox', defaultValue: true, checkboxLabel: 'Categoría activa', filterable: true }
];

export const actividadFields = [
    { key: 'nombre', label: 'Nombre', required: true, maxlength: 150 },
    { key: 'descripcion', label: 'Descripción', type: 'textarea', maxlength: 1000 },
    { key: 'categoria_id', label: 'Categoría', required: true, optionsEndpoint: '/categorias-actividades/', optionLabel: 'nombre', filterable: true },
    { key: 'fecha', label: 'Fecha', type: 'date', required: true, filterable: true, sortable: true },
    { key: 'hora', label: 'Hora', type: 'time', required: true },
    { key: 'lugar', label: 'Lugar', required: true, maxlength: 150 },
    { key: 'cupo', label: 'Cupo máximo', type: 'number', min: 1, required: true, sortable: true },
    { key: 'docentes_asignados', label: 'Docente(s) asociado(s)', readOnly: true, sortable: true },
    { key: 'cantidad_inscritos', label: 'Estudiantes inscritos', type: 'number', readOnly: true, sortable: true },
    { key: 'estado', label: 'Estado', type: 'checkbox', defaultValue: true, checkboxLabel: 'Actividad activa y visible', filterable: true }
];

export const estudianteFields = [
    { key: 'usuario_id', label: 'Estudiante', required: true, optionsEndpoint: '/usuarios/?rol=estudiante', optionLabel: 'nombre' },
    { key: 'codigo_estudiante', label: 'Código estudiantil', required: true, maxlength: 30, sortable: true },
    { key: 'grado', label: 'Grado', required: true, maxlength: 30, filterable: true, sortable: true },
    { key: 'estado', label: 'Estado', type: 'checkbox', defaultValue: true, checkboxLabel: 'Estudiante activo', filterable: true }
];

export const acudienteFields = [
    { key: 'usuario_id', label: 'Acudiente', required: true, optionsEndpoint: '/usuarios/?rol=acudiente', optionLabel: 'nombre' },
    { key: 'documento', label: 'Documento', required: true, maxlength: 30 },
    { key: 'telefono', label: 'Teléfono', required: true, maxlength: 30 },
    { key: 'parentesco', label: 'Parentesco', maxlength: 50, filterable: true },
    { key: 'estado', label: 'Estado', type: 'checkbox', defaultValue: true, checkboxLabel: 'Acudiente activo', filterable: true }
];

export const inscripcionFields = [
    {
        key: 'estudiante_id', label: 'Estudiante', required: true, filterable: true,
        optionsEndpoint: '/estudiantes/',
        optionLabel: (estudiante, refs) => {
            const usuario = estudiante.usuario_nombre ? { nombre: estudiante.usuario_nombre } : refs['/usuarios/']?.find((item) => Number(item.id) === Number(estudiante.usuario_id));
            const nombre = usuario?.nombre ?? 'Estudiante';
            const referencia = [estudiante.codigo_estudiante, estudiante.grado].filter(Boolean).join(' · ');
            return referencia ? `${nombre} · ${referencia}` : nombre;
        }
    },
    { key: 'actividad_id', label: 'Taller o actividad', required: true, optionsEndpoint: '/actividades/', optionLabel: (actividad) => `${actividad.nombre} · ${actividad.fecha}`, filterable: true },
    { key: 'docentes_asignados', label: 'Docente(s) asociado(s)', readOnly: true, sortable: true },
    { key: 'fecha_inscripcion', label: 'Fecha de inscripción', type: 'date', readOnly: true, filterable: true, sortable: true },
    { key: 'estado', label: 'Estado', type: 'checkbox', defaultValue: true, checkboxLabel: 'Inscripción vigente', required: true, filterable: true }
];

export const autorizacionFields = [
    {
        key: 'inscripcion_id', label: 'Inscripción', required: true, filterable: true,
        optionsEndpoint: '/inscripciones/',
        optionLabel: (inscripcion, refs) => {
            const estudiante = { codigo_estudiante: inscripcion.estudiante_nombre };
            const usuario = { nombre: inscripcion.estudiante_nombre };
            const actividad = { nombre: inscripcion.actividad_nombre };
            return `${usuario?.nombre ?? estudiante?.codigo_estudiante ?? 'Estudiante'} · ${actividad?.nombre ?? 'Actividad'}`;
        }
    },
    { key: 'acudiente_id', label: 'Acudiente', required: true, optionsEndpoint: '/acudientes/', optionLabel: (acudiente) => acudiente.usuario_nombre ?? acudiente.parentesco ?? 'Acudiente', filterable: true },
    { key: 'estado', label: 'Autorización', type: 'checkbox', defaultValue: false, checkboxLabel: 'Acudiente autoriza la participación', required: true, filterable: true },
    { key: 'fecha_autorizacion', label: 'Fecha de autorización', type: 'date', filterable: true, sortable: true }
];

export const asistenciaFields = [
    {
        key: 'inscripcion_id', label: 'Inscripción', required: true, filterable: true,
        optionsEndpoint: '/inscripciones/',
        optionLabel: (inscripcion, refs) => {
            const estudiante = { codigo_estudiante: inscripcion.estudiante_nombre };
            const usuario = { nombre: inscripcion.estudiante_nombre };
            const actividad = { nombre: inscripcion.actividad_nombre };
            return `${usuario?.nombre ?? estudiante?.codigo_estudiante ?? 'Estudiante'} · ${actividad?.nombre ?? 'Actividad'}`;
        }
    },
    { key: 'estudiante_nombre', label: 'Estudiante', readOnly: true, sortable: true },
    { key: 'actividad_nombre', label: 'Actividad', readOnly: true, sortable: true },
    { key: 'actividad_fecha', label: 'Fecha de actividad', type: 'date', readOnly: true, sortable: true },
    { key: 'docentes_asignados', label: 'Docente(s) asociado(s)', readOnly: true, sortable: true },
    {
        key: 'asistio', label: 'Asistencia', type: 'select', defaultValue: null,
        options: [{ value: true, label: 'Presente' }, { value: false, label: 'Ausente' }], filterable: true
    },
    { key: 'observacion', label: 'Observación', type: 'textarea', maxlength: 500 },
    { key: 'nota', label: 'Nota (0 a 5)', type: 'number', min: 0, max: 5, step: 0.1 },
    { key: 'retroalimentacion', label: 'Retroalimentación docente', type: 'textarea', maxlength: 1000 },
    { key: 'estado', label: 'Estado del registro', type: 'checkbox', defaultValue: true, checkboxLabel: 'Registro activo', required: true, filterable: true }
];

