// Módulo genérico de calendario. Se usa tanto en el dashboard del usuario
// (calendario editable) como en el detalle de administrador (solo lectura).

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const EstadoCalendario = {
  dias: [],       // arreglo completo de días del reto, con {fecha, pasos, color, estrella, esFuturo, esHoy}
  mesActual: null, // Date del primer día del mes que se está mostrando
  retoInicio: null,
  retoFin: null,
};

async function cargarCalendario(urlDatos) {
  const resp = await fetch(urlDatos);
  const data = await resp.json();
  EstadoCalendario.dias = data.dias;
  EstadoCalendario.retoInicio = data.retoInicio;
  EstadoCalendario.retoFin = data.retoFin;

  const totalEl = document.getElementById('totalPasos');
  if (totalEl) totalEl.textContent = data.totalPasos.toLocaleString('es-MX');

  if (!EstadoCalendario.mesActual) {
    const hoyEnDias = data.dias.find((d) => d.esHoy);
    const referencia = hoyEnDias ? hoyEnDias.fecha : data.dias[0].fecha;
    const [y, m] = referencia.split('-').map(Number);
    EstadoCalendario.mesActual = new Date(y, m - 1, 1);
  }

  pintarMesActual();
}

function pintarMesActual() {
  const rejilla = document.getElementById('rejillaCalendario');
  const titulo = document.getElementById('tituloMes');
  if (!rejilla) return;

  const mes = EstadoCalendario.mesActual;
  titulo.textContent = `${NOMBRES_MES[mes.getMonth()]} ${mes.getFullYear()}`;

  const primerDiaSemana = new Date(mes.getFullYear(), mes.getMonth(), 1).getDay();
  const diasDelMes = EstadoCalendario.dias.filter((d) => {
    const [y, m] = d.fecha.split('-').map(Number);
    return y === mes.getFullYear() && m - 1 === mes.getMonth();
  });

  rejilla.innerHTML = '';

  for (let i = 0; i < primerDiaSemana; i++) {
    const vacio = document.createElement('div');
    vacio.className = 'dia-calendario dia-vacio';
    rejilla.appendChild(vacio);
  }

  for (const dia of diasDelMes) {
    const celda = document.createElement('div');
    celda.className = 'dia-calendario';
    if (dia.color) celda.classList.add(`color-${dia.color}`);
    if (dia.esFuturo) celda.classList.add('dia-futuro');
    if (dia.esHoy) celda.classList.add('hoy-dia');

    const numeroDia = dia.fecha.split('-')[2];
    celda.innerHTML = `
      <span class="numero-dia">${parseInt(numeroDia, 10)}</span>
      ${dia.pasos !== null ? `<span class="pasos-dia">${dia.pasos.toLocaleString('es-MX')}</span>` : ''}
      ${dia.estrella ? '<span class="estrella-dia">⭐</span>' : ''}
    `;

    if (window.alHacerClicDiaCalendario) {
      celda.addEventListener('click', () => window.alHacerClicDiaCalendario(dia));
    }

    rejilla.appendChild(celda);
  }

  // Navegación deshabilitada si no hay más días del reto en esa dirección
  const btnAnterior = document.getElementById('btnMesAnterior');
  const btnSiguiente = document.getElementById('btnMesSiguiente');
  if (btnAnterior && btnSiguiente) {
    const [yi, mi] = EstadoCalendario.retoInicio.split('-').map(Number);
    const [yf, mf] = EstadoCalendario.retoFin.split('-').map(Number);
    const inicioMes = new Date(yi, mi - 1, 1);
    const finMes = new Date(yf, mf - 1, 1);
    btnAnterior.disabled = mes <= inicioMes;
    btnSiguiente.disabled = mes >= finMes;
  }
}

function irMesAnterior() {
  EstadoCalendario.mesActual = new Date(
    EstadoCalendario.mesActual.getFullYear(),
    EstadoCalendario.mesActual.getMonth() - 1,
    1
  );
  pintarMesActual();
}

function irMesSiguiente() {
  EstadoCalendario.mesActual = new Date(
    EstadoCalendario.mesActual.getFullYear(),
    EstadoCalendario.mesActual.getMonth() + 1,
    1
  );
  pintarMesActual();
}

document.addEventListener('DOMContentLoaded', () => {
  const btnAnterior = document.getElementById('btnMesAnterior');
  const btnSiguiente = document.getElementById('btnMesSiguiente');
  if (btnAnterior) btnAnterior.addEventListener('click', irMesAnterior);
  if (btnSiguiente) btnSiguiente.addEventListener('click', irMesSiguiente);
});
