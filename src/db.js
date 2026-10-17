const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

const url = process.env.DATABASE_URL || 'file:./data/reto.db';

// Si es un archivo local, asegurar que la carpeta exista
if (url.startsWith('file:')) {
  const filePath = url.replace('file:', '');
  const dir = path.dirname(path.resolve(filePath));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const db = createClient({
  url,
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

async function init() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expediente TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      fecha_nacimiento TEXT NOT NULL,
      categoria TEXT NOT NULL CHECK(categoria IN ('A','B')),
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'usuario' CHECK(rol IN ('usuario','admin')),
      creado_en TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS reto_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      nombre_reto TEXT NOT NULL DEFAULT 'Paso a Pasito',
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS actividades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      fecha TEXT NOT NULL,
      pasos INTEGER NOT NULL DEFAULT 0,
      creado_en TEXT DEFAULT (datetime('now')),
      actualizado_en TEXT DEFAULT (datetime('now')),
      UNIQUE(usuario_id, fecha)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS evidencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actividad_id INTEGER NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
      mime_type TEXT NOT NULL,
      datos_base64 TEXT NOT NULL,
      creado_en TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migración suave: agrega nombre_reto si la tabla reto_config ya existía sin esa columna
  try {
    await db.execute("ALTER TABLE reto_config ADD COLUMN nombre_reto TEXT NOT NULL DEFAULT 'Paso a Pasito'");
  } catch (e) {
    // La columna ya existe: no hacer nada
  }

  // Config por defecto del reto si no existe
  const cfg = await db.execute('SELECT * FROM reto_config WHERE id = 1');
  if (cfg.rows.length === 0) {
    const nombreReto = process.env.RETO_NOMBRE_DEFAULT || 'Paso a Pasito';
    const inicio = process.env.RETO_INICIO_DEFAULT || '2026-09-01';
    const fin = process.env.RETO_FIN_DEFAULT || '2026-09-30';
    await db.execute({
      sql: 'INSERT INTO reto_config (id, nombre_reto, fecha_inicio, fecha_fin) VALUES (1, ?, ?, ?)',
      args: [nombreReto, inicio, fin],
    });
  }
}

module.exports = { db, init };
