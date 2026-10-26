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

  let pestana = '';
  try {
    pestana = crearPresupuestoImprenta(libro, {
      club: d.club_corto || d.club_nombre, clubOficial: d.club_nombre, localidad: d.localidad,
      contacto: d.contacto_nombre + ' · ' + d.contacto_email + ' · ' + d.contacto_telefono,
      equipos: eq, cromoEntrenadores: d.cromo_entrenadores !== 'No',
      formato: d.formato, orientacion: d.orientacion, fecha: d.fecha_entrega
    }).getName();
  } catch (err) {
    console.error('No se pudo crear la pestaña de presupuesto', err);
  }

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
    pestana ? 'Presupuesto para la imprenta en la pestaña «' + pestana + '».' : '',
    'Respondiendo a este correo contestas directamente al club.'
  ];
  avisar('Nueva ficha de club: ' + String(d.club_corto || d.club_nombre).slice(0, 80), lineas, d.contacto_email);
  return respuesta(true);
}

// ---------- Presupuesto para la imprenta (una pestaña por pedido) ----------
const PCT_ALBUMES = 0.6;   // álbumes = 60 % de jugadores + entrenadores
const PCT_COPIAS = 0.4;    // copias de cada cromo = 40 % de jugadores + entrenadores
const CATEGORIAS_F8 = ['Escuelita', 'Prebenjamín', 'Benjamín', 'Alevín'];

function crearPresupuestoImprenta(libro, p) {
  // Nombre de pestaña único: «Pedido · Club» (máx. 90 caracteres, sin caracteres no válidos)
  const base = ('Pedido · ' + String(p.club)).replace(/[\[\]\*\?\/\\:']/g, '').slice(0, 90);
  let nombre = base, n = 2;
  while (libro.getSheetByName(nombre)) nombre = base.slice(0, 85) + ' (' + (n++) + ')';
  const h = libro.insertSheet(nombre);

  const eq = p.equipos || [];
  const filas = eq.map(e => [e.categoria, e.equipo || '', e.jugadores, e.entrenadores,
    CATEGORIAS_F8.indexOf(e.categoria) !== -1 ? 'F8' : 'F11']);
  const r0 = 12, r1 = r0 + Math.max(filas.length, 1) - 1;   // filas de equipos
  const T = r1 + 2;                                         // inicio de totales

  h.getRange('A1').setValue('Presupuesto para la imprenta · ' + p.clubOficial)
    .setFontSize(15).setFontWeight('bold').setFontColor('#1E3B71');
  h.getRange('A2').setValue((p.localidad || '') + '  ·  ' + (p.contacto || '') +
    '  ·  Formato pedido: ' + (p.formato || '—') + '  ·  Cromo: ' + (p.orientacion || '—') +
    '  ·  Fecha deseada: ' + (p.fecha || '—'))
    .setFontColor('#6B7280').setFontStyle('italic');

  h.getRange('A4:C8').setValues([
    ['Parámetros (puedes cambiarlos)', '', ''],
    ['Álbumes: % de jugadores + entrenadores', PCT_ALBUMES, ''],
    ['Copias de cada cromo: % de jugadores + entrenadores', PCT_COPIAS, ''],
    ['Entrenadores con cromo', p.cromoEntrenadores ? 'Sí' : 'No', ''],
    ['Cromos por sobre', 5, '']
  ]);
  h.getRange('A4').setFontWeight('bold').setFontColor('#1E3B71');
  h.getRange('B5:B8').setBackground('#FFF2B3').setFontColor('#0000FF').setFontWeight('bold');
  h.getRange('B5:B6').setNumberFormat('0%');

  h.getRange(r0 - 1, 1, 1, 5).setValues([['Categoría', 'Equipo', 'Jugadores', 'Entrenadores', 'Bloque']])
    .setFontWeight('bold').setBackground('#1E3B71').setFontColor('#FFFFFF');
  if (filas.length) h.getRange(r0, 1, filas.length, 5).setValues(filas);
  h.getRange(r0, 3, r1 - r0 + 1, 2).setBackground('#FFF2B3').setFontColor('#0000FF');

  const J = 'C' + r0 + ':C' + r1, E = 'D' + r0 + ':D' + r1, B = 'E' + r0 + ':E' + r1;
  const cromos = (rango) => rango.jug + '+IF($B$7="Sí",' + rango.ent + ',0)';
  const todo = { jug: 'SUM(' + J + ')', ent: 'SUM(' + E + ')' };
  const f8 = { jug: 'SUMIF(' + B + ',"F8",' + J + ')', ent: 'SUMIF(' + B + ',"F8",' + E + ')' };
  const f11 = { jug: 'SUMIF(' + B + ',"F11",' + J + ')', ent: 'SUMIF(' + B + ',"F11",' + E + ')' };
  const equipos = (b) => b ? 'COUNTIF(' + B + ',"' + b + '")' : 'COUNTA(A' + r0 + ':A' + r1 + ')';

  const bloque = (fila, titulo, g, b) => {
    const personas = '(' + g.jug + '+' + g.ent + ')';
    const datos = [
      [titulo, '', ''],
      ['Jugadores', '=' + g.jug, ''],
      ['Entrenadores', '=' + g.ent, ''],
      ['Total jugadores + entrenadores', '=' + personas, ''],
      ['Modelos de cromo distintos', '=' + cromos(g), ''],
      ['Copias de cada cromo', '=ROUNDUP($B$6*' + personas + ',0)', ''],
      ['Cromos a imprimir', '=B' + (fila + 4) + '*B' + (fila + 5), ''],
      ['Álbumes', '=ROUNDUP($B$5*' + personas + ',0)', ''],
      ['Páginas del álbum (múltiplo de 4)', '=CEILING(2*' + equipos(b) + '+8,4)', '2 por equipo + portada, historia, autógrafos, patrocinadores y contraportada'],
      ['Sobres', '=ROUNDUP(B' + (fila + 6) + '/$B$8,0)', ''],
      ['Texto para pedir presupuesto', '="CROMOS-PEGATINAS 5,5 x 7,5 cm, color una cara, cortados individualmente con precorte trasero: "&B' + (fila + 4) + '&" modelos x "&B' + (fila + 5) + '&" unid. = "&B' + (fila + 6) + '&" cromos.  ÁLBUM A4 grapado, "&B' + (fila + 8) + '&" páginas, portada couché mate 350 g plastificada, interior couché mate 150 g: "&B' + (fila + 7) + '&" ejemplares.  SOBRES C7 opacos y ensobrado aleatorio de "&$B$8&" cromos: "&B' + (fila + 9) + '&" sobres."', '']
    ];
    h.getRange(fila, 1, datos.length, 3).setValues(datos);
    h.getRange(fila, 1, 1, 3).setFontWeight('bold').setBackground('#E8EEF7').setFontColor('#1E3B71');
    h.getRange(fila + 4, 1, 4, 2).setFontWeight('bold');
    h.getRange(fila + 10, 2).setWrap(true);
    h.getRange(fila + 10, 2, 1, 4).merge();
    h.setRowHeight(fila + 10, 70);
    return fila + datos.length + 1;
  };

  let fila = bloque(T, 'OPCIÓN A · Un álbum para todo el club', todo, '');
  fila = bloque(fila, 'OPCIÓN B1 · Álbum Fútbol 8 (Escuelita a Alevín)', f8, 'F8');
  bloque(fila, 'OPCIÓN B2 · Álbum Fútbol 11 (Infantil en adelante)', f11, 'F11');

  h.setColumnWidth(1, 330); h.setColumnWidths(2, 4, 110);
  h.getRange('C' + T + ':C' + (fila + 12)).setFontColor('#6B7280').setFontStyle('italic');
  h.setHiddenGridlines(true);
  return h;
}

// Menú para crear la pestaña de presupuesto de una ficha ya existente:
// en la pestaña «Fichas», selecciona una celda de la fila del club y usa el menú.
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Somos Cantera')
    .addItem('Crear presupuesto de imprenta (fila seleccionada en Fichas)', 'presupuestoDesdeFila')
    .addToUi();
}

function presupuestoDesdeFila() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = libro.getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  if (hoja.getName() !== HOJA_FICHAS) { ui.alert('Ve a la pestaña «Fichas» y selecciona la fila del club.'); return; }
  const r = hoja.getActiveRange().getRow();
  if (r < 2) { ui.alert('Selecciona una fila con datos.'); return; }
  const v = hoja.getRange(r, 1, 1, COLUMNAS_FICHA.length).getValues()[0];
  const col = (nombre) => v[COLUMNAS_FICHA.indexOf(nombre)];
  const equipos = String(col('Equipos (detalle)')).split('\n').map(l => {
    const m = l.match(/^(\S+)\s*(.*?):\s*(\d+) jug\. \+ (\d+) ent\.$/);
    return m ? { categoria: m[1], equipo: m[2], jugadores: +m[3], entrenadores: +m[4] } : null;
  }).filter(Boolean);
  const h = crearPresupuestoImprenta(libro, {
    club: col('Nombre en cromos') || col('Club (oficial)'), clubOficial: col('Club (oficial)'),
    localidad: col('Localidad'), contacto: col('Contacto') + ' · ' + col('Email') + ' · ' + col('Teléfono'),
    equipos: equipos, cromoEntrenadores: col('Cromos entrenadores') !== 'No',
    formato: col('Formato álbum'), orientacion: col('Orientación cromo'), fecha: col('Fecha deseada')
  });
  libro.setActiveSheet(h);
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
