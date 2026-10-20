const TOKEN_KEY = 'portal:eventos-escolares:access-token';
const PROFILE_KEY = 'perfilPortal';

function emitirEvento(nombre) {
	if (typeof window !== 'undefined') window.dispatchEvent(new Event(nombre));
}

export function leerToken() {
	if (typeof window === 'undefined') return '';
	return sessionStorage.getItem(TOKEN_KEY) ?? '';
}

export function leerPerfilAutenticado() {
	if (typeof window === 'undefined') return null;
	try {
		return JSON.parse(sessionStorage.getItem(PROFILE_KEY) ?? 'null');
	} catch {
		return null;
	}
}

export function guardarPerfilAutenticado(perfil) {
	if (typeof window === 'undefined') return;
	if (!perfil?.usuario || !perfil?.rol || !Array.isArray(perfil?.modulos)) {
		throw new TypeError('La API devolvió un perfil incompleto.');
	}
	sessionStorage.setItem(PROFILE_KEY, JSON.stringify(perfil));
	emitirEvento('perfil-portal-cambiado');
}

export function guardarSesion(respuesta) {
	if (typeof window === 'undefined') return;
	if (typeof respuesta?.access_token !== 'string' || !respuesta.access_token) {
		throw new TypeError('La API no devolvió un token de acceso.');
	}
	sessionStorage.setItem(TOKEN_KEY, respuesta.access_token);
	guardarPerfilAutenticado(respuesta);
	emitirEvento('portal-sesion-cambiada');
}

export function cerrarSesion() {
	if (typeof window !== 'undefined') {
		sessionStorage.removeItem(TOKEN_KEY);
		sessionStorage.removeItem(PROFILE_KEY);
	}
	emitirEvento('perfil-portal-cambiado');
	emitirEvento('portal-sesion-cambiada');
}
