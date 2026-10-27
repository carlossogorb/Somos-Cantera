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
// Hoja de la calculadora (pestaña «Tarifas») para el precio orientativo.
const CALCULADORA_ID = '1azRTmGCsnjPxch79OzEYD1_9YvkX3NvE1P22LlO7MBY';
const PCT_ALBUMES = 0.6;    // álbumes = 60 % de jugadores + entrenadores con cromo
const PCT_COPIAS = 0.35;    // copias de cada cromo = 35 % de jugadores + entrenadores con cromo
const SOBRES_OBJETIVO = 50; // cromos por sobre = modelos ÷ 50 (mínimo 5, máximo 8)

function guardarSolicitud(d) {
  const c = calculos(d);
  const precio = precioOrientativo(Number(d.jugadores));

  // La solicitud nueva se inserta en la fila 2, justo debajo de los títulos:
  // las más recientes quedan arriba y las antiguas abajo.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA);
    const fila = [
      new Date(), limpio(d.nombre), limpio(d.club), limpio(d.email), limpio(d.telefono),
      limpio(d.localidad), limpio(d.rol), d.jugadores, limpio(d.entrenadores_cromo), d.entrenadores || 0,
      d.equipos, limpio(d.formato), limpio(d.mensaje),
      'Sí', 'nueva', '', precio.texto, c ? c.texto : ''
    ];
    hoja.insertRowBefore(2);
    hoja.getRange(2, 1, 1, fila.length).setValues([fila]).setFontWeight('normal');
  } finally {
    lock.releaseLock();
  }

  const lineas = [
    'Nombre: ' + d.nombre, 'Club: ' + d.club, 'Email: ' + d.email,
    'Teléfono: ' + (d.telefono || '—'), 'Localidad: ' + d.localidad,
    'Papel en el club: ' + d.rol, '',
    'Jugadores: ' + d.jugadores + ' · Equipos: ' + d.equipos,
    'Entrenadores con cromo: ' + d.entrenadores_cromo + (d.entrenadores_cromo === 'Sí' ? ' (' + d.entrenadores + ')' : ''),
    'Formato: ' + d.formato, '',
    d.mensaje || '(sin mensaje)', ''
  ];
  if (c) {
    lineas.push(
      'CÁLCULO (opción de un álbum para todo el club)',
      '· Modelos de cromo: ' + c.modelos + ' · Copias de cada uno: ' + c.copias + ' · Cromos a imprimir: ' + c.cromos,
      '· Álbumes: ' + c.albumes + ' de ' + c.paginas + ' páginas',
      '· Sobres: ' + c.sobres + ' de ' + c.porSobre + ' cromos',
      '· Precio orientativo (tarifa): ' + precio.texto, '',
      'Texto para pedir presupuesto a la imprenta:', c.texto, '');
  }
  lineas.push(
    'Hoja de solicitudes: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    'Respondiendo a este correo contestas directamente al club.');
  avisar('Nueva solicitud: ' + String(d.club).slice(0, 80) + ' (' + String(d.localidad).slice(0, 40) + ')', lineas, d.email);
  return respuesta(true);
}

// Cantidades para la imprenta a partir de los datos del formulario.
function calculos(d) {
  const jug = Number(d.jugadores), eq = Number(d.equipos);
  if (!(jug > 0) || !(eq > 0)) return null;
  const ent = d.entrenadores_cromo === 'Sí' ? Number(d.entrenadores) || 0 : 0;
  const modelos = jug + ent;
  const copias = Math.ceil(PCT_COPIAS * modelos);
  const cromos = modelos * copias;
  const albumes = Math.ceil(PCT_ALBUMES * modelos);
  const paginas = Math.ceil((2 * eq + 8) / 4) * 4;
  const porSobre = Math.min(8, Math.max(5, Math.round(modelos / SOBRES_OBJETIVO)));
  const sobres = Math.ceil(cromos / porSobre);
  const texto = 'CROMOS-PEGATINAS 5,5 x 7,5 cm, color una cara, cortados individualmente con precorte trasero: ' +
    modelos + ' modelos x ' + copias + ' unid. = ' + cromos + ' cromos. ÁLBUM A4 grapado, ' + paginas +
    ' páginas, portada couché mate 350 g plastificada, interior couché mate 150 g: ' + albumes +
    ' ejemplares. SOBRES C7 opacos y ensobrado aleatorio de ' + porSobre + ' cromos: ' + sobres + ' sobres.';
  return { modelos, copias, cromos, albumes, paginas, porSobre, sobres, texto };
}

// Busca el tramo en la pestaña «Tarifas» de la calculadora (filas «Hasta…», «De … a …»).
function precioOrientativo(jugadores) {
  try {
    const filas = SpreadsheetApp.openById(CALCULADORA_ID).getSheetByName('Tarifas')
      .getRange('A41:D60').getValues().filter(f => typeof f[1] === 'number' && typeof f[2] === 'number');
    const tramo = filas.find(f => jugadores <= f[1]);
    if (!tramo) return { texto: 'Más de ' + filas[filas.length - 1][1] + ' jugadores: presupuesto a medida' };
    const eur = n => Math.round(n).toLocaleString('es-ES') + ' €';
    return { texto: tramo[0] + ': ' + eur(tramo[2]) + ' + IVA (' + eur(tramo[3]) + ')' };
  } catch (err) {
    console.error('No se pudo leer la tarifa', err);
    return { texto: '(no se pudo leer la tarifa)' };
  }
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

// Ejecútala una vez desde el editor (botón «Ejecutar») para dar permiso a leer la calculadora.
function autorizar() {
  console.log(precioOrientativo(100).texto);
}
