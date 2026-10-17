const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../src/db');
const { crearToken, setCookieSesion, limpiarCookieSesion } = require('../src/auth');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.usuario) {
    return res.redirect(req.usuario.rol === 'admin' ? '/admin' : '/dashboard');
  }
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('login', { error: 'Ingresa usuario y contraseña.' });
  }

  const result = await db.execute({
    sql: 'SELECT * FROM usuarios WHERE username = ?',
    args: [username.trim()],
  });
  const usuario = result.rows[0];

  if (!usuario) {
    return res.render('login', { error: 'Usuario o contraseña incorrectos.' });
  }

  const ok = await bcrypt.compare(password, usuario.password_hash);
  if (!ok) {
    return res.render('login', { error: 'Usuario o contraseña incorrectos.' });
  }

  const token = crearToken(usuario);
  setCookieSesion(res, token);
  res.redirect(usuario.rol === 'admin' ? '/admin' : '/dashboard');
});

router.post('/logout', (req, res) => {
  limpiarCookieSesion(res);
  res.redirect('/login');
});

module.exports = router;
