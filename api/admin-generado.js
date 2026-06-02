import { sql, checkPassword } from './_admin-utils.js';

export default async function handler(req, res) {
  try {
    const { id, password, download } = req.query;

    if (!checkPassword(password)) {
      return res.status(401).send('No autorizado');
    }

    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS generado_archivo TEXT`;
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS generado_mime TEXT`;
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS generado_imagen BYTEA`;

    const result = await sql`
      SELECT generado_imagen, generado_mime, generado_archivo
      FROM pedidos
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!result.length || !result[0].generado_imagen) {
      return res.status(404).send('Cromo generado no encontrado');
    }

    const mime = result[0].generado_mime || 'image/png';
    const filename = result[0].generado_archivo || `cromo_${id}.png`;
    const buffer = Buffer.from(result[0].generado_imagen);

    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'no-store');

    if (download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    return res.status(200).send(buffer);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error al cargar cromo generado');
  }
}
