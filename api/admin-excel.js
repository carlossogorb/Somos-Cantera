import { checkPassword, generarExcelPedidos } from './_admin-utils.js';

export default async function handler(req, res) {
  try {
    const password = req.query.password;
    if (!checkPassword(password)) return res.status(401).json({ error: 'No autorizado' });
    const buffer = await generarExcelPedidos();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="pedidos_somos_cantera.xlsx"');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al generar Excel' });
  }
}
