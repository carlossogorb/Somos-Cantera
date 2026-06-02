import Stripe from 'stripe';
import { neon } from '@neondatabase/serverless';
import ExcelJS from 'exceljs';
import { Resend } from 'resend';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'pedidos@somoscantera.es';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Somos Cantera <pedidos@somoscantera.es>';
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
const sql = neon(DATABASE_URL);

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function euros(valor) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(valor || 0));
}

async function generarExcel() {
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS deporte TEXT`;
  const pedidos = await sql`SELECT * FROM pedidos ORDER BY id ASC`;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Pedidos');

  sheet.columns = [
    { header: 'Nº pedido', key: 'numero_pedido', width: 14 },
    { header: 'Fecha', key: 'fecha', width: 22 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Nombre', key: 'nombre', width: 22 },
    { header: 'Email cliente', key: 'email_cliente', width: 28 },
    { header: 'Tipo cromo', key: 'tipo_cromo', width: 18 },
    { header: 'Deporte', key: 'deporte', width: 16 },
    { header: 'Tamaño', key: 'tamano', width: 14 },
    { header: 'Pack álbum', key: 'pack_album', width: 18 },
    { header: 'Cantidad', key: 'cantidad', width: 12 },
    { header: 'Total', key: 'total', width: 14 },
    { header: 'Habilidades', key: 'habilidades', width: 38 },
    { header: 'Indicaciones', key: 'indicaciones', width: 54 },
    { header: 'Foto', key: 'foto_nombre', width: 20 }
  ];
  sheet.getRow(1).font = { bold: true };

  for (const pedido of pedidos) {
    const row = sheet.addRow({
      numero_pedido: pedido.numero_pedido,
      fecha: new Date(pedido.fecha).toLocaleString('es-ES'),
      estado: pedido.estado || 'pendiente',
      nombre: pedido.nombre,
      email_cliente: pedido.email_cliente,
      tipo_cromo: pedido.tipo_cromo,
      deporte: pedido.deporte,
      tamano: pedido.tamano,
      pack_album: pedido.pack_album,
      cantidad: pedido.cantidad,
      total: Number(pedido.total || 0),
      habilidades: pedido.habilidades,
      indicaciones: pedido.indicaciones,
      foto_nombre: pedido.foto_nombre
    });
    sheet.getColumn('total').numFmt = '#,##0.00 €';

    if (pedido.foto) {
      const buffer = Buffer.from(pedido.foto);
      const mime = pedido.foto_mime || 'image/jpeg';
      const extension = mime.includes('png') ? 'png' : 'jpeg';
      const imageId = workbook.addImage({ buffer, extension });
      sheet.addImage(imageId, { tl: { col: 14, row: row.number - 1 }, ext: { width: 110, height: 110 } });
      row.height = 85;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

async function enviarEmailsPedidoPagado(pedido) {
  const excelBuffer = await generarExcel();
  const fotoBuffer = pedido.foto ? Buffer.from(pedido.foto) : null;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `Pedido pagado ${pedido.numero_pedido} - ${pedido.nombre}`,
    html: `
      <h2>Pedido pagado ${pedido.numero_pedido}</h2>
      <p><strong>Cliente:</strong> ${pedido.nombre}</p>
      <p><strong>Email:</strong> ${pedido.email_cliente}</p>
      <p><strong>Tipo:</strong> ${pedido.tipo_cromo}</p>
      <p><strong>Deporte:</strong> ${pedido.deporte || '-'}</p>
      <p><strong>Tamaño:</strong> ${pedido.tamano}</p>
      <p><strong>Total:</strong> ${euros(pedido.total)}</p>
      <p><strong>Indicaciones:</strong> ${pedido.indicaciones || '-'}</p>
    `,
    attachments: [
      { filename: 'pedidos_somos_cantera.xlsx', content: excelBuffer },
      ...(fotoBuffer ? [{ filename: pedido.foto_nombre || 'foto.jpg', content: fotoBuffer }] : [])
    ]
  });

  await resend.emails.send({
    from: FROM_EMAIL,
    to: pedido.email_cliente,
    subject: `Pedido pagado correctamente - ${pedido.numero_pedido}`,
    html: `
      <p>Hola ${pedido.nombre},</p>
      <p>Hemos recibido correctamente tu pedido y el pago.</p>
      <ul>
        <li><strong>Nº pedido:</strong> ${pedido.numero_pedido}</li>
        <li><strong>Tipo de cromo:</strong> ${pedido.tipo_cromo}</li>
        <li><strong>Deporte:</strong> ${pedido.deporte || '-'}</li>
        <li><strong>Tamaño:</strong> ${pedido.tamano}</li>
        <li><strong>Total:</strong> ${euros(pedido.total)}</li>
      </ul>
      <p>Empezaremos a preparar tu diseño.</p>
      <p>Gracias por confiar en Somos Cantera.</p>
    `
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');

  const rawBody = await getRawBody(req);
  const signature = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.status(400).send(`Webhook error: ${error.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const numeroPedido = session.metadata?.numeroPedido;

      const actuales = await sql`SELECT estado FROM pedidos WHERE numero_pedido = ${numeroPedido} LIMIT 1`;
      if (!actuales.length) {
        return res.status(200).json({ received: true, ignored: 'pedido_no_encontrado' });
      }

      if (actuales[0].estado === 'pagado' || actuales[0].estado === 'generado' || actuales[0].estado === 'enviado') {
        return res.status(200).json({ received: true, ignored: 'pedido_ya_procesado' });
      }

      await sql`UPDATE pedidos SET estado = 'pagado' WHERE numero_pedido = ${numeroPedido}`;
      const pedidos = await sql`SELECT * FROM pedidos WHERE numero_pedido = ${numeroPedido} LIMIT 1`;
      if (pedidos.length) await enviarEmailsPedidoPagado(pedidos[0]);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error procesando webhook');
  }
}
