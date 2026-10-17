const PDFDocument = require('pdfkit');
const path = require('path');

const COLOR_OSCURO = '#8a2f1c';
const COLOR_CLARO = '#da4e2b';
const COLOR_AZUL = '#2563eb';
const COLOR_TEXTO = '#1f2937';

const LOGO_UNINET = path.join(__dirname, '..', 'public', 'img', 'uninet.png');
const LOGO_TRIARA = path.join(__dirname, '..', 'public', 'img', 'triara.png');

/**
 * Genera el PDF del certificado de participación y lo transmite a `res`.
 * datos: { nombreReto, fechaInicio, fechaFin, nombreParticipante, expediente, categoria, totalPasos }
 */
function generarCertificadoPDF(res, datos) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="certificado-${(datos.nombreParticipante || 'participante').replace(/[^a-z0-9]+/gi, '-')}.pdf"`
  );
  doc.pipe(res);

  const ancho = doc.page.width;
  const alto = doc.page.height;

  // --- Marco decorativo ---
  doc.save();
  doc
    .lineWidth(3)
    .strokeColor(COLOR_CLARO)
    .rect(20, 20, ancho - 40, alto - 40)
    .stroke();
  doc
    .lineWidth(1)
    .strokeColor(COLOR_OSCURO)
    .rect(28, 28, ancho - 56, alto - 56)
    .stroke();
  doc.restore();

  // --- Banda superior con degradado ---
  const alturaBanda = 120;
  const gradiente = doc.linearGradient(0, 0, ancho, 0);
  gradiente.stop(0, COLOR_OSCURO).stop(1, COLOR_CLARO);
  doc.save();
  doc.rect(0, 0, ancho, alturaBanda).fill(gradiente);
  doc.restore();

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(34)
    .text('CERTIFICADO DE PARTICIPACIÓN', 0, 40, { align: 'center', width: ancho });

  doc
    .font('Helvetica-Oblique')
    .fontSize(14)
    .text(`Reto: ${datos.nombreReto}`, 0, 84, { align: 'center', width: ancho });

  // --- Cuerpo ---
  let y = alturaBanda + 50;

  doc
    .fillColor(COLOR_TEXTO)
    .font('Helvetica')
    .fontSize(14)
    .text('Se otorga el presente reconocimiento a:', 0, y, { align: 'center', width: ancho });

  y += 32;
  doc
    .fillColor(COLOR_AZUL)
    .font('Helvetica-Bold')
    .fontSize(30)
    .text(datos.nombreParticipante, 0, y, { align: 'center', width: ancho });

  // línea decorativa bajo el nombre
  const anchoLinea = 320;
  doc
    .moveTo(ancho / 2 - anchoLinea / 2, y + 42)
    .lineTo(ancho / 2 + anchoLinea / 2, y + 42)
    .lineWidth(1.5)
    .strokeColor(COLOR_CLARO)
    .stroke();

  y += 65;
  const mensaje =
    `por su destacada participación y constancia durante el reto de pasos, ` +
    `alcanzando un total de ${Number(datos.totalPasos).toLocaleString('es-MX')} pasos registrados ` +
    `en la Categoría ${datos.categoria}, durante el periodo comprendido del ${formatearFecha(datos.fechaInicio)} ` +
    `al ${formatearFecha(datos.fechaFin)}.`;

  doc
    .fillColor(COLOR_TEXTO)
    .font('Helvetica')
    .fontSize(13)
    .text(mensaje, ancho * 0.18, y, { align: 'center', width: ancho * 0.64, lineGap: 4 });

  y += 95;

  // --- Tarjetas de datos ---
  const tarjetas = [
    { etiqueta: 'Categoría', valor: datos.categoria },
    { etiqueta: 'Total de pasos', valor: Number(datos.totalPasos).toLocaleString('es-MX') },
    { etiqueta: 'Periodo', valor: `${formatearFechaCorta(datos.fechaInicio)} – ${formatearFechaCorta(datos.fechaFin)}` },
  ];
  const anchoTarjeta = 190;
  const espacio = 24;
  const anchoTotal = tarjetas.length * anchoTarjeta + (tarjetas.length - 1) * espacio;
  let x = (ancho - anchoTotal) / 2;

  tarjetas.forEach((t) => {
    doc.roundedRect(x, y, anchoTarjeta, 56, 8).fillAndStroke('#fdf2ee', COLOR_CLARO);
    doc
      .fillColor(COLOR_OSCURO)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(t.etiqueta.toUpperCase(), x, y + 10, { align: 'center', width: anchoTarjeta });
    doc
      .fillColor(COLOR_TEXTO)
      .font('Helvetica-Bold')
      .fontSize(t.etiqueta === 'Periodo' ? 12 : 15)
      .text(String(t.valor), x + 6, y + (t.etiqueta === 'Periodo' ? 30 : 28), {
        align: 'center',
        width: anchoTarjeta - 12,
      });
    x += anchoTarjeta + espacio;
  });

  // --- Mensaje de felicitación ---
  y += 90;
  doc
    .fillColor(COLOR_AZUL)
    .font('Helvetica-BoldOblique')
    .fontSize(15)
    .text('¡Felicidades por cuidar tu salud y dar cada paso con constancia!', 0, y, {
      align: 'center',
      width: ancho,
    });

  // --- Pie con logos ---
  const yFooter = alto - 85;
  try {
    doc.image(LOGO_UNINET, 60, yFooter, { height: 42 });
  } catch (e) {
    /* si el logo no está disponible, se omite sin romper el PDF */
  }
  try {
    doc.image(LOGO_TRIARA, ancho - 60 - 70, yFooter, { height: 42 });
  } catch (e) {
    /* idem */
  }

  doc
    .fillColor('#9ca3af')
    .font('Helvetica')
    .fontSize(9)
    .text(`Generado el ${formatearFecha(datos.fechaEmision)}`, 0, alto - 36, {
      align: 'center',
      width: ancho,
    });

  doc.end();
}

function formatearFecha(fechaISOStr) {
  const [y, m, d] = fechaISOStr.split('-').map(Number);
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${d} de ${meses[m - 1]} de ${y}`;
}

function formatearFechaCorta(fechaISOStr) {
  const [y, m, d] = fechaISOStr.split('-');
  return `${d}/${m}/${y}`;
}

module.exports = { generarCertificadoPDF };
