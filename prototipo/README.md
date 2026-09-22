# Prototipo de visualización de respaldos

Página autocontenida para **ver** cómo quedaría el registro de respaldos en la
plataforma. No está conectada a Apps Script: es una maqueta funcional para
acordar el diseño antes de implementar.

## Cómo abrirla

Doble click en `respaldos.html`, o servirla:

```bash
python3 -m http.server 8000
# luego abrir http://localhost:8000/prototipo/respaldos.html
```

## Qué muestra

| Vista | Para qué |
|---|---|
| **Línea de continuidad** | Una barra por reemplazante en el tiempo. Los huecos sobre el umbral salen marcados. Es la vista que hoy no existe en ninguna parte. |
| **Registro** | La carpeta, pero ordenable por fecha de ejecución **o** por fecha de anotación, y filtrable por persona, concepto y estado. |
| **Alertas** | Lo que el sistema detecta solo: dobles respaldos el mismo día, anotaciones tardías, lagunas, anulados. |
| **Anotar respaldo** | Los campos de la hoja de papel, con vista previa de los días que genera. |

## Los datos

`datos-muestra.js` tiene 34 respaldos transcritos de las hojas de Aline Campos,
Rodrigo Caamaño y Katherine Albarnez (jul–nov 2026).

> ⚠️ **Transcripción aproximada desde fotografías.** Sirve para ver el prototipo
> con casos reales, no como fuente de verdad. Verificar contra los originales
> antes de cargar nada al sistema. No incluye RUT ni datos personales.

Para probar con otros datos, editar ese archivo: es un array plano de objetos
`{ id, quien, titular, tipo, desde, hasta, anotado, estado, nota }`.

## Para Manuel

La lógica reutilizable está en el `<script>` de `respaldos.html`:

- `fusionar()` — une períodos que se tocan, para calcular cobertura real
- `lagunasDe()` — huecos de una persona sobre un umbral
- `pintarAlertas()` — detección de días duplicados y anotaciones tardías

Esas tres funciones son las que hay que portar al backend. El resto es
presentación.

La especificación completa del módulo está en el documento de respaldos.
