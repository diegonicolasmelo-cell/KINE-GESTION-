// ============================================
// SOLICITUDES.GS — Gestión completa de permisos
// KinesioTurno UCI — Hospital San Pablo de Coquimbo
// --------------------------------------------
// Incluye el flujo de DOBLE CONFIRMACIÓN del cambio de turno
// y el ANÁLISIS DE COBERTURA / descobertura del equipo.
//
// Seguridad: la identidad SIEMPRE sale de usuarioSesion_() /
// aprobadorSesion_() (Auth.gs). Ninguna función acepta el ID
// del usuario desde el cliente.
// ============================================

// --------------------------------------------
// BÚSQUEDA / ROLES (privadas)
// --------------------------------------------
function buscarUsuarioPorEmail_(email) {
  email = String(email || "").toLowerCase().trim();
  if (!email) return null;
  var usuarios = obtenerDatosHoja_("USUARIOS");
  var user = usuarios.find(function(u) {
    return String(u.Email).toLowerCase().trim() === email;
  });
  if (!user) return null;
  if (String(user.Estado).toUpperCase() !== "ACTIVO") return null;
  return JSON.parse(JSON.stringify(user));
}

function esAprobadorId_(idUsuario) {
  var usuarios = obtenerDatosHoja_("USUARIOS");
  var u = usuarios.find(function(user) { return String(user.ID_Usuario) === String(idUsuario); });
  if (!u) return false;
  var rol = String(u.Rol).toUpperCase();
  var esCoord = rol.indexOf("JEFATURA") !== -1 || rol.indexOf("COORDINADOR") !== -1;
  var esSubrogante = (u.Es_Subrogante_Activo === "TRUE" || u.Es_Subrogante_Activo === true);
  return esCoord || esSubrogante;
}

// --------------------------------------------
// CALENDARIO Y LISTAS (públicas, requieren sesión)
// --------------------------------------------
function obtenerTurnosMesSeguro(anio, mes) {
  if (!usuarioSesion_()) return [];
  return obtenerCalendarioHibrido_(anio, mes);
}

// Lista de colegas activos — SOLO los campos que la UI necesita
// (nada de RUT, emails ni saldos de terceros).
function obtenerListaKines() {
  if (!usuarioSesion_()) return [];
  var usuarios = obtenerDatosHoja_("USUARIOS");
  var activos = usuarios
    .filter(function(u) { return String(u.Estado).toUpperCase() === "ACTIVO"; })
    .map(function(u) {
      return {
        ID_Usuario: u.ID_Usuario,
        Nombre: u.Nombre,
        Apellido: u.Apellido,
        Turno_Base: u.Turno_Base
      };
    });
  return JSON.parse(JSON.stringify(activos));
}

// --------------------------------------------
// VALIDACIÓN DE SALDOS (privada)
// --------------------------------------------
function validarSolicitud_(solicitante, datos) {
  if (datos.tipo === "FL" || datos.tipo === "FF") {
    var dias = calcularDiasHabiles_(datos.fechaInicio, datos.fechaFin);
    var col = datos.tipo + "_Disponibles";
    var saldo = parseInt(solicitante[col], 10) || 0;
    if (saldo < dias) {
      return { valido: false, mensaje: "No tienes suficientes " + datos.tipo + ". Disp: " + saldo + ". Solicitados: " + dias };
    }
  }
  if (datos.tipo === "ADM") {
    var diasADM = calcularDiasCorridos_(datos.fechaInicio, datos.fechaFin);
    var saldoADM = parseInt(solicitante.ADM_Disponibles, 10) || 0;
    if (saldoADM < diasADM) {
      return { valido: false, mensaje: "No tienes suficientes ADM. Disp: " + saldoADM + ". Solicitados: " + diasADM };
    }
  }
  return { valido: true, mensaje: "Solicitud válida" };
}

// --------------------------------------------
// CREAR SOLICITUD (el solicitante es el usuario de la sesión)
// Un CAMBIO_TURNO entra como "Pendiente Colega": primero debe
// aceptarlo el colega receptor y recién luego llega a la coordinadora.
// --------------------------------------------
function crearSolicitud(datos) {
  var yo = usuarioSesion_();
  if (!yo) return { exito: false, mensaje: "Sesión no válida. Recarga la página." };
  if (!datos || !datos.fechaInicio || !datos.fechaFin) {
    return { exito: false, mensaje: "Completa las fechas." };
  }
  if (new Date(datos.fechaFin) < new Date(datos.fechaInicio)) {
    return { exito: false, mensaje: "La fecha de fin no puede ser anterior al inicio." };
  }

  var validacion = validarSolicitud_(yo, datos);
  if (!validacion.valido) return { exito: false, mensaje: validacion.mensaje };

  var esCambio = tipoNorm_(datos.tipo) === "CAMBIO";
  if (esCambio) {
    if (!datos.idReemplazo) return { exito: false, mensaje: "Selecciona un colega para el trueque." };
    if (String(datos.idReemplazo) === String(yo.ID_Usuario)) {
      return { exito: false, mensaje: "No puedes proponerte a ti mismo como reemplazo." };
    }
    var usuarios = obtenerDatosHoja_("USUARIOS");
    var receptor = usuarios.find(function(u) {
      return String(u.ID_Usuario) === String(datos.idReemplazo) &&
             String(u.Estado).toUpperCase() === "ACTIVO";
    });
    if (!receptor) return { exito: false, mensaje: "El colega seleccionado no está activo." };
  }

  var idSolicitud = generarID_("SOL");
  var estadoInicial = (esCambio && datos.idReemplazo) ? "Pendiente Colega" : "Pendiente";

  var diasCalc = (datos.tipo === "FL" || datos.tipo === "FF")
    ? calcularDiasHabiles_(datos.fechaInicio, datos.fechaFin)
    : calcularDiasCorridos_(datos.fechaInicio, datos.fechaFin);

  appendFilaPorClave_("SOLICITUDES", {
    ID_Sol: idSolicitud,
    Fecha_Solicitud: new Date(),
    ID_Solicitante: yo.ID_Usuario,
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
      emailConfirmacionColega_(idSolicitud);
    } else {
      emailNuevaSolicitud_(idSolicitud);
      emailAcuseRecibo_(idSolicitud);
    }
  } catch (e) { Logger.log("Aviso notificación: " + e.message); }

  var msg = estadoInicial === "Pendiente Colega"
    ? "Propuesta enviada. Espera la confirmación de tu colega."
    : "Solicitud creada correctamente.";
  return { exito: true, mensaje: msg, idSolicitud: idSolicitud };
}

function obtenerMisSolicitudes() {
  var yo = usuarioSesion_();
  if (!yo) return [];
  var solicitudes = obtenerDatosHoja_("SOLICITUDES");
  var misSol = solicitudes.filter(function(s) {
    return String(s.ID_Solicitante) === String(yo.ID_Usuario);
  });
  return JSON.parse(JSON.stringify(misSol.reverse()));
}

// --------------------------------------------
// DOBLE CONFIRMACIÓN DEL CAMBIO DE TURNO
// --------------------------------------------
// Solicitudes en las que el usuario de la sesión es el colega
// receptor y aún debe aceptar/rechazar cubrir el turno.
function obtenerConfirmacionesPendientes() {
  var yo = usuarioSesion_();
  if (!yo) return [];
  var solicitudes = obtenerDatosHoja_("SOLICITUDES");
  var usuarios = obtenerDatosHoja_("USUARIOS");
  var pendientes = solicitudes.filter(function(s) {
    return String(s.ID_Reemplazante) === String(yo.ID_Usuario) &&
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
function responderCambioColega(idSol, acepta, motivo) {
  var yo = usuarioSesion_();
  if (!yo) return { exito: false, mensaje: "Sesión no válida." };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { exito: false, mensaje: "Sistema ocupado, intenta de nuevo." };
  try {
    var solicitudes = obtenerDatosHoja_("SOLICITUDES");
    var sol = solicitudes.find(function(s) { return String(s.ID_Sol) === String(idSol); });
    if (!sol) return { exito: false, mensaje: "Solicitud no encontrada." };
    if (String(sol.ID_Reemplazante) !== String(yo.ID_Usuario)) {
      return { exito: false, mensaje: "Esta solicitud no está dirigida a ti." };
    }
    if (String(sol.Estado).trim().toLowerCase() !== "pendiente colega") {
      return { exito: false, mensaje: "Esta solicitud ya fue respondida." };
    }

    if (acepta) {
      actualizarFilaPorClave_("SOLICITUDES", "ID_Sol", idSol, { Estado: "Pendiente" });
      try {
        emailNuevaSolicitud_(idSol);
        emailAcuseRecibo_(idSol);
      } catch (e) { Logger.log("Aviso notificación: " + e.message); }
      return { exito: true, mensaje: "Aceptaste cubrir el turno. La solicitud pasó a revisión de la coordinadora." };
    } else {
      actualizarFilaPorClave_("SOLICITUDES", "ID_Sol", idSol, {
        Estado: "Rechazado Colega",
        Nota_Resolucion: motivo || "El colega no puede cubrir el turno.",
        Fecha_Resolucion: new Date()
      });
      return { exito: true, mensaje: "Rechazaste cubrir el turno. La solicitud no continúa." };
    }
  } finally {
    lock.releaseLock();
  }
}

// --------------------------------------------
// ANÁLISIS DE COBERTURA / DESCOBERTURA (solo aprobadores)
// --------------------------------------------
function analizarCoberturaSolicitud(idSol) {
  if (!aprobadorSesion_()) return { cubierto: false, nota: "Sin permisos." };
  return analizarCobertura_(idSol);
}

function analizarCobertura_(idSol) {
  var solicitudes = obtenerDatosHoja_("SOLICITUDES");
  var usuarios = obtenerDatosHoja_("USUARIOS");
  var vacantes = obtenerDatosHoja_("VACANTES");

  var sol = solicitudes.find(function(s) { return String(s.ID_Sol) === String(idSol); });
  if (!sol) return { cubierto: false, nota: "Solicitud no encontrada." };
  var solicitante = usuarios.find(function(u) { return String(u.ID_Usuario) === String(sol.ID_Solicitante); });
  if (!solicitante) return { cubierto: false, nota: "Solicitante no encontrado." };

  // Cambio de turno con colega → cubierto por trueque
  if (tipoNorm_(sol.Tipo_Sol) === "CAMBIO" && sol.ID_Reemplazante) {
    var r = usuarios.find(function(u) { return String(u.ID_Usuario) === String(sol.ID_Reemplazante); });
    return { cubierto: true, reemplazante: r ? (r.Nombre + " " + r.Apellido) : "Colega asignado" };
  }

  // Jornada diurna L-V → no afecta la rotación
  if (esTurnoDiurno_(solicitante.Turno_Base)) {
    return { cubierto: false, dias: [], nota: "Jornada administrativa L-V: no afecta la rotación de turnos del equipo." };
  }

  var equipo = equipoDeUsuario_(solicitante.Turno_Base);
  var teamSize = usuarios.filter(function(u) {
    return String(u.Estado).toUpperCase() === "ACTIVO" &&
           !esTurnoDiurno_(u.Turno_Base) &&
           equipoDeUsuario_(u.Turno_Base) === equipo;
  }).length;

  var fechas = rangoDeFechas_(sol.Fecha_Inicio, sol.Fecha_Fin);
  var dias = [];
  var algunRiesgo = false;

  fechas.forEach(function(f) {
    var turno = getTurnoMatematico(f, equipo);
    if (turno === "Libre") return;
    var iso = fechaISO_(f);
    var min = dotacionMinima_(turno);
    var ausentes = contarAusenciasEquipo_(solicitudes, usuarios, equipo, iso, idSol);
    var vacAbiertas = vacantes.filter(function(v) {
      return String(v.Equipo).toUpperCase() === equipo &&
             fechaISO_(v.Fecha) === iso &&
             String(v.Turno).toUpperCase() === turno.toUpperCase() &&
             String(v.Estado).toUpperCase() === "ABIERTA";
    }).length;

    var presentes = teamSize - ausentes - vacAbiertas - 1; // -1 = este solicitante
    if (presentes < 0) presentes = 0;
    var riesgo = presentes < min;
    if (riesgo) algunRiesgo = true;
    dias.push({ fechaVisual: fechaVisual_(f), turno: turno, presentes: presentes, minimo: min, riesgo: riesgo });
  });

  return { ok: !algunRiesgo, equipo: equipo, minimo: dotacionMinima_("Largo"), dias: dias };
}

// Cuenta ausencias aprobadas de un equipo que cubren una fecha (excluyendo la solicitud analizada).
function contarAusenciasEquipo_(solicitudes, usuarios, equipo, iso, excluirIdSol) {
  var byId = {};
  usuarios.forEach(function(u) { byId[String(u.ID_Usuario)] = u; });
  var count = 0;
  solicitudes.forEach(function(s) {
    if (String(s.ID_Sol) === String(excluirIdSol)) return;
    if (String(s.Estado).toUpperCase() !== "APROBADO") return;
    var tipo = tipoNorm_(s.Tipo_Sol);
    if (tipo === "TURNO_EXTRA") return;                    // los extra suman, no restan
    if (tipo === "CAMBIO" && s.ID_Reemplazante) return;    // cambio cubierto no resta
    var u = byId[String(s.ID_Solicitante)];
    if (!u || equipoDeUsuario_(u.Turno_Base) !== equipo) return;
    var fi = fechaISO_(s.Fecha_Inicio), ff = fechaISO_(s.Fecha_Fin);
    if (iso >= fi && iso <= ff) count++;
  });
  return count;
}

// --------------------------------------------
// CONSOLIDADO DE UNIDAD (cambios + turnos extra aprobados)
// --------------------------------------------
function obtenerConsolidadoTurnos() {
  if (!usuarioSesion_()) return [];
  var solicitudes = obtenerDatosHoja_("SOLICITUDES");
  var usuarios = obtenerDatosHoja_("USUARIOS");
  var filtradas = solicitudes.filter(function(s) {
    var tipo = tipoNorm_(s.Tipo_Sol);
    return (tipo === "CAMBIO" || tipo === "TURNO_EXTRA") &&
           String(s.Estado).trim().toUpperCase() === "APROBADO";
  });
  var resultado = filtradas.map(function(s) {
    var u = usuarios.find(function(user) { return String(user.ID_Usuario) === String(s.ID_Solicitante); });
    return {
      ID: s.ID_Sol,
      Kinesiologo: u ? (u.Nombre + " " + u.Apellido) : "Desconocido",
      Tipo: tipoNorm_(s.Tipo_Sol),
      Fecha_Inicio: s.Fecha_Inicio,
      Detalle: s.Motivo || "-"
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
function obtenerSolicitudesAdmin() {
  if (!aprobadorSesion_()) return [];
  var solicitudes = obtenerDatosHoja_("SOLICITUDES");
  var usuarios = obtenerDatosHoja_("USUARIOS");
  var pendientes = solicitudes.filter(function(s) {
    return String(s.Estado).trim().toUpperCase() === "PENDIENTE";
  });

  var resultado = pendientes.map(function(s) {
    var u = usuarios.find(function(user) { return String(user.ID_Usuario) === String(s.ID_Solicitante); });
    var cob = analizarCobertura_(s.ID_Sol);
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
  if (!aprobadorSesion_()) return { exito: false };
  var solicitudes = obtenerDatosHoja_("SOLICITUDES");
  var usuarios = obtenerDatosHoja_("USUARIOS");
  var sol = solicitudes.find(function(s) { return String(s.ID_Sol) === String(idSolicitud); });
  if (!sol) return { exito: false };

  var esCambio = tipoNorm_(sol.Tipo_Sol) === "CAMBIO";
  var reemplazo = usuarios.find(function(u) { return String(u.ID_Usuario) === String(sol.ID_Reemplazante); });

  // Solo pedimos confirmar quién cubre cuando es un cambio de turno.
  if (!esCambio) return { exito: true, esCambio: false, turnosPerdidos: [] };

  var fechaEx = new Date(sol.Fecha_Inicio);
  fechaEx.setHours(12, 0, 0, 0);
  return {
    exito: true,
    esCambio: true,
    turnosPerdidos: [{
      fechaStr: fechaISO_(fechaEx),
      fechaVisual: fechaVisual_(fechaEx),
      tipo: sol.Turno_Ausencia || "Turno",
      sugerencias: [{
        id: sol.ID_Reemplazante,
        nombre: reemplazo ? (reemplazo.Nombre + " " + reemplazo.Apellido) : "Colega seleccionado"
      }]
    }]
  };
}

// --------------------------------------------
// RECHAZAR / APROBAR (solo aprobadores, con lock e idempotencia)
// --------------------------------------------
function rechazarSolicitud(idSolicitud, motivo) {
  var apr = aprobadorSesion_();
  if (!apr) return { exito: false, mensaje: "No tienes permisos." };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { exito: false, mensaje: "Sistema ocupado, intenta de nuevo." };
  try {
    var solicitudes = obtenerDatosHoja_("SOLICITUDES");
    var sol = solicitudes.find(function(s) { return String(s.ID_Sol) === String(idSolicitud); });
    if (!sol) return { exito: false, mensaje: "Solicitud no encontrada." };
    if (String(sol.Estado).trim().toUpperCase() !== "PENDIENTE") {
      return { exito: false, mensaje: "Esta solicitud ya fue resuelta (" + sol.Estado + ")." };
    }

    actualizarFilaPorClave_("SOLICITUDES", "ID_Sol", idSolicitud, {
      Estado: "Rechazado",
      Fecha_Resolucion: new Date(),
      ID_Aprobador: apr.ID_Usuario,
      Nota_Resolucion: motivo || ""
    });
  } finally {
    lock.releaseLock();
  }
  try { emailResolucion_(idSolicitud); } catch (e) { Logger.log(e.message); }
  return { exito: true, mensaje: "Solicitud rechazada ❌" };
}

function aprobarSolicitudMulti(idSolicitud, nota, asignaciones) {
  var apr = aprobadorSesion_();
  if (!apr) return { exito: false, mensaje: "No tienes permisos." };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { exito: false, mensaje: "Sistema ocupado, intenta de nuevo." };
  try {
    var solicitudes = obtenerDatosHoja_("SOLICITUDES");
    var sol = solicitudes.find(function(s) { return String(s.ID_Sol) === String(idSolicitud); });
    if (!sol) return { exito: false, mensaje: "Solicitud no encontrada." };

    // Guard de idempotencia: aprobar dos veces descontaba el saldo dos veces.
    if (String(sol.Estado).trim().toUpperCase() !== "PENDIENTE") {
      return { exito: false, mensaje: "Esta solicitud ya fue resuelta (" + sol.Estado + ")." };
    }

    actualizarFilaPorClave_("SOLICITUDES", "ID_Sol", idSolicitud, {
      Estado: "Aprobado",
      Fecha_Resolucion: new Date(),
      ID_Aprobador: apr.ID_Usuario,
      Nota_Resolucion: nota || ""
    });

    // Descontar saldos del solicitante según el tipo
    try { descontarSaldo_(sol); } catch (e) { Logger.log("Aviso saldo: " + e.message); }

    // Registrar el turno extra del reemplazante (para el consolidado)
    try {
      if (asignaciones && asignaciones.length) {
        asignaciones.forEach(function(a) {
          if (!a.idReemplazo) return;
          appendFilaPorClave_("SOLICITUDES", {
            ID_Sol: generarID_("EXT"),
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
            ID_Aprobador: apr.ID_Usuario
          });
        });
      }
    } catch (e) { Logger.log("Aviso turno extra: " + e.message); }
  } finally {
    lock.releaseLock();
  }

  try { emailResolucion_(idSolicitud); } catch (e) { Logger.log(e.message); }
  return { exito: true, mensaje: "Solicitud aprobada ✅" };
}

// Descuenta FL / FF / ADM del solicitante al aprobar.
function descontarSaldo_(sol) {
  var tipo = String(sol.Tipo_Sol).toUpperCase();
  var col = null;
  if (tipo === "FL") col = "FL_Disponibles";
  else if (tipo === "FF") col = "FF_Disponibles";
  else if (tipo === "ADM") col = "ADM_Disponibles";
  if (!col) return;

  var usuarios = obtenerDatosHoja_("USUARIOS");
  var u = usuarios.find(function(x) { return String(x.ID_Usuario) === String(sol.ID_Solicitante); });
  if (!u) return;
  var actual = parseInt(u[col], 10) || 0;
  var dias = parseInt(sol.Dias_Solicitados, 10) || 0;
  var nuevo = Math.max(0, actual - dias);
  var cambios = {}; cambios[col] = nuevo;
  actualizarFilaPorClave_("USUARIOS", "ID_Usuario", sol.ID_Solicitante, cambios);
}
