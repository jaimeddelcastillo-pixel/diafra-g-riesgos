# T3b — Verificación previa

## Resultado
No se han cambiado pantallas, cálculos, textos, permisos ni datos de Tendencias. La implementación se detiene ante incompatibilidades con T2, conforme al requisito de avisar antes de corregirlas. La matriz exhaustiva se entrega por separado en `t3b_matriz_equivalencia.md`.

## Regresión de Word y motor
- Ejecución nueva: `bunx vitest run src/modules/tendencias/lib/__tests__`: **42/42**, cinco archivos de pruebas, incluida **1/1 regresión Word**.
- El origen tiene 36 pruebas: 20 de estadística, 3 de fechas y 13 de textos. TRACEA conserva esas pruebas y añade cinco de integración y una de Word.
- La regresión usa el mismo fixture `ins-cmb-03-t-q1-2025.json`, identidad DIAFRA de prueba, mismos firmantes y logo proporcionado a ambos generadores.
- Compara cinco partes del documento: `document.xml`, `header1.xml`, `footer1.xml`, `numbering.xml` y `styles.xml`, normalizando identificadores de relaciones; compara asimismo tablas, textos y bytes de imágenes.
- Alcance exacto: prueba automática en memoria de un Word emitido, **no** lectura real de `tend_formato`, ni comparación binaria completa del ZIP, ni Word borrador. Las pruebas de navegador son de Jaime, como pide T3b.
- La referencia local Word se cotejó con el origen: diferencias solo de imports/logo de prueba y comprobación de canvas/Blob nulos. La referencia de formato conserva los valores originales, sin funciones de persistencia. No se modificó ninguna referencia ni cálculo.

## Incompatibilidades confirmadas en la base actual
| Requisito | Situación actual | Decisión antes de corregir |
|---|---|---|
| Borrador → revisión → emisión | Los únicos estados son borrador, emitido y anulado; el origen tampoco tiene estado revisión. | Elegir revisión como etapa persistida o como revisión del borrador sin nuevo estado. |
| Anular un borrador con motivo | El control actual solo permite anular emitidos. RS/suplente elaborador o modificador tampoco puede anular su propia versión. | Permitir borrador → anulado, conservando motivo y separación de funciones, sin dar escritura a super_admin. |
| Correo de suplencia y registrar resultado | El control de suplencias permite únicamente revocar; rechaza modificar enviado/error incluso con un cliente de servicio sin actor. | Operación servidor específica, autenticada y auditada, que solo registre el resultado del aviso. |
| Nombre histórico del RS sustituido | Se conservan nombre/cargo del suplente y del autorizador, no el nombre del RS sustituido. | Conservar esa identidad al emitir, sin reconstruirla usando un RS posterior. |
| Trazabilidad y consumo por extracción | T2 no tiene registros de extracción ni contador de esta función. El origen solo devuelve el consumo; no lo conserva. | Añadir almacenamiento de propuestas y consumo, con límite exclusivamente desde plan_limites. |
| Prompt original, sin identidad DIAFRA fija | El origen trae tres prompts según sistema, todos con DIAFRA fijo; para agua devuelve texto vacío. | Autorizar parametrizar únicamente identidad y registrar las variantes en la skill; decidir cómo abordar agua sin inventar un prompt «original». |
| Textos/estructura Word intactos y nuevas etiquetas | El origen no representa suplencia, Autoemitido ni anulado. | Añadir solo las leyendas expresamente pedidas, sin alterar estructura/cálculos; decidir si un anulado se exporta y con qué marca. |
| Abrir un emitido tal como se guardó | AT no congela la versión de formato ni todos los datos del reporte; el origen tampoco garantiza esa congelación. | Guardar instantáneas para nuevas emisiones; no inventar identidad o datos de emisiones históricas. |

## Semánticas existentes que no se corrigen por cuenta propia
- `version` aumenta en cada guardado/cambio de estado; coincide con atdiafra. No se introduce un contador documental independiente sin autorización.
- `autoemitido` solo es verdadero cuando el RS elaborador/modificador emite con la excepción empresarial encendida; no significa simplemente que el interruptor esté encendido. La excepción nunca aplica al suplente.
- El motivo de una nueva versión está en la nueva fila y aparece en el historial en la siguiente operación; no se reescriben las instantáneas previas.
- La insuficiencia de muestra (<20) se verifica antes de exportar; no se afirma que T2 ya aplique esta condición en la emisión.

## Fuera de alcance
No se toca Riesgos ni Cerebro. No se añade firma electrónica Part 11 (Fase 5), causa raíz ni auditoría externa. Ninguna prueba se ejecuta contra datos reales DIAFRA. No se publica la aplicación.