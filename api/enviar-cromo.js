import { sql, checkPassword } from './_admin-utils.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'Somos Cantera <pedidos@somoscantera.es>';

function euros(valor) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(Number(valor || 0));
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    const { password, id } = req.body || {};

    if (!checkPassword(password)) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: 'Falta RESEND_API_KEY.' });
    }

    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS generado_archivo TEXT`;
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS generado_mime TEXT`;
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS generado_imagen BYTEA`;

    const pedidos = await sql`
      SELECT
        id,
        numero_pedido,
        nombre,
        email_cliente,
        tipo_cromo,
        deporte,
        tamano,
        total,
        generado_archivo,
        generado_mime,
        generado_imagen
      FROM pedidos
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!pedidos.length) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    const pedido = pedidos[0];

    if (!pedido.email_cliente) {
      return res.status(400).json({ error: 'El pedido no tiene email de cliente.' });
    }

    if (!pedido.generado_imagen) {
      return res.status(400).json({ error: 'Este pedido todavía no tiene cromo generado.' });
    }

    const buffer = Buffer.from(pedido.generado_imagen);
    const filename = pedido.generado_archivo || `${pedido.numero_pedido || 'cromo'}_somos_cantera.png`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: pedido.email_cliente,
      subject: `Tu cromo Somos Cantera ya está listo - ${pedido.numero_pedido}`,
      html: `
        <p>Hola ${pedido.nombre || ''},</p>
        <p>Tu cromo personalizado de <strong>Somos Cantera</strong> ya está listo.</p>
        <h3>Resumen del pedido</h3>
        <ul>
          <li><strong>Nº pedido:</strong> ${pedido.numero_pedido}</li>
          <li><strong>Tipo de cromo:</strong> ${pedido.tipo_cromo || '-'}</li>
          <li><strong>Deporte:</strong> ${pedido.deporte || '-'}</li>
          <li><strong>Tamaño:</strong> ${pedido.tamano || '-'}</li>
          <li><strong>Total:</strong> ${euros(pedido.total)}</li>
        </ul>
        <p>Te adjuntamos el archivo PNG de tu cromo.</p>
        <p>Gracias por confiar en Somos Cantera.</p>
      `,
      attachments: [
        {
          filename,
          content: buffer
        }
      ]
    });

    await sql`
      UPDATE pedidos
      SET estado = 'enviado'
      WHERE id = ${id}
    `;

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al enviar el cromo al cliente.' });
  }
}
