require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const { init } = require('./src/db');
const { cargarUsuario } = require('./src/auth');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(cargarUsuario);

app.get('/', (req, res) => {
  if (!req.usuario) return res.redirect('/login');
  res.redirect(req.usuario.rol === 'admin' ? '/admin' : '/dashboard');
});

app.use(authRoutes);
app.use(userRoutes);
app.use(adminRoutes);

app.use((req, res) => {
  res.status(404).send('Página no encontrada');
});

const PORT = process.env.PORT || 3000;

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Paso a Pasito corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error al inicializar la base de datos:', err);
    process.exit(1);
  });
