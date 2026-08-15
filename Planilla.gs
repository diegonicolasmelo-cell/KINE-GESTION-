// ============================================
// PLANILLA.GS — Planilla mensual + Reporte RRHH
// KinesioTurno UCI — Hospital San Pablo de Coquimbo
// --------------------------------------------
// Expone dos funciones llamadas desde el cliente via google.script.run:
//   obtenerPlanillaMes(anio, mes)  → matriz para la vista Planilla
//   obtenerDatosMes(anio, mes)     → datos para el Reporte RRHH
// Los tipos de solicitud se comparan con tipoNorm_() — el frontend
// guarda "CAMBIO_TURNO" y antes se comparaba contra "CAMBIO" exacto,
// por lo que los cambios aprobados nunca aparecían aquí.
// ============================================

// Orden visual de la planilla (IDs tal como están en la hoja USUARIOS).
// Los usuarios activos que no figuren aquí se agregan al final.
var ORDEN_PLANILLA_IDS = [
  'U001','U002','U003',   // Equipo 1: M Ortega · F Guerrero · N Parra
  'U004','U005','U006',   // Equipo 2: S Ortiz  · M Vega     · A Wilson
  'U007','U008','U009',   // Equipo 3: E González · D Melo   · K González
  'U010','U011','U012',   // Equipo 4: C Morales  · A Ángel  · M Fuentes
  'U013',                 // Jornada / Coordinación: M Contardo
  'U014','U015'           // Reemplazos: A Campos (1°) · R Caamaño (2°)
];

// Índice 0-based de la ÚLTIMA persona de cada bloque (línea gruesa debajo)
var FIN_BLOQUE_IDX = { 2:true, 5:true, 8:true, 11:true, 12:true };

// ============================================
// obtenerPlanillaMes — llamada desde el cliente
// Devuelve: { anio, mes, dias, dow[], filas[] }
// Cada fila: { id, etiqueta, finBloque, celdas[] }
// Cada celda: { code:'L'|'N'|'J'|'LM'|'FF'|'ADM'|'FL'|'', tipo }
// ============================================
function obtenerPlanillaMes(anio, mes) {
  if (!usuarioSesion_()) return { anio: anio, mes: mes, dias: 0, dow: [], filas: [] };
  var usuarios     = obtenerDatosHoja_('USUARIOS');
  var solicitudes  = obtenerDatosHoja_('SOLICITUDES');
  var licencias    = obtenerDatosHoja_('LICENCIAS');

  var dias = new Date(anio, mes, 0).getDate();
  var DOW  = ['D','L','M','M','J','V','S'];
  var dow  = [];
  for (var d = 1; d <= dias; d++) {
    dow.push(DOW[new Date(anio, mes - 1, d).getDay()]);
  }

  // Orden fijo + usuarios activos nuevos que no estén en la lista
  var idsOrdenados = ORDEN_PLANILLA_IDS.slice();
  usuarios.forEach(function(u) {
    if (String(u.Estado).toUpperCase() === 'ACTIVO' &&
        idsOrdenados.indexOf(String(u.ID_Usuario)) === -1) {
      idsOrdenados.push(String(u.ID_Usuario));
    }
  });

  var filas = idsOrdenados.map(function(id, idx) {
    var u = usuarios.find(function(x) { return String(x.ID_Usuario) === id; });
    if (!u) return null;

    var celdas = [];
    for (var d = 1; d <= dias; d++) {
      var fecha = new Date(anio, mes - 1, d, 12, 0, 0);
      var iso   = fechaISO_(fecha);
      celdas.push(celdaPlanilla_(u, fecha, iso, solicitudes, licencias));
    }

    var etiqueta = String(
      u.Etiqueta || ((u.Nombre.charAt(0)) + ' ' + u.Apellido)
    ).toUpperCase().trim();

    return {
      id        : id,
      etiqueta  : etiqueta,
      finBloque : !!FIN_BLOQUE_IDX[idx],
      celdas    : celdas
    };
  }).filter(Boolean);

  return JSON.parse(JSON.stringify({ anio: anio, mes: mes, dias: dias, dow: dow, filas: filas }));
}

// ============================================
// celdaPlanilla_ — lógica de prioridad por día
// ============================================
function celdaPlanilla_(u, fecha, iso, solicitudes, licencias) {
  var uid = String(u.ID_Usuario);

  // 1. Licencia Médica (prioridad máxima)
  var lm = (licencias || []).find(function(l) {
    return String(l.ID_Usuario) === uid &&
           iso >= isoStr_(l.Fecha_Inicio) &&
           iso <= isoStr_(l.Fecha_Fin);
  });
  if (lm) return { code: 'LM', tipo: 'lm' };

  // 2. Permiso aprobado (FL / FF / ADM) — puede abarcar varios días
  var permiso = solicitudes.find(function(s) {
    return String(s.ID_Solicitante) === uid &&
           String(s.Estado).toUpperCase() === 'APROBADO' &&
           ['FL','FF','ADM'].indexOf(String(s.Tipo_Sol).toUpperCase()) !== -1 &&
           iso >= isoStr_(s.Fecha_Inicio) &&
           iso <= isoStr_(s.Fecha_Fin);
  });
  if (permiso) return { code: String(permiso.Tipo_Sol).toUpperCase(), tipo: 'permiso' };

  // 3. Cambio de turno (sobreescribe la rotación base ese día)
  var cambio = solicitudes.find(function(s) {
    return String(s.ID_Solicitante) === uid &&
           tipoNorm_(s.Tipo_Sol) === 'CAMBIO' &&
           String(s.Estado).toUpperCase() === 'APROBADO' &&
           isoStr_(s.Fecha_Inicio) === iso;
  });
  if (cambio) {
    var tc = String(cambio.Turno_Ausencia || '').toUpperCase();
    return { code: tc === 'NOCHE' ? 'N' : tc === 'DIURNO' ? 'J' : tc === 'LIBRE' ? '' : 'L', tipo: 'base' };
  }

  // 4. Reemplazo (A. Campos / R. Caamaño — asignados por ausencia)
  var reemplazo = solicitudes.find(function(s) {
    return String(s.ID_Solicitante) === uid &&
           tipoNorm_(s.Tipo_Sol) === 'REEMPLAZO' &&
           String(s.Estado).toUpperCase() === 'APROBADO' &&
           isoStr_(s.Fecha_Inicio) === iso;
  });
  if (reemplazo) {
    var tr = String(reemplazo.Turno_Ausencia || '').toUpperCase();
    return { code: tr === 'NOCHE' ? 'N' : tr === 'DIURNO' ? 'J' : 'L', tipo: 'base' };
  }

  // 5. Turno extra (se muestra en amarillo)
  var extra = solicitudes.find(function(s) {
    return String(s.ID_Solicitante) === uid &&
           tipoNorm_(s.Tipo_Sol) === 'TURNO_EXTRA' &&
           String(s.Estado).toUpperCase() === 'APROBADO' &&
           isoStr_(s.Fecha_Inicio) === iso;
  });
  if (extra) {
    var te = String(extra.Turno_Ausencia || '').toUpperCase();
    return { code: te === 'NOCHE' ? 'N' : 'L', tipo: 'extra' };
  }

  // 6. Rotación matemática base (Equipos A/B/C/D)
  var eq = equipoDeUsuario_(u.Turno_Base);
  if (eq && ['A','B','C','D'].indexOf(eq) !== -1) {
    var tt = getTurnoMatematico(fecha, eq);
    return { code: tt === 'Largo' ? 'L' : (tt === 'Noche' ? 'N' : ''), tipo: 'base' };
  }

  // 7. Jornada diurna L–V (Coordinación / Jefatura)
  if (esTurnoDiurno_(u.Turno_Base)) {
    var dw = fecha.getDay();
    return { code: (dw >= 1 && dw <= 5) ? 'J' : '', tipo: 'jornada' };
  }

  return { code: '', tipo: 'libre' };
}

// ============================================
// obtenerDatosMes — datos para el Reporte RRHH
// Devuelve: { anio, mes, cambios[], extras[], reemplazos[] }
// Cada item: { nombre, items:['descripcion...'] }
// ============================================
function obtenerDatosMes(anio, mes) {
  if (!usuarioSesion_()) return { anio: anio, mes: mes, cambios: [], extras: [], reemplazos: [] };
  var solicitudes = obtenerDatosHoja_('SOLICITUDES');
  var usuarios    = obtenerDatosHoja_('USUARIOS');

  var ultimoDia = Utilities.formatDate(new Date(anio, mes, 0, 12, 0, 0), TZ_, 'yyyy-MM-dd');
  // Ventana extendida ~5 días antes (ej: febr. 27 aparece en reporte de marzo)
  var dExt = new Date(anio, mes - 1, -3, 12, 0, 0);
  var primerExt = Utilities.formatDate(dExt, TZ_, 'yyyy-MM-dd');

  function nombreUsuario(id) {
    var u = usuarios.find(function(x) { return String(x.ID_Usuario) === String(id); });
    return u ? String(u.Etiqueta || (u.Nombre + ' ' + u.Apellido)) : id;
  }

  var cMap = {}, eMap = {}, rMap = {};

  solicitudes.forEach(function(s) {
    if (String(s.Estado).toUpperCase() !== 'APROBADO') return;
    var tipo = tipoNorm_(s.Tipo_Sol);
    var key  = String(s.ID_Solicitante);
    var iso  = isoStr_(s.Fecha_Inicio);
    if (iso < primerExt || iso > ultimoDia) return;
    // Sin descripción no se descarta: se muestra la fecha del turno
    var desc = String(s.Nota_Resolucion || s.Motivo || '').trim() ||
               ('Turno ' + (s.Turno_Ausencia || '') + ' del ' + fechaVisual_(s.Fecha_Inicio)).trim();

    if (tipo === 'CAMBIO') {
      if (!cMap[key]) cMap[key] = { nombre: nombreUsuario(key), items: [] };
      cMap[key].items.push(desc);
    } else if (tipo === 'TURNO_EXTRA') {
      if (!eMap[key]) eMap[key] = { nombre: nombreUsuario(key), items: [] };
      eMap[key].items.push(desc);
    } else if (tipo === 'REEMPLAZO') {
      if (!rMap[key]) rMap[key] = { nombre: nombreUsuario(key), items: [] };
      rMap[key].items.push(desc);
    }
  });

  function toArr(m) { return Object.keys(m).map(function(k) { return m[k]; }); }

  return JSON.parse(JSON.stringify({
    anio      : anio,
    mes       : mes,
    cambios   : toArr(cMap),
    extras    : toArr(eMap),
    reemplazos: toArr(rMap)
  }));
}

// ============================================
// isoStr_ — normaliza cualquier valor de fecha a "yyyy-MM-dd"
// Maneja strings, Date objects y serial numbers de Sheets
// ============================================
function isoStr_(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, TZ_, 'yyyy-MM-dd');
  var s = String(val).trim();
  // Si ya viene como yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Si viene como fecha legible "dd/MM/yyyy"
  var partes = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (partes) return partes[3] + '-' + partes[2].padStart(2,'0') + '-' + partes[1].padStart(2,'0');
  // Intentar parse genérico
  var d = new Date(s);
  if (!isNaN(d)) return Utilities.formatDate(d, TZ_, 'yyyy-MM-dd');
  return s.slice(0, 10);
}
