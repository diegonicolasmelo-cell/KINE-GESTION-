# Montar KinesioTurno UCI — guía paso a paso

Tiempo estimado: **20 minutos**. No necesitas saber programar.

Al terminar tendrás: la app funcionando en el navegador, y la PWA instalable
en el teléfono del equipo.

---

## Parte 1 · El backend (Google Sheets + Apps Script)

### 1.1 Crear la planilla

1. Entra a [sheets.new](https://sheets.new) con la cuenta de Google que será
   **dueña del sistema** (idealmente una cuenta institucional, no personal —
   si esa cuenta se pierde, se pierde el sistema).
2. Ponle nombre: `KinesioTurno UCI — Datos`.
3. Menú **Extensiones → Apps Script**. Se abre el editor en otra pestaña.

### 1.2 Subir el código

Tienes dos caminos. El **A** es más rápido si tienes Node instalado; el **B**
no requiere instalar nada.

#### Camino A — automático con `clasp` (recomendado)

```bash
# 1. Instalar la herramienta oficial de Google
npm install -g @google/clasp

# 2. Iniciar sesión (abre el navegador)
clasp login

# 3. En la carpeta del proyecto, copiar la plantilla
cp .clasp.json.example .clasp.json
```

Ahora necesitas el **ID del script**: en el editor de Apps Script ve a
⚙️ **Configuración del proyecto** y copia el *ID de la secuencia de comandos*.
Pégalo en `.clasp.json` reemplazando `PEGA_AQUI_EL_ID_DE_TU_SCRIPT`.

```bash
# 4. Subir todo de una vez
clasp push
```

Sube los 8 archivos de código más el manifiesto. Listo.

> `.clasp.json` está en `.gitignore`: contiene el ID de *tu* script y no debe
> subirse al repositorio.

#### Camino B — manual (copiar y pegar)

En el editor de Apps Script, primero activa el manifiesto:
⚙️ **Configuración del proyecto** → marca **"Mostrar el archivo de manifiesto
appsscript.json en el editor"**.

Luego crea cada archivo con el botón **+** de la izquierda:

| Crear como | Nombre en el editor | Pegar el contenido de |
|---|---|---|
| (ya existe) | `appsscript.json` | `appsscript.json` |
| Secuencia de comandos | `Auth` | `Auth.gs` |
| Secuencia de comandos | `Utils` | `Utils.gs` |
| Secuencia de comandos | `Setup` | `Setup.gs` |
| Secuencia de comandos | `Solicitudes` | `Solicitudes.gs` |
| Secuencia de comandos | `Licencias` | `Licencias.gs` |
| Secuencia de comandos | `Planilla` | `Planilla.gs` |
| Secuencia de comandos | `Notificaciones` | `Notificaciones.gs` |
| **HTML** | `Index` | `Index.html` |

> Apps Script agrega solo la extensión: escribe `Auth`, no `Auth.gs`.
> El archivo `Index` **debe** crearse como HTML, no como secuencia de comandos.
> Borra el `Código.gs` de ejemplo que viene por defecto.

### 1.3 Poner los correos reales

Abre `Setup.gs` en el editor y edita las dos primeras constantes:

```javascript
var EMAIL_COORDINADORA = 'monica.contardo@hospitalcoquimbo.cl';
var EMAIL_KINE_PRUEBA  = 'diegonicolas.melo@gmail.com';
```

Deben ser **exactamente** las cuentas de Google con las que van a entrar.
Si el correo no coincide, la app dirá "Sin acceso al sistema".

### 1.4 Crear las hojas y los datos

1. En el selector de funciones (arriba), elige **`inicializarProyecto`**.
2. Pulsa **Ejecutar**.
3. Google pedirá autorización: **Revisar permisos → elige tu cuenta →
   Configuración avanzada → Ir a (nombre del proyecto) → Permitir**.
   La advertencia de "app no verificada" es normal: la app es tuya.
4. Mira el registro de ejecución. Debe decir:
   `✅ Proyecto inicializado — roster 2026 con 15 personas listo.`

Vuelve a la planilla: ahora tiene 6 hojas con el roster y los feriados.

### 1.5 Publicar la web app

1. Botón **Implementar → Nueva implementación**.
2. Icono ⚙️ junto a "Seleccionar tipo" → **Aplicación web**.
3. Configura:
   - **Ejecutar como**: `Yo (tu correo)`
   - **Quién tiene acceso**: `Cualquier usuario con cuenta de Google`
     ⚠️ **No** elijas "Cualquier usuario" a secas — sin sesión de Google el
     login no puede funcionar.
4. **Implementar** → copia la **URL de la aplicación web** (termina en `/exec`).
   Guárdala, la necesitas en la Parte 2.
5. Ábrela en el navegador. Deberías entrar directo con tu cuenta.

> **¿Dice "Sin acceso al sistema"?** La pantalla te muestra qué cuenta detectó.
> Si no coincide con la de `Setup.gs`, corrige la constante y ejecuta la
> función **`corregirAcceso()`**. Para un diagnóstico completo ejecuta
> **`diagnosticoProyecto()`** y mira el registro.

---

## Parte 2 · La PWA (instalable en el teléfono)

### 2.1 Publicar en GitHub Pages

1. En GitHub, entra a tu repositorio → **Settings** → **Pages**.
2. En *Source* elige **Deploy from a branch**.
3. Selecciona la rama (`main`, o la rama donde está este código) y la
   carpeta **`/ (root)`**. **Save**.
4. Espera ~1 minuto. Tu PWA queda en:

```
https://diegonicolasmelo-cell.github.io/KINE-GESTION-/pwa/
```

### 2.2 Conectarla con la app

Abre esa URL. Como aún no conoce tu implementación, muestra un campo:
**pega ahí la URL `/exec`** de la Parte 1 y pulsa *Conectar*.

Queda guardada en ese dispositivo. Si quieres dejarla fija para todo el equipo
(así nadie tiene que pegarla), edita `pwa/config.js`:

```javascript
var APP_URL = "https://script.google.com/macros/s/TU_ID/exec";
```

…y sube el cambio. GitHub Pages se actualiza solo.

### 2.3 Instalar en el teléfono

- **Android / Chrome**: menú ⋮ → *Instalar aplicación* (o acepta el banner).
- **iPhone / Safari**: botón Compartir → *Añadir a pantalla de inicio*.

> **Atajo para el equipo:** puedes mandarles un enlace que ya trae la URL
> configurada, así solo tienen que instalar:
> `https://…github.io/KINE-GESTION-/pwa/?url=TU_URL_EXEC`
> (Por seguridad solo se aceptan URLs de `script.google.com`.)

---

## Parte 3 · Comprobar que quedó bien

| Prueba | Resultado esperado |
|---|---|
| Abrir la web app | Entra directo, sin pedir usuario ni contraseña |
| Ver el calendario | Muestra la rotación L/N de tu equipo |
| Crear una solicitud FL | Llega correo de acuse; aparece en *Mis Permisos* |
| Entrar como coordinadora | Aparece el menú **Admin** con la solicitud pendiente |
| Aprobar esa solicitud | Descuenta el saldo; sale en la **Planilla** |
| Abrir la PWA en el móvil | Ícono propio, sin barra del navegador |

Si algo falla, ejecuta `diagnosticoProyecto()` en el editor y revisa
**Ver → Registros de ejecución**.

---

## Notas de operación

**Los emails** piden una autorización extra la primera vez que se disparan.
Ejecuta `probarEmailDirecto()` una vez para autorizarlo de entrada.

**Feriados:** el instalador siembra los de 2026. Para 2027 y siguientes,
agrega filas en la hoja `FERIADOS` con formato `yyyy-MM-dd`. No requiere tocar
código.

**Dotación mínima:** viene en `1` por defecto en la hoja `CONFIGURACION`. Con
equipos de 3 personas eso significa que la alerta de descobertura casi nunca
salta. Ajusta `DOTACION_MINIMA_LARGO` y `DOTACION_MINIMA_NOCHE` al número real
que exige la unidad.

**Al actualizar el código:** `clasp push` (o pegar de nuevo) y luego
**Implementar → Administrar implementaciones → ✏️ (editar) → Versión: Nueva**.
Si creas una implementación *nueva* en vez de editar la existente, **cambia la
URL** y tendrías que reconfigurar la PWA.

**Respaldos:** Google guarda historial de versiones de la planilla
(Archivo → Historial de versiones). No necesitas respaldo manual, pero conviene
descargar una copia en Excel al cierre de cada año.
