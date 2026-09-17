const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'cambia-esto';
const COOKIE_NAME = 'paso_a_pasito_token';

function crearToken(usuario) {
  return jwt.sign(
    { id: usuario.id, username: usuario.username, rol: usuario.rol, nombre: usuario.nombre },
    SECRET,
    { expiresIn: '12h' }
  );
}

function setCookieSesion(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000,
  });
}

function limpiarCookieSesion(res) {
  res.clearCookie(COOKIE_NAME);
}

function cargarUsuario(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  req.usuario = null;
  if (token) {
    try {
      req.usuario = jwt.verify(token, SECRET);
    } catch (e) {
      // token inválido o vencido: se ignora, req.usuario queda null
    }
  }
  next();
}

function requiereSesion(req, res, next) {
  if (!req.usuario) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'No autenticado' });
    return res.redirect('/login');
  }
  next();
}

function requiereAdmin(req, res, next) {
  if (!req.usuario || req.usuario.rol !== 'admin') {
    if (req.path.startsWith('/api/') || req.path.startsWith('/admin/api/')) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    return res.redirect('/login');
  }
  next();
}

module.exports = {
  crearToken,
  setCookieSesion,
  limpiarCookieSesion,
  cargarUsuario,
  requiereSesion,
  requiereAdmin,
  COOKIE_NAME,
};
