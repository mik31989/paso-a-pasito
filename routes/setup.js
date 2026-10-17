const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../src/db');

const router = express.Router();

// Ruta de "primer arranque": crea el administrador inicial desde el navegador,
// sin necesitar acceso a terminal/shell en el hosting (útil en Render free tier).
//
// Se protege con dos candados:
// 1) Solo funciona si está configurada la variable de entorno SETUP_TOKEN.
// 2) Solo funciona si todavía NO existe ningún usuario con rol 'admin'.
// En cuanto se crea el primer admin, la ruta queda inutilizada por el segundo candado.

router.get('/setup-admin', async (req, res) => {
  if (!process.env.SETUP_TOKEN) {
    return res
      .status(403)
      .send('Esta ruta está deshabilitada. Define la variable de entorno SETUP_TOKEN para habilitarla.');
  }

  const existeAdmin = (
    await db.execute({ sql: 'SELECT id FROM usuarios WHERE rol = ? LIMIT 1', args: ['admin'] })
  ).rows[0];

  if (existeAdmin) {
    return res.send(
      '<p style="font-family:sans-serif">Ya existe un administrador. Esta ruta de primer arranque ya no está disponible. Inicia sesión normalmente en <a href="/login">/login</a>.</p>'
    );
  }

  res.render('setup-admin', { error: null });
});

router.post('/setup-admin', async (req, res) => {
  if (!process.env.SETUP_TOKEN) {
    return res.status(403).send('Esta ruta está deshabilitada.');
  }

  const existeAdmin = (
    await db.execute({ sql: 'SELECT id FROM usuarios WHERE rol = ? LIMIT 1', args: ['admin'] })
  ).rows[0];
  if (existeAdmin) {
    return res.render('setup-admin', { error: 'Ya existe un administrador. Esta ruta ya no está disponible.' });
  }

  const { token, username, password, nombre } = req.body;

  if (token !== process.env.SETUP_TOKEN) {
    return res.render('setup-admin', { error: 'Token incorrecto.' });
  }
  if (!username || !password || !nombre) {
    return res.render('setup-admin', { error: 'Completa usuario, contraseña y nombre.' });
  }
  if (password.length < 6) {
    return res.render('setup-admin', { error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  const yaExisteUsername = (
    await db.execute({ sql: 'SELECT id FROM usuarios WHERE username = ?', args: [username.trim()] })
  ).rows[0];
  if (yaExisteUsername) {
    return res.render('setup-admin', { error: 'Ese nombre de usuario ya está en uso.' });
  }

  const hash = await bcrypt.hash(password, 10);
  await db.execute({
    sql: `INSERT INTO usuarios (expediente, nombre, fecha_nacimiento, categoria, username, password_hash, rol)
          VALUES (?, ?, '1990-01-01', 'A', ?, ?, 'admin')`,
    args: [`ADMIN-${username.trim()}`, nombre.trim(), username.trim(), hash],
  });

  res.send(
    `<p style="font-family:sans-serif">Administrador "${username.trim()}" creado correctamente. Ya puedes iniciar sesión en <a href="/login">/login</a>.</p>`
  );
});

module.exports = router;
