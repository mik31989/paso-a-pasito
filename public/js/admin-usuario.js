const usuarioId = document.body.dataset.usuarioId;

const modalEvidencias = document.getElementById('modalEvidencias');
const tituloModalEvidencias = document.getElementById('tituloModalEvidencias');
const pasosModalEvidencias = document.getElementById('pasosModalEvidencias');
const carrusel = document.getElementById('carrusel');
const carruselImagen = document.getElementById('carruselImagen');
const carruselContador = document.getElementById('carruselContador');
const sinEvidencias = document.getElementById('sinEvidencias');

let evidenciasActuales = [];
let indiceEvidenciaActual = 0;

window.alHacerClicDiaCalendario = function (dia) {
  if (dia.esFuturo) return;
  abrirModalEvidencias(dia.fecha);
};

async function abrirModalEvidencias(fecha) {
  tituloModalEvidencias.textContent = `Detalle del ${fecha}`;
  const resp = await fetch(`/admin/api/usuarios/${usuarioId}/actividades/${fecha}`);
  const data = await resp.json();

  if (!data.existe) {
    pasosModalEvidencias.textContent = '0 pasos';
    evidenciasActuales = [];
  } else {
    pasosModalEvidencias.textContent = `${data.pasos.toLocaleString('es-MX')} pasos`;
    evidenciasActuales = data.evidencias;
  }

  indiceEvidenciaActual = 0;
  actualizarCarrusel();
  modalEvidencias.classList.remove('oculto');
}

function actualizarCarrusel() {
  if (evidenciasActuales.length === 0) {
    carrusel.classList.add('oculto');
    carruselContador.classList.add('oculto');
    sinEvidencias.classList.remove('oculto');
    return;
  }
  sinEvidencias.classList.add('oculto');
  carrusel.classList.remove('oculto');
  carruselContador.classList.remove('oculto');
  carruselImagen.src = evidenciasActuales[indiceEvidenciaActual].dataUrl;
  carruselContador.textContent = `Imagen ${indiceEvidenciaActual + 1} de ${evidenciasActuales.length}`;
}

document.getElementById('carruselAnterior').addEventListener('click', () => {
  indiceEvidenciaActual = (indiceEvidenciaActual - 1 + evidenciasActuales.length) % evidenciasActuales.length;
  actualizarCarrusel();
});
document.getElementById('carruselSiguiente').addEventListener('click', () => {
  indiceEvidenciaActual = (indiceEvidenciaActual + 1) % evidenciasActuales.length;
  actualizarCarrusel();
});
document.getElementById('cerrarModal').addEventListener('click', () => {
  modalEvidencias.classList.add('oculto');
});

document.addEventListener('DOMContentLoaded', () => {
  cargarCalendario(`/admin/api/usuarios/${usuarioId}/actividades`);
});
