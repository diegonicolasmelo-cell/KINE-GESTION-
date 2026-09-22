// ============================================
// DATOS DE MUESTRA — transcritos de las hojas de respaldo
// (Aline Campos · Rodrigo Caamaño · Katherine Albarnez, jul–nov 2026)
// ============================================
//
// ⚠️ TRANSCRIPCIÓN APROXIMADA desde fotografías. Sirve para ver el
//    prototipo funcionando con casos reales, NO como fuente de verdad.
//    Verificar contra las hojas originales antes de cargar nada.
//
// No se incluyen RUT ni datos personales más allá del nombre, que ya
// está en el roster del proyecto.
//
// tipo:  LM = licencia médica · FF = feriado fraccionado
//        FL = feriado legal   · ADM = administrativo
//        DC = días compensatorios (ley de urgencia)
//        CAP = capacitación    · PRE = licencia prenatal
// ============================================

var REEMPLAZANTES = [
  { id: 'R1', nombre: 'Aline Campos',      orden: 1, estado: 'Activo' },
  { id: 'R2', nombre: 'Rodrigo Caamaño',   orden: 2, estado: 'Activo' },
  { id: 'R3', nombre: 'Katherine Albarnez', orden: 3, estado: 'Orientación' }
];

// desde/hasta   = período del respaldo
// anotado       = fecha en que se registró (la letra chica de la hoja)
// absorbidoPor  = id del respaldo que lo dejó sin efecto por contenerlo entero
var RESPALDOS = [
  // ---- Aline Campos ----
  { id:'A01', quien:'R1', titular:'Carlos Moreno',      tipo:'LM',  desde:'2026-07-07', hasta:'2026-07-12', anotado:'2026-07-06', estado:'Vigente' },
  { id:'A02', quien:'R1', titular:'Andrés Ángel',       tipo:'FF',  desde:'2026-07-23', hasta:'2026-07-28', anotado:'2026-07-08', estado:'Vigente' },
  { id:'A03', quien:'R1', titular:'Andrés Ángel',       tipo:'FF',  desde:'2026-07-31', hasta:'2026-08-03', anotado:'2026-07-08', estado:'Anulado', nota:'Anulado' },
  { id:'A04', quien:'R1', titular:'Felipe Guerrero',    tipo:'FF',  desde:'2026-07-20', hasta:'2026-07-21', anotado:'2026-07-20', estado:'Anulado', nota:'Anulado' },
  { id:'A05', quien:'R1', titular:'Felipe Guerrero',    tipo:'FF',  desde:'2026-07-21', hasta:'2026-07-24', anotado:'2026-07-23', estado:'Vigente' },
  { id:'A06', quien:'R1', titular:'Karen González',     tipo:'LM',  desde:'2026-08-04', hasta:'2026-08-08', anotado:'2026-07-30', estado:'Corregido', nota:'Recorte al 8 de agosto · correo 03/08' },
  { id:'A07', quien:'R1', titular:'Natalia Parra',      tipo:'FF',  desde:'2026-07-13', hasta:'2026-07-13', anotado:'2026-08-05', estado:'Anulado', nota:'Anulado · correo 07/08' },
  { id:'A08', quien:'R1', titular:'Karen González',     tipo:'LM',  desde:'2026-07-29', hasta:'2026-07-29', anotado:'2026-08-05', estado:'Vigente' },
  { id:'A09', quien:'R1', titular:'Natalia Parra',      tipo:'FF',  desde:'2026-07-10', hasta:'2026-07-12', anotado:'2026-08-07', estado:'Vigente' },
  { id:'A10', quien:'R1', titular:'Natalia Parra',      tipo:'LM',  desde:'2026-08-09', hasta:'2026-08-13', anotado:'2026-08-10', estado:'Vigente' },
  { id:'A11', quien:'R1', titular:'Natalia Parra',      tipo:'LM',  desde:'2026-08-16', hasta:'2026-08-23', anotado:'2026-08-10', estado:'Vigente' },
  { id:'A12', quien:'R1', titular:'Eduardo González',   tipo:'LM',  desde:'2026-08-24', hasta:'2026-09-03', anotado:'2026-08-14', estado:'Vigente' },
  { id:'A13', quien:'R1', titular:'Natalia Parra',      tipo:'LM',  desde:'2026-09-04', hasta:'2026-09-07', anotado:'2026-08-24', estado:'Vigente' },
  { id:'A14', quien:'R1', titular:'Sergio Ortiz',       tipo:'LM',  desde:'2026-09-11', hasta:'2026-09-28', anotado:'2026-08-15', estado:'Vigente' },
  { id:'A15', quien:'R1', titular:'Carlos Moreno',      tipo:'LM',  desde:'2026-09-08', hasta:'2026-09-08', anotado:'2026-09-04', estado:'Vigente' },
  { id:'A16', quien:'R1', titular:'Felipe Guerrero',    tipo:'FF',  desde:'2026-10-16', hasta:'2026-10-19', anotado:'2026-09-08', estado:'Vigente' },
  { id:'A17', quien:'R1', titular:'Carlos Moreno',      tipo:'LM',  desde:'2026-10-23', hasta:'2026-10-23', anotado:'2026-09-09', estado:'Vigente' },
  { id:'A18', quien:'R1', titular:'Andrés Ángel',       tipo:'LM',  desde:'2026-09-29', hasta:'2026-10-13', anotado:'2026-09-03', estado:'Vigente' },
  { id:'A19', quien:'R1', titular:'—',                  tipo:'DC',  desde:'2026-11-05', hasta:'2026-11-05', anotado:'2026-09-09', estado:'Vigente', nota:'Día compensatorio' },

  // ---- Rodrigo Caamaño ----
  { id:'B01', quien:'R2', titular:'Diego Melo',         tipo:'FF',  desde:'2026-06-10', hasta:'2026-06-10', anotado:'2026-08-28', estado:'Vigente', nota:'Anotado 2 meses después' },
  { id:'B02', quien:'R2', titular:'Diego Melo',         tipo:'FF',  desde:'2026-07-07', hasta:'2026-07-07', anotado:'2026-08-28', estado:'Vigente' },
  { id:'B03', quien:'R2', titular:'Natalia Parra',      tipo:'FF',  desde:'2026-07-13', hasta:'2026-07-13', anotado:'2026-08-04', estado:'Vigente' },
  { id:'B04', quien:'R2', titular:'Karen González',     tipo:'FL',  desde:'2026-07-30', hasta:'2026-08-03', anotado:'2026-07-30', estado:'Vigente' },
  { id:'B05', quien:'R2', titular:'Natalia Parra',      tipo:'LM',  desde:'2026-08-14', hasta:'2026-08-15', anotado:'2026-08-10', estado:'Vigente' },
  { id:'B06', quien:'R2', titular:'Eduardo González',   tipo:'LM',  desde:'2026-08-16', hasta:'2026-08-23', anotado:'2026-08-14', estado:'Vigente' },
  { id:'B07', quien:'R2', titular:'Natalia Parra',      tipo:'LM',  desde:'2026-08-24', hasta:'2026-09-03', anotado:'2026-08-24', estado:'Vigente' },
  { id:'B08', quien:'R2', titular:'Carlos Moreno',      tipo:'LM',  desde:'2026-09-04', hasta:'2026-09-07', anotado:'2026-09-04', estado:'Vigente' },
  { id:'B09', quien:'R2', titular:'Carlos Moreno',      tipo:'LM',  desde:'2026-09-10', hasta:'2026-09-10', anotado:'2026-09-04', estado:'Vigente' },
  { id:'B10', quien:'R2', titular:'Mauricio Ortega',    tipo:'LM',  desde:'2026-09-11', hasta:'2026-09-12', anotado:'2026-09-14', estado:'Vigente' },
  { id:'B11', quien:'R2', titular:'Mauricio Ortega',    tipo:'FL',  desde:'2026-09-14', hasta:'2026-09-28', anotado:'2026-09-13', estado:'Vigente' },
  { id:'B12', quien:'R2', titular:'Sergio Ortiz',       tipo:'FF',  desde:'2026-10-09', hasta:'2026-10-13', anotado:'2026-09-02', estado:'Vigente' },
  { id:'B13', quien:'R2', titular:'Magdalena Contardo', tipo:'PRE', desde:'2026-10-14', hasta:'2026-10-31', anotado:'2026-09-08', estado:'Vigente', nota:'Licencia prenatal' },

  // ---- Katherine Albarnez (en orientación) ----
  { id:'C01', quien:'R3', titular:'Magdalena Contardo', tipo:'FF',  desde:'2026-09-14', hasta:'2026-09-16', anotado:'2026-09-03', estado:'Anulado', absorbidoPor:'C02', nota:'Absorbido: el prenatal del 14 al 28 ya incluye estos días' },
  { id:'C02', quien:'R3', titular:'Magdalena Contardo', tipo:'PRE', desde:'2026-09-14', hasta:'2026-09-28', anotado:'2026-09-08', estado:'Vigente', nota:'Licencia prenatal' }
];

var TIPOS = {
  LM:  { nombre:'Licencia médica',        color:'#E5484D' },
  FF:  { nombre:'Feriado fraccionado',    color:'#3C78D8' },
  FL:  { nombre:'Feriado legal',          color:'#2E9E5B' },
  ADM: { nombre:'Administrativo',         color:'#7C4DFF' },
  DC:  { nombre:'Días compensatorios',    color:'#F1932C' },
  CAP: { nombre:'Capacitación',           color:'#0E9AA7' },
  PRE: { nombre:'Licencia prenatal',      color:'#D6336C' }
};
