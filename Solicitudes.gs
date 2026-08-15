// ============================================
// SOLICITUDES.GS — Gestión completa de permisos
// KinesioTurno UCI — Hospital San Pablo de Coquimbo
// --------------------------------------------
// Incluye el flujo de DOBLE CONFIRMACIÓN del cambio de turno
// y el ANÁLISIS DE COBERTURA / descobertura del equipo.
// ============================================

// --------------------------------------------
// AUTENTICACIÓN / ROLES (versión canónica)
// --------------------------------------------
function buscarUsuarioPorEmail(datos) {
  var email = "";
  try {
    if (typeof datos === "string") email = datos;
    else if (datos && typeof datos === "object") email = datos.email || JSON.stringify(datos);
  } catch (e) { email = String(datos); }
  email = String(email).toLowerCase().trim();
  if (!email) return null;

  var usuarios = obtenerDatosHoja("USUARIOS");
  var user = usuarios.find(function(u) {
    return String(u.Email).toLowerCase().trim() === email;
  });
  if (!user) return null;
  if (String(user.Estado).toUpperCase() !== "ACTIVO") return null;
  return JSON.parse(JSON.stringify(user));
}

function esAprobador(idUsuario) {
  var usuarios = obtenerDatosHoja("USUARIOS");
  var u = usuarios.find(function(user) { return String(user.ID_Usuario) === String(idUsuario); });
  if (!u) return false;
  var rol = String(u.Rol).toUpperCase();
  var esCoord = rol.indexOf("JEFATURA") !== -1 || rol.indexOf("COORDINADOR") !== -1;
  var esSubrogante = (u.Es_Subrogante_Activo === "TRUE" || u.Es_Subrogante_Activo === true);
  return esCoord || esSubrogante;
}

// --------------------------------------------
// CALENDARIO Y LISTAS
// --------------------------------------------
function obtenerTurnosMesSeguro(anio, mes) {
  return obtenerCalendarioHibrido(anio, mes);
}

function obtenerListaKines() {
  var usuarios = obtenerDatosHoja("USUARIOS");
  return JSON.parse(JSON.stringify(
    usuarios.filter(function(u) { return String(u.Estado).toUpperCase() === "ACTIVO"; })
  ));
}

// --------------------------------------------
// VALIDACIÓN DE SALDOS
// --------------------------------------------
function validarSolicitud(datos) {
  var usuarios = obtenerDatosHoja("USUARIOS");
  var solicitante = usuarios.find(function(u) { return String(u.ID_Usuario) === String(datos.idUsuario); });
  if (!solicitante) return { valido: false, mensaje: "Usuario no encontrado" };

  if (datos.tipo === "FL") {
    var diasFL = calcularDiasHabiles(datos.fechaInicio, datos.fechaFin);
    var saldoFL = parseInt(solicitante.FL_Disponibles) || 0;
    if (saldoFL < diasFL) return { valido: false, mensaje: "No tienes suficientes FL. Disp: " + saldoFL + ". Solicitados: " + diasFL };
  }
  if (datos.tipo === "FF") {
    var diasFF = calcularDiasHabiles(datos.fechaInicio, datos.fechaFin);
    var saldoFF = parseInt(solicitante.FF_Disponibles) || 0;
    if (saldoFF < diasFF) return { valido: false, mensaje: "No tienes suficientes FF. Disp: " + saldoFF + ". Solicitados: " + diasFF };
  }
  if (datos.tipo === "ADM") {
    var diasADM = calcularDiasCorridos(datos.fechaInicio, datos.fechaFin);
    var saldoADM = parseInt(solicitante.ADM_Disponibles) || 0;
    if (saldoADM < diasADM) return { valido: false, mensaje: "No tienes suficientes ADM. Disp: " + saldoADM + ". Solicitados: " + diasADM };
  }
  return { valido: true, mensaje: "Solicitud válida" };
}

// --------------------------------------------
// CREAR SOLICITUD
// Un CAMBIO_TURNO entra como "Pendiente Colega": primero debe
// aceptarlo el colega receptor y recién luego llega a la coordinadora.
// --------------------------------------------
function crearSolicitud(datos) {
  var validacion = validarSolicitud(datos);
  if (!validacion.valido) return { exito: false, mensaje: validacion.mensaje };

  var idSolicitud = generarID("SOL");
  var esCambio = String(datos.tipo).toUpperCase().indexOf("CAMBIO") !== -1;
  var estadoInicial = (esCambio && datos.idReemplazo) ? "Pendiente Colega" : "Pendiente";

  var diasCalc = (datos.tipo === "FL" || datos.tipo === "FF")
    ? calcularDiasHabiles(datos.fechaInicio, datos.fechaFin)
    : calcularDiasCorridos(datos.fechaInicio, datos.fechaFin);

  appendFilaPorClave("SOLICITUDES", {
    ID_Sol: idSolicitud,
    Fecha_Solicitud: new Date(),
    ID_Solicitante: datos.idUsuario,
    Tipo_Sol: datos.tipo,
    Fecha_Inicio: datos.fechaInicio,
    Fecha_Fin: datos.fechaFin,
    Dias_Solicitados: diasCalc,
    ID_Reemplazante: datos.idReemplazo || "",
    Motivo: datos.motivo || "",
    Estado: estadoInicial,
    Turno_Ausencia: datos.turno || "Largo"
  });

  // Notificaciones (no bloqueantes)
  try {
    if (estadoInicial === "Pendiente Colega") {
      if (typeof emailConfirmacionColega === "function") emailConfirmacionColega(idSolicitud);
    } else {
      if (typeof emailNuevaSolicitud === "function") emailNuevaSolicitud(idSolicitud);
      if (typeof emailAcuseRecibo === "function") emailAcuseRecibo(idSolicitud);
    }
  } catch (e) { Logger.log("Aviso notificación: " + e.message); }

  var msg = estadoInicial === "Pendiente Colega"
    ? "Propuesta enviada. Espera la confirmación de tu colega."
    : "Solicitud creada correctamente.";
  return { exito: true, mensaje: msg, idSolicitud: idSolicitud };
}

function obtenerMisSolicitudes(idUsuario) {
  try {
    var solicitudes = obtenerDatosHoja("SOLICITUDES");
    var misSol = solicitudes.filter(function(s) { return String(s.ID_Solicitante) === String(idUsuario); });
    return JSON.parse(JSON.stringify(misSol.reverse()));
  } catch (e) { return []; }
}

// --------------------------------------------
// DOBLE CONFIRMACIÓN DEL CAMBIO DE TURNO
// --------------------------------------------
// Solicitudes en las que ESTE usuario es el colega receptor
// y aún debe aceptar/rechazar cubrir el turno.
function obtenerConfirmacionesPendientes(idUsuario) {
  var solicitudes = obtenerDatosHoja("SOLICITUDES");
  var usuarios = obtenerDatosHoja("USUARIOS");
  var pendientes = solicitudes.filter(function(s) {
    return String(s.ID_Reemplazante) === String(idUsuario) &&
           String(s.Estado).trim().toLowerCase() === "pendiente colega";
  });
  var out = pendientes.map(function(s) {
    var u = usuarios.find(function(user) { return String(user.ID_Usuario) === String(s.ID_Solicitante); });
    return {
      ID_Sol: s.ID_Sol,
      Solicitante: u ? (u.Nombre + " " + u.Apellido) : "Colega",
      Turno_Ausencia: s.Turno_Ausencia || "turno",
      Fecha_Inicio: s.Fecha_Inicio,
      Motivo: s.Motivo
    };
  });
  return JSON.parse(JSON.stringify(out));
}

// El colega acepta (→ pasa a "Pendiente" de la coordinadora) o rechaza (→ "Rechazado Colega").
function responderCambioColega(idSol, idUsuario, acepta, motivo) {
  var solicitudes = obtenerDatosHoja("SOLICITUDES");
  var sol = solicitudes.find(function(s) { return String(s.ID_Sol) === String(idSol); });
  if (!sol) return { exito: false, mensaje: "Solicitud no encontrada." };
  if (String(sol.ID_Reemplazante) !== String(idUsuario)) {
    return { exito: false, mensaje: "Esta solicitud no está dirigida a ti." };
  }
  if (String(sol.Estado).trim().toLowerCase() !== "pendiente colega") {
    return { exito: false, mensaje: "Esta solicitud ya fue respondida." };
  }

  if (acepta) {
    actualizarFilaPorClave("SOLICITUDES", "ID_Sol", idSol, { Estado: "Pendiente" });
    try {
      if (typeof emailNuevaSolicitud === "function") emailNuevaSolicitud(idSol);
      if (typeof emailAcuseRecibo === "function") emailAcuseRecibo(idSol);
    } catch (e) { Logger.log("Aviso notificación: " + e.message); }
    return { exito: true, mensaje: "Aceptaste cubrir el turno. La solicitud pasó a revisión de la coordinadora." };
  } else {
    actualizarFilaPorClave("SOLICITUDES", "ID_Sol", idSol, {
      Estado: "Rechazado Colega",
      Nota_Resolucion: motivo || "El colega no puede cubrir el turno.",
      Fecha_Resolucion: new Date()
    });
    return { exito: true, mensaje: "Rechazaste cubrir el turno. La solicitud no continúa." };
  }
}

// --------------------------------------------
// ANÁLISIS DE COBERTURA / DESCOBERTURA
// --------------------------------------------
function analizarCoberturaSolicitud(idSol) {
  var solicitudes = obtenerDatosHoja("SOLICITUDES");
  var usuarios = obtenerDatosHoja("USUARIOS");
  var vacantes = obtenerDatosHoja("VACANTES");

  var sol = solicitudes.find(function(s) { return String(s.ID_Sol) === String(idSol); });
  if (!sol) return { cubierto: false, nota: "Solicitud no encontrada." };
  var solicitante = usuarios.find(function(u) { return String(u.ID_Usuario) === String(sol.ID_Solicitante); });
  if (!solicitante) return { cubierto: false, nota: "Solicitante no encontrado." };

  // Cambio de turno con colega → cubierto por trueque
  if (String(sol.Tipo_Sol).toUpperCase().indexOf("CAMBIO") !== -1 && sol.ID_Reemplazante) {
    var r = usuarios.find(function(u) { return String(u.ID_Usuario) === String(sol.ID_Reemplazante); });
    return { cubierto: true, reemplazante: r ? (r.Nombre + " " + r.Apellido) : "Colega asignado" };
  }

  // Jornada diurna L-V → no afecta la rotación
  if (esTurnoDiurno(solicitante.Turno_Base)) {
    return { cubierto: false, dias: [], nota: "Jornada administrativa L-V: no afecta la rotación de turnos del equipo." };
  }

  var equipo = equipoDeUsuario(solicitante.Turno_Base);
  var teamSize = usuarios.filter(function(u) {
    return String(u.Estado).toUpperCase() === "ACTIVO" &&
           !esTurnoDiurno(u.Turno_Base) &&
           equipoDeUsuario(u.Turno_Base) === equipo;
  }).length;

  var fechas = rangoDeFechas(sol.Fecha_Inicio, sol.Fecha_Fin);
  var dias = [];
  var algunRiesgo = false;

  fechas.forEach(function(f) {
    var turno = getTurnoMatematico(f, equipo);
    if (turno === "Libre") return;
    var iso = fechaISO(f);
    var min = dotacionMinima(turno);
    var ausentes = _contarAusenciasEquipo(solicitudes, usuarios, equipo, iso, idSol);
    var vacAbiertas = vacantes.filter(function(v) {
      return String(v.Equipo).toUpperCase() === equipo &&
             fechaISO(v.Fecha) === iso &&
             String(v.Turno).toUpperCase() === turno.toUpperCase() &&
             String(v.Estado).toUpperCase() === "ABIERTA";
    }).length;

    var presentes = teamSize - ausentes - vacAbiertas - 1; // -1 = este solicitante
    if (presentes < 0) presentes = 0;
    var riesgo = presentes < min;
    if (riesgo) algunRiesgo = true;
    dias.push({ fechaVisual: fechaVisual(f), turno: turno, presentes: presentes, minimo: min, riesgo: riesgo });
  });

  return { ok: !algunRiesgo, equipo: equipo, minimo: dotacionMinima("Largo"), dias: dias };
}

// Cuenta ausencias aprobadas de un equipo que cubren una fecha (excluyendo la solicitud analizada).
function _contarAusenciasEquipo(solicitudes, usuarios, equipo, iso, excluirIdSol) {
  var byId = {};
  usuarios.forEach(function(u) { byId[String(u.ID_Usuario)] = u; });
  var count = 0;
  solicitudes.forEach(function(s) {
    if (String(s.ID_Sol) === String(excluirIdSol)) return;
    if (String(s.Estado).toUpperCase() !== "APROBADO") return;
    var tipo = String(s.Tipo_Sol).toUpperCase();
    if (tipo.indexOf("EXTRA") !== -1) return;                 // los extra suman, no restan
    if (tipo.indexOf("CAMBIO") !== -1 && s.ID_Reemplazante) return; // cambio cubierto no resta
    var u = byId[String(s.ID_Solicitante)];
    if (!u || equipoDeUsuario(u.Turno_Base) !== equipo) return;
    var fi = fechaISO(s.Fecha_Inicio), ff = fechaISO(s.Fecha_Fin);
    if (iso >= fi && iso <= ff) count++;
  });
  return count;
}

// --------------------------------------------
// CONSOLIDADO DE UNIDAD (cambios + turnos extra aprobados)
// --------------------------------------------
function obtenerConsolidadoTurnos() {
  var solicitudes = obtenerDatosHoja("SOLICITUDES");
  var usuarios = obtenerDatosHoja("USUARIOS");
  var filtradas = solicitudes.filter(function(s) {
    var tipo = String(s.Tipo_Sol).toUpperCase();
    return (tipo.indexOf("CAMBIO") !== -1 || tipo.indexOf("EXTRA") !== -1) &&
           String(s.Estado).trim().toUpperCase() === "APROBADO";
  });
  var resultado = filtradas.map(function(s) {
    var u = usuarios.find(function(user) { return String(user.ID_Usuario) === String(s.ID_Solicitante); });
    return {
      ID: s.ID_Sol,
      Kinesiologo: u ? (u.Nombre + " " + u.Apellido) : "Desconocido",
      Tipo: s.Tipo_Sol,
      Fecha_Inicio: s.Fecha_Inicio,
      Detalle: s.ID_Reemplazante || s.Motivo || "-"
    };
  });
  return JSON.parse(JSON.stringify(resultado.sort(function(a, b) {
    return new Date(b.Fecha_Inicio) - new Date(a.Fecha_Inicio);
  })));
}

// --------------------------------------------
// PANEL ADMIN — solo "Pendiente" (no "Pendiente Colega"),
// con bandera de cobertura por solicitud.
// --------------------------------------------
function obtenerSolicitudesAdmin(idAprobador) {
  if (!esAprobador(idAprobador)) return [];
  var solicitudes = obtenerDatosHoja("SOLICITUDES");
  var usuarios = obtenerDatosHoja("USUARIOS");
  var pendientes = solicitudes.filter(function(s) {
    return String(s.Estado).trim().toUpperCase() === "PENDIENTE";
  });

  var resultado = pendientes.map(function(s) {
    var u = usuarios.find(function(user) { return String(user.ID_Usuario) === String(s.ID_Solicitante); });
    var cob = analizarCoberturaSolicitud(s.ID_Sol);
    var riesgo = !!(cob.dias && cob.dias.some(function(d) { return d.riesgo; }));
    return {
      ID_Sol: s.ID_Sol,
      Solicitante: u ? (u.Nombre + " " + u.Apellido) : "Desconocido",
      Tipo_Sol: s.Tipo_Sol,
      Fecha_Inicio: s.Fecha_Inicio,
      Fecha_Fin: s.Fecha_Fin,
      Dias: s.Dias_Solicitados,
      Motivo: s.Motivo,
      Cubierto: !!cob.cubierto,
      Riesgo: riesgo
    };
  });
  return JSON.parse(JSON.stringify(resultado));
}

function obtenerDetallesAprobacion(idSolicitud) {
  var solicitudes = obtenerDatosHoja("SOLICITUDES");
  var usuarios = obtenerDatosHoja("USUARIOS");
  var sol = solicitudes.find(function(s) { return String(s.ID_Sol) === String(idSolicitud); });
  if (!sol) return { exito: false };

  var esCambio = (String(sol.Tipo_Sol).toUpperCase().indexOf("CAMBIO") !== -1);
  var reemplazo = usuarios.find(function(u) { return String(u.ID_Usuario) === String(sol.ID_Reemplazante); });

  // Solo pedimos confirmar quién cubre cuando es un cambio de turno.
  if (!esCambio) return { exito: true, esCambio: false, turnosPerdidos: [] };

  var fechaEx = new Date(sol.Fecha_Inicio);
  fechaEx.setHours(12, 0, 0, 0);
  return {
    exito: true,
    esCambio: true,
    turnosPerdidos: [{
      fechaStr: fechaISO(fechaEx),
      fechaVisual: fechaVisual(fechaEx),
      tipo: sol.Turno_Ausencia || "Turno",
      sugerencias: [{
        id: sol.ID_Reemplazante,
        nombre: reemplazo ? (reemplazo.Nombre + " " + reemplazo.Apellido) : "Colega seleccionado"
      }]
    }]
  };
}

// --------------------------------------------
// RECHAZAR / APROBAR
// --------------------------------------------
function rechazarSolicitud(idSolicitud, idAprobador, motivo) {
  if (!esAprobador(idAprobador)) return { exito: false, mensaje: "No tienes permisos." };
  var ok = actualizarFilaPorClave("SOLICITUDES", "ID_Sol", idSolicitud, {
    Estado: "Rechazado",
    Fecha_Resolucion: new Date(),
    ID_Aprobador: idAprobador,
    Nota_Resolucion: motivo || ""
  });
  if (!ok) return { exito: false, mensaje: "Solicitud no encontrada." };
  try { if (typeof emailResolucion === "function") emailResolucion(idSolicitud); } catch (e) { Logger.log(e.message); }
  return { exito: true, mensaje: "Solicitud rechazada ❌" };
}

function aprobarSolicitudMulti(idSolicitud, idAprobador, nota, asignaciones) {
  if (!esAprobador(idAprobador)) return { exito: false, mensaje: "No tienes permisos." };

  var solicitudes = obtenerDatosHoja("SOLICITUDES");
  var sol = solicitudes.find(function(s) { return String(s.ID_Sol) === String(idSolicitud); });
  if (!sol) return { exito: false, mensaje: "Solicitud no encontrada." };

  var ok = actualizarFilaPorClave("SOLICITUDES", "ID_Sol", idSolicitud, {
    Estado: "Aprobado",
    Fecha_Resolucion: new Date(),
    ID_Aprobador: idAprobador,
    Nota_Resolucion: nota || ""
  });
  if (!ok) return { exito: false, mensaje: "Solicitud no encontrada." };

  // Descontar saldos del solicitante según el tipo
  try { _descontarSaldo(sol); } catch (e) { Logger.log("Aviso saldo: " + e.message); }

  // Registrar el turno extra del reemplazante (para el consolidado)
  try {
    if (asignaciones && asignaciones.length) {
      asignaciones.forEach(function(a) {
        if (!a.idReemplazo) return;
        appendFilaPorClave("SOLICITUDES", {
          ID_Sol: generarID("EXT"),
          Fecha_Solicitud: new Date(),
          ID_Solicitante: a.idReemplazo,
          Tipo_Sol: "TURNO_EXTRA",
          Fecha_Inicio: a.fecha,
          Fecha_Fin: a.fecha,
          Dias_Solicitados: 1,
          ID_Reemplazante: sol.ID_Solicitante,
          Motivo: "Cubre turno " + (a.tipo || "") + " de solicitud " + idSolicitud,
          Estado: "Aprobado",
          Turno_Ausencia: a.tipo || "",
          Fecha_Resolucion: new Date(),
          ID_Aprobador: idAprobador
        });
      });
    }
  } catch (e) { Logger.log("Aviso turno extra: " + e.message); }

  try { if (typeof emailResolucion === "function") emailResolucion(idSolicitud); } catch (e) { Logger.log(e.message); }
  return { exito: true, mensaje: "Solicitud aprobada ✅" };
}

// Descuenta FL / FF / ADM del solicitante al aprobar.
function _descontarSaldo(sol) {
  var tipo = String(sol.Tipo_Sol).toUpperCase();
  var col = null;
  if (tipo === "FL") col = "FL_Disponibles";
  else if (tipo === "FF") col = "FF_Disponibles";
  else if (tipo === "ADM") col = "ADM_Disponibles";
  if (!col) return;

  var usuarios = obtenerDatosHoja("USUARIOS");
  var u = usuarios.find(function(x) { return String(x.ID_Usuario) === String(sol.ID_Solicitante); });
  if (!u) return;
  var actual = parseInt(u[col], 10) || 0;
  var dias = parseInt(sol.Dias_Solicitados, 10) || 0;
  var nuevo = Math.max(0, actual - dias);
  var cambios = {}; cambios[col] = nuevo;
  actualizarFilaPorClave("USUARIOS", "ID_Usuario", sol.ID_Solicitante, cambios);
}
