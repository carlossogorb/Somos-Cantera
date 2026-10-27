// Somos Cantera — recibe el formulario de la web y lo envía a la hoja de Google.
// Función de Vercel (Node). Valida los datos y los reenvía al script de Google
// (Apps Script) que añade la fila en «Somos Cantera — Solicitudes web» y avisa
// por email. La URL del script y la clave compartida van en variables de entorno
// de Vercel (SC_SHEETS_URL y SC_SHEETS_SECRET); nunca en este repositorio público.

const ROLES = ["Presidencia", "Junta directiva", "Coordinación deportiva", "Entrenador o entrenadora", "Familia", "Otro"];
const FORMATOS = ["Un álbum para todo el club", "Álbumes por categorías (F8 y F11)", "Aconsejadnos"];

function entero(v, min, max) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function texto(v, min, max) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= min && t.length <= max ? t : null;
}

function opcional(v, max) {
  if (v === null || v === undefined || v === "") return "";
  return typeof v === "string" && v.trim().length <= max ? v.trim() : null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false });
  }

  const url = process.env.SC_SHEETS_URL;
  const secret = process.env.SC_SHEETS_SECRET;
  if (!url || !secret) {
    console.error("Faltan SC_SHEETS_URL o SC_SHEETS_SECRET");
    return res.status(503).json({ ok: false });
  }

  let b = req.body;
  if (typeof b === "string") {
    try { b = JSON.parse(b); } catch { return res.status(400).json({ ok: false }); }
  }
  if (!b || typeof b !== "object") return res.status(400).json({ ok: false });

  // Trampa para bots: el campo oculto «web» debe venir vacío.
  if (b.web) return res.status(200).json({ ok: true });

  const datos = {
    nombre: texto(b.nombre, 2, 120),
    club: texto(b.club, 2, 160),
    email: texto(b.email, 5, 200),
    telefono: opcional(b.telefono, 30),
    localidad: texto(b.localidad, 2, 120),
    rol: ROLES.includes(b.rol) ? b.rol : null,
    jugadores: entero(b.jugadores, 1, 2000),
    equipos: entero(b.equipos, 1, 100),
    entrenadores_cromo: b.entrenadores_cromo === "Sí" || b.entrenadores_cromo === "No" ? b.entrenadores_cromo : null,
    entrenadores: b.entrenadores_cromo === "Sí" ? entero(b.entrenadores, 1, 300) : 0,
    formato: FORMATOS.includes(b.formato) ? b.formato : null,
    mensaje: opcional(b.mensaje, 2000),
  };
  const invalido = Object.entries(datos).find(([, v]) => v === null);
  if (invalido) return res.status(400).json({ ok: false, campo: invalido[0] });
  if (!EMAIL.test(datos.email)) return res.status(400).json({ ok: false, campo: "email" });
  if (b.acepta_privacidad !== true) return res.status(400).json({ ok: false, campo: "privacidad" });

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, ...datos }),
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    const cuerpo = await r.text();
    let respuesta = null;
    try { respuesta = JSON.parse(cuerpo); } catch { /* no es JSON */ }
    if (!r.ok || !respuesta || !respuesta.ok) {
      console.error("Apps Script", r.status, r.headers.get("content-type"), cuerpo.slice(0, 300));
      return res.status(502).json({ ok: false });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Apps Script no responde", e);
    return res.status(502).json({ ok: false });
  }
};
