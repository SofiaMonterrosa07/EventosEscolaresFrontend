import { normalizarNombre } from '$lib/modulos.js';

/**
 * Las acciones de escritura solo aparecen para módulos asignados al rol en
 * la respuesta de /modulos-roles/. El backend sigue siendo quien debe validar
 * esos permisos al recibir cada solicitud.
 */
export function puedeRealizarAccion(rol, modulo, accion, perfil = leerPerfilActivo()) {
    if (!['crear', 'editar', 'eliminar'].includes(accion)) return false;

    const rolActivo = normalizarNombre(perfil?.rol?.nombre);
    const rolSolicitado = normalizarNombre(rol);
    if (!rolActivo || (rolSolicitado && rolSolicitado !== rolActivo)) return false;

    const claveModulo = normalizarNombre(modulo);
    const puedeEscribirPorModulo = {
        actividades: ['administrador', 'coordinador'],
        inscripciones: ['administrador', 'coordinador'],
        autorizaciones: ['administrador', 'coordinador'],
        asistencia: ['administrador', 'coordinador', 'docente', 'profesor', 'entrenador'],
        categorias: ['administrador', 'coordinador'],
        usuarios: ['administrador', 'secretaria'],
        estudiantes: ['administrador', 'secretaria'],
        acudientes: ['administrador', 'secretaria'],
        roles: ['administrador']
    };
    const rolesPermitidos = puedeEscribirPorModulo[claveModulo] ?? [];
    if (!rolesPermitidos.includes(rolActivo)) return false;
    if (accion === 'eliminar' && claveModulo === 'asistencia') {
        const rolesQuePuedenEliminar = ['administrador', 'coordinador'];
        if (!rolesQuePuedenEliminar.includes(rolActivo)) return false;
    }

    return Array.isArray(perfil?.modulos) && perfil.modulos.some((item) =>
        normalizarNombre(item?.nombre) === claveModulo
    );
}

export function leerPerfilActivo() {
    if (typeof window === 'undefined') return null;
    try {
        return JSON.parse(sessionStorage.getItem('perfilPortal') ?? 'null');
    } catch {
        return null;
    }
}

export function leerRolActivo() {
    return normalizarNombre(leerPerfilActivo()?.rol?.nombre);
}
