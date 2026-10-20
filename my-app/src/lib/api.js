import { cerrarSesion, leerToken } from '$lib/auth.js';

const apiConfigurada = String(import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
const apiLocal = import.meta.env.DEV ? 'http://127.0.0.1:8000' : '';
const claveCambiosApi = 'portal:eventos-escolares:cambio-api';

function notificarCambioApi(endpoint, method) {
	if (typeof window === 'undefined') return;

	const detalle = { endpoint, method, timestamp: Date.now(), nonce: Math.random() };
	window.dispatchEvent(new CustomEvent('portal-datos-actualizados', { detail: detalle }));
	try {
		localStorage.setItem(claveCambiosApi, JSON.stringify(detalle));
	} catch {
		// The same-tab event still works when the browser blocks localStorage.
	}
}

export function suscribirCambiosApi(callback) {
	if (typeof window === 'undefined') return () => {};

	const alCambiarEnEstaPestana = (event) => callback(event.detail);
	const alCambiarEnOtraPestana = (event) => {
		if (event.key !== claveCambiosApi || !event.newValue) return;
		try {
			callback(JSON.parse(event.newValue));
		} catch {
			callback(null);
		}
	};

	window.addEventListener('portal-datos-actualizados', alCambiarEnEstaPestana);
	window.addEventListener('storage', alCambiarEnOtraPestana);
	return () => {
		window.removeEventListener('portal-datos-actualizados', alCambiarEnEstaPestana);
		window.removeEventListener('storage', alCambiarEnOtraPestana);
	};
}

function crearUrl(endpoint) {
	if (typeof endpoint !== 'string' || !endpoint.trim()) {
		throw new TypeError('La ruta de la API debe ser un texto no vacío.');
	}

	const ruta = endpoint.trim();
	if (/^https?:\/\//i.test(ruta)) return ruta;

	const base = apiConfigurada || apiLocal;
	if (!base) {
		throw new Error('Falta configurar VITE_API_URL para conectar con la API.');
	}

	return `${base}/${ruta.replace(/^\/+/, '')}`;
}

function mensajeDeError(payload, texto, response) {
	const detalle = payload?.detail ?? payload?.message ?? payload?.mensaje;

	if (Array.isArray(detalle)) {
		const mensajes = detalle.map((error) => {
			const campo = Array.isArray(error?.loc)
				? error.loc.filter((parte) => parte !== 'body').join('.')
				: '';
			const mensaje = error?.msg ?? error?.message ?? 'Dato no válido';
			return campo ? `${campo}: ${mensaje}` : mensaje;
		});
		return mensajes.join('; ');
	}

	if (typeof detalle === 'string' && detalle.trim()) return detalle;
	if (detalle && typeof detalle === 'object') {
		return detalle.message ?? JSON.stringify(detalle);
	}
	if (texto.trim()) return texto.trim();
	return `La API respondió con el estado ${response.status}${response.statusText ? ` (${response.statusText})` : ''}.`;
}

async function leerRespuesta(response) {
	if (response.status === 204) return null;

	const texto = await response.text();
	if (!texto.trim()) return null;

	try {
		return JSON.parse(texto);
	} catch {
		return texto;
	}
}

export function apiGet(endpoint, opciones = {}) {
	return apiRequest(endpoint, { ...opciones, method: 'GET' });
}

export async function apiRequest(endpoint, { method = 'GET', body, headers, signal } = {}) {
	const url = crearUrl(endpoint);
	const cabeceras = new Headers(headers);
	cabeceras.set('Accept', 'application/json');
	const token = leerToken();
	if (token && !cabeceras.has('Authorization')) {
		cabeceras.set('Authorization', `Bearer ${token}`);
	}

	let cuerpo;
	if (body !== undefined) {
		const esFormData = typeof FormData !== 'undefined' && body instanceof FormData;
		const esUrlSearchParams = typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams;
		const esBlob = typeof Blob !== 'undefined' && body instanceof Blob;

		if (esFormData || esUrlSearchParams || esBlob || typeof body === 'string') {
			cuerpo = body;
		} else {
			cuerpo = JSON.stringify(body);
			if (!cabeceras.has('Content-Type')) {
				cabeceras.set('Content-Type', 'application/json');
			}
		}
	}

	let response;
	try {
		response = await fetch(url, {
			method: String(method).toUpperCase(),
			headers: cabeceras,
			body: cuerpo,
			signal
		});
	} catch (cause) {
		const detalle = cause instanceof Error ? cause.message : 'Error de red';
		throw new Error(
			`No se pudo conectar con la API en ${url}. Verifica que esté activa, que VITE_API_URL sea correcta y que CORS permita este frontend. (${detalle})`,
			{ cause }
		);
	}

	const respuesta = await leerRespuesta(response);
	if (response.status === 401 && token && !/\/auth\/login\/?$/i.test(endpoint)) {
		cerrarSesion();
		if (typeof window !== 'undefined') window.dispatchEvent(new Event('portal-sesion-expirada'));
	}
	if (!response.ok) {
		const texto = typeof respuesta === 'string' ? respuesta : '';
		const payload = respuesta && typeof respuesta === 'object' ? respuesta : null;
		throw new Error(mensajeDeError(payload, texto, response));
	}

	if (!['GET', 'HEAD', 'OPTIONS'].includes(String(method).toUpperCase())) {
		notificarCambioApi(endpoint, String(method).toUpperCase());
	}
	return respuesta;
}
