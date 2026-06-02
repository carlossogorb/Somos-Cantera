import { sql, checkPassword, ensureEstado } from './_admin-utils.js';

export default async function handler(req, res) {
  try {
    const password = req.query.password;
    if (!checkPassword(password)) return res.status(401).json({ error: 'No autorizado' });
    await ensureEstado();
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS deporte TEXT`;
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS generado_archivo TEXT`;
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS generado_mime TEXT`;
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS generado_imagen BYTEA`;
    const pedidos = await sql`
      SELECT id, numero_pedido, fecha, estado, nombre, email_cliente, tipo_cromo, especial_elegido,
      deporte, tamano, pack_album, cantidad, precio_unitario, total, dorsal, equipo, posicion, habilidades,
      indicaciones, foto_nombre, generado_archivo, CASE WHEN generado_imagen IS NULL THEN false ELSE true END AS tiene_generado, CASE WHEN foto IS NULL THEN false ELSE true END AS tiene_foto
      FROM pedidos ORDER BY id DESC
    `;
    const normalizados = pedidos.map(p => ({...p, fecha: p.fecha ? new Date(p.fecha).toLocaleString('es-ES') : ''}));
    return res.status(200).json({ pedidos: normalizados });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al cargar pedidos' });
  }
}
