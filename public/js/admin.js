// --- Configuración del reto ---
document.getElementById('formConfig').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fecha_inicio = document.getElementById('fechaInicio').value;
  const fecha_fin = document.getElementById('fechaFin').value;

  const resp = await fetch('/admin/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fecha_inicio, fecha_fin }),
  });

  if (resp.ok) {
    const msg = document.getElementById('mensajeConfig');
    msg.classList.remove('oculto');
    setTimeout(() => msg.classList.add('oculto'), 2000);
  }
});

// --- Importar usuarios ---
let ultimosCreados = [];

document.getElementById('formImportar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const archivo = document.getElementById('archivoExcel').files[0];
  if (!archivo) return;

  const formData = new FormData();
  formData.append('archivo', archivo);

  const contenedorResultado = document.getElementById('resultadoImportar');
  contenedorResultado.innerHTML = '<p class="texto-ayuda">Procesando archivo…</p>';

  const resp = await fetch('/admin/api/importar-usuarios', { method: 'POST', body: formData });
  const data = await resp.json();

  if (!resp.ok) {
    contenedorResultado.innerHTML = `<div class="alerta alerta-error">${data.error}</div>`;
    return;
  }

  contenedorResultado.innerHTML = `<p class="texto-ayuda">${data.creados.length} usuario(s) creado(s), ${data.errores.length} error(es).</p>`;
  ultimosCreados = data.creados;
  mostrarModalCredenciales(data.creados, data.errores);
  cargarUsuarios();
});

function mostrarModalCredenciales(creados, errores) {
  const modal = document.getElementById('modalCredenciales');
  const tabla = document.getElementById('tablaCredenciales');
  const tablaErrores = document.getElementById('tablaErroresImportacion');

  if (creados.length === 0) {
    tabla.innerHTML = '<p class="texto-ayuda">No se creó ningún usuario nuevo.</p>';
  } else {
    tabla.innerHTML = `
      <table class="tabla-usuarios">
        <thead><tr><th>Expediente</th><th>Nombre</th><th>Categoría</th><th>Usuario</th><th>Contraseña</th></tr></thead>
        <tbody>
          ${creados
            .map(
              (c) => `<tr><td>${c.expediente}</td><td>${c.nombre}</td><td>${c.categoria}</td><td>${c.username}</td><td>${c.password}</td></tr>`
            )
            .join('')}
        </tbody>
      </table>`;
  }

  tablaErrores.innerHTML = errores.length
    ? `<p class="alerta alerta-error">${errores.length} fila(s) con problemas: ${errores
        .map((e) => `Fila ${e.fila}: ${e.motivo}`)
        .join(' · ')}</p>`
    : '';

  modal.classList.remove('oculto');
}

document.getElementById('cerrarModalCredenciales').addEventListener('click', () => {
  document.getElementById('modalCredenciales').classList.add('oculto');
});

document.getElementById('btnDescargarCredenciales').addEventListener('click', async () => {
  const resp = await fetch('/admin/api/exportar-credenciales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creados: ultimosCreados }),
  });
  const blob = await resp.blob();
  descargarBlob(blob, 'credenciales-paso-a-pasito.xlsx');
});

function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- Listado y filtros ---
async function cargarUsuarios() {
  const usuario = document.getElementById('filtroUsuario').value;
  const categoria = document.getElementById('filtroCategoria').value;
  const dia = document.getElementById('filtroDia').value;

  const params = new URLSearchParams();
  if (usuario) params.set('usuario', usuario);
  if (categoria) params.set('categoria', categoria);
  if (dia) params.set('dia', dia);

  const resp = await fetch(`/admin/api/usuarios?${params.toString()}`);
  const data = await resp.json();

  const cuerpo = document.getElementById('cuerpoTablaUsuarios');
  cuerpo.innerHTML = data.usuarios
    .map(
      (u) => `
      <tr>
        <td>${u.expediente}</td>
        <td>${u.nombre}</td>
        <td>Categoría ${u.categoria}</td>
        <td>${u.diasRegistrados}</td>
        <td>${u.totalPasos.toLocaleString('es-MX')}</td>
        <td><a href="/admin/usuario/${u.id}" class="btn btn-secundario">Ver detalle</a></td>
      </tr>`
    )
    .join('');
}

document.getElementById('filtroUsuario').addEventListener('input', debounce(cargarUsuarios, 300));
document.getElementById('filtroCategoria').addEventListener('change', cargarUsuarios);
document.getElementById('filtroDia').addEventListener('change', cargarUsuarios);
document.getElementById('btnLimpiarFiltros').addEventListener('click', () => {
  document.getElementById('filtroUsuario').value = '';
  document.getElementById('filtroCategoria').value = '';
  document.getElementById('filtroDia').value = '';
  cargarUsuarios();
});

document.getElementById('btnExportar').addEventListener('click', () => {
  window.location.href = '/admin/api/usuarios/exportar';
});

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

document.addEventListener('DOMContentLoaded', cargarUsuarios);
