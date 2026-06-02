import { sql, checkPassword } from './_admin-utils.js';

export default async function handler(req, res) {
  try {
    const { id, password } = req.query;
    if (!checkPassword(password)) return res.status(401).send('No autorizado');
    const result = await sql`SELECT foto, foto_mime FROM pedidos WHERE id = ${id} LIMIT 1`;
    if (!result.length || !result[0].foto) return res.status(404).send('Foto no encontrada');
    const mime = result[0].foto_mime || 'image/jpeg';
    const buffer = Buffer.from(result[0].foto);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error al cargar foto');
  }
}
