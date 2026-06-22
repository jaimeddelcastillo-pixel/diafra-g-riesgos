## Objetivo

Permitir que el **super admin de TRACEA** gestione los documentos de la sección **Recursos** (PNO-AMGR-01, Formato AMGR, PNO-AMGR-02, Formato AMGR Med, y cualquier otro recurso público) desde el Panel — actualmente solo se sirven en modo lectura desde el bucket `tracea-recursos`.

Buenas noticias: las políticas RLS del bucket `tracea-recursos` ya permiten INSERT/UPDATE/DELETE a `is_super_admin()` y lectura pública, así que no hace falta migración.

## Cambios

### 1. Nueva página `src/pages/AdminRecursos.tsx` (ruta `/admin/recursos`)

- Protegida con `ProtectedRoute` exigiendo super admin (igual que `/admin/protocolos`).
- Dos secciones:
  - **Recursos oficiales fijos** (los 4 que consume `Recursos.tsx`): tarjeta por cada uno con su `storagePath` esperado (`PNO-AMGR-01.pdf`, `formato-amgr.pdf`, `PNO-AMGR-02.pdf`, `formato-amgr-med.pdf`), mostrando: estado (Cargado / Falta), fecha de última actualización, tamaño, botones **Reemplazar** (upload con `upsert: true`), **Descargar** y **Eliminar**.
  - **Otros archivos del bucket**: listado dinámico de `storage.list("")` del bucket `tracea-recursos`, con upload libre (nombre de archivo configurable), descarga y eliminación. Útil para versiones adicionales o anexos.
- Validaciones: solo PDF/DOCX, máximo 20 MB, confirmación antes de eliminar.
- Toda acción se registra en `audit_trail` vía un `insert` directo (`tabla='tracea_recursos'`, `accion='UPLOAD'|'DELETE'|'REPLACE'`, `valor_nuevo` con path/size) para cumplir la regla core de Audit Trail.

### 2. Ruta en `src/App.tsx`

Añadir `<Route path="/admin/recursos" element={<AdminRecursos />} />` junto a las otras rutas admin (línea ~80).

### 3. Tarjeta de acceso en `src/pages/Admin.tsx`

Añadir una tarjeta "Recursos públicos" en el grid del panel super admin, con ícono `FolderOpen` y link a `/admin/recursos`. Sigue el mismo patrón visual que las tarjetas existentes (Protocolos, Cursos, Folios).

## Lo que NO cambia

- `src/pages/Recursos.tsx` (vista cliente) sigue idéntica: lee los mismos paths fijos, así que en cuanto el super admin reemplace un archivo todos los clientes verán la nueva versión sin tocar código.
- No se crean tablas ni se modifica RLS — las políticas existentes ya cubren el caso.
- No se altera el bucket `org-documentos` ni el flujo de documentos por organización.

## Archivos

- **Crear**: `src/pages/AdminRecursos.tsx`
- **Editar**: `src/App.tsx`, `src/pages/Admin.tsx`
