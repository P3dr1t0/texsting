// Donaciones con Google Play (1, 3 y 5 USD). No desbloquean nada: TeXsting es completo y gratis para todos.
import { Capacitor, registerPlugin } from '@capacitor/core';

const Donaciones = (typeof window !== 'undefined' && window.__donacionesPrueba) || registerPlugin('Donaciones');
export const MONTOS = [{ id: 'donacion_1', usd: 1 }, { id: 'donacion_3', usd: 3 }, { id: 'donacion_5', usd: 5 }];

/** Precios en la moneda del usuario: [{ id, precio }]. Lanza un error si no hay Google Play. */
export async function productos() {
  if (!Capacitor.isNativePlatform() && !window.__donacionesPrueba) throw new Error('NO_DISPONIBLE');
  const r = await Donaciones.productos();
  return r.productos || [];
}

/** Abre el pago de Google Play: devuelve 'gracias', 'pendiente' o 'cancelado'. */
export async function donar(id) {
  const r = await Donaciones.donar({ id });
  return r.estado;
}
