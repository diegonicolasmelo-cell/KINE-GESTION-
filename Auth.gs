// ============================================
// AUTH.GS — Punto de entrada, inclusión y sesión
// KinesioTurno UCI — Hospital San Pablo de Coquimbo
// --------------------------------------------
// NOTA: buscarUsuarioPorEmail() y esAprobador() viven en
// Solicitudes.gs (versión canónica). No las dupliques aquí.
// ============================================

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('KinesioTurno UCI')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function incluir(nombreArchivo) {
  return HtmlService.createHtmlOutputFromFile(nombreArchivo).getContent();
}

// Usuario logueado por sesión de Google (cuando se accede con la cuenta institucional).
function obtenerUsuarioActual() {
  var email = Session.getActiveUser().getEmail();
  if (!email) email = Session.getEffectiveUser().getEmail();
  if (!email) return null;

  var usuarios = obtenerDatosHoja("USUARIOS");
  var usuario = usuarios.find(function(u) {
    return String(u.Email).toLowerCase().trim() === email.toLowerCase().trim();
  });

  if (!usuario) {
    Logger.log("ACCESO DENEGADO: Email no registrado → " + email);
    return null;
  }
  if (String(usuario.Estado).toUpperCase() !== "ACTIVO") {
    Logger.log("ACCESO DENEGADO: Usuario inactivo → " + email);
    return null;
  }
  return JSON.parse(JSON.stringify(usuario));
}

// Rol mostrado al usuario (considera subrogancia activa).
function obtenerRolEfectivo(idUsuario) {
  var usuarios = obtenerDatosHoja("USUARIOS");
  var usuario = usuarios.find(function(u) { return String(u.ID_Usuario) === String(idUsuario); });
  if (!usuario) return "Desconocido";
  if (usuario.Es_Subrogante_Activo === "TRUE" || usuario.Es_Subrogante_Activo === true) {
    return "Coordinadora Subrogante";
  }
  return usuario.Rol;
}

// --------------------------------------------
// DIAGNÓSTICO
// --------------------------------------------
function probarBusqueda() {
  var resultado = buscarUsuarioPorEmail("diegonicolas.melo@gmail.com");
  Logger.log("Resultado: " + JSON.stringify(resultado));
}
