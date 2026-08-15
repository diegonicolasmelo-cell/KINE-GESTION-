// ============================================
// NOTIFICACIONES.GS — Emails institucionales
// KinesioTurno UCI — Hospital San Pablo de Coquimbo
// --------------------------------------------
// Usa los nombres de columna canónicos de la hoja SOLICITUDES:
//   ID_Sol · Tipo_Sol · ID_Solicitante · ID_Reemplazante ·
//   Fecha_Inicio · Fecha_Fin · Dias_Solicitados · Estado ·
//   ID_Aprobador · Fecha_Resolucion · Nota_Resolucion · Motivo
// ============================================

var TIPOS_LEGIBLES = {
  "FL":              "Feriado Legal",
  "FF":              "Feriado Fraccionado",
  "ADM":             "Día Administrativo",
  "CAMBIO_TURNO":    "Cambio de Turno",
  "LICENCIA_MEDICA": "Licencia Médica",
  "CAPACITACION":    "Capacitación",
  "TURNO_EXTRA":     "Turno Extra"
};

function _tipoLegible(t) { return TIPOS_LEGIBLES[t] || t; }
function _buscarSol(idSol) {
  return obtenerDatosHoja("SOLICITUDES").find(function(s) { return String(s.ID_Sol) === String(idSol); });
}
function _buscarUser(id) {
  return obtenerDatosHoja("USUARIOS").find(function(u) { return String(u.ID_Usuario) === String(id); });
}
function _fmt(fecha) {
  if (!fecha) return "-";
  return Utilities.formatDate(new Date(fecha), Session.getScriptTimeZone(), "dd/MM/yyyy");
}

// --------------------------------------------
// PLANTILLA BASE
// --------------------------------------------
function plantillaEmail(titulo, cuerpoHtml) {
  var hospital = obtenerConfig("NOMBRE_HOSPITAL") || "Hospital San Pablo de Coquimbo";
  var unidad = obtenerConfig("NOMBRE_UNIDAD") || "UCI";
  var coordinadora = obtenerConfig("NOMBRE_COORDINADORA") || "";

  return '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">' +
    '<div style="background-color: #2B3674; padding: 20px; text-align: center;">' +
      '<h2 style="color: white; margin: 0;">KinesioTurno UCI</h2>' +
      '<p style="color: #a8c4e0; margin: 5px 0 0 0;">' + hospital + ' · ' + unidad + '</p>' +
    '</div>' +
    '<div style="background-color: #f0f4f8; padding: 15px 20px;">' +
      '<h3 style="color: #2B3674; margin: 0;">' + titulo + '</h3>' +
    '</div>' +
    '<div style="padding: 20px; background-color: #ffffff;">' + cuerpoHtml + '</div>' +
    '<div style="background-color: #f0f4f8; padding: 15px 20px; text-align: center;">' +
      '<p style="color: #666; font-size: 12px; margin: 0;">Mensaje automático del sistema KinesioTurno UCI</p>' +
      '<p style="color: #666; font-size: 12px; margin: 5px 0 0 0;">' + unidad + ' · ' + hospital + '</p>' +
      (coordinadora ? '<p style="color: #666; font-size: 12px; margin: 5px 0 0 0;">Coordinadora: ' + coordinadora + '</p>' : '') +
    '</div>' +
  '</div>';
}

function _fila(label, valor, alt) {
  return '<tr' + (alt ? ' style="background-color:#f0f4f8;"' : '') + '>' +
    '<td style="padding:8px; font-weight:bold; width:40%;">' + label + '</td>' +
    '<td style="padding:8px;">' + valor + '</td></tr>';
}

// --------------------------------------------
// 1 · Nueva solicitud → Coordinadora
// --------------------------------------------
function emailNuevaSolicitud(idSol) {
  var s = _buscarSol(idSol);
  if (!s) { Logger.log("emailNuevaSolicitud: solicitud no encontrada " + idSol); return false; }
  var solicitante = _buscarUser(s.ID_Solicitante);
  var emailCoord = obtenerConfig("EMAIL_COORDINADORA");
  if (!emailCoord) { Logger.log("emailNuevaSolicitud: falta EMAIL_COORDINADORA"); return false; }

  var cuerpo =
    '<p>Se ha recibido una solicitud que requiere tu revisión.</p>' +
    '<table style="width:100%; border-collapse:collapse;">' +
      _fila("Solicitante", (solicitante ? solicitante.Nombre + " " + solicitante.Apellido : "-"), true) +
      _fila("Tipo", _tipoLegible(s.Tipo_Sol), false) +
      _fila("Fecha inicio", _fmt(s.Fecha_Inicio), true) +
      _fila("Fecha fin", _fmt(s.Fecha_Fin), false) +
      _fila("Días solicitados", s.Dias_Solicitados, true) +
      _fila("Motivo", s.Motivo || "Sin motivo indicado", false) +
      _fila("ID Solicitud", idSol, true) +
    '</table>' +
    '<p style="margin-top:20px; color:#666;">Ingresa al sistema para aprobar o rechazar.</p>';

  MailApp.sendEmail({
    to: emailCoord,
    subject: "📋 Nueva solicitud — " + _tipoLegible(s.Tipo_Sol) + " · " + (solicitante ? solicitante.Nombre + " " + solicitante.Apellido : ""),
    htmlBody: plantillaEmail("📋 Nueva solicitud pendiente", cuerpo)
  });
  return true;
}

// --------------------------------------------
// 2 · Acuse de recibo → Solicitante
// --------------------------------------------
function emailAcuseRecibo(idSol) {
  var s = _buscarSol(idSol);
  if (!s) return false;
  var solicitante = _buscarUser(s.ID_Solicitante);
  if (!solicitante || !solicitante.Email) return false;

  var cuerpo =
    '<p>Hola <strong>' + solicitante.Nombre + '</strong>,</p>' +
    '<p>Tu solicitud fue recibida y está pendiente de revisión por la coordinadora.</p>' +
    '<table style="width:100%; border-collapse:collapse;">' +
      _fila("ID Solicitud", idSol, true) +
      _fila("Tipo", _tipoLegible(s.Tipo_Sol), false) +
      _fila("Fechas", _fmt(s.Fecha_Inicio) + " al " + _fmt(s.Fecha_Fin), true) +
      _fila("Estado", '<span style="color:#f59e0b; font-weight:bold;">⏳ Pendiente</span>', false) +
    '</table>' +
    '<p style="margin-top:20px; color:#666;">Recibirás otro correo cuando sea resuelta.</p>';

  MailApp.sendEmail({
    to: solicitante.Email,
    subject: "✅ Solicitud recibida — " + _tipoLegible(s.Tipo_Sol) + " · " + _fmt(s.Fecha_Inicio),
    htmlBody: plantillaEmail("✅ Solicitud recibida", cuerpo)
  });
  return true;
}

// --------------------------------------------
// 3 · Resolución (aprobada / rechazada) → Solicitante
// --------------------------------------------
function emailResolucion(idSol) {
  var s = _buscarSol(idSol);
  if (!s) return false;
  var solicitante = _buscarUser(s.ID_Solicitante);
  if (!solicitante || !solicitante.Email) return false;
  var aprobador = _buscarUser(s.ID_Aprobador);
  var aprobado = String(s.Estado).toUpperCase() === "APROBADO";

  var estadoHtml = aprobado
    ? '<span style="color:#16a34a; font-weight:bold;">✅ Aprobado</span>'
    : '<span style="color:#dc2626; font-weight:bold;">❌ Rechazado</span>';

  var cuerpo =
    '<p>Hola <strong>' + solicitante.Nombre + '</strong>,</p>' +
    '<p>Tu solicitud ha sido <strong>' + (aprobado ? "aprobada" : "rechazada") + '</strong>.</p>' +
    '<table style="width:100%; border-collapse:collapse;">' +
      _fila("ID Solicitud", idSol, true) +
      _fila("Tipo", _tipoLegible(s.Tipo_Sol), false) +
      _fila("Fechas", _fmt(s.Fecha_Inicio) + " al " + _fmt(s.Fecha_Fin), true) +
      _fila("Estado", estadoHtml, false) +
      _fila("Resuelto por", (aprobador ? aprobador.Nombre + " " + aprobador.Apellido : "Coordinación"), true) +
      _fila((aprobado ? "Nota" : "Motivo rechazo"), (s.Nota_Resolucion || "Sin nota"), false) +
    '</table>';

  MailApp.sendEmail({
    to: solicitante.Email,
    subject: (aprobado ? "✅ Solicitud aprobada" : "❌ Solicitud rechazada") + " — " + _tipoLegible(s.Tipo_Sol),
    htmlBody: plantillaEmail(aprobado ? "✅ Solicitud aprobada" : "❌ Solicitud rechazada", cuerpo)
  });
  return true;
}

// --------------------------------------------
// 4 · Cambio de turno → Colega receptor (doble confirmación)
// --------------------------------------------
function emailConfirmacionColega(idSol) {
  var s = _buscarSol(idSol);
  if (!s) return false;
  var solicitante = _buscarUser(s.ID_Solicitante);
  var colega = _buscarUser(s.ID_Reemplazante);
  if (!colega || !colega.Email) return false;

  var cuerpo =
    '<p>Hola <strong>' + colega.Nombre + '</strong>,</p>' +
    '<p><strong>' + (solicitante ? solicitante.Nombre + " " + solicitante.Apellido : "Un colega") +
      '</strong> te propone un cambio de turno y necesita que confirmes si puedes cubrirlo.</p>' +
    '<table style="width:100%; border-collapse:collapse;">' +
      _fila("Turno a cubrir", (s.Turno_Ausencia || "Turno"), true) +
      _fila("Fecha", _fmt(s.Fecha_Inicio), false) +
      _fila("Mensaje", (s.Motivo || "Sin mensaje"), true) +
    '</table>' +
    '<p style="margin-top:20px; color:#666;">Ingresa al sistema, abre <strong>Mis Permisos</strong> y acepta o rechaza la propuesta. ' +
    'Solo si aceptas, la solicitud pasará a revisión de la coordinadora.</p>';

  MailApp.sendEmail({
    to: colega.Email,
    subject: "🔄 Te piden cubrir un turno — " + _fmt(s.Fecha_Inicio),
    htmlBody: plantillaEmail("🔄 Confirmación de cambio de turno", cuerpo)
  });
  return true;
}

// --------------------------------------------
// PRUEBA
// --------------------------------------------
function probarEmailDirecto() {
  var miEmail = Session.getActiveUser().getEmail();
  var cuerpo =
    '<p>Hola,</p><p>Email de prueba del sistema KinesioTurno UCI.</p>' +
    '<table style="width:100%; border-collapse:collapse;">' +
      _fila("Hospital", obtenerConfig("NOMBRE_HOSPITAL") || "-", true) +
      _fila("Unidad", obtenerConfig("NOMBRE_UNIDAD") || "-", false) +
      _fila("Enviado a", miEmail, true) +
    '</table>';
  MailApp.sendEmail({ to: miEmail, subject: "🧪 Prueba KinesioTurno UCI", htmlBody: plantillaEmail("🧪 Email de prueba", cuerpo) });
  Logger.log("Email de prueba enviado a: " + miEmail);
}
