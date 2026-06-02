import { sql, checkPassword, ensureEstado } from './_admin-utils.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    const { password, id, estado } = req.body || {};

    if (!checkPassword(password)) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const estadosPermitidos = ['pendiente', 'pagado', 'generando', 'generado', 'enviado'];

    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }

    await ensureEstado();
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS generado_archivo TEXT`;
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS generado_mime TEXT`;
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS generado_imagen BYTEA`;

    await sql`
      UPDATE pedidos
      SET estado = ${estado}
      WHERE id = ${id}
    `;

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al actualizar estado' });
  }
}
