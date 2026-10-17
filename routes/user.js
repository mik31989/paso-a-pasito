const express = require('express');
const multer = require('multer');
const { db } = require('../src/db');
const { requiereSesion } = require('../src/auth');
const {
  hoyISO,
  fechaMinimaRegistro,
  pasosMinimos,
  construirCalendario,
} = require('../src/utils');
const { generarCertificadoPDF } = require('../src/certificado');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 5 }, // 4MB por imagen, máx 5 archivos
});

router.get('/dashboard', requiereSesion, async (req, res) => {
  if (req.usuario.rol === 'admin') return res.redirect('/admin');

  const cfg = (await db.execute('SELECT * FROM reto_config WHERE id = 1')).rows[0];
  const usuarioRow = (
    await db.execute({ sql: 'SELECT * FROM usuarios WHERE id = ?', args: [req.usuario.id] })
  ).rows[0];

  res.render('dashboard', {
    usuario: req.usuario,
    expediente: usuarioRow.expediente,
    categoria: usuarioRow.categoria,
    pasosMinimosCategoria: pasosMinimos(usuarioRow.categoria),
    retoNombre: cfg.nombre_reto,
    retoInicio: cfg.fecha_inicio,
    retoFin: cfg.fecha_fin,
    fechaMinima: fechaMinimaRegistro(),
    hoy: hoyISO(),
    retoFinalizado: hoyISO() > cfg.fecha_fin,
  });
});

// Datos del calendario del usuario autenticado (para pintar el mes)
router.get('/api/actividades', requiereSesion, async (req, res) => {
  const cfg = (await db.execute('SELECT * FROM reto_config WHERE id = 1')).rows[0];
  const rows = (
    await db.execute({
      sql: 'SELECT fecha, pasos FROM actividades WHERE usuario_id = ?',
      args: [req.usuario.id],
    })
  ).rows;

  const mapaPasos = new Map(rows.map((r) => [r.fecha, r.pasos]));
  const dias = construirCalendario(cfg.fecha_inicio, cfg.fecha_fin, mapaPasos);
  const totalPasos = dias.reduce((sum, d) => sum + (d.pasos || 0), 0);

  res.json({ dias, totalPasos, retoInicio: cfg.fecha_inicio, retoFin: cfg.fecha_fin });
});

// Detalle de un día (para precargar el modal si ya existe registro)
router.get('/api/actividades/:fecha', requiereSesion, async (req, res) => {
  const { fecha } = req.params;
  const actividad = (
    await db.execute({
      sql: 'SELECT * FROM actividades WHERE usuario_id = ? AND fecha = ?',
      args: [req.usuario.id, fecha],
    })
  ).rows[0];

  if (!actividad) return res.json({ existe: false });

  const evidencias = (
    await db.execute({
      sql: 'SELECT id, mime_type FROM evidencias WHERE actividad_id = ?',
      args: [actividad.id],
    })
  ).rows;

  res.json({ existe: true, pasos: actividad.pasos, evidencias });
});

// Registrar / actualizar actividad de un día (con hasta 5 imágenes de evidencia)
router.post('/api/actividades', requiereSesion, upload.array('evidencias', 5), async (req, res) => {
  try {
    const { fecha, pasos } = req.body;
    const min = fechaMinimaRegistro();
    const max = hoyISO();

    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ error: 'Fecha inválida.' });
    }
    if (fecha < min || fecha > max) {
      return res.status(400).json({ error: 'Solo puedes registrar actividad de hasta una semana atrás y no fechas futuras.' });
    }
    const pasosNum = parseInt(pasos, 10);
    if (isNaN(pasosNum) || pasosNum < 0) {
      return res.status(400).json({ error: 'Número de pasos inválido.' });
    }

    const existente = (
      await db.execute({
        sql: 'SELECT id FROM actividades WHERE usuario_id = ? AND fecha = ?',
        args: [req.usuario.id, fecha],
      })
    ).rows[0];

    let actividadId;
    if (existente) {
      await db.execute({
        sql: "UPDATE actividades SET pasos = ?, actualizado_en = datetime('now') WHERE id = ?",
        args: [pasosNum, existente.id],
      });
      actividadId = existente.id;
      // Reemplazar evidencias si llegan nuevas imágenes
      if (req.files && req.files.length > 0) {
        await db.execute({ sql: 'DELETE FROM evidencias WHERE actividad_id = ?', args: [actividadId] });
      }
    } else {
      const insertResult = await db.execute({
        sql: 'INSERT INTO actividades (usuario_id, fecha, pasos) VALUES (?, ?, ?)',
        args: [req.usuario.id, fecha, pasosNum],
      });
      actividadId = Number(insertResult.lastInsertRowid);
    }

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const b64 = file.buffer.toString('base64');
        await db.execute({
          sql: 'INSERT INTO evidencias (actividad_id, mime_type, datos_base64) VALUES (?, ?, ?)',
          args: [actividadId, file.mimetype, b64],
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar la actividad.' });
  }
});

// Certificado de participación en PDF (disponible solo cuando el reto ya terminó)
router.get('/certificado', requiereSesion, async (req, res) => {
  if (req.usuario.rol === 'admin') return res.status(403).send('No disponible para administradores.');

  const cfg = (await db.execute('SELECT * FROM reto_config WHERE id = 1')).rows[0];
  if (hoyISO() <= cfg.fecha_fin) {
    return res.status(400).send('El certificado estará disponible cuando finalice el periodo del reto.');
  }

  const usuarioRow = (
    await db.execute({ sql: 'SELECT * FROM usuarios WHERE id = ?', args: [req.usuario.id] })
  ).rows[0];

  const rows = (
    await db.execute({
      sql: 'SELECT fecha, pasos FROM actividades WHERE usuario_id = ?',
      args: [req.usuario.id],
    })
  ).rows;
  const mapaPasos = new Map(rows.map((r) => [r.fecha, r.pasos]));
  const dias = construirCalendario(cfg.fecha_inicio, cfg.fecha_fin, mapaPasos);
  const totalPasos = dias.reduce((sum, d) => sum + (d.pasos || 0), 0);

  generarCertificadoPDF(res, {
    nombreReto: cfg.nombre_reto,
    fechaInicio: cfg.fecha_inicio,
    fechaFin: cfg.fecha_fin,
    nombreParticipante: usuarioRow.nombre,
    expediente: usuarioRow.expediente,
    categoria: usuarioRow.categoria,
    totalPasos,
    fechaEmision: hoyISO(),
  });
});

module.exports = router;
