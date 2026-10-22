/**
 * Somos Cantera — script de la hoja «Somos Cantera — Solicitudes web».
 *
 * Recibe cada solicitud desde la web (función /api/solicitud de Vercel),
 * la añade como fila nueva y te envía un aviso a tu propio Gmail
 * (la cuenta dueña de la hoja), etiquetado como «Somos Cantera».
 *
 * Instalación: Extensiones → Apps Script, pegar este código, cambiar CLAVE
 * por la clave secreta, y Implementar → Nueva implementación → Aplicación web
 * (Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario).
 */

const CLAVE = 'PEGA_AQUI_LA_CLAVE';            // la misma que SC_SHEETS_SECRET en Vercel
const ETIQUETA = 'Somos Cantera';               // etiqueta de Gmail donde se guardan los avisos
const HOJA = 'Solicitudes';

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return respuesta(false); }
  if (!d || d.secret !== CLAVE) return respuesta(false);

  // Evita que un texto que empiece por = + - @ se interprete como fórmula.
  const limpio = v => {
    const t = String(v == null ? '' : v).slice(0, 2000);
    return /^[=+\-@]/.test(t) ? "'" + t : t;
  };

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
  try {
    const yo = Session.getEffectiveUser().getEmail();
    const asunto = 'Nueva solicitud: ' + String(d.club).slice(0, 80) + ' (' + String(d.localidad).slice(0, 40) + ')';
    GmailApp.sendEmail(yo, asunto, lineas.join('\n'), { replyTo: d.email, name: 'Web Somos Cantera' });
    etiquetar(asunto);
  } catch (err) {
    console.error('No se pudo enviar el aviso', err); // la fila ya está guardada
  }
  return respuesta(true);
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
