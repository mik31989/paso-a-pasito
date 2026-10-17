// --- Configuración del reto ---
document.getElementById('formConfig').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre_reto = document.getElementById('nombreReto').value;
  const fecha_inicio = document.getElementById('fechaInicio').value;
  const fecha_fin = document.getElementById('fechaFin').value;

  const resp = await fetch('/admin/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre_reto, fecha_inicio, fecha_fin }),
  });

  if (resp.ok) {
    const msg = document.getElementById('mensajeConfig');
    msg.classList.remove('oculto');
    setTimeout(() => msg.classList.add('oculto'), 2000);
    cargarUsuarios();
    cargarTop10();
  }
});

// --- Importar usuarios ---
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
  mostrarModalCredenciales(data.creados, data.errores);
  cargarUsuarios();
  cargarTop10();
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

// --- Regenerar archivo de usuarios y contraseñas (todos los participantes) ---
document.getElementById('btnRegenerarCredenciales').addEventListener('click', () => {
  window.location.href = '/admin/api/credenciales/exportar';
});

// --- Listado, filtros y orden ---
async function cargarUsuarios() {
  const usuario = document.getElementById('filtroUsuario').value;
  const categoria = document.getElementById('filtroCategoria').value;
  const dia = document.getElementById('filtroDia').value;
  const orden = document.getElementById('ordenUsuarios').value;

  const params = new URLSearchParams();
  if (usuario) params.set('usuario', usuario);
  if (categoria) params.set('categoria', categoria);
  if (dia) params.set('dia', dia);
  if (orden) params.set('orden', orden);

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
        <td class="celda-acciones">
          <a href="/admin/usuario/${u.id}" class="btn btn-secundario btn-pequeno">Ver detalle</a>
          <button class="btn btn-secundario btn-pequeno" onclick="abrirModalEditar(${u.id}, ${JSON.stringify(u.expediente)}, ${JSON.stringify(u.nombre)}, ${JSON.stringify(u.fechaNacimiento)})">Editar</button>
          <button class="btn btn-peligro btn-pequeno" onclick="borrarUsuario(${u.id}, ${JSON.stringify(u.nombre)})">Eliminar</button>
        </td>
      </tr>`
    )
    .join('');
}

document.getElementById('filtroUsuario').addEventListener('input', debounce(cargarUsuarios, 300));
document.getElementById('filtroCategoria').addEventListener('change', cargarUsuarios);
document.getElementById('filtroDia').addEventListener('change', cargarUsuarios);
document.getElementById('ordenUsuarios').addEventListener('change', cargarUsuarios);
document.getElementById('btnLimpiarFiltros').addEventListener('click', () => {
  document.getElementById('filtroUsuario').value = '';
  document.getElementById('filtroCategoria').value = '';
  document.getElementById('filtroDia').value = '';
  document.getElementById('ordenUsuarios').value = 'nombre';
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

// --- Top 10 ---
async function cargarTop10() {
  const resp = await fetch('/admin/api/top10');
  const data = await resp.json();
  const cuerpo = document.getElementById('cuerpoTop10');

  if (data.top.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="4" class="texto-ayuda">Aún no hay pasos registrados.</td></tr>';
    return;
  }

  const medallas = ['🥇', '🥈', '🥉'];
  cuerpo.innerHTML = data.top
    .map(
      (u, i) => `
      <tr>
        <td class="celda-posicion">${medallas[i] || i + 1}</td>
        <td>${u.nombre}</td>
        <td>Categoría ${u.categoria}</td>
        <td>${u.totalPasos.toLocaleString('es-MX')}</td>
      </tr>`
    )
    .join('');
}

// --- Editar perfil de usuario ---
let usuarioEditandoId = null;
const modalEditar = document.getElementById('modalEditarUsuario');

window.abrirModalEditar = function (id, expediente, nombre, fechaNacimiento) {
  usuarioEditandoId = id;
  document.getElementById('editarExpediente').value = expediente;
  document.getElementById('editarNombre').value = nombre;
  document.getElementById('editarFechaNacimiento').value = fechaNacimiento;
  document.getElementById('errorEditar').classList.add('oculto');
  modalEditar.classList.remove('oculto');
};

document.getElementById('cerrarModalEditar').addEventListener('click', () => modalEditar.classList.add('oculto'));
document.getElementById('btnCancelarEditar').addEventListener('click', () => modalEditar.classList.add('oculto'));

document.getElementById('btnGuardarEditar').addEventListener('click', async () => {
  const errorEl = document.getElementById('errorEditar');
  errorEl.classList.add('oculto');

  const body = {
    expediente: document.getElementById('editarExpediente').value.trim(),
    nombre: document.getElementById('editarNombre').value.trim(),
    fecha_nacimiento: document.getElementById('editarFechaNacimiento').value,
  };

  const resp = await fetch(`/admin/api/usuarios/${usuarioEditandoId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json();

  if (!resp.ok) {
    errorEl.textContent = data.error || 'No se pudo guardar el cambio.';
    errorEl.classList.remove('oculto');
    return;
  }

  modalEditar.classList.add('oculto');
  cargarUsuarios();
  cargarTop10();
});

// --- Borrar usuario ---
window.borrarUsuario = async function (id, nombre) {
  if (!confirm(`¿Eliminar a "${nombre}"? Se borrarán también sus actividades y evidencias. Esta acción no se puede deshacer.`)) {
    return;
  }
  const resp = await fetch(`/admin/api/usuarios/${id}`, { method: 'DELETE' });
  if (resp.ok) {
    cargarUsuarios();
    cargarTop10();
  } else {
    const data = await resp.json();
    alert(data.error || 'No se pudo eliminar el usuario.');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  cargarUsuarios();
  cargarTop10();
});
