import formidable from 'formidable';
import { neon } from '@neondatabase/serverless';
import fs from 'fs/promises';
import Stripe from 'stripe';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
const sql = neon(DATABASE_URL);

function parseForm(req) {
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    maxFileSize: 20 * 1024 * 1024
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function fieldValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS pedidos (
      id SERIAL PRIMARY KEY,
      numero_pedido TEXT UNIQUE,
      fecha TIMESTAMPTZ DEFAULT NOW(),
      nombre TEXT,
      email_cliente TEXT,
      tipo_cromo TEXT,
      especial_elegido TEXT,
      tamano TEXT,
      pack_album TEXT,
      cantidad INTEGER,
      precio_unitario NUMERIC,
      total NUMERIC,
      dorsal TEXT,
      equipo TEXT,
      deporte TEXT,
      posicion TEXT,
      habilidades TEXT,
      indicaciones TEXT,
      foto_nombre TEXT,
      foto_mime TEXT,
      foto BYTEA,
      estado TEXT DEFAULT 'pendiente',
      stripe_session_id TEXT
    )
  `;

  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente'`;
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS stripe_session_id TEXT`;
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS deporte TEXT`;
}

async function guardarPedidoPendiente(pedido, fotoFile) {
  await ensureTable();

  let fotoBuffer = null;
  let fotoNombre = '';
  let fotoMime = '';

  if (fotoFile?.filepath) {
    fotoBuffer = await fs.readFile(fotoFile.filepath);
    fotoNombre = fotoFile.originalFilename || 'foto.jpg';
    fotoMime = fotoFile.mimetype || 'image/jpeg';
  }

  const cantidad = Number(pedido.cantidad || 1);
  const precioUnitario = Number(pedido.precioUnitario ?? pedido.precio ?? 0);
  const total = Number(pedido.total ?? ((precioUnitario * cantidad) + Number(pedido.packAlbumPrecio || 0)));

  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('Total de pedido no válido.');
  }

  const inserted = await sql`
    INSERT INTO pedidos (
      nombre, email_cliente, tipo_cromo, especial_elegido, tamano, pack_album,
      cantidad, precio_unitario, total, dorsal, equipo, deporte, posicion, habilidades,
      indicaciones, foto_nombre, foto_mime, foto, estado
    )
    VALUES (
      ${pedido.nombre || ''},
      ${pedido.emailCliente || ''},
      ${pedido.tipoCromo || ''},
      ${pedido.especialElegido || ''},
      ${pedido.tamano || ''},
      ${pedido.packAlbum || 'NO'},
      ${cantidad},
      ${precioUnitario},
      ${total},
      ${pedido.dorsal || ''},
      ${pedido.equipo || ''},
      ${pedido.deporte || ''},
      ${pedido.posicion || ''},
      ${pedido.cualidades || pedido.habilidades || ''},
      ${pedido.indicaciones || ''},
      ${fotoNombre},
      ${fotoMime},
      ${fotoBuffer},
      ${'pendiente'}
    )
    RETURNING id
  `;

  const id = inserted[0].id;
  const numeroPedido = `SC-${String(id).padStart(4, '0')}`;

  await sql`
    UPDATE pedidos
    SET numero_pedido = ${numeroPedido}
    WHERE id = ${id}
  `;

  return { numeroPedido, total };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Falta STRIPE_SECRET_KEY.' });
    }

    if (!DATABASE_URL) {
      return res.status(500).json({ error: 'Falta DATABASE_URL o POSTGRES_URL.' });
    }

    const { fields, files } = await parseForm(req);
    const pedido = JSON.parse(fieldValue(fields.pedido) || '{}');
    const fotoFile = Array.isArray(files.foto) ? files.foto[0] : files.foto;

    if (!pedido.nombre || !pedido.emailCliente) {
      return res.status(400).json({ error: 'Faltan nombre o email del cliente.' });
    }

    const { numeroPedido, total } = await guardarPedidoPendiente(pedido, fotoFile);
    const origin = req.headers.origin || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: pedido.emailCliente,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: Math.round(Number(total) * 100),
            product_data: {
              name: `Pedido ${numeroPedido} - Somos Cantera`,
              description: `${pedido.tipoCromo || 'Cromo'} · ${pedido.deporte || 'Deporte no indicado'} · ${pedido.tamano || ''} · ${pedido.packAlbum || 'Sin pack'}`
            }
          }
        }
      ],
      metadata: {
        numeroPedido
      },
      success_url: `${origin}/gracias.html?pedido=${numeroPedido}`,
      cancel_url: `${origin}/cancelado.html?pedido=${numeroPedido}`
    });

    await sql`
      UPDATE pedidos
      SET stripe_session_id = ${session.id}
      WHERE numero_pedido = ${numeroPedido}
    `;

    return res.status(200).json({
      ok: true,
      numeroPedido,
      total,
      checkoutUrl: session.url
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al crear el pedido y el pago.' });
  }
}
