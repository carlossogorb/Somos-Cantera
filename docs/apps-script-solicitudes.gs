/**
 * Somos Cantera — script de la hoja «Somos Cantera — Solicitudes web».
 *
 * Recibe dos tipos de envío desde la web (funciones de Vercel):
 *  - Solicitud de información (/api/solicitud) → pestaña «Solicitudes».
 *  - Ficha del club (/api/ficha) → pestaña «Fichas» (se crea sola) y el escudo
 *    en la carpeta de Drive «Somos Cantera — Escudos».
 * En los dos casos te envía un aviso a tu propio Gmail con la etiqueta «Somos Cantera».
 *
 * Instalación / actualización: Extensiones → Apps Script, pegar este código,
 * cambiar CLAVE por la clave secreta, guardar y
 * Implementar → Gestionar implementaciones → Editar (lápiz) → Versión: Nueva versión → Implementar.
 * (Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario).
 */

const CLAVE = 'PEGA_AQUI_LA_CLAVE';            // la misma que SC_SHEETS_SECRET en Vercel
const ETIQUETA = 'Somos Cantera';               // etiqueta de Gmail donde se guardan los avisos
const HOJA = 'Solicitudes';
const HOJA_FICHAS = 'Fichas';
const CARPETA_ESCUDOS = 'Somos Cantera — Escudos';

const COLUMNAS_FICHA = [
  'Fecha', 'Club (oficial)', 'Nombre en cromos', 'Localidad', 'Deporte', 'Temporada', 'Fundación', 'Web / redes',
  'Contacto', 'Cargo', 'Email', 'Teléfono',
  'Escudo', 'Color principal', 'Color secundario', 'Equipación', 'Lema',
  'Nº equipos', 'Jugadores', 'Entrenadores', 'Cromos distintos', 'Equipos (detalle)',
  'Formato álbum', 'Orientación cromo', 'Portada', 'Datos en el cromo', 'Cromos entrenadores', 'Páginas especiales',
  'Patrocinadores', 'Estilo',
  'Fotos', 'Días para fotos', 'Dirección del campo', 'Listado jugadores',
  'Modelo', 'Puntos de venta', 'Fecha deseada', 'Evento',
  'Observaciones', 'Estado', 'Notas'
];

// Evita que un texto que empiece por = + - @ se interprete como fórmula.
function limpio(v) {
  const t = String(v == null ? '' : v).slice(0, 3000);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return respuesta(false); }
  if (!d || d.secret !== CLAVE) return respuesta(false);
  return d.tipo === 'ficha' ? guardarFicha(d) : guardarSolicitud(d);
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

// ---------- Ficha del club ----------
function guardarFicha(d) {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(HOJA_FICHAS);
  if (!hoja) {
    hoja = libro.insertSheet(HOJA_FICHAS);
    hoja.appendRow(COLUMNAS_FICHA);
    hoja.setFrozenRows(1);
    hoja.getRange(1, 1, 1, COLUMNAS_FICHA.length).setFontWeight('bold');
  }

  let enlaceEscudo = 'Pendiente';
  if (d.escudo && d.escudo.contenido) {
    try {
      const carpetas = DriveApp.getFoldersByName(CARPETA_ESCUDOS);
      const carpeta = carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder(CARPETA_ESCUDOS);
      const ext = (String(d.escudo.nombre).match(/\.[a-z0-9]+$/i) || [''])[0];
      const nombre = String(d.club_corto || d.club_nombre).replace(/[\\/:*?"<>|]/g, '') + ' — escudo' + ext;
      const blob = Utilities.newBlob(Utilities.base64Decode(d.escudo.contenido), d.escudo.tipo, nombre);
      enlaceEscudo = carpeta.createFile(blob).getUrl();
    } catch (err) {
      console.error('No se pudo guardar el escudo', err);
      enlaceEscudo = 'Error al subir (pedirlo al club)';
    }
  }

  const eq = d.equipos || [];
  const jugadores = eq.reduce((s, x) => s + x.jugadores, 0);
  const entrenadores = eq.reduce((s, x) => s + x.entrenadores, 0);
  const cromos = jugadores + (d.cromo_entrenadores === 'No' ? 0 : entrenadores);
  const detalle = eq.map(x => x.categoria + (x.equipo ? ' ' + x.equipo : '') + ': ' + x.jugadores + ' jug. + ' + x.entrenadores + ' ent.').join('\n');
  const lista = v => (v || []).join(', ');

  const fila = [
    new Date(), d.club_nombre, d.club_corto, d.localidad, d.deporte, d.temporada, d.fundacion, d.redes,
    d.contacto_nombre, d.contacto_cargo, d.contacto_email, d.contacto_telefono,
    enlaceEscudo, d.color1 + (d.color1_nombre ? ' (' + d.color1_nombre + ')' : ''), d.color2 + (d.color2_nombre ? ' (' + d.color2_nombre + ')' : ''), d.equipacion, d.lema,
    eq.length, jugadores, entrenadores, cromos, detalle,
    d.formato, d.orientacion, d.portada, lista(d.datos_cromo), d.cromo_entrenadores, lista(d.paginas),
    d.patrocinadores == null ? '' : d.patrocinadores, d.estilo,
    d.fotos, d.fechas_fotos, d.campo, d.listado,
    d.modelo, d.puntos_venta, d.fecha_entrega, d.evento,
    d.observaciones, 'nueva', ''
  ].map(limpio);
  fila[0] = new Date(); // la fecha como fecha, no como texto

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { hoja.appendRow(fila); } finally { lock.releaseLock(); }

  const lineas = [
    'Club: ' + d.club_nombre + ' (' + d.localidad + ')',
    'Contacto: ' + d.contacto_nombre + ', ' + d.contacto_cargo + ' · ' + d.contacto_email + ' · ' + d.contacto_telefono,
    '',
    eq.length + ' equipos · ' + jugadores + ' jugadores · ' + entrenadores + ' entrenadores · ' + cromos + ' cromos distintos',
    detalle, '',
    'Formato: ' + d.formato, 'Cromo: ' + d.orientacion, 'Portada: ' + d.portada,
    'Modelo: ' + d.modelo, 'Fecha deseada: ' + d.fecha_entrega,
    'Escudo: ' + enlaceEscudo, '',
    'Ficha completa en la pestaña «Fichas»: ' + libro.getUrl(),
    'Respondiendo a este correo contestas directamente al club.'
  ];
  avisar('Nueva ficha de club: ' + String(d.club_corto || d.club_nombre).slice(0, 80), lineas, d.contacto_email);
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

// Ejecútala una vez desde el editor (botón «Ejecutar») para dar permiso a Drive y Gmail.
function autorizar() {
  DriveApp.getRootFolder();
  GmailApp.getUserLabelByName(ETIQUETA);
}

function respuesta(ok) {
  return ContentService.createTextOutput(JSON.stringify({ ok: ok }))
    .setMimeType(ContentService.MimeType.JSON);
}
