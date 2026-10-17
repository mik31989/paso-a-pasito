const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const { db } = require('../src/db');
const { requiereAdmin } = require('../src/auth');
const {
  calcularCategoria,
  passwordInicial,
  construirCalendario,
} = require('../src/utils');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requiereAdmin);

router.get('/admin', async (req, res) => {
  const cfg = (await db.execute('SELECT * FROM reto_config WHERE id = 1')).rows[0];
  res.render('admin', {
    usuario: req.usuario,
    retoNombre: cfg.nombre_reto,
    retoInicio: cfg.fecha_inicio,
    retoFin: cfg.fecha_fin,
  });
});

router.get('/admin/usuario/:id', async (req, res) => {
  const usuarioObjetivo = (
    await db.execute({ sql: 'SELECT * FROM usuarios WHERE id = ?', args: [req.params.id] })
  ).rows[0];
  if (!usuarioObjetivo) return res.status(404).send('Usuario no encontrado');

  res.render('admin_usuario', { usuario: req.usuario, objetivo: usuarioObjetivo });
});

// --- Configuración del reto (nombre y fechas de inicio y fin) ---
router.post('/admin/api/config', async (req, res) => {
  const { nombre_reto, fecha_inicio, fecha_fin } = req.body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_fin)) {
    return res.status(400).json({ error: 'Fechas inválidas.' });
  }
  if (!nombre_reto || !nombre_reto.trim()) {
    return res.status(400).json({ error: 'El nombre del reto no puede estar vacío.' });
  }
  await db.execute({
    sql: 'UPDATE reto_config SET nombre_reto = ?, fecha_inicio = ?, fecha_fin = ? WHERE id = 1',
    args: [nombre_reto.trim(), fecha_inicio, fecha_fin],
  });
  res.json({ ok: true });
});

// --- Importar usuarios desde Excel ---
// Columnas esperadas (en la primera fila, cualquier orden): No Expediente | Nombre | Fecha de Nacimiento
// Usuario = No. de expediente. Contraseña inicial = expediente + sufijo fijo (ver src/utils.js).
router.post('/admin/api/importar-usuarios', upload.single('archivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Debes adjuntar un archivo de Excel.' });

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const hoja = workbook.worksheets[0];

    const encabezados = {};
    hoja.getRow(1).eachCell((cell, colNumber) => {
      const texto = String(cell.value || '').trim().toLowerCase();
      if (texto.includes('expediente')) encabezados.expediente = colNumber;
      else if (texto.includes('nombre')) encabezados.nombre = colNumber;
      else if (texto.includes('nacimiento')) encabezados.fechaNacimiento = colNumber;
    });

    if (!encabezados.expediente || !encabezados.nombre || !encabezados.fechaNacimiento) {
      return res.status(400).json({
        error: 'El Excel debe tener columnas para No. Expediente, Nombre y Fecha de Nacimiento.',
      });
    }

    const creados = [];
    const errores = [];

    for (let i = 2; i <= hoja.rowCount; i++) {
      const fila = hoja.getRow(i);
      const expedienteRaw = fila.getCell(encabezados.expediente).value;
      const nombreRaw = fila.getCell(encabezados.nombre).value;
      const fechaRaw = fila.getCell(encabezados.fechaNacimiento).value;

      if (!expedienteRaw && !nombreRaw) continue; // fila vacía

      const expediente = String(expedienteRaw).trim();
      const nombre = String(nombreRaw).trim();

      let fechaNacimiento;
      if (fechaRaw instanceof Date) {
        fechaNacimiento = fechaRaw.toISOString().slice(0, 10);
      } else {
        const parsed = new Date(fechaRaw);
        if (isNaN(parsed.getTime())) {
          errores.push({ fila: i, motivo: 'Fecha de nacimiento inválida' });
          continue;
        }
        fechaNacimiento = parsed.toISOString().slice(0, 10);
      }

      if (!expediente || !nombre) {
        errores.push({ fila: i, motivo: 'Falta expediente o nombre' });
        continue;
      }

      const yaExiste = (
        await db.execute({ sql: 'SELECT id FROM usuarios WHERE expediente = ?', args: [expediente] })
      ).rows[0];
      if (yaExiste) {
        errores.push({ fila: i, motivo: `El expediente ${expediente} ya existe` });
        continue;
      }

      const categoria = calcularCategoria(fechaNacimiento);
      const username = expediente;
      const passwordPlano = passwordInicial(username);
      const passwordHash = await bcrypt.hash(passwordPlano, 10);

      await db.execute({
        sql: `INSERT INTO usuarios (expediente, nombre, fecha_nacimiento, categoria, username, password_hash, rol)
              VALUES (?, ?, ?, ?, ?, ?, 'usuario')`,
        args: [expediente, nombre, fechaNacimiento, categoria, username, passwordHash],
      });

      creados.push({ expediente, nombre, categoria, username, password: passwordPlano });
    }

    res.json({ ok: true, creados, errores });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo procesar el archivo de Excel.' });
  }
});

// Genera (o regenera) el Excel de usuarios y contraseñas de TODOS los participantes.
// La contraseña es determinística (expediente + sufijo fijo), así que siempre se puede
// reconstruir sin tener que guardar texto plano en la base de datos.
router.get('/admin/api/credenciales/exportar', async (req, res) => {
  const usuarios = (
    await db.execute({
      sql: 'SELECT * FROM usuarios WHERE rol = ? ORDER BY nombre ASC',
      args: ['usuario'],
    })
  ).rows;

  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet('Credenciales');
  hoja.columns = [
    { header: 'No. Expediente', key: 'expediente', width: 18 },
    { header: 'Nombre', key: 'nombre', width: 30 },
    { header: 'Categoría', key: 'categoria', width: 12 },
    { header: 'Usuario', key: 'username', width: 18 },
    { header: 'Contraseña', key: 'password', width: 20 },
  ];
  hoja.addRows(
    usuarios.map((u) => ({
      expediente: u.expediente,
      nombre: u.nombre,
      categoria: u.categoria,
      username: u.username,
      password: passwordInicial(u.username),
    }))
  );
  hoja.getRow(1).font = { bold: true };

  res.setHeader('Content-Disposition', 'attachment; filename="credenciales-paso-a-pasito.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  await workbook.xlsx.write(res);
  res.end();
});

// --- Cambiar perfil de un usuario (nombre, expediente, fecha de nacimiento) ---
router.put('/admin/api/usuarios/:id', async (req, res) => {
  const { nombre, expediente, fecha_nacimiento } = req.body;

  if (!nombre || !nombre.trim() || !expediente || !expediente.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_nacimiento || '')) {
    return res.status(400).json({ error: 'Nombre, expediente y fecha de nacimiento son obligatorios.' });
  }

  const usuarioActual = (
    await db.execute({ sql: 'SELECT * FROM usuarios WHERE id = ?', args: [req.params.id] })
  ).rows[0];
  if (!usuarioActual) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const nuevoExpediente = expediente.trim();
  if (nuevoExpediente !== usuarioActual.expediente) {
    const choque = (
      await db.execute({
        sql: 'SELECT id FROM usuarios WHERE expediente = ? AND id != ?',
        args: [nuevoExpediente, req.params.id],
      })
    ).rows[0];
    if (choque) return res.status(400).json({ error: 'Ya existe otro usuario con ese número de expediente.' });
  }

  const categoria = calcularCategoria(fecha_nacimiento);
  const nuevoUsername = nuevoExpediente; // el usuario de acceso siempre es el expediente
  const nuevoPasswordHash = await bcrypt.hash(passwordInicial(nuevoUsername), 10);

  await db.execute({
    sql: `UPDATE usuarios
          SET nombre = ?, expediente = ?, fecha_nacimiento = ?, categoria = ?, username = ?, password_hash = ?
          WHERE id = ?`,
    args: [nombre.trim(), nuevoExpediente, fecha_nacimiento, categoria, nuevoUsername, nuevoPasswordHash, req.params.id],
  });

  res.json({ ok: true, categoria, username: nuevoUsername });
});

// --- Borrar usuario (y sus actividades / evidencias) ---
router.delete('/admin/api/usuarios/:id', async (req, res) => {
  const usuarioObjetivo = (
    await db.execute({ sql: 'SELECT * FROM usuarios WHERE id = ?', args: [req.params.id] })
  ).rows[0];
  if (!usuarioObjetivo) return res.status(404).json({ error: 'Usuario no encontrado.' });
  if (usuarioObjetivo.rol === 'admin') {
    return res.status(400).json({ error: 'No se puede eliminar una cuenta de administrador desde aquí.' });
  }

  await db.execute({
    sql: `DELETE FROM evidencias WHERE actividad_id IN (SELECT id FROM actividades WHERE usuario_id = ?)`,
    args: [req.params.id],
  });
  await db.execute({ sql: 'DELETE FROM actividades WHERE usuario_id = ?', args: [req.params.id] });
  await db.execute({ sql: 'DELETE FROM usuarios WHERE id = ?', args: [req.params.id] });

  res.json({ ok: true });
});

// --- Listado de usuarios con filtros y orden ---
router.get('/admin/api/usuarios', async (req, res) => {
  const { categoria, usuario, dia, orden } = req.query;
  const cfg = (await db.execute('SELECT * FROM reto_config WHERE id = 1')).rows[0];

  let sql = 'SELECT * FROM usuarios WHERE rol = ?';
  const args = ['usuario'];
  if (categoria) {
    sql += ' AND categoria = ?';
    args.push(categoria);
  }
  if (usuario) {
    sql += ' AND (nombre LIKE ? OR expediente LIKE ?)';
    args.push(`%${usuario}%`, `%${usuario}%`);
  }
  sql += ' ORDER BY nombre ASC';

  const usuarios = (await db.execute({ sql, args })).rows;

  const resultado = [];
  for (const u of usuarios) {
    let actSql = 'SELECT fecha, pasos FROM actividades WHERE usuario_id = ? AND fecha BETWEEN ? AND ?';
    const actArgs = [u.id, cfg.fecha_inicio, cfg.fecha_fin];
    if (dia) {
      actSql += ' AND fecha = ?';
      actArgs.push(dia);
    }
    const actividades = (await db.execute({ sql: actSql, args: actArgs })).rows;
    const diasRegistrados = actividades.filter((a) => a.pasos > 0).length;
    const totalPasos = actividades.reduce((s, a) => s + a.pasos, 0);

    resultado.push({
      id: u.id,
      expediente: u.expediente,
      nombre: u.nombre,
      fechaNacimiento: u.fecha_nacimiento,
      categoria: u.categoria,
      diasRegistrados,
      totalPasos,
    });
  }

  if (orden === 'pasos_desc') resultado.sort((a, b) => b.totalPasos - a.totalPasos);
  else if (orden === 'pasos_asc') resultado.sort((a, b) => a.totalPasos - b.totalPasos);
  else if (orden === 'dias_desc') resultado.sort((a, b) => b.diasRegistrados - a.diasRegistrados);

  res.json({ usuarios: resultado });
});

// --- Top 10 de usuarios con más pasos registrados en el periodo del reto ---
router.get('/admin/api/top10', async (req, res) => {
  const cfg = (await db.execute('SELECT * FROM reto_config WHERE id = 1')).rows[0];
  const usuarios = (
    await db.execute({ sql: 'SELECT * FROM usuarios WHERE rol = ? ORDER BY nombre ASC', args: ['usuario'] })
  ).rows;

  const resultado = [];
  for (const u of usuarios) {
    const actividades = (
      await db.execute({
        sql: 'SELECT pasos FROM actividades WHERE usuario_id = ? AND fecha BETWEEN ? AND ?',
        args: [u.id, cfg.fecha_inicio, cfg.fecha_fin],
      })
    ).rows;
    const totalPasos = actividades.reduce((s, a) => s + a.pasos, 0);
    resultado.push({ id: u.id, nombre: u.nombre, categoria: u.categoria, totalPasos });
  }

  resultado.sort((a, b) => b.totalPasos - a.totalPasos);
  res.json({ top: resultado.slice(0, 10) });
});

// --- Exportar tabla general: una fila por usuario, columnas = días del reto ---
router.get('/admin/api/usuarios/exportar', async (req, res) => {
  const cfg = (await db.execute('SELECT * FROM reto_config WHERE id = 1')).rows[0];
  const usuarios = (
    await db.execute({ sql: 'SELECT * FROM usuarios WHERE rol = ? ORDER BY nombre ASC', args: ['usuario'] })
  ).rows;

  const fechas = [];
  const inicio = new Date(cfg.fecha_inicio + 'T00:00:00');
  const fin = new Date(cfg.fecha_fin + 'T00:00:00');
  for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
    fechas.push(d.toISOString().slice(0, 10));
  }

  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet('Reto de pasos');

  const encabezado = ['No. Expediente', 'Nombre', 'Categoría', ...fechas, 'Total', 'Días registrados'];
  hoja.addRow(encabezado);
  hoja.getRow(1).font = { bold: true };

  for (const u of usuarios) {
    const actividades = (
      await db.execute({ sql: 'SELECT fecha, pasos FROM actividades WHERE usuario_id = ?', args: [u.id] })
    ).rows;
    const mapa = new Map(actividades.map((a) => [a.fecha, a.pasos]));

    const fila = [u.expediente, u.nombre, u.categoria];
    let total = 0;
    let diasRegistrados = 0;
    for (const f of fechas) {
      const pasos = mapa.has(f) ? mapa.get(f) : 0;
      fila.push(pasos);
      total += pasos;
      if (pasos > 0) diasRegistrados++;
    }
    fila.push(total, diasRegistrados);
    hoja.addRow(fila);
  }

  hoja.columns.forEach((col, i) => {
    col.width = i < 3 ? 20 : 12;
  });

  res.setHeader('Content-Disposition', 'attachment; filename="reto-de-pasos.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  await workbook.xlsx.write(res);
  res.end();
});

// --- Calendario y detalle de un usuario específico (vista de administrador) ---
router.get('/admin/api/usuarios/:id/actividades', async (req, res) => {
  const cfg = (await db.execute('SELECT * FROM reto_config WHERE id = 1')).rows[0];
  const rows = (
    await db.execute({
      sql: 'SELECT fecha, pasos FROM actividades WHERE usuario_id = ?',
      args: [req.params.id],
    })
  ).rows;
  const mapaPasos = new Map(rows.map((r) => [r.fecha, r.pasos]));
  const dias = construirCalendario(cfg.fecha_inicio, cfg.fecha_fin, mapaPasos);
  const totalPasos = dias.reduce((sum, d) => sum + (d.pasos || 0), 0);
  res.json({ dias, totalPasos, retoInicio: cfg.fecha_inicio, retoFin: cfg.fecha_fin });
});

router.get('/admin/api/usuarios/:id/actividades/:fecha', async (req, res) => {
  const actividad = (
    await db.execute({
      sql: 'SELECT * FROM actividades WHERE usuario_id = ? AND fecha = ?',
      args: [req.params.id, req.params.fecha],
    })
  ).rows[0];

  if (!actividad) return res.json({ existe: false });

  const evidenciasRows = (
    await db.execute({
      sql: 'SELECT id, mime_type, datos_base64 FROM evidencias WHERE actividad_id = ?',
      args: [actividad.id],
    })
  ).rows;

  const evidencias = evidenciasRows.map((e) => ({
    id: e.id,
    dataUrl: `data:${e.mime_type};base64,${e.datos_base64}`,
  }));

  res.json({ existe: true, pasos: actividad.pasos, evidencias });
});

module.exports = router;
