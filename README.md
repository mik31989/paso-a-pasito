# Paso a Pasito 🚶‍♂️

Reto de pasos entre compañeros de trabajo: calendario de registro diario, evidencias fotográficas
y panel de administración con exportación a Excel.

## Funcionalidades

- **Ingreso** por usuario y contraseña. Los usuarios se crean **importando un Excel** con columnas
  *No. Expediente*, *Nombre* y *Fecha de Nacimiento*. La categoría se calcula sola:
  **A = menos de 40 años**, **B = 40 años o más**. Usuario y contraseña se generan automáticamente
  y se muestran una sola vez al admin (con opción de descargarlos en Excel).
- **Calendario del reto** a tamaño de página, con un panel lateral que suma el total de pasos.
- Clic en un día → modal para registrar: número de empleado, fecha (hasta 7 días atrás, nunca futura),
  pasos (con el mínimo de su categoría: A ≥ 7,000, B ≥ 9,000 mostrado como referencia) y hasta 5 imágenes
  de evidencia.
- Cada día se colorea: 🟩 verde si superó los pasos del día anterior, 🟨 amarillo si registró menos,
  🟥 rojo si no registró (0 pasos). El día con más pasos se marca con ⭐.
- **Panel de administrador**: listado de usuarios con días registrados y total de pasos, filtrable por
  día, categoría y usuario/expediente; exportable a Excel (una fila por usuario, una columna por día).
  Al entrar al detalle de un usuario se ve su calendario y, por día, un carrusel con sus evidencias.

## Requisitos

- Node.js 18 o superior.

## Instalación local

```bash
npm install
cp .env.example .env
# Edita .env si quieres cambiar el puerto, el secreto de sesión o las fechas por defecto del reto
```

Crea el primer usuario administrador:

```bash
node scripts/crear-admin.js admin "unaContraseñaSegura" "Nombre del Administrador"
```

Arranca la app:

```bash
npm start
```

Abre `http://localhost:3000`, entra como administrador, ve a **Configuración del reto** para poner
las fechas de inicio/fin, y luego a **Importar usuarios desde Excel**.

### Formato del Excel de usuarios

| No. Expediente | Nombre       | Fecha de Nacimiento |
|-----------------|--------------|----------------------|
| 1001            | Juan Pérez   | 1995-05-10           |
| 1002            | María López  | 1978-03-22           |

(El orden de las columnas no importa, solo que el encabezado contenga esas palabras. Si el archivo
trae una columna de categoría, se ignora: la categoría siempre se recalcula desde la fecha de
nacimiento para evitar inconsistencias.)

## Cómo alojarlo gratis

La app guarda la base de datos como un **archivo SQLite**. La mayoría de los hostings gratuitos
(Render, Railway, Fly.io, etc.) reinician o borran el disco cada vez que la app se redespliega o se
duerme, así que en producción se recomienda usar **Turso** (https://turso.tech): es SQLite en la nube,
tiene un plan gratuito generoso y es 100% compatible con este proyecto (ya está integrado con
`@libsql/client`, solo cambias dos variables de entorno). Las imágenes de evidencia se guardan como
texto (base64) dentro de la misma base de datos, así que no dependes del disco del servidor en ningún
momento — todo lo que importa vive en Turso.

**Pasos sugeridos (gratis):**

1. **Base de datos en Turso**
   ```bash
   npm install -g @tursodatabase/turso-cli   # o revisa la instalación recomendada en turso.tech
   turso auth signup
   turso db create paso-a-pasito
   turso db show paso-a-pasito --url
   turso db tokens create paso-a-pasito
   ```
   Copia la URL (empieza con `libsql://`) y el token.

2. **Subir el código a GitHub** (crea un repo y sube esta carpeta).

3. **Desplegar en Render** (https://render.com, tiene plan gratuito para web services):
   - New → Web Service → conecta tu repo.
   - Build command: `npm install`
   - Start command: `npm start`
   - Variables de entorno: `JWT_SECRET`, `DATABASE_URL` (la de Turso, `libsql://...`),
     `DATABASE_AUTH_TOKEN` (el token de Turso).
   - Una vez desplegado, crea el administrador ejecutando en tu máquina (con el `.env` apuntando
     a la base de Turso): `node scripts/crear-admin.js ...` — así el administrador queda en la
     misma base que usa producción.

   Alternativas igualmente válidas a Render: **Railway**, **Fly.io** o **Cyclic**; el único punto
   importante es usar Turso (o dejar el disco de esa plataforma bien montado) para que los datos no
   se borren solos.

4. Comparte con tus compañeros la URL pública que te da el hosting y el Excel de credenciales que
   generaste al importar usuarios.

## Estructura del proyecto

```
server.js              punto de entrada
src/db.js              conexión y esquema de la base de datos
src/auth.js            sesión con JWT en cookie httpOnly
src/utils.js           categoría, fechas límite, colores del calendario
routes/auth.js         login / logout
routes/user.js         calendario y registro de actividad del usuario
routes/admin.js        importación, listado, exportación y detalle de usuarios
views/                 plantillas EJS
public/                CSS y JS del cliente
scripts/crear-admin.js crea el primer usuario administrador
```

## Notas de diseño / supuestos

- El mínimo de pasos por categoría (7,000 / 9,000) se muestra como referencia en el modal, pero no
  bloquea el registro: un compañero puede caminar menos ese día y aun así guardar su avance real.
- El color del día compara el número de pasos contra el día calendario anterior (no contra el mínimo
  de la categoría). Si un día no tiene registro cuenta como 0 pasos para la comparación del día
  siguiente.
- Al reemplazar el registro de un día ya guardado con nuevas imágenes, las evidencias anteriores de
  ese día se sustituyen por las nuevas (para no ir acumulando imágenes de intentos de captura).
