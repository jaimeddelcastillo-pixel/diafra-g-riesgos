# T3a — Tendencias

## Entregado
- `src/modules/tendencias/`: registro del módulo, tablero, catálogos, captura semanal con fotos individuales y por lote, configuración y adaptadores de persistencia.
- `src/modules/tendencias/lib/`: motor estadístico, fechas, textos, bloques, Excel y generador Word copiados de atdiafra; Word todavía no expuesto en pantallas (T3b).
- Pruebas originales y fixture, referencias del generador original y regresión Word.
- Integración en registro de módulos, navegación beta e Inicio; beta sin oferta comercial.

## Verificación
- atdiafra: 36 pruebas del motor; TRACEA: 36/36 originales y 42/42 totales (5 reglas de integración y 1 regresión Word).
- Último resultado del compilador: build OK.
- Navegador adminqa: menú beta; alta de sistema HVAC, área No clasificada e instrumento; semana de presiones con 15 lecturas, foto abierta y datos recuperados al recargar; logo y firmante QA guardados y recuperados; pendientes de Inicio visibles.
- Operador adminqa: catálogos visibles, sin acciones de edición.
- QA Starter sin módulo: Tendencias ausente de menú/Inicio y acceso directo bloqueado.
- Ninguna cadena DIAFRA fija fuera de las referencias/fixtures de pruebas dentro del módulo; enlace tracea.site conservado.
- Las altas de prueba quedan en adminqa, sin borrar registros ni modificar empresas reales.

## Diferencias autorizadas
- T2 ampliado para admitir No clasificada, como atdiafra; permisos sin cambios.
- Identidad y configuración parametrizadas desde la empresa y tend_formato; persistencia aislada del motor y fotos privadas por empresa.
- No se replica el borrado de semanas del adaptador original, conforme a la regla de no eliminación.
- Imports y dependencias adaptados; biblioteca ES2021 para replaceAll del motor original.

## Fuera de T3a
T3b: análisis/Word visibles, registro AT y emisión/anulación/nueva versión, suplencias con aviso al RS y reintentos, extracción IA y consumo por empresa.