# T3b — Inventario de archivos copiados en T3a

Origen: `jaimeddelcastillo-pixel/atdiafra`, commit `ce2e802265c93248e33be4a8e58c057dc7fac5e6` (2026-10-14). Destino de bibliotecas: `src/modules/tendencias/lib/`.

| Archivo origen | Estado | Diferencia en TRACEA |
|---|---|---|
| estadistica-pno.ts | Intacto | Contenido idéntico. |
| statistics.ts | Intacto | Contenido idéntico. |
| fechas-lectura.ts | Intacto | Contenido idéntico. |
| texto-forval16.ts | Intacto | Contenido idéntico. |
| export-forval16.ts | Adaptado | Imports locales; empresa parametrizada en portada Excel. Construcción de bloques y cálculos sin cambios. |
| seleccion-forval16.ts | Adaptado | Solo imports locales. |
| word-forval16.ts | Adaptado | Identidad/logo/confidencialidad/autor del documento parametrizados; sin logo DIAFRA de respaldo; comprobaciones de canvas/Blob nulos. Estructura, cálculos y texto original restante conservados. |
| formato-forval16.ts | Adaptado | Identidad parametrizada y firmantes sin personas fijas; `{empresa}` en objetivo; persistencia trasladada al adaptador empresarial. |
| catalogos.ts | Adaptado | Conserva modelos y escalas; funciones de persistencia trasladadas al adaptador empresarial, sin eliminación. |
| objetivos-presion.ts | Adaptado | Conserva modelos; persistencia trasladada al adaptador empresarial. |
| semanas.ts | Adaptado | Conserva modelos y lógica de lecturas; persistencia/localStorage/migración legacy trasladados o no expuestos; sin borrado de semanas. |
| __tests__/estadistica-pno.test.ts | Intacto | 20 pruebas originales. |
| __tests__/fechas-lectura.test.ts | Intacto | 3 pruebas originales. |
| __tests__/texto-forval16.test.ts | Adaptado | Solo import local; 13 pruebas originales. |
| __tests__/fixtures/ins-cmb-03-t-q1-2025.json | Intacto | Mismo fixture. |
| word-forval16.ts → __tests__/word-atdiafra.reference.ts | Adaptado | Imports de prueba, logo de prueba en lugar del import JPG y comprobaciones nulas; identidad y generador originales para comparación. |
| formato-forval16.ts → __tests__/formato-atdiafra.reference.ts | Adaptado | Conserva valores/firmantes/textos originales; sin acceso a datos ni funciones de persistencia. |

## Archivos propios de TRACEA, no copias literales
`module.ts`, `Marco.tsx`, `Tablero.tsx`, `hooks.ts`, `Catalogos.tsx`, `Captura.tsx`, `Configuracion.tsx`, `lib/persistencia.ts`, `lib/pendientes.ts`, `lib/__tests__/integracion.test.ts`, `lib/__tests__/word-regresion.test.ts`.

Las pantallas originales **no** se copiaron literalmente: T3a creó pantallas de TRACEA que todavía no incluyen todas las acciones del origen. La matriz de equivalencia identifica las diferencias pendientes; «T3a cerrado» no equivale a equivalencia completa de todas las funciones de atdiafra.

## Copias todavía pendientes de T3b
Reportes, gráficas, registro AT y sus auxiliares (incluidos `normativo.ts`, `export-normativo.ts`, `chart-renderer.ts`, `imagen-grafica.ts`, `fotos-bitacora.ts` y `export-utils.ts`) y `extract-bitacora/index.ts` se inventarían en la matriz. No se han copiado ni implementado en esta verificación previa.

## Resultado de pruebas
Nueva ejecución: **36/36 originales y 42/42 totales**, incluida la regresión Word (1/1). Alcance y limitaciones documentados en `t3b_verificacion_previa.md`.