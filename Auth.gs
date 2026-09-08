// ============================================
// AUTH.GS — Punto de entrada, sesión e identidad
// KinesioTurno UCI — Hospital San Pablo de Coquimbo
// --------------------------------------------
// TODA la identidad se deriva en el servidor con
// Session.getActiveUser(). Ninguna función sensible acepta
// el ID de usuario desde el cliente.
// ============================================

function doGet(e) {
  // ALLOWALL es necesario para el envoltorio PWA (carpeta /pwa): la app
  // se embebe en un iframe servido desde otro origen (GitHub Pages), y
  // DEFAULT solo permite el mismo dominio.
  //
  // Contrapartida aceptada: al permitir el embebido queda abierta la
  // puerta al clickjacking. El riesgo es acotado porque toda acción
  // sensible exige sesión Google válida y rol verificado en el servidor,
  // y aprobar/rechazar pasa por un modal de confirmación explícito.
  // Si algún día dejas de usar la PWA, vuelve a DEFAULT.
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('KinesioTurno UCI')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function incluir(nombreArchivo) {
  return HtmlService.createHtmlOutputFromFile(nombreArchivo).getContent();
}

// --------------------------------------------
// IDENTIDAD DE SESIÓN (privadas — no llamables desde el cliente)
// --------------------------------------------

// Usuario ACTIVO de la sesión de Google, o null.
// OJO: sin fallback a getEffectiveUser() — con "ejecutar como yo"
// ese fallback devolvía el email del propietario del script y
// logueaba a cualquier visitante como el dueño.
function usuarioSesion_() {
  var email = Session.getActiveUser().getEmail();
  if (!email) return null;
  return buscarUsuarioPorEmail_(email);
}

// Usuario de sesión solo si además es aprobador; null en caso contrario.
function aprobadorSesion_() {
  var u = usuarioSesion_();
  if (!u || !esAprobadorId_(u.ID_Usuario)) return null;
  return u;
}

// --------------------------------------------
// API PÚBLICA (cliente)
// --------------------------------------------

// Login automático al cargar la página. Devuelve el email
// detectado cuando falla, para que la pantalla de error diga
// exactamente con qué cuenta llegó el usuario.
function autoLogin() {
  var email = Session.getActiveUser().getEmail();
  if (!email) {
    return { ok: false, motivo: "SIN_SESION", email: "" };
  }
  var u = buscarUsuarioPorEmail_(email);
  if (!u) {
    Logger.log("ACCESO DENEGADO: email no registrado o inactivo → " + email);
    return { ok: false, motivo: "NO_REGISTRADO", email: email };
  }
  return { ok: true, usuario: JSON.parse(JSON.stringify(u)) };
}

// ¿El usuario de la sesión actual es aprobador? (para mostrar el panel admin)
function esAprobadorActual() {
  var u = usuarioSesion_();
  return !!(u && esAprobadorId_(u.ID_Usuario));
}

// Rol mostrado al usuario de la sesión (considera subrogancia activa).
function obtenerRolEfectivo() {
  var u = usuarioSesion_();
  if (!u) return "Desconocido";
  if (u.Es_Subrogante_Activo === "TRUE" || u.Es_Subrogante_Activo === true) {
    return "Coordinadora Subrogante";
  }
  return u.Rol;
}

// --------------------------------------------
// GUARDIA PARA FUNCIONES DE MANTENIMIENTO
// Solo el propietario del script, desde el editor.
// --------------------------------------------
function soloPropietario_() {
  var activo = Session.getActiveUser().getEmail();
  var efectivo = Session.getEffectiveUser().getEmail();
  if (!activo || activo !== efectivo) {
    throw new Error("Solo el propietario puede ejecutar esta función desde el editor de Apps Script.");
  }
}

// --------------------------------------------
// DIAGNÓSTICO (ejecutar desde el editor)
// --------------------------------------------
function probarBusqueda() {
  soloPropietario_();
  var email = Session.getActiveUser().getEmail();
  var resultado = buscarUsuarioPorEmail_(email);
  Logger.log("Sesión: " + email);
  Logger.log("Resultado: " + JSON.stringify(resultado));
}
