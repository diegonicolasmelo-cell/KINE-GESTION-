// ============================================
// UTILS.GS — Motor de Inteligencia y Base
// KinesioTurno UCI — Hospital San Pablo de Coquimbo
// --------------------------------------------
// Lectura de hojas (con caché por request), turno por fórmula,
// helpers de fechas, configuración, feriados y dotación mínima.
//
// CONVENCIÓN DE SEGURIDAD: las funciones que terminan en "_"
// son PRIVADAS del servidor — Apps Script les bloquea la
// invocación remota vía google.script.run. Solo las funciones
// sin sufijo son parte de la API expuesta al cliente.
// ============================================

// --------------------------------------------
// CACHÉ POR INVOCACIÓN
// Cada request de Apps Script es un proceso nuevo, así que la
// caché vive solo durante una llamada — evita releer la misma
// hoja decenas de veces (p. ej. el panel admin).
// --------------------------------------------
var CACHE_HOJAS_ = {};

function invalidarCacheHoja_(nombreHoja) { delete CACHE_HOJAS_[nombreHoja]; }

// --------------------------------------------
// LECTURA GENÉRICA DE HOJAS (cabecera = clave)
// --------------------------------------------
function obtenerDatosHoja_(nombreHoja) {
  if (CACHE_HOJAS_[nombreHoja]) return CACHE_HOJAS_[nombreHoja];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(nombreHoja);
  if (!hoja) return [];
  var datos = hoja.getDataRange().getValues();
  var out = [];
  if (datos.length > 1) {
    var encabezados = datos[0];
    out = datos.slice(1).map(function(fila) {
      var objeto = {};
      encabezados.forEach(function(enc, i) { objeto[enc] = fila[i]; });
      return objeto;
    });
  }
  CACHE_HOJAS_[nombreHoja] = out;
  return out;
}

// Devuelve {hoja, encabezados, datos} listo para escritura por columna-nombre
function abrirHojaEscritura_(nombreHoja) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(nombreHoja);
  if (!hoja) throw new Error("No existe la hoja: " + nombreHoja);
  var datos = hoja.getDataRange().getValues();
  return { hoja: hoja, encabezados: datos[0], datos: datos };
}

// Escribe una fila nueva respetando el orden de las cabeceras.
// valoresPorClave: { NombreColumna: valor, ... }
function appendFilaPorClave_(nombreHoja, valoresPorClave) {
  var info = abrirHojaEscritura_(nombreHoja);
  var fila = info.encabezados.map(function(h) {
    return (valoresPorClave[h] !== undefined) ? valoresPorClave[h] : "";
  });
  info.hoja.appendRow(fila);
  invalidarCacheHoja_(nombreHoja);
}

// Actualiza columnas de la fila cuyo valor en colClave coincide con valorClave.
function actualizarFilaPorClave_(nombreHoja, colClave, valorClave, cambios) {
  var info = abrirHojaEscritura_(nombreHoja);
  var idx = info.encabezados.indexOf(colClave);
  if (idx === -1) return false;
  for (var i = 1; i < info.datos.length; i++) {
    if (String(info.datos[i][idx]) === String(valorClave)) {
      // Escritura en bloque: reescribe la fila completa con los cambios aplicados
      var filaNueva = info.datos[i].slice();
      Object.keys(cambios).forEach(function(col) {
        var c = info.encabezados.indexOf(col);
        if (c !== -1) filaNueva[c] = cambios[col];
      });
      info.hoja.getRange(i + 1, 1, 1, filaNueva.length).setValues([filaNueva]);
      invalidarCacheHoja_(nombreHoja);
      return true;
    }
  }
  return false;
}

// --------------------------------------------
// CONFIGURACIÓN
// --------------------------------------------
function obtenerConfig_(clave) {
  var config = obtenerDatosHoja_("CONFIGURACION");
  var fila = config.find(function(item) { return item.Clave === clave; });
  return fila ? fila.Valor : null;
}

// Configuración numérica con valor por defecto si la hoja no la define.
function obtenerConfigNum_(clave, porDefecto) {
  var v = obtenerConfig_(clave);
  var n = parseInt(v, 10);
  return isNaN(n) ? porDefecto : n;
}

// Dotación mínima de kinesiólogos presentes por tipo de turno.
function dotacionMinima_(tipoTurno) {
  if (String(tipoTurno).toUpperCase() === "NOCHE") {
    return obtenerConfigNum_("DOTACION_MINIMA_NOCHE", 1);
  }
  return obtenerConfigNum_("DOTACION_MINIMA_LARGO", 1);
}

// --------------------------------------------
// NORMALIZACIÓN DE TIPO DE SOLICITUD
// El frontend guarda "CAMBIO_TURNO"; la planilla comparaba contra
// "CAMBIO" y nunca coincidía. Todo el código pasa por aquí ahora.
// --------------------------------------------
function tipoNorm_(t) {
  var s = String(t || "").toUpperCase();
  if (s.indexOf("EXTRA") !== -1) return "TURNO_EXTRA";
  if (s.indexOf("CAMBIO") !== -1) return "CAMBIO";
  if (s.indexOf("REEMPLAZO") !== -1) return "REEMPLAZO";
  return s;
}

// --------------------------------------------
// FERIADOS (hoja FERIADOS: Fecha | Nombre)
// Fuente única para servidor y cliente. Agregar los años
// futuros directamente en la hoja.
// --------------------------------------------
function obtenerFeriados() {
  // Pública: el cliente la usa para pintar el calendario.
  var filas = obtenerDatosHoja_("FERIADOS");
  var map = {};
  filas.forEach(function(f) {
    if (!f.Fecha) return;
    map[fechaISO_(f.Fecha)] = String(f.Nombre || "Feriado");
  });
  return map;
}

// --------------------------------------------
// CÁLCULO DE TURNO POR FÓRMULA (ciclo de 4 días)
// ciclo 0 = Largo · 1 = Noche · 2 y 3 = Libre
// La fecha base se lee de CONFIGURACION (BASE_DATE_ROTACION).
// --------------------------------------------
function baseRotacion_() {
  var v = String(obtenerConfig_("BASE_DATE_ROTACION") || "");
  var m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return new Date(2026, 2, 5, 12, 0, 0);
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 12, 0, 0);
}

function getTurnoMatematico(fechaConsultada, equipo) {
  // Pública: el cliente la usa para "tu turno de mañana" y el form.
  if (!fechaConsultada || !equipo) return "Libre";
  var fechaRef = new Date(fechaConsultada);
  fechaRef.setHours(12, 0, 0, 0);

  var difDias = Math.round((fechaRef - baseRotacion_()) / (1000 * 60 * 60 * 24));

  // toUpperCase ANTES del replace: el cliente envía "Equipo C" tal cual
  var miEq = String(equipo).toUpperCase().replace("EQUIPO", "").trim();
  var offsets = { "A": 0, "B": 1, "C": 2, "D": 3 };
  var offset = (offsets[miEq] !== undefined) ? offsets[miEq] : 0;

  var ciclo = (((difDias - offset) % 4) + 4) % 4;
  if (ciclo === 0) return "Largo";
  if (ciclo === 1) return "Noche";
  return "Libre";
}

// Determina si un Turno_Base corresponde a jornada diurna L-V (no rotativa).
function esTurnoDiurno_(turnoBase) {
  var s = String(turnoBase || "").toUpperCase();
  return s.indexOf("DIURNO") !== -1 || s.indexOf("JEFATURA") !== -1 || s.indexOf("ADMIN") !== -1;
}

// Extrae la letra de equipo (A/B/C/D) desde el Turno_Base.
function equipoDeUsuario_(turnoBase) {
  return String(turnoBase || "").toUpperCase().replace("EQUIPO", "").trim();
}

function obtenerCalendarioHibrido_(anio, mes) {
  var equipos = ["A", "B", "C", "D"];
  var ultimoDia = new Date(anio, mes, 0).getDate();
  var resultado = [];

  for (var dia = 1; dia <= ultimoDia; dia++) {
    var fecha = new Date(anio, mes - 1, dia, 12, 0, 0);
    equipos.forEach(function(eq) {
      var turnoBase = getTurnoMatematico(fecha, eq);
      if (turnoBase !== "Libre") {
        resultado.push({ Fecha: dia, Equipo: eq, Tipo_Turno: turnoBase });
      }
    });
  }
  return JSON.parse(JSON.stringify(resultado));
}

// --------------------------------------------
// HELPERS DE FECHAS
// Zona horaria única en todo el sistema: America/Santiago.
// --------------------------------------------
var TZ_ = "America/Santiago";

// Días hábiles L-V descontando feriados de la hoja FERIADOS.
function calcularDiasHabiles_(inicio, fin) {
  var feriados = obtenerFeriados();
  var d1 = new Date(inicio); d1.setHours(12, 0, 0, 0);
  var d2 = new Date(fin);    d2.setHours(12, 0, 0, 0);
  var count = 0;
  while (d1 <= d2) {
    var day = d1.getDay();
    if (day !== 0 && day !== 6 && !feriados[fechaISO_(d1)]) count++;
    d1.setDate(d1.getDate() + 1);
  }
  return count;
}

function calcularDiasCorridos_(inicio, fin) {
  var d1 = new Date(inicio); d1.setHours(12, 0, 0, 0);
  var d2 = new Date(fin);    d2.setHours(12, 0, 0, 0);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
}

// Devuelve un array de objetos Date (mediodía) entre inicio y fin inclusive.
function rangoDeFechas_(inicio, fin) {
  var d1 = new Date(inicio); d1.setHours(12, 0, 0, 0);
  var d2 = new Date(fin);    d2.setHours(12, 0, 0, 0);
  var out = [];
  while (d1 <= d2) {
    out.push(new Date(d1));
    d1.setDate(d1.getDate() + 1);
  }
  return out;
}

// Normaliza cualquier fecha a string "yyyy-MM-dd" (zona Santiago).
function fechaISO_(fecha) {
  var d = (fecha instanceof Date) ? fecha : new Date(fecha);
  return Utilities.formatDate(d, TZ_, "yyyy-MM-dd");
}

function fechaVisual_(fecha) {
  var d = (fecha instanceof Date) ? fecha : new Date(fecha);
  return Utilities.formatDate(d, TZ_, "dd/MM/yyyy");
}

// ID único: timestamp + sufijo aleatorio (evita colisiones al
// generar varios IDs dentro del mismo milisegundo).
function generarID_(prefijo) {
  return prefijo + "-" + new Date().getTime() + "-" + Math.floor(Math.random() * 100000);
}
