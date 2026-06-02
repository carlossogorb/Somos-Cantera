import { neon } from '@neondatabase/serverless';
import ExcelJS from 'exceljs';

export const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
export const sql = neon(DATABASE_URL);

export function checkPassword(password) {
  return password && process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD;
}

export async function ensureEstado() {
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente'`;
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS deporte TEXT`;
}

export async function generarExcelPedidos() {
  await ensureEstado();
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
    { header: 'Especial elegido', key: 'especial_elegido', width: 20 },
    { header: 'Tamaño', key: 'tamano', width: 14 },
    { header: 'Pack álbum', key: 'pack_album', width: 18 },
    { header: 'Cantidad', key: 'cantidad', width: 12 },
    { header: 'Precio unitario', key: 'precio_unitario', width: 16 },
    { header: 'Total', key: 'total', width: 14 },
    { header: 'Dorsal', key: 'dorsal', width: 10 },
    { header: 'Equipo', key: 'equipo', width: 24 },
    { header: 'Deporte', key: 'deporte', width: 16 },
    { header: 'Posición', key: 'posicion', width: 18 },
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
      especial_elegido: pedido.especial_elegido,
      tamano: pedido.tamano,
      pack_album: pedido.pack_album,
      cantidad: pedido.cantidad,
      precio_unitario: Number(pedido.precio_unitario || 0),
      total: Number(pedido.total || 0),
      dorsal: pedido.dorsal,
      equipo: pedido.equipo,
      deporte: pedido.deporte,
      posicion: pedido.posicion,
      habilidades: pedido.habilidades,
      indicaciones: pedido.indicaciones,
      foto_nombre: pedido.foto_nombre
    });
    sheet.getColumn('precio_unitario').numFmt = '#,##0.00 €';
    sheet.getColumn('total').numFmt = '#,##0.00 €';
    if (pedido.foto) {
      const buffer = Buffer.from(pedido.foto);
      const mime = pedido.foto_mime || 'image/jpeg';
      const extension = mime.includes('png') ? 'png' : 'jpeg';
      const imageId = workbook.addImage({ buffer, extension });
      sheet.addImage(imageId, { tl: { col: 18, row: row.number - 1 }, ext: { width: 110, height: 110 } });
      row.height = 85;
    }
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
