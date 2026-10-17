# Paso a Pasito 🚶‍♂️

Reto de pasos entre compañeros de trabajo: calendario de registro diario, evidencias fotográficas,
panel de administración con exportación a Excel y certificado de participación en PDF.

## Funcionalidades

### Participantes
- **Ingreso** por usuario y contraseña. Los usuarios se crean **importando un Excel** con columnas
  *No. Expediente*, *Nombre* y *Fecha de Nacimiento*. La categoría se calcula sola:
  **A = menos de 40 años**, **B = 40 años o más**. El usuario de acceso es el número de expediente y
  la **contraseña inicial es `expediente + uninet2026`** (por ejemplo, expediente `1001` → contraseña
  `1001uninet2026`).
- **Calendario del reto** a tamaño de página, con un panel lateral que suma el total de pasos
  (siempre acotado al periodo vigente del reto).
- Clic en un día → modal para registrar: número de empleado, fecha (hasta 7 días atrás, nunca futura),
  pasos (con el mínimo de su categoría: A ≥ 7,000, B ≥ 9,000 mostrado como referencia) y hasta 5 imágenes
  de evidencia.
- Cada día se colorea: 🟩 verde si superó los pasos del día anterior, 🟨 amarillo si registró menos,
  🟥 rojo si no registró (0 pasos). El día con más pasos se marca con ⭐.
- **Certificado de participación**: cuando el periodo del reto termina, aparece un apartado para
  descargar un PDF con logo, nombre del reto, periodo, nombre del participante, categoría, total de
  pasos logrados y un mensaje de felicitación.

### Administrador
- **Configuración del reto**: nombre, fecha de inicio y fecha de fin.
- **Importar usuarios desde Excel** (genera usuario/contraseña automáticamente).
- **Regenerar el archivo de usuarios y contraseñas** en cualquier momento (botón dedicado, exporta a
  Excel el usuario y la contraseña vigente de todos los participantes).
- **Editar el perfil de un usuario** (nombre, expediente, fecha de nacimiento — la categoría se
  recalcula sola).
- **Eliminar usuarios** (borra también sus actividades y evidencias).
- **Listado de usuarios** con días registrados y total de pasos del periodo, filtrable por día,
  categoría y usuario/expediente, y **ordenable** por nombre, total de pasos o días registrados.
- **Top 10** de usuarios con más pasos registrados en el periodo del reto.
- **Exportar a Excel**: una fila por usuario, con una columna por cada día del reto.
- **Detalle por usuario**: calendario individual; al hacer clic en un día se abre un carrusel con las
  evidencias cargadas y el número de pasos de ese día.

## Requisitos

- Node.js 18 o superior.

## Instalación local

```bash
npm install
cp .env.example .env
# Edita .env si quieres cambiar el puerto, el secreto de sesión, el sufijo de contraseña
# o las fechas/nombre por defecto del reto
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
el nombre y las fechas de inicio/fin, y luego a **Importar usuarios desde Excel**.

### Formato del Excel de usuarios

| No. Expediente | Nombre       | Fecha de Nacimiento |
|-----------------|--------------|----------------------|
| 1001            | Juan Pérez   | 1995-05-10           |
| 1002            | María López  | 1978-03-22           |

(El orden de las columnas no importa, solo que el encabezado contenga esas palabras. Si el archivo
trae una columna de categoría, se ignora: la categoría siempre se calcula desde la fecha de
nacimiento para evitar inconsistencias. La contraseña inicial de cada usuario es su expediente seguido
de `uninet2026`; puedes cambiar ese sufijo con la variable `SUFIJO_PASSWORD` en `.env`.)

## Cómo alojarlo gratis

La app guarda la base de datos como un **archivo SQLite**. La mayoría de los hostings gratuitos
(Render, Railway, Fly.io, etc.) reinician o borran el disco cada vez que la app se redespliega o se
duerme, así que en producción se recomienda usar **Turso** (https://turso.tech): es SQLite en la nube,
tiene un plan gratuito generoso y es 100% compatible con este proyecto (ya está integrado con
`@libsql/client`, solo cambias dos variables de entorno). Las imágenes de evidencia se guardan como
texto (base64) dentro de la misma base de datos, así que no dependes del disco del servidor en ningún
momento.

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
     `DATABASE_AUTH_TOKEN` (el token de Turso), `SUFIJO_PASSWORD` si quieres cambiar el valor por
     defecto.
   - Una vez desplegado, crea el administrador ejecutando en tu máquina (con el `.env` apuntando
     a la base de Turso): `node scripts/crear-admin.js ...`.

   Alternativas igualmente válidas a Render: **Railway**, **Fly.io** o **Cyclic**; el único punto
   importante es usar Turso (o dejar el disco de esa plataforma bien montado) para que los datos no
   se borren solos.

4. Comparte con tus compañeros la URL pública y, si lo necesitas, el Excel de credenciales generado
   con el botón **Regenerar archivo de usuarios y contraseñas** del panel de administrador.

## Estructura del proyecto

```
server.js               punto de entrada
src/db.js                conexión y esquema de la base de datos
src/auth.js               sesión con JWT en cookie httpOnly
src/utils.js               categoría, fechas límite, colores del calendario, contraseña inicial
src/certificado.js          generación del PDF del certificado de participación
routes/auth.js              login / logout
routes/user.js               calendario, registro de actividad y certificado del usuario
routes/admin.js               importación, listado, orden, top 10, edición y borrado de usuarios
views/                        plantillas EJS
public/                        CSS, JS e imágenes (logos) del cliente
scripts/crear-admin.js          crea el primer usuario administrador
```

## Notas de diseño / supuestos

- El mínimo de pasos por categoría (7,000 / 9,000) se muestra como referencia en el modal, pero no
  bloquea el registro.
- El color del día compara el número de pasos contra el día calendario anterior (no contra el mínimo
  de la categoría). Un día sin registro cuenta como 0 pasos para la comparación del día siguiente.
- El total de pasos (dashboard, listado admin, top 10, certificado) siempre se recalcula contra el
  periodo vigente del reto: si cambias las fechas del reto, los registros fuera de ese rango dejan de
  sumar automáticamente (no se borran, solo dejan de contar mientras estén fuera del periodo).
- Al editar el perfil de un usuario, si cambias su número de expediente, su usuario de acceso y su
  contraseña inicial se actualizan para seguir siendo `nuevoExpediente + uninet2026`.
- El certificado solo está disponible cuando la fecha de hoy es posterior a la fecha de fin del reto.
- Eliminar un usuario borra también sus actividades y evidencias; no se puede eliminar una cuenta de
  administrador desde el listado.
