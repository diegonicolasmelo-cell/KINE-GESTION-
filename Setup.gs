// ============================================
// SETUP.GS — Instalador y datos de prueba
// KinesioTurno UCI — Hospital San Pablo de Coquimbo
// --------------------------------------------
// EJECUTA UNA SOLA VEZ: inicializarProyecto()
// → Crea 6 hojas con cabeceras, configuración base, feriados
//   y el roster real 2026 de la UCI (15 personas).
//
// Para borrar datos y volver a sembrar: resetearProyecto()
// Para verificar el estado:            diagnosticoProyecto()
// Si tu cuenta quedó fuera del sistema: corregirAcceso()
// ============================================

// 🔴 ANTES DE EJECUTAR: reemplaza los correos de prueba
//    por los correos con los que realmente vas a entrar.
//    Deben ser EXACTAMENTE la cuenta Google con la que abres
//    la web app (el login es automático por sesión de Google).
var EMAIL_COORDINADORA = 'monica.contardo@hospitalcoquimbo.cl';
var EMAIL_KINE_PRUEBA  = 'diegonicolas.melo@gmail.com';

// ============================================
// ESQUEMA DE HOJAS
// ============================================
var ESQUEMA_HOJAS = {
  'USUARIOS': [
    'ID_Usuario','Nombre','Apellido','Email','Rol','Estado','Turno_Base',
    'FL_Disponibles','FF_Disponibles','ADM_Disponibles','URL_Foto','RUT',
    'Fecha_Ingreso','Es_Subrogante_Activo','Etiqueta'
  ],
  'SOLICITUDES': [
    'ID_Sol','Fecha_Solicitud','ID_Solicitante','Tipo_Sol','Fecha_Inicio',
    'Fecha_Fin','Dias_Solicitados','ID_Reemplazante','Motivo','Estado',
    'Turno_Ausencia','Fecha_Resolucion','ID_Aprobador','Nota_Resolucion'
  ],
  'CONFIGURACION': ['Clave','Valor'],
  'LICENCIAS': [
    'ID_Lic','ID_Usuario','Fecha_Inicio','Fecha_Fin','Folio','Tipo',
    'Observacion','Fecha_Registro','Dias'
  ],
  'VACANTES': [
    'ID_Vac','ID_Lic','Fecha','Turno','Equipo',
    'ID_Ausente','Estado','ID_Cobertura','Fecha_Asignacion'
  ],
  'FERIADOS': ['Fecha','Nombre']
};

// ============================================
// FERIADOS CHILE 2026 — fuente única (servidor y cliente).
// Para años futuros: agregar filas directamente en la hoja FERIADOS.
// ============================================
var FERIADOS_2026 = [
  ['2026-01-01','Año Nuevo'],            ['2026-04-03','Viernes Santo'],
  ['2026-04-04','Sábado Santo'],         ['2026-05-01','Día del Trabajador'],
  ['2026-05-21','Glorias Navales'],      ['2026-06-21','Pueblos Indígenas'],
  ['2026-06-29','San Pedro y San Pablo'],['2026-07-16','Virgen del Carmen'],
  ['2026-08-15','Asunción de la Virgen'],['2026-09-18','Independencia Nacional'],
  ['2026-09-19','Glorias del Ejército'], ['2026-10-12','Encuentro de 2 Mundos'],
  ['2026-10-31','Iglesias Evangélicas'], ['2026-11-01','Todos los Santos'],
  ['2026-12-08','Inmaculada Concepción'],['2026-12-25','Navidad']
];

// ============================================
// ROSTER REAL 2026 — UCI Hospital San Pablo de Coquimbo
// [ID, Nombre, Apellido, Email, Rol, Turno_Base, FL, FF, ADM, RUT, Etiqueta]
// ============================================
var ROSTER_2026 = [
  // Equipo 1
  ['U001','Matías',   'Ortega',   'matias.ortega@hospitalcoquimbo.cl',    'Kinesiólogo',  'Equipo A', 14,6,6,'15.111.222-3','M ORTEGA'],
  ['U002','Felipe',   'Guerrero', 'felipe.guerrero@hospitalcoquimbo.cl',  'Kinesiólogo',  'Equipo A', 12,5,6,'16.222.333-4','F GUERRERO'],
  ['U003','Nicolás',  'Parra',    'nicolas.parra@hospitalcoquimbo.cl',    'Kinesiólogo',  'Equipo A', 11,4,5,'17.333.444-5','N PARRA'],
  // Equipo 2
  ['U004','Sergio',   'Ortiz',    'sergio.ortiz@hospitalcoquimbo.cl',     'Kinesiólogo',  'Equipo B', 13,6,6,'18.444.555-6','S ORTIZ'],
  ['U005','María José','Vega',    'mariajose.vega@hospitalcoquimbo.cl',   'Kinesiólogo',  'Equipo B', 10,5,4,'16.555.666-7','M VEGA'],
  ['U006','Álvaro',   'Wilson',   'alvaro.wilson@hospitalcoquimbo.cl',    'Kinesiólogo',  'Equipo B', 12,6,6,'15.666.777-8','A WILSON'],
  // Equipo 3
  ['U007','Eduardo',  'González', 'eduardo.gonzalez@hospitalcoquimbo.cl', 'Kinesiólogo',  'Equipo C',  9,3,6,'17.777.888-9','E GONZALEZ'],
  ['U008','Diego',    'Melo',     EMAIL_KINE_PRUEBA,                       'Kinesiólogo',  'Equipo C', 12,4,5,'17.890.123-4','D MELO'],
  ['U009','Karen',    'González', 'karen.gonzalez@hospitalcoquimbo.cl',   'Kinesiólogo',  'Equipo C', 11,5,6,'19.888.999-0','K GONZALEZ'],
  // Equipo 4
  ['U010','Carlos',   'Morales',  'carlos.morales@hospitalcoquimbo.cl',   'Kinesiólogo',  'Equipo D', 10,5,5,'20.999.000-1','C MORALES'],
  ['U011','Andrés',   'Ángel',    'andres.angel@hospitalcoquimbo.cl',     'Kinesiólogo',  'Equipo D', 13,6,6,'18.000.111-2','A ANGEL'],
  ['U012','Manuel',   'Fuentes',  'manuel.fuentes@hospitalcoquimbo.cl',   'Kinesiólogo',  'Equipo D', 12,5,6,'16.111.222-3','M FUENTES'],
  // Coordinación / Jornada
  ['U013','Mónica',   'Contardo', EMAIL_COORDINADORA,                      'Coordinadora', 'Diurno Jefatura', 15,6,6,'14.222.333-4','M CONTARDO'],
  // Reemplazos
  ['U014','Aline',    'Campos',   'aline.campos@hospitalcoquimbo.cl',     'Kinesiólogo',  'Reemplazo 1', 12,6,6,'19.333.444-5','A CAMPOS'],
  ['U015','Rodrigo',  'Caamaño',  'rodrigo.caamano@hospitalcoquimbo.cl',  'Kinesiólogo',  'Reemplazo 2', 12,6,6,'20.444.555-6','R CAAMAÑO']
];

// ============================================
// INSTALADOR PRINCIPAL ← ejecuta esta función
// ============================================
function inicializarProyecto() {
  soloPropietario_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Crear hojas con cabeceras si no existen
  Object.keys(ESQUEMA_HOJAS).forEach(function(nombre) {
    var hoja = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    var cabs = ESQUEMA_HOJAS[nombre];
    var primera = hoja.getRange(1, 1, 1, cabs.length).getValues()[0];
    var vacia = primera.every(function(c) { return c === '' || c === null; });
    if (vacia) {
      hoja.getRange(1, 1, 1, cabs.length).setValues([cabs]);
      hoja.getRange(1, 1, 1, cabs.length)
          .setFontWeight('bold').setBackground('#2B3674').setFontColor('#FFFFFF');
      hoja.setFrozenRows(1);
      hoja.autoResizeColumns(1, cabs.length);
    }
  });

  // 2. Configuración base
  sembrarConfig_([
    ['NOMBRE_HOSPITAL',       'Hospital San Pablo de Coquimbo'],
    ['NOMBRE_UNIDAD',         'UCI'],
    ['NOMBRE_COORDINADORA',   'Mónica Contardo'],
    ['EMAIL_COORDINADORA',    EMAIL_COORDINADORA],
    ['DOTACION_MINIMA_LARGO', '1'],
    ['DOTACION_MINIMA_NOCHE', '1'],
    ['BASE_DATE_ROTACION',    '2026-03-05'],
    ['VERSION_APP',           '2.1-Pro']
  ]);

  // 3. Roster 2026 + feriados
  sembrarUsuarios_();
  sembrarFeriados_();

  // 4. Eliminar hoja por defecto si quedó vacía
  ['Hoja 1','Hoja1','Sheet1'].forEach(function(n) {
    var h = ss.getSheetByName(n);
    if (h && ss.getSheets().length > 1) { try { ss.deleteSheet(h); } catch(e) {} }
  });

  SpreadsheetApp.flush();
  Logger.log('✅ Proyecto inicializado — roster 2026 con 15 personas listo.');
  Logger.log('   Coordinadora: ' + EMAIL_COORDINADORA);
  Logger.log('   Kinesiólogo de prueba: ' + EMAIL_KINE_PRUEBA);
}

// ============================================
// CORREGIR ACCESO — ejecutar si la web app te dice
// "Sin acceso al sistema" con una hoja ya sembrada.
// Alinea los emails de la hoja USUARIOS con las constantes
// de arriba (la siembra no se repite si ya hay datos, así que
// cambiar solo la constante no basta).
// ============================================
function corregirAcceso() {
  soloPropietario_();
  var okKine  = actualizarFilaPorClave_('USUARIOS', 'ID_Usuario', 'U008', { Email: EMAIL_KINE_PRUEBA,  Estado: 'Activo' });
  var okCoord = actualizarFilaPorClave_('USUARIOS', 'ID_Usuario', 'U013', { Email: EMAIL_COORDINADORA, Estado: 'Activo' });
  actualizarFilaPorClave_('CONFIGURACION', 'Clave', 'EMAIL_COORDINADORA', { Valor: EMAIL_COORDINADORA });
  SpreadsheetApp.flush();
  Logger.log(okKine  ? '✔ U008 (kine de prueba) → ' + EMAIL_KINE_PRUEBA  : '❌ No se encontró U008 — ejecuta inicializarProyecto()');
  Logger.log(okCoord ? '✔ U013 (coordinadora)   → ' + EMAIL_COORDINADORA : '❌ No se encontró U013 — ejecuta inicializarProyecto()');
  Logger.log('Tu sesión actual: ' + Session.getActiveUser().getEmail());
  Logger.log('Recarga la web app para probar el acceso.');
}

// ============================================
// SEMBRAR CONFIGURACIÓN
// ============================================
function sembrarConfig_(pares) {
  var existentes = obtenerDatosHoja_('CONFIGURACION').map(function(r) { return String(r.Clave); });
  pares.forEach(function(p) {
    if (existentes.indexOf(p[0]) === -1) {
      appendFilaPorClave_('CONFIGURACION', { Clave: p[0], Valor: p[1] });
    }
  });
}

// ============================================
// SEMBRAR FERIADOS (solo los que falten)
// ============================================
function sembrarFeriados_() {
  var existentes = obtenerDatosHoja_('FERIADOS').map(function(r) { return fechaISO_(r.Fecha); });
  var nuevos = 0;
  FERIADOS_2026.forEach(function(f) {
    if (existentes.indexOf(f[0]) === -1) {
      appendFilaPorClave_('FERIADOS', { Fecha: f[0], Nombre: f[1] });
      nuevos++;
    }
  });
  if (nuevos) Logger.log('Sembrados ' + nuevos + ' feriado(s) 2026.');
}

// ============================================
// SEMBRAR USUARIOS (solo si la hoja está vacía)
// ============================================
function sembrarUsuarios_() {
  if (obtenerDatosHoja_('USUARIOS').length > 0) {
    Logger.log('USUARIOS ya tiene datos — no se sobrescribió.');
    return;
  }
  var hoy = Utilities.formatDate(new Date(), TZ_, 'yyyy-MM-dd');
  ROSTER_2026.forEach(function(r) {
    appendFilaPorClave_('USUARIOS', {
      ID_Usuario         : r[0],
      Nombre             : r[1],
      Apellido           : r[2],
      Email              : r[3],
      Rol                : r[4],
      Estado             : 'Activo',
      Turno_Base         : r[5],
      FL_Disponibles     : r[6],
      FF_Disponibles     : r[7],
      ADM_Disponibles    : r[8],
      URL_Foto           : '',
      RUT                : r[9],
      Fecha_Ingreso      : hoy,
      Es_Subrogante_Activo: 'FALSE',
      Etiqueta           : r[10]
    });
  });
  Logger.log('Sembrados ' + ROSTER_2026.length + ' usuarios.');
}

// ============================================
// RESET — borra SOLO los datos, conserva cabeceras
// ============================================
function resetearProyecto() {
  soloPropietario_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(ESQUEMA_HOJAS).forEach(function(nombre) {
    var hoja = ss.getSheetByName(nombre);
    if (!hoja) return;
    var ultima = hoja.getLastRow();
    if (ultima > 1) hoja.deleteRows(2, ultima - 1);
    invalidarCacheHoja_(nombre);
  });
  SpreadsheetApp.flush();
  Logger.log('🧹 Datos borrados. Ejecuta inicializarProyecto() para volver a sembrar.');
}

// ============================================
// DIAGNÓSTICO RÁPIDO
// ============================================
function diagnosticoProyecto() {
  soloPropietario_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(ESQUEMA_HOJAS).forEach(function(nombre) {
    var hoja = ss.getSheetByName(nombre);
    if (!hoja) { Logger.log('❌ Falta la hoja: ' + nombre); return; }
    Logger.log('✔ ' + nombre + ' → ' + Math.max(0, hoja.getLastRow() - 1) + ' fila(s)');
  });
  var coord = obtenerConfig_('EMAIL_COORDINADORA');
  Logger.log('EMAIL_COORDINADORA = ' + (coord || '(no configurado)'));
  var sesion = Session.getActiveUser().getEmail();
  Logger.log('Tu sesión = ' + (sesion || '(no detectada)'));
  var u = sesion ? buscarUsuarioPorEmail_(sesion) : null;
  Logger.log(u
    ? '✔ Tu cuenta está registrada como ' + u.Nombre + ' ' + u.Apellido + ' (' + u.ID_Usuario + ')'
    : '❌ Tu cuenta NO está en USUARIOS — la web app te mostrará "Sin acceso". Ejecuta corregirAcceso().');
}
