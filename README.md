# KinesioTurno UCI — Backend (Google Apps Script)

Código del servidor que da soporte a las tres mejoras prioritarias de la app:
**doble confirmación de cambio de turno**, **detección de descobertura** y
**módulo de licencias médicas con turnos vacantes**.

## Archivos

| Archivo | Rol |
|---|---|
| `appsscript.json` | Manifiesto: zona horaria `America/Santiago`, runtime V8, config de la web app. |
| `Setup.gs` | **Instalador.** `inicializarProyecto()` crea las 6 hojas + config + feriados 2026 + **roster real 2026 (15 personas)**. `resetearProyecto()` limpia datos. `diagnosticoProyecto()` verifica el estado. `corregirAcceso()` repara el acceso si tu cuenta quedó fuera. |
| `Auth.gs` | `doGet`, **identidad de sesión** (`autoLogin`, `usuarioSesion_`, `aprobadorSesion_`). |
| `Utils.gs` | Lectura/escritura de hojas **con caché por request**, turno por fórmula, fechas, feriados, configuración y **dotación mínima**. |
| `Solicitudes.gs` | Validación de saldos, crear/aprobar/rechazar (con `LockService`), **doble confirmación** y **análisis de cobertura**. |
| `Licencias.gs` | Registrar licencias y generar/asignar **turnos vacantes** (solo coordinadora). |
| `Planilla.gs` | **Planilla mensual** (`obtenerPlanillaMes`) y **Reporte RRHH** (`obtenerDatosMes`). |
| `Notificaciones.gs` | Emails: nueva solicitud, acuse, resolución y **confirmación al colega**. |
| `Index.html` | Frontend (cliente): calendario, permisos, **Planilla**, **Reporte RRHH** y selector de paleta. |

## Modelo de seguridad

- **La identidad se deriva SIEMPRE en el servidor** con `Session.getActiveUser()`.
  Ninguna función sensible acepta el ID del usuario desde el cliente: quién crea,
  quién confirma, quién aprueba — todo sale de la sesión de Google.
- **Convención:** las funciones que terminan en `_` son privadas del servidor.
  Apps Script les bloquea la invocación remota vía `google.script.run`, así que
  la superficie expuesta al navegador son solo las funciones sin sufijo.
- Aprobar/rechazar solicitudes y asignar vacantes usan `LockService` + guard de
  estado: aprobar dos veces no descuenta el saldo dos veces.
- Las funciones de mantenimiento (`inicializarProyecto`, `resetearProyecto`,
  `corregirAcceso`, …) exigen ejecutarse como propietario desde el editor.

## Hojas de cálculo requeridas (la fila 1 son las cabeceras exactas)

**USUARIOS**
`ID_Usuario · Nombre · Apellido · Email · Rol · Estado · Turno_Base ·
FL_Disponibles · FF_Disponibles · ADM_Disponibles · URL_Foto · RUT ·
Fecha_Ingreso · Es_Subrogante_Activo · Etiqueta`

> La columna **`Etiqueta`** (ej. `D MELO`) es el nombre corto que usa la Planilla
> y el Reporte RRHH. `Turno_Base` define el bloque: `Equipo A/B/C/D` (rotación),
> `Diurno Jefatura` (jornada/coordinación) o `Reemplazo 1/2` (Campos y Caamaño).
> El **Email debe ser exactamente la cuenta Google** con la que la persona abre
> la web app — el login es automático por sesión.

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
| `BASE_DATE_ROTACION` | `2026-03-05` | Día en que el Equipo A hace turno Largo (ancla de la rotación) |

**LICENCIAS**
`ID_Lic · ID_Usuario · Fecha_Inicio · Fecha_Fin · Folio · Tipo ·
Observacion · Fecha_Registro · Dias`

**VACANTES**
`ID_Vac · ID_Lic · Fecha · Turno · Equipo · ID_Ausente · Estado ·
ID_Cobertura · Fecha_Asignacion`

**FERIADOS**  ·  columnas `Fecha · Nombre`

> Fuente única de feriados para servidor y cliente: se **descuentan del cómputo
> de días hábiles (FL/FF)** y pintan el calendario. El instalador siembra los de
> 2026; **agrega los años siguientes directamente en esta hoja** (formato
> `yyyy-MM-dd`).

## Planilla y Reporte RRHH (`Planilla.gs`)

Dos vistas **solo de lectura** que reflejan lo registrado en la plataforma — pensadas
para el equipo y para la secretaría que conserva el formato Excel clásico.

**Planilla** (`obtenerPlanillaMes`): matriz mes × personas en el orden de la unidad
(4 equipos + jornada/coordinación + 2 reemplazos), con líneas gruesas separando bloques.
Los usuarios activos que no estén en el orden fijo se agregan al final.
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

> Los tipos se comparan normalizados (`tipoNorm_`): `CAMBIO_TURNO`, `CAMBIO` y
> variantes cuentan como cambio en todas las vistas.

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
- Solo se puede resolver una solicitud en estado **Pendiente** (idempotencia).

## Lógica de cobertura (`analizarCobertura_`)

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
2. En el editor: **Configuración del proyecto → marca "Mostrar el archivo de
   manifiesto appsscript.json"** y pega el contenido de `appsscript.json`.
3. Crea un archivo por cada `.gs` (mismo nombre) y pega su contenido.
   Crea un HTML llamado `Index` (sin extensión en el editor) y pega `Index.html`.
4. Abre `Setup.gs` y reemplaza `EMAIL_COORDINADORA` y `EMAIL_KINE_PRUEBA` por
   **las cuentas Google exactas** con las que van a entrar (institucional o Gmail).
5. Selecciona la función **`inicializarProyecto`** y pulsa **Ejecutar**. Autoriza permisos.
   → Crea las 6 hojas con cabeceras, la `CONFIGURACION`, los **feriados 2026** y el
   **roster real 2026 (15 personas)**.
6. **Implementar → Nueva implementación → App web**:
   - *Ejecutar como*: **Yo**
   - *Quién tiene acceso*: **Cualquier usuario con cuenta de Google** (o tu dominio Workspace)
7. Abre la **URL `/exec`** con la cuenta de `EMAIL_KINE_PRUEBA` (kine) o
   `EMAIL_COORDINADORA` (admin). El login es automático.

### Si ves "Sin acceso al sistema"

La pantalla de error ahora muestra **qué cuenta detectó** el sistema:

- **La cuenta no está registrada** → el email de esa cuenta no coincide con
  ninguna fila de `USUARIOS`. Corrige el email en la hoja, o actualiza las
  constantes de `Setup.gs` y ejecuta **`corregirAcceso()`** desde el editor
  (la siembra no se repite con datos existentes, así que cambiar solo la
  constante no basta).
- **No se pudo detectar tu cuenta** → la implementación no entrega la sesión.
  Verifica que el acceso sea "Cualquier usuario con cuenta de Google" (no
  "Cualquier persona"/anónimo) y que estés abriendo la URL `/exec`, no `/dev`
  de otra cuenta.
- `diagnosticoProyecto()` te dice directamente si tu sesión está registrada.

> **La planificación se construye desde la plataforma.** Las hojas `SOLICITUDES` y
> `LICENCIAS` arrancan vacías; a medida que el equipo registra cambios, extras,
> reemplazos y licencias, la Planilla y el Reporte RRHH se llenan solos. La rotación
> base A/B/C/D se calcula desde `BASE_DATE_ROTACION` (config, `2026-03-05`).

Para repetir pruebas desde cero: ejecuta `resetearProyecto()` y luego `inicializarProyecto()`.
Para revisar el estado: ejecuta `diagnosticoProyecto()` y mira el registro (Ver → Registros).

> Los emails (`MailApp`/Gmail) requieren autorización adicional la primera vez que se disparan.
