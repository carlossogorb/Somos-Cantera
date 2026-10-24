// Somos Cantera — recibe la ficha del club (/club) y la reenvía al script de Google,
// que la guarda en la pestaña «Fichas» de la hoja de solicitudes, sube el escudo a
// Google Drive y avisa por Gmail. Usa las mismas variables de entorno que
// /api/solicitud (SC_SHEETS_URL y SC_SHEETS_SECRET).

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CATEGORIAS = ["Escuelita", "Prebenjamín", "Benjamín", "Alevín", "Infantil", "Cadete", "Juvenil", "Sénior", "Veteranos", "Otra"];
const UNO_DE = {
  deporte: ["Fútbol", "Fútbol sala", "Baloncesto", "Balonmano", "Voleibol", "Otro"],
  formato: ["Un álbum para todo el club", "Álbumes por categorías", "Lo decidimos juntos"],
  orientacion: ["Vertical", "Horizontal", "Lo decidimos juntos"],
  portada: ["Jugadores del club", "Foto de grupo de todo el club", "Solo el escudo", "Campo o instalaciones", "Lo decidimos juntos"],
  cromo_entrenadores: ["Sí", "No"],
  fotos: ["Somos Cantera en nuestras instalaciones", "El club aporta las fotos", "Lo decidimos juntos"],
  listado: ["Lo tenemos en Excel", "Lo tenemos en otro formato", "Hay que prepararlo"],
  modelo: ["Proyecto completo", "Sin inversión", "Colaboración flexible", "Lo decidimos juntos"],
};
const OPCIONALES_UNO_DE = { estilo: ["", "Clásico y limpio", "Moderno y dinámico", "Retro", "Lo decidimos juntos"] };
const VARIOS = {
  datos_cromo: ["Nombre", "Apellido", "Dorsal", "Posición", "Categoría y equipo", "Bandera de nacionalidad", "Apodo"],
  paginas: ["Historia del club", "Junta directiva y coordinación", "Instalaciones", "Autógrafos", "Patrocinadores"],
};
const TEXTOS = {
  club_nombre: [2, 160, true], club_corto: [2, 60, true], localidad: [2, 120, true], temporada: [4, 20, true],
  fundacion: [0, 4], redes: [0, 300], contacto_nombre: [2, 120, true], contacto_cargo: [2, 80, true],
  contacto_email: [5, 200, true], contacto_telefono: [6, 30, true], color1_nombre: [0, 40], color2_nombre: [0, 40],
  equipacion: [0, 200], lema: [0, 120], fechas_fotos: [0, 200], campo: [0, 200], puntos_venta: [0, 300],
  evento: [0, 200], observaciones: [0, 3000],
};
const ESCUDO_MAX = 3 * 1024 * 1024;
const ESCUDO_TIPOS = /\.(png|svg|pdf|jpe?g|ai|eps)$/i;

function falla(res, campo) { return res.status(400).json({ ok: false, campo }); }

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ ok: false }); }
  const url = process.env.SC_SHEETS_URL, secret = process.env.SC_SHEETS_SECRET;
  if (!url || !secret) return res.status(503).json({ ok: false });

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { return falla(res, "json"); } }
  if (!b || typeof b !== "object") return falla(res, "json");
  if (b.web) return res.status(200).json({ ok: true });

  const d = { tipo: "ficha" };
  for (const [k, [min, max, obligatorio]] of Object.entries(TEXTOS)) {
    const v = typeof b[k] === "string" ? b[k].trim() : "";
    if ((obligatorio && v.length < min) || v.length > max) return falla(res, k);
    d[k] = v;
  }
  if (!EMAIL.test(d.contacto_email)) return falla(res, "contacto_email");
  for (const [k, ops] of Object.entries(UNO_DE)) { if (!ops.includes(b[k])) return falla(res, k); d[k] = b[k]; }
  for (const [k, ops] of Object.entries(OPCIONALES_UNO_DE)) { const v = b[k] || ""; if (!ops.includes(v)) return falla(res, k); d[k] = v; }
  for (const [k, ops] of Object.entries(VARIOS)) {
    const v = Array.isArray(b[k]) ? b[k] : [];
    if (!v.every((x) => ops.includes(x))) return falla(res, k);
    d[k] = v;
  }
  for (const k of ["color1", "color2"]) {
    if (!/^#[0-9a-f]{6}$/i.test(b[k] || "")) return falla(res, k);
    d[k] = b[k].toUpperCase();
  }
  if (!/^\d{4}-\d{2}$/.test(b.fecha_entrega || "")) return falla(res, "fecha_entrega");
  d.fecha_entrega = b.fecha_entrega;
  const patro = b.patrocinadores === "" || b.patrocinadores == null ? null : Number(b.patrocinadores);
  if (patro !== null && !(Number.isInteger(patro) && patro >= 0 && patro <= 60)) return falla(res, "patrocinadores");
  d.patrocinadores = patro;

  const eq = Array.isArray(b.equipos) ? b.equipos : [];
  if (!eq.length || eq.length > 60) return falla(res, "equipos");
  d.equipos = [];
  for (const e of eq) {
    const jug = Number(e && e.jugadores), ent = Number(e && e.entrenadores);
    const letra = typeof (e && e.equipo) === "string" ? e.equipo.trim().slice(0, 20) : "";
    if (!CATEGORIAS.includes(e && e.categoria) || !Number.isInteger(jug) || jug < 1 || jug > 40 || !Number.isInteger(ent) || ent < 0 || ent > 6) return falla(res, "equipos");
    d.equipos.push({ categoria: e.categoria, equipo: letra, jugadores: jug, entrenadores: ent });
  }

  if (b.autorizaciones !== true) return falla(res, "autorizaciones");
  if (b.privacidad !== true) return falla(res, "privacidad");

  if (b.escudo) {
    const e = b.escudo;
    const nombre = typeof e.nombre === "string" ? e.nombre.slice(0, 120) : "";
    const contenido = typeof e.contenido === "string" ? e.contenido : "";
    if (!ESCUDO_TIPOS.test(nombre) || !/^[A-Za-z0-9+/=]+$/.test(contenido) || contenido.length * 0.75 > ESCUDO_MAX) return falla(res, "escudo");
    d.escudo = { nombre, tipo: typeof e.tipo === "string" ? e.tipo.slice(0, 80) : "application/octet-stream", contenido };
  }

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, ...d }),
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    const cuerpo = await r.text();
    let respuesta = null;
    try { respuesta = JSON.parse(cuerpo); } catch { /* no es JSON */ }
    if (!r.ok || !respuesta || !respuesta.ok) {
      console.error("Apps Script (ficha)", r.status, r.headers.get("content-type"), cuerpo.slice(0, 300));
      return res.status(502).json({ ok: false });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Apps Script no responde (ficha)", e);
    return res.status(502).json({ ok: false });
  }
};
