const modal = document.getElementById('modalActividad');
const inputFecha = document.getElementById('inputFecha');
const inputPasos = document.getElementById('inputPasos');
const inputEvidencias = document.getElementById('inputEvidencias');
const previewEvidencias = document.getElementById('previewEvidencias');
const evidenciasExistentes = document.getElementById('evidenciasExistentes');
const errorModal = document.getElementById('errorModal');

let fechaSeleccionadaActual = null;

function abrirModal(fecha) {
  fechaSeleccionadaActual = fecha;
  inputFecha.value = fecha;
  inputFecha.disabled = true; // la fecha ya se eligió al hacer clic en el día
  inputPasos.value = '';
  inputEvidencias.value = '';
  previewEvidencias.innerHTML = '';
  evidenciasExistentes.innerHTML = '';
  errorModal.classList.add('oculto');
  modal.classList.remove('oculto');

  fetch(`/api/actividades/${fecha}`)
    .then((r) => r.json())
    .then((data) => {
      if (data.existe) {
        inputPasos.value = data.pasos;
        evidenciasExistentes.innerHTML = data.evidencias
          .map(() => '<div class="texto-ayuda">📎 evidencia ya guardada</div>')
          .join('');
      }
    });
}

function cerrarModal() {
  modal.classList.add('oculto');
}

window.alHacerClicDiaCalendario = function (dia) {
  if (dia.esFuturo) return;
  abrirModal(dia.fecha);
};

document.getElementById('cerrarModal').addEventListener('click', cerrarModal);
document.getElementById('btnCancelar').addEventListener('click', cerrarModal);

inputEvidencias.addEventListener('change', () => {
  previewEvidencias.innerHTML = '';
  const archivos = Array.from(inputEvidencias.files).slice(0, 5);
  if (inputEvidencias.files.length > 5) {
    errorModal.textContent = 'Solo se permiten hasta 5 imágenes; se tomarán las primeras 5.';
    errorModal.classList.remove('oculto');
  }
  archivos.forEach((archivo) => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(archivo);
    previewEvidencias.appendChild(img);
  });
});

document.getElementById('btnAceptar').addEventListener('click', async () => {
  errorModal.classList.add('oculto');
  const pasos = inputPasos.value;

  if (pasos === '' || Number(pasos) < 0) {
    errorModal.textContent = 'Ingresa un número de pasos válido.';
    errorModal.classList.remove('oculto');
    return;
  }

  const formData = new FormData();
  formData.append('fecha', fechaSeleccionadaActual);
  formData.append('pasos', pasos);
  Array.from(inputEvidencias.files)
    .slice(0, 5)
    .forEach((archivo) => formData.append('evidencias', archivo));

  const resp = await fetch('/api/actividades', { method: 'POST', body: formData });
  const data = await resp.json();

  if (!resp.ok) {
    errorModal.textContent = data.error || 'No se pudo registrar la actividad.';
    errorModal.classList.remove('oculto');
    return;
  }

  cerrarModal();
  cargarCalendario('/api/actividades');
});

document.addEventListener('DOMContentLoaded', () => {
  cargarCalendario('/api/actividades');
});
