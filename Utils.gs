// ============================================
// UTILS.GS — Motor de Inteligencia y Base
// KinesioTurno UCI — Hospital San Pablo de Coquimbo
// --------------------------------------------
// Lectura de hojas, cálculo de turno por fórmula,
// helpers de fechas, configuración y dotación mínima.
// ============================================

// --------------------------------------------
// LECTURA GENÉRICA DE HOJAS (cabecera = clave)
// --------------------------------------------
function obtenerDatosHoja(nombreHoja) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(nombreHoja);
  if (!hoja) return [];
  var datos = hoja.getDataRange().getValues();
  if (datos.length <= 1) return [];
  var encabezados = datos[0];
  return datos.slice(1).map(function(fila) {
    var objeto = {};
    encabezados.forEach(function(enc, i) { objeto[enc] = fila[i]; });
    return objeto;
  });
}

// Devuelve {hoja, encabezados, datos} listo para escritura por columna-nombre
function abrirHojaEscritura(nombreHoja) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(nombreHoja);
  if (!hoja) throw new Error("No existe la hoja: " + nombreHoja);
  var datos = hoja.getDataRange().getValues();
  return { hoja: hoja, encabezados: datos[0], datos: datos };
}

// Escribe una fila nueva respetando el orden de las cabeceras.
// valoresPorClave: { NombreColumna: valor, ... }
function appendFilaPorClave(nombreHoja, valoresPorClave) {
  var info = abrirHojaEscritura(nombreHoja);
  var fila = info.encabezados.map(function(h) {
    return (valoresPorClave[h] !== undefined) ? valoresPorClave[h] : "";
  });
  info.hoja.appendRow(fila);
}

// Actualiza columnas de la fila cuyo valor en colClave coincide con valorClave.
function actualizarFilaPorClave(nombreHoja, colClave, valorClave, cambios) {
  var info = abrirHojaEscritura(nombreHoja);
  var idx = info.encabezados.indexOf(colClave);
  if (idx === -1) return false;
  for (var i = 1; i < info.datos.length; i++) {
    if (String(info.datos[i][idx]) === String(valorClave)) {
      Object.keys(cambios).forEach(function(col) {
        var c = info.encabezados.indexOf(col);
        if (c !== -1) info.hoja.getRange(i + 1, c + 1).setValue(cambios[col]);
      });
      return true;
    }
  }
  return false;
}

// --------------------------------------------
// CONFIGURACIÓN
// --------------------------------------------
function obtenerConfig(clave) {
  var config = obtenerDatosHoja("CONFIGURACION");
  var fila = config.find(function(item) { return item.Clave === clave; });
  return fila ? fila.Valor : null;
}

// Configuración numérica con valor por defecto si la hoja no la define.
function obtenerConfigNum(clave, porDefecto) {
  var v = obtenerConfig(clave);
  var n = parseInt(v, 10);
  return isNaN(n) ? porDefecto : n;
}

// Dotación mínima de kinesiólogos presentes por tipo de turno.
// Se lee de CONFIGURACION (claves DOTACION_MINIMA_LARGO / DOTACION_MINIMA_NOCHE).
function dotacionMinima(tipoTurno) {
  if (String(tipoTurno).toUpperCase() === "NOCHE") {
    return obtenerConfigNum("DOTACION_MINIMA_NOCHE", 1);
  }
  return obtenerConfigNum("DOTACION_MINIMA_LARGO", 1);
}

// --------------------------------------------
// CÁLCULO DE TURNO POR FÓRMULA (ciclo de 4 días)
// ciclo 0 = Largo · 1 = Noche · 2 y 3 = Libre
// --------------------------------------------
function getTurnoMatematico(fechaConsultada, equipo) {
  if (!fechaConsultada || !equipo) return "Libre";
  var fechaRef = new Date(fechaConsultada);
  fechaRef.setHours(12, 0, 0, 0);

  var BASE_DATE = new Date(2026, 2, 5, 12, 0, 0);
  var difDias = Math.round((fechaRef - BASE_DATE) / (1000 * 60 * 60 * 24));

  var miEq = String(equipo).replace("EQUIPO", "").trim().toUpperCase();
  var offsets = {"A": 0, "B": 1, "C": 2, "D": 3};
  var offset = (offsets[miEq] !== undefined) ? offsets[miEq] : 0;

  var ciclo = (((difDias - offset) % 4) + 4) % 4;
  if (ciclo === 0) return "Largo";
  if (ciclo === 1) return "Noche";
  return "Libre";
}

// Determina si un Turno_Base corresponde a jornada diurna L-V (no rotativa).
function esTurnoDiurno(turnoBase) {
  var s = String(turnoBase || "").toUpperCase();
  return s.indexOf("DIURNO") !== -1 || s.indexOf("JEFATURA") !== -1 || s.indexOf("ADMIN") !== -1;
}

// Extrae la letra de equipo (A/B/C/D) desde el Turno_Base.
function equipoDeUsuario(turnoBase) {
  return String(turnoBase || "").replace(/EQUIPO/i, "").trim().toUpperCase();
}

function obtenerCalendarioHibrido(anio, mes) {
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
// --------------------------------------------
function calcularDiasHabiles(inicio, fin) {
  var d1 = new Date(inicio);
  var d2 = new Date(fin);
  var count = 0;
  while (d1 <= d2) {
    var day = d1.getDay();
    if (day !== 0 && day !== 6) count++;
    d1.setDate(d1.getDate() + 1);
  }
  return count;
}

function calcularDiasCorridos(inicio, fin) {
  var d1 = new Date(inicio);
  var d2 = new Date(fin);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
}

// Devuelve un array de objetos Date (mediodía) entre inicio y fin inclusive.
function rangoDeFechas(inicio, fin) {
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
function fechaISO(fecha) {
  var d = (fecha instanceof Date) ? fecha : new Date(fecha);
  return Utilities.formatDate(d, "America/Santiago", "yyyy-MM-dd");
}

function fechaVisual(fecha) {
  var d = (fecha instanceof Date) ? fecha : new Date(fecha);
  return Utilities.formatDate(d, "America/Santiago", "dd/MM/yyyy");
}

function generarID(prefijo) {
  return prefijo + "-" + new Date().getTime();
}
