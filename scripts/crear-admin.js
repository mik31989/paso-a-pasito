require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db, init } = require('../src/db');

async function main() {
  const [, , username, password, ...nombreParts] = process.argv;
  const nombre = nombreParts.join(' ') || 'Administrador';

  if (!username || !password) {
    console.log('Uso: npm run crear-admin -- usuario contraseña "Nombre del administrador"');
    process.exit(1);
  }

  await init();

  const existente = await db.execute({
    sql: 'SELECT id FROM usuarios WHERE username = ?',
    args: [username],
  });
  if (existente.rows.length > 0) {
    console.log(`Ya existe un usuario con username "${username}".`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  await db.execute({
    sql: `INSERT INTO usuarios (expediente, nombre, fecha_nacimiento, categoria, username, password_hash, rol)
          VALUES (?, ?, '1990-01-01', 'A', ?, ?, 'admin')`,
    args: [`ADMIN-${username}`, nombre, username, hash],
  });

  console.log(`Administrador "${username}" creado correctamente.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
