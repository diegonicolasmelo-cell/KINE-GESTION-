// ============================================
// LICENCIAS.GS — Licencias médicas y turnos vacantes
// KinesioTurno UCI — Hospital San Pablo de Coquimbo
// --------------------------------------------
// Al cargar una licencia se generan automáticamente los
// turnos VACANTES de rotación que quedan sin cubrir, para
// que la coordinadora reasigne la cobertura.
//
// Todas las operaciones de este módulo son de la coordinadora:
// requieren aprobadorSesion_() (identidad derivada en servidor).
// ============================================

// --------------------------------------------
// REGISTRAR LICENCIA + GENERAR VACANTES
// --------------------------------------------
function cargarLicencia(datos) {
  if (!aprobadorSesion_()) return { exito: false, mensaje: "No tienes permisos para registrar licencias." };
  if (!datos || !datos.idUsuario || !datos.fechaInicio || !datos.fechaFin) {
    return { exito: false, mensaje: "❌ Completa profesional y fechas." };
  }
  if (new Date(datos.fechaFin) < new Date(datos.fechaInicio)) {
    return { exito: false, mensaje: "❌ La fecha de fin no puede ser anterior al inicio." };
  }

  var usuarios = obtenerDatosHoja_("USUARIOS");
  var u = usuarios.find(function(x) { return String(x.ID_Usuario) === String(datos.idUsuario); });
  if (!u) return { exito: false, mensaje: "❌ Profesional no encontrado." };

  var idLic = generarID_("LIC");
  var dias = calcularDiasCorridos_(datos.fechaInicio, datos.fechaFin);

  appendFilaPorClave_("LICENCIAS", {
    ID_Lic: idLic,
    ID_Usuario: datos.idUsuario,
    Fecha_Inicio: datos.fechaInicio,
    Fecha_Fin: datos.fechaFin,
    Folio: datos.folio || "",
    Tipo: datos.tipo || "Curativa",
    Observacion: datos.observacion || "",
    Fecha_Registro: new Date(),
    Dias: dias
  });

  // Generar vacantes solo para los días de turno de rotación (Largo / Noche)
  var generadas = 0;
  if (!esTurnoDiurno_(u.Turno_Base)) {
    var equipo = equipoDeUsuario_(u.Turno_Base);
    var fechas = rangoDeFechas_(datos.fechaInicio, datos.fechaFin);
    fechas.forEach(function(f) {
      var turno = getTurnoMatematico(f, equipo);
      if (turno === "Libre") return;
      appendFilaPorClave_("VACANTES", {
        ID_Vac: generarID_("VAC") + "-" + generadas,
        ID_Lic: idLic,
        Fecha: fechaISO_(f),
        Turno: turno,
        Equipo: equipo,
        ID_Ausente: datos.idUsuario,
        Estado: "Abierta",
        ID_Cobertura: "",
        Fecha_Asignacion: ""
      });
      generadas++;
    });
  }

  var msg = generadas > 0
    ? "Licencia registrada. Se generaron " + generadas + " turno(s) vacante(s) por cubrir."
    : "Licencia registrada. El profesional no tenía turnos de rotación en esas fechas.";
  return { exito: true, mensaje: msg, idLicencia: idLic, vacantes: generadas };
}

// --------------------------------------------
// LISTAR LICENCIAS (con conteo de vacantes)
// --------------------------------------------
function obtenerLicencias() {
  if (!aprobadorSesion_()) return [];
  var licencias = obtenerDatosHoja_("LICENCIAS");
  var usuarios = obtenerDatosHoja_("USUARIOS");
  var vacantes = obtenerDatosHoja_("VACANTES");

  var out = licencias.map(function(l) {
    var u = usuarios.find(function(x) { return String(x.ID_Usuario) === String(l.ID_Usuario); });
    var propias = vacantes.filter(function(v) { return String(v.ID_Lic) === String(l.ID_Lic); });
    var abiertas = propias.filter(function(v) { return String(v.Estado).toUpperCase() === "ABIERTA"; }).length;
    return {
      ID_Lic: l.ID_Lic,
      Profesional: u ? (u.Nombre + " " + u.Apellido) : "Desconocido",
      Equipo: u ? (equipoDeUsuario_(u.Turno_Base) || (esTurnoDiurno_(u.Turno_Base) ? "Diurno" : "-")) : "-",
      Tipo: l.Tipo,
      Fecha_Inicio: l.Fecha_Inicio,
      Fecha_Fin: l.Fecha_Fin,
      Folio: l.Folio,
      Dias: l.Dias,
      Vacantes: propias.length,
      Abiertas: abiertas
    };
  });
  // Más recientes primero
  out.sort(function(a, b) { return new Date(b.Fecha_Inicio) - new Date(a.Fecha_Inicio); });
  return JSON.parse(JSON.stringify(out));
}

// --------------------------------------------
// LISTAR VACANTES
// soloAbiertas = true → solo las que faltan por cubrir
// --------------------------------------------
function obtenerVacantes(soloAbiertas) {
  if (!aprobadorSesion_()) return [];
  var vacantes = obtenerDatosHoja_("VACANTES");
  var usuarios = obtenerDatosHoja_("USUARIOS");

  var lista = vacantes.filter(function(v) {
    return soloAbiertas ? String(v.Estado).toUpperCase() === "ABIERTA" : true;
  });

  var out = lista.map(function(v) {
    var ausente = usuarios.find(function(x) { return String(x.ID_Usuario) === String(v.ID_Ausente); });
    var cobertura = usuarios.find(function(x) { return String(x.ID_Usuario) === String(v.ID_Cobertura); });
    return {
      ID_Vac: v.ID_Vac,
      Fecha: v.Fecha,
      Turno: v.Turno,
      Equipo: v.Equipo,
      ID_Ausente: v.ID_Ausente,
      Ausente: ausente ? (ausente.Nombre + " " + ausente.Apellido) : "Profesional",
      Estado: v.Estado,
      Cobertura: cobertura ? (cobertura.Nombre + " " + cobertura.Apellido) : ""
    };
  });
  // Abiertas primero, luego por fecha
  out.sort(function(a, b) {
    var ra = String(a.Estado).toUpperCase() === "ABIERTA" ? 0 : 1;
    var rb = String(b.Estado).toUpperCase() === "ABIERTA" ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return new Date(a.Fecha) - new Date(b.Fecha);
  });
  return JSON.parse(JSON.stringify(out));
}

// --------------------------------------------
// ASIGNAR COBERTURA A UNA VACANTE
// --------------------------------------------
function asignarVacante(idVac, idCobertura) {
  var apr = aprobadorSesion_();
  if (!apr) return { exito: false, mensaje: "No tienes permisos." };
  if (!idCobertura) return { exito: false, mensaje: "Selecciona un colega para cubrir el turno." };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { exito: false, mensaje: "Sistema ocupado, intenta de nuevo." };
  try {
    var vacantes = obtenerDatosHoja_("VACANTES");
    var vac = vacantes.find(function(v) { return String(v.ID_Vac) === String(idVac); });
    if (!vac) return { exito: false, mensaje: "Vacante no encontrada." };
    if (String(vac.Estado).toUpperCase() !== "ABIERTA") {
      return { exito: false, mensaje: "Esta vacante ya fue cubierta." };
    }

    actualizarFilaPorClave_("VACANTES", "ID_Vac", idVac, {
      Estado: "Cubierta",
      ID_Cobertura: idCobertura,
      Fecha_Asignacion: new Date()
    });

    // Registrar el turno extra para que aparezca en el consolidado de unidad
    try {
      appendFilaPorClave_("SOLICITUDES", {
        ID_Sol: generarID_("EXT"),
        Fecha_Solicitud: new Date(),
        ID_Solicitante: idCobertura,
        Tipo_Sol: "TURNO_EXTRA",
        Fecha_Inicio: vac.Fecha,
        Fecha_Fin: vac.Fecha,
        Dias_Solicitados: 1,
        ID_Reemplazante: vac.ID_Ausente,
        Motivo: "Cobertura de licencia (" + vac.Turno + ", Eq " + vac.Equipo + ")",
        Estado: "Aprobado",
        Turno_Ausencia: vac.Turno,
        Fecha_Resolucion: new Date(),
        ID_Aprobador: apr.ID_Usuario
      });
    } catch (e) { Logger.log("Aviso turno extra: " + e.message); }
  } finally {
    lock.releaseLock();
  }

  return { exito: true, mensaje: "Cobertura asignada ✅" };
}
