/**
 * Somos Cantera — script de la hoja «Somos Cantera — Solicitudes web».
 *
 * Recibe las solicitudes de información de la web (/api/solicitud), las guarda en la
 * pestaña «Solicitudes» y te envía un aviso a tu propio Gmail con la etiqueta «Somos Cantera».
 *
 * Instalación / actualización: Extensiones → Apps Script, pegar este código,
 * cambiar CLAVE por la clave secreta, guardar y
 * Implementar → Gestionar implementaciones → Editar (lápiz) → Versión: Nueva versión → Implementar.
 * (Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario).
 */

const CLAVE = 'PEGA_AQUI_LA_CLAVE';            // la misma que SC_SHEETS_SECRET en Vercel
const ETIQUETA = 'Somos Cantera';               // etiqueta de Gmail donde se guardan los avisos
const HOJA = 'Solicitudes';

// Evita que un texto que empiece por = + - @ se interprete como fórmula.
function limpio(v) {
  const t = String(v == null ? '' : v).slice(0, 3000);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return respuesta(false); }
  if (!d || d.secret !== CLAVE) return respuesta(false);
  return guardarSolicitud(d);
}

// ---------- Solicitud de información ----------
function guardarSolicitud(d) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA).appendRow([
      new Date(), limpio(d.nombre), limpio(d.club), limpio(d.email), limpio(d.telefono),
      limpio(d.localidad), limpio(d.rol), limpio(d.jugadores), limpio(d.mensaje),
      'Sí', 'nueva', ''
    ]);
  } finally {
    lock.releaseLock();
  }

  const lineas = [
    'Nombre: ' + d.nombre, 'Club: ' + d.club, 'Email: ' + d.email,
    'Teléfono: ' + (d.telefono || '—'), 'Localidad: ' + d.localidad,
    'Papel en el club: ' + d.rol, 'Jugadores: ' + d.jugadores, '',
    d.mensaje || '(sin mensaje)', '',
    'Hoja de solicitudes: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    'Respondiendo a este correo contestas directamente al club.'
  ];
  avisar('Nueva solicitud: ' + String(d.club).slice(0, 80) + ' (' + String(d.localidad).slice(0, 40) + ')', lineas, d.email);
  return respuesta(true);
}

// ---------- Aviso por Gmail ----------
function avisar(asunto, lineas, responderA) {
  try {
    const yo = Session.getEffectiveUser().getEmail();
    GmailApp.sendEmail(yo, asunto, lineas.join('\n'), { replyTo: responderA, name: 'Web Somos Cantera' });
    etiquetar(asunto);
  } catch (err) {
    console.error('No se pudo enviar el aviso', err); // los datos ya están guardados
  }
}

// Pone la etiqueta «Somos Cantera» al aviso recién enviado (la crea si no existe).
function etiquetar(asunto) {
  const etiqueta = GmailApp.getUserLabelByName(ETIQUETA) || GmailApp.createLabel(ETIQUETA);
  for (let i = 0; i < 5; i++) {
    const hilos = GmailApp.search('subject:"' + asunto.replace(/"/g, '') + '" newer_than:1d', 0, 1);
    if (hilos.length) { hilos[0].addLabel(etiqueta); return; }
    Utilities.sleep(1500);
  }
}

function respuesta(ok) {
  return ContentService.createTextOutput(JSON.stringify({ ok: ok }))
    .setMimeType(ContentService.MimeType.JSON);
}
