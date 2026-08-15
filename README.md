# KinesioTurno UCI — Backend (Google Apps Script)

Código del servidor que da soporte a las tres mejoras prioritarias de la app:
**doble confirmación de cambio de turno**, **detección de descobertura** y
**módulo de licencias médicas con turnos vacantes**.

## Archivos

| Archivo | Rol |
|---|---|
| `Setup.gs` | **Instalador.** `inicializarProyecto()` crea las 5 hojas + config + **roster real 2026 (15 personas)**. `resetearProyecto()` limpia datos. `diagnosticoProyecto()` verifica el estado. |
| `Auth.gs` | `doGet`, `incluir`, sesión y rol efectivo. |
| `Utils.gs` | Lectura/escritura de hojas, turno por fórmula, fechas, configuración y **dotación mínima**. |
| `Solicitudes.gs` | Login, validación de saldos, crear/aprobar/rechazar, **doble confirmación** y **análisis de cobertura**. |
| `Licencias.gs` | Registrar licencias y generar/asignar **turnos vacantes**. |
| `Planilla.gs` | **Planilla mensual** (`obtenerPlanillaMes`) y **Reporte RRHH** (`obtenerDatosMes`) — leen de las hojas y arman la matriz visual y el consolidado de cambios/extras/reemplazos. |
| `Notificaciones.gs` | Emails: nueva solicitud, acuse, resolución y **confirmación al colega**. |
| `Index.html` | Frontend (cliente): calendario, permisos, **Planilla**, **Reporte RRHH** y selector de paleta. |

> En Apps Script todos los `.gs` comparten un mismo ámbito global. Por eso
> `buscarUsuarioPorEmail()` y `esAprobador()` viven **solo** en `Solicitudes.gs`
> (no las dupliques en `Auth.gs` o tendrás funciones repetidas).

## Hojas de cálculo requeridas (la fila 1 son las cabeceras exactas)

**USUARIOS**
`ID_Usuario · Nombre · Apellido · Email · Rol · Estado · Turno_Base ·
FL_Disponibles · FF_Disponibles · ADM_Disponibles · URL_Foto · RUT ·
Fecha_Ingreso · Es_Subrogante_Activo · Etiqueta`

> La columna **`Etiqueta`** (ej. `D MELO`) es el nombre corto que usa la Planilla
> y el Reporte RRHH. `Turno_Base` define el bloque: `Equipo A/B/C/D` (rotación),
> `Diurno Jefatura` (jornada/coordinación) o `Reemplazo 1/2` (Campos y Caamaño).

**SOLICITUDES**
`ID_Sol · Fecha_Solicitud · ID_Solicitante · Tipo_Sol · Fecha_Inicio ·
Fecha_Fin · Dias_Solicitados · ID_Reemplazante · Motivo · Estado ·
Turno_Ausencia · Fecha_Resolucion · ID_Aprobador · Nota_Resolucion`

**CONFIGURACION**  ·  columnas `Clave · Valor`

| Clave | Ejemplo | Uso |
|---|---|---|
| `NOMBRE_HOSPITAL` | Hospital San Pablo de Coquimbo | Pie de emails |
| `NOMBRE_UNIDAD` | UCI | Pie de emails |
| `NOMBRE_COORDINADORA` | (nombre) | Pie de emails |
| `EMAIL_COORDINADORA` | coord@... | Destino de avisos de solicitud |
| `DOTACION_MINIMA_LARGO` | `1` | Mínimo de kine presentes en turno Largo |
| `DOTACION_MINIMA_NOCHE` | `1` | Mínimo de kine presentes en turno Noche |

**LICENCIAS** *(nueva)*
`ID_Lic · ID_Usuario · Fecha_Inicio · Fecha_Fin · Folio · Tipo ·
Observacion · Fecha_Registro · Dias`

**VACANTES** *(nueva)*
`ID_Vac · ID_Lic · Fecha · Turno · Equipo · ID_Ausente · Estado ·
ID_Cobertura · Fecha_Asignacion`

## Planilla y Reporte RRHH (`Planilla.gs`)

Dos vistas **solo de lectura** que reflejan lo registrado en la plataforma — pensadas
para el equipo y para la secretaría que conserva el formato Excel clásico.

**Planilla** (`obtenerPlanillaMes`): matriz mes × personas en el orden de la unidad
(4 equipos + jornada/coordinación + 2 reemplazos), con líneas gruesas separando bloques.
Prioridad de cada casilla:

```
1. LM (licencia médica)      → rojo, "LICENCIA MÉDICA"
2. FL / FF / ADM aprobados    → azul
3. CAMBIO aprobado            → sobreescribe la rotación base ese día
4. REEMPLAZO aprobado         → turno de Campos / Caamaño
5. TURNO_EXTRA aprobado       → amarillo
6. Rotación matemática A/B/C/D → L / N / (libre)
7. Jornada diurna L–V         → J
```

**Reporte RRHH** (`obtenerDatosMes`): consolida los **cambios**, **turnos extra** y
**reemplazos** aprobados del mes en tres tablas (formato del Word oficial), con una
ventana de ~5 días hacia atrás para capturar turnos de fin de mes anterior.

Ambas vistas tienen navegación de **mes** (`◀ ▶`) y **año** (`◀◀ ▶▶`), y botón **Imprimir / PDF**.

## Estados de una solicitud

```
CAMBIO_TURNO:  Pendiente Colega ──(colega acepta)──▶ Pendiente ──▶ Aprobado / Rechazado
                      └──────────(colega rechaza)──▶ Rechazado Colega
Otros tipos:   Pendiente ──▶ Aprobado / Rechazado
```

- **Pendiente Colega**: el receptor del trueque aún no confirma; no aparece en el panel admin.
- Al **aprobar** se descuentan los saldos (FL/FF/ADM) y, si hay reemplazo, se
  registra un `TURNO_EXTRA` aprobado para el consolidado.

## Lógica de cobertura (`analizarCoberturaSolicitud`)

Para cada día de la solicitud que cae en turno de rotación (Largo/Noche):

```
presentes = (tamaño del equipo)
          − ausencias aprobadas del equipo ese día
          − vacantes abiertas del equipo/turno ese día
          − 1   (el solicitante)
riesgo = presentes < dotación mínima del turno
```

Un cambio de turno con colega asignado se considera **cubierto** (no genera descobertura).
Las jornadas diurnas L-V no afectan la rotación.

## Arranque rápido (para probar)

1. Crea una **Google Sheet** nueva → menú **Extensiones → Apps Script**.
2. En el editor, crea un archivo por cada `.gs` (mismo nombre, incluido `Planilla.gs`) y pega su contenido.
   Crea un HTML llamado `Index` (sin extensión en el editor) y pega `Index.html`.
3. Abre `Setup.gs` y reemplaza `EMAIL_COORDINADORA` y `EMAIL_KINE_PRUEBA` por los correos institucionales reales.
4. Selecciona la función **`inicializarProyecto`** y pulsa **Ejecutar**. Autoriza permisos.
   → Crea las 5 hojas con cabeceras, la `CONFIGURACION` y el **roster real 2026 (15 personas)**.
5. **Implementar → Nueva implementación → App web** (ejecutar como tú; acceso según tu política) y abre la URL.
6. Loguéate con el correo que pusiste en `EMAIL_KINE_PRUEBA` (kine) o `EMAIL_COORDINADORA` (admin).

> **La planificación se construye desde la plataforma.** Las hojas `SOLICITUDES` y
> `LICENCIAS` arrancan vacías; a medida que el equipo registra cambios, extras,
> reemplazos y licencias, la Planilla y el Reporte RRHH se llenan solos. La rotación
> base A/B/C/D la calcula la fórmula desde `BASE_DATE_ROTACION` (config, `2026-03-05`).

Para repetir pruebas desde cero: ejecuta `resetearProyecto()` y luego `inicializarProyecto()`.
Para revisar el estado: ejecuta `diagnosticoProyecto()` y mira el registro (Ver → Registros).

> Los emails (`MailApp`/Gmail) requieren autorización adicional la primera vez que se disparan.
