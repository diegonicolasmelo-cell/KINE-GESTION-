// ============================================
// NOTIFICACIONES.GS — Emails institucionales
// KinesioTurno UCI — Hospital San Pablo de Coquimbo
// --------------------------------------------
// Todas las funciones de envío son PRIVADAS (sufijo "_"):
// solo el servidor puede dispararlas — un cliente no puede
// invocarlas vía google.script.run para generar spam.
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

function tipoLegible_(t) { return TIPOS_LEGIBLES[t] || t; }
function buscarSol_(idSol) {
  return obtenerDatosHoja_("SOLICITUDES").find(function(s) { return String(s.ID_Sol) === String(idSol); });
}
function buscarUser_(id) {
  return obtenerDatosHoja_("USUARIOS").find(function(u) { return String(u.ID_Usuario) === String(id); });
}
function fmt_(fecha) {
  if (!fecha) return "-";
  return Utilities.formatDate(new Date(fecha), TZ_, "dd/MM/yyyy");
}

// --------------------------------------------
// PLANTILLA BASE
// --------------------------------------------
function plantillaEmail_(titulo, cuerpoHtml) {
  var hospital = obtenerConfig_("NOMBRE_HOSPITAL") || "Hospital San Pablo de Coquimbo";
  var unidad = obtenerConfig_("NOMBRE_UNIDAD") || "UCI";
  var coordinadora = obtenerConfig_("NOMBRE_COORDINADORA") || "";

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

function fila_(label, valor, alt) {
  return '<tr' + (alt ? ' style="background-color:#f0f4f8;"' : '') + '>' +
    '<td style="padding:8px; font-weight:bold; width:40%;">' + label + '</td>' +
    '<td style="padding:8px;">' + valor + '</td></tr>';
}

// --------------------------------------------
// 1 · Nueva solicitud → Coordinadora
// --------------------------------------------
function emailNuevaSolicitud_(idSol) {
  var s = buscarSol_(idSol);
  if (!s) { Logger.log("emailNuevaSolicitud: solicitud no encontrada " + idSol); return false; }
  var solicitante = buscarUser_(s.ID_Solicitante);
  var emailCoord = obtenerConfig_("EMAIL_COORDINADORA");
  if (!emailCoord) { Logger.log("emailNuevaSolicitud: falta EMAIL_COORDINADORA"); return false; }

  var cuerpo =
    '<p>Se ha recibido una solicitud que requiere tu revisión.</p>' +
    '<table style="width:100%; border-collapse:collapse;">' +
      fila_("Solicitante", (solicitante ? solicitante.Nombre + " " + solicitante.Apellido : "-"), true) +
      fila_("Tipo", tipoLegible_(s.Tipo_Sol), false) +
      fila_("Fecha inicio", fmt_(s.Fecha_Inicio), true) +
      fila_("Fecha fin", fmt_(s.Fecha_Fin), false) +
      fila_("Días solicitados", s.Dias_Solicitados, true) +
      fila_("Motivo", s.Motivo || "Sin motivo indicado", false) +
      fila_("ID Solicitud", idSol, true) +
    '</table>' +
    '<p style="margin-top:20px; color:#666;">Ingresa al sistema para aprobar o rechazar.</p>';

  MailApp.sendEmail({
    to: emailCoord,
    subject: "📋 Nueva solicitud — " + tipoLegible_(s.Tipo_Sol) + " · " + (solicitante ? solicitante.Nombre + " " + solicitante.Apellido : ""),
    htmlBody: plantillaEmail_("📋 Nueva solicitud pendiente", cuerpo)
  });
  return true;
}

// --------------------------------------------
// 2 · Acuse de recibo → Solicitante
// --------------------------------------------
function emailAcuseRecibo_(idSol) {
  var s = buscarSol_(idSol);
  if (!s) return false;
  var solicitante = buscarUser_(s.ID_Solicitante);
  if (!solicitante || !solicitante.Email) return false;

  var cuerpo =
    '<p>Hola <strong>' + solicitante.Nombre + '</strong>,</p>' +
    '<p>Tu solicitud fue recibida y está pendiente de revisión por la coordinadora.</p>' +
    '<table style="width:100%; border-collapse:collapse;">' +
      fila_("ID Solicitud", idSol, true) +
      fila_("Tipo", tipoLegible_(s.Tipo_Sol), false) +
      fila_("Fechas", fmt_(s.Fecha_Inicio) + " al " + fmt_(s.Fecha_Fin), true) +
      fila_("Estado", '<span style="color:#f59e0b; font-weight:bold;">⏳ Pendiente</span>', false) +
    '</table>' +
    '<p style="margin-top:20px; color:#666;">Recibirás otro correo cuando sea resuelta.</p>';

  MailApp.sendEmail({
    to: solicitante.Email,
    subject: "✅ Solicitud recibida — " + tipoLegible_(s.Tipo_Sol) + " · " + fmt_(s.Fecha_Inicio),
    htmlBody: plantillaEmail_("✅ Solicitud recibida", cuerpo)
  });
  return true;
}

// --------------------------------------------
// 3 · Resolución (aprobada / rechazada) → Solicitante
// --------------------------------------------
function emailResolucion_(idSol) {
  var s = buscarSol_(idSol);
  if (!s) return false;
  var solicitante = buscarUser_(s.ID_Solicitante);
  if (!solicitante || !solicitante.Email) return false;
  var aprobador = buscarUser_(s.ID_Aprobador);
  var aprobado = String(s.Estado).toUpperCase() === "APROBADO";

  var estadoHtml = aprobado
    ? '<span style="color:#16a34a; font-weight:bold;">✅ Aprobado</span>'
    : '<span style="color:#dc2626; font-weight:bold;">❌ Rechazado</span>';

  var cuerpo =
    '<p>Hola <strong>' + solicitante.Nombre + '</strong>,</p>' +
    '<p>Tu solicitud ha sido <strong>' + (aprobado ? "aprobada" : "rechazada") + '</strong>.</p>' +
    '<table style="width:100%; border-collapse:collapse;">' +
      fila_("ID Solicitud", idSol, true) +
      fila_("Tipo", tipoLegible_(s.Tipo_Sol), false) +
      fila_("Fechas", fmt_(s.Fecha_Inicio) + " al " + fmt_(s.Fecha_Fin), true) +
      fila_("Estado", estadoHtml, false) +
      fila_("Resuelto por", (aprobador ? aprobador.Nombre + " " + aprobador.Apellido : "Coordinación"), true) +
      fila_((aprobado ? "Nota" : "Motivo rechazo"), (s.Nota_Resolucion || "Sin nota"), false) +
    '</table>';

  MailApp.sendEmail({
    to: solicitante.Email,
    subject: (aprobado ? "✅ Solicitud aprobada" : "❌ Solicitud rechazada") + " — " + tipoLegible_(s.Tipo_Sol),
    htmlBody: plantillaEmail_(aprobado ? "✅ Solicitud aprobada" : "❌ Solicitud rechazada", cuerpo)
  });
  return true;
}

// --------------------------------------------
// 4 · Cambio de turno → Colega receptor (doble confirmación)
// --------------------------------------------
function emailConfirmacionColega_(idSol) {
  var s = buscarSol_(idSol);
  if (!s) return false;
  var solicitante = buscarUser_(s.ID_Solicitante);
  var colega = buscarUser_(s.ID_Reemplazante);
  if (!colega || !colega.Email) return false;

  var cuerpo =
    '<p>Hola <strong>' + colega.Nombre + '</strong>,</p>' +
    '<p><strong>' + (solicitante ? solicitante.Nombre + " " + solicitante.Apellido : "Un colega") +
      '</strong> te propone un cambio de turno y necesita que confirmes si puedes cubrirlo.</p>' +
    '<table style="width:100%; border-collapse:collapse;">' +
      fila_("Turno a cubrir", (s.Turno_Ausencia || "Turno"), true) +
      fila_("Fecha", fmt_(s.Fecha_Inicio), false) +
      fila_("Mensaje", (s.Motivo || "Sin mensaje"), true) +
    '</table>' +
    '<p style="margin-top:20px; color:#666;">Ingresa al sistema, abre <strong>Mis Permisos</strong> y acepta o rechaza la propuesta. ' +
    'Solo si aceptas, la solicitud pasará a revisión de la coordinadora.</p>';

  MailApp.sendEmail({
    to: colega.Email,
    subject: "🔄 Te piden cubrir un turno — " + fmt_(s.Fecha_Inicio),
    htmlBody: plantillaEmail_("🔄 Confirmación de cambio de turno", cuerpo)
  });
  return true;
}

// --------------------------------------------
// PRUEBA (ejecutar desde el editor)
// --------------------------------------------
function probarEmailDirecto() {
  soloPropietario_();
  var miEmail = Session.getActiveUser().getEmail();
  var cuerpo =
    '<p>Hola,</p><p>Email de prueba del sistema KinesioTurno UCI.</p>' +
    '<table style="width:100%; border-collapse:collapse;">' +
      fila_("Hospital", obtenerConfig_("NOMBRE_HOSPITAL") || "-", true) +
      fila_("Unidad", obtenerConfig_("NOMBRE_UNIDAD") || "-", false) +
      fila_("Enviado a", miEmail, true) +
    '</table>';
  MailApp.sendEmail({ to: miEmail, subject: "🧪 Prueba KinesioTurno UCI", htmlBody: plantillaEmail_("🧪 Email de prueba", cuerpo) });
  Logger.log("Email de prueba enviado a: " + miEmail);
}
