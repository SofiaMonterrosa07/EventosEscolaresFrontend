
/*
 * src/lib/modulos.js
 *
 * Registro central de las rutas de los módulos.
 * Los permisos por rol se siguen consultando en la API.
 */

export function normalizarNombre(nombre) {
    return String(nombre ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

/* Solo se registran módulos con una página +page.svelte existente. */
export const rutasPorModulo = Object.freeze({
    usuarios: '/usuarios',
    roles: '/roles',
    actividades: '/actividades',
    inscripciones: '/inscripciones',
    autorizaciones: '/autorizaciones',
    asistencia: '/asistencia',
    reportes: '/reportes',
    analitica: '/analitica',
    estudiantes: '/estudiantes',
    acudientes: '/acudientes',
    categorias: '/categorias',
    bienestar: '/bienestar',
    notificaciones: '/notificaciones',
});

/**
 * Devuelve la ruta registrada para un módulo.
 * Reconoce tildes y variantes de escritura de los nombres de módulo.
 */
export function obtenerRutaModulo(nombre) {
    const clave = normalizarNombre(nombre);

    return rutasPorModulo[clave] ?? null;
}

