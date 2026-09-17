const UMBRAL_PASOS = { A: 7000, B: 9000 };

/** Calcula edad en años completos a partir de una fecha (YYYY-MM-DD) hasta hoy. */
function calcularEdad(fechaNacimientoStr) {
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimientoStr);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
}

/** Categoría A: menos de 40 años. Categoría B: 40 años o más. */
function calcularCategoria(fechaNacimientoStr) {
  return calcularEdad(fechaNacimientoStr) < 40 ? 'A' : 'B';
}

function pasosMinimos(categoria) {
  return UMBRAL_PASOS[categoria] || 0;
}

/** Devuelve YYYY-MM-DD en horario local (evita desfases de zona horaria de toISOString). */
function fechaISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hoyISO() {
  return fechaISO(new Date());
}

/** Fecha mínima permitida para registrar actividad: hasta una semana atrás. */
function fechaMinimaRegistro() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return fechaISO(d);
}

function generarPasswordAleatoria(longitud = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < longitud; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Construye el arreglo de días del reto con pasos, color y estrella para un usuario.
 * mapaPasos: Map fecha(YYYY-MM-DD) -> pasos (solo fechas con registro)
 */
function construirCalendario(fechaInicio, fechaFin, mapaPasos) {
  const dias = [];
  const inicio = new Date(fechaInicio + 'T00:00:00');
  const fin = new Date(fechaFin + 'T00:00:00');
  const hoy = hoyISO();

  let maxPasos = 0;
  for (const pasos of mapaPasos.values()) {
    if (pasos > maxPasos) maxPasos = pasos;
  }

  let pasosDiaAnterior = 0;
  for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
    const fecha = fechaISO(d);
    const esFuturo = fecha > hoy;
    let pasos = mapaPasos.has(fecha) ? mapaPasos.get(fecha) : 0;
    let color = null;

    if (!esFuturo) {
      if (pasos === 0) {
        color = 'rojo';
      } else if (pasos > pasosDiaAnterior) {
        color = 'verde';
      } else {
        color = 'amarillo';
      }
      pasosDiaAnterior = pasos;
    }

    dias.push({
      fecha,
      pasos: esFuturo ? null : pasos,
      color,
      estrella: !esFuturo && maxPasos > 0 && pasos === maxPasos,
      esFuturo,
      esHoy: fecha === hoy,
    });
  }
  return dias;
}

module.exports = {
  UMBRAL_PASOS,
  calcularEdad,
  calcularCategoria,
  pasosMinimos,
  fechaISO,
  hoyISO,
  fechaMinimaRegistro,
  generarPasswordAleatoria,
  construirCalendario,
};
