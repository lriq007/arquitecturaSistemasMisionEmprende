---
baseline_commit: 212d62169efb6c1eacd3159c054f89c7c89dbd2a
---

# Story 2.1: Crear Sesión de Juego con Grupos y Códigos de Acceso

Status: done

## Story

Como profesor,
quiero crear una sesión especificando nombre, número de grupos y alumnos, y que el sistema genere automáticamente códigos de acceso únicos por grupo,
para que pueda preparar una sesión de clase lista para que los grupos ingresen.

## Alcance de esta historia (decisión de contexto)

**Incluido:** Crear `compartido/maquinaEstados.ts` (AD-2), estado inicial `configuracion`, refactorizar `profesor/servicio.ts` para importar desde ahí, validación de grupos, tests.

**Diferido a historia 3-2:** Snapshot de temática y desafío — requiere el módulo `catalogo/` (Épica 3, en backlog). Los campos `temaElegido` y `desafioNombre` se inicializan vacíos hasta que exista el catálogo.

## Análisis del Estado Actual

### Lo que está implementado y funciona
- `crearSesiones()` en `profesor/servicio.ts:233` genera sesionId, grupos y códigos alfanuméricos de 6 chars ✅
- Distribución de alumnos en grupos (3 modos: `recomendado`, `dividir_dos`, `personalizado`) ✅
- Tests básicos de creación en `pruebas/profesor.test.ts` ✅
- `listarSesionesProfesor()`, `ejecutarAccionSesion()`, `obtenerControlSesion()` funcionan ✅

### Brechas activas (este story las cierra)

**Brecha 1 — AD-2 violado:** `FASES_ORDEN` y `TIEMPOS_POR_FASE` están inline en `profesor/servicio.ts:42-94`. No existe `compartido/maquinaEstados.ts`. Cualquier módulo que necesite validar fases duplica o copia literales de strings.

**Brecha 2 — Estado inicial incorrecto:** `crearSesiones()` en `profesor/servicio.ts:365` asigna `fase: "f1_bienvenida"`. La spec exige `fase: "configuracion"` al crear. El estado `configuracion` no está en `FASES_ORDEN` actual.

**Brecha 3 — Sin tests para estado inicial:** `pruebas/profesor.test.ts` no verifica que la sesión se crea en `configuracion`.

## Acceptance Criteria

**AC-1: Estado inicial `configuracion`**
Dado que el profesor crea una sesión exitosamente
Cuando se persiste en DynamoDB
Entonces el item SESION#metadatos tiene `fase: "configuracion"`
Y el campo `configuracion` es el primer elemento de `FASES_ORDEN` exportado desde `compartido/maquinaEstados.ts`

**AC-2: `compartido/maquinaEstados.ts` existe y exporta las constantes**
Dado que existe el archivo `backend-serverless/src/compartido/maquinaEstados.ts`
Cuando cualquier módulo necesita la lista de fases o los tiempos
Entonces importa `FASES_ORDEN` y `TIEMPOS_POR_FASE` desde `../compartido/maquinaEstados.js`
Y `profesor/servicio.ts` no contiene definiciones inline de `FASES_ORDEN` ni `TIEMPOS_POR_FASE`

**AC-3: Transiciones desde `configuracion` funcionan**
Dado que la sesión está en `configuracion`
Cuando el profesor ejecuta `siguiente_fase`
Entonces el sistema avanza a `f1_bienvenida` (el sucesor inmediato en `FASES_ORDEN`)
Y retorna el nuevo estado de la sesión

**AC-4: Validación de códigos únicos**
Dado que el sistema genera códigos de acceso
Cuando se crean N grupos en la misma sesión
Entonces los N códigos son distintos entre sí (sin colisiones dentro de la sesión)
Y cada código tiene exactamente 6 caracteres del alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`

**AC-5: Tests cubren el estado inicial**
Dado que se ejecutan `npm run pruebas` en `backend-serverless/`
Cuando se ejecuta la suite `profesor.test.ts`
Entonces hay al menos un test que verifica que `crearSesiones()` produce items con `fase: "configuracion"`
Y todos los tests existentes siguen pasando

## Tasks / Subtasks

- [x] Tarea 1: Crear `compartido/maquinaEstados.ts` (AC-1, AC-2)
  - [x] 1.1 Crear `backend-serverless/src/compartido/maquinaEstados.ts`
  - [x] 1.2 Definir y exportar `FASES_ORDEN` como `readonly` array — primer elemento: `"configuracion"`, seguido de los 24 estados actuales (ver lista en Dev Notes)
  - [x] 1.3 Definir y exportar `TIEMPOS_POR_FASE` como `Record<string, number>` — incluir `configuracion: 0`
  - [x] 1.4 Exportar el tipo derivado `FaseSesion = (typeof FASES_ORDEN)[number]`

- [x] Tarea 2: Refactorizar `profesor/servicio.ts` para usar `maquinaEstados.ts` (AC-2)
  - [x] 2.1 Agregar import: `import { FASES_ORDEN, TIEMPOS_POR_FASE } from "../compartido/maquinaEstados.js"`
  - [x] 2.2 Eliminar las definiciones inline de `FASES_ORDEN` (líneas 42-67) y `TIEMPOS_POR_FASE` (líneas 69-94) — el módulo importará las del compartido
  - [x] 2.3 Verificar que el cast `faseActual as (typeof FASES_ORDEN)[number]` en `ejecutarAccionSesion()` sigue compilando con el tipo exportado

- [x] Tarea 3: Cambiar estado inicial en `crearSesiones()` (AC-1, AC-3)
  - [x] 3.1 En `profesor/servicio.ts`, cambiar `fase: "f1_bienvenida"` → `fase: "configuracion"` en el item SESION (línea ~365)
  - [x] 3.2 Verificar que `ejecutarAccionSesion()` con `siguiente_fase` desde `configuracion` avanza a `f1_bienvenida`

- [x] Tarea 4: Actualizar y agregar tests (AC-5)
  - [x] 4.1 Agregar test: `crearSesiones()` produce items SESION con `fase: "configuracion"`
  - [x] 4.2 Agregar test: `ejecutarAccionSesion("siguiente_fase")` desde `configuracion` avanza a `f1_bienvenida`
  - [x] 4.3 Revisar `repositorioConSesiones` en `profesor.test.ts` — los tests de aislamiento inician con `fase: "f1_bienvenida"` explícito (para probar transiciones desde ese estado, no la creación); dejar así, no requieren cambio

- [x] Tarea 5: Verificar compilación y pruebas completas
  - [x] 5.1 `cd backend-serverless && npm run verificar` — tipos + pruebas + bundle deben pasar sin errores
  - [x] 5.2 Confirmar que `compartido/maquinaEstados.ts` aparece en el bundle generado

## Dev Notes

### FASES_ORDEN completo (para `maquinaEstados.ts`)

El nuevo orden con `configuracion` como primer elemento:

```typescript
export const FASES_ORDEN = [
  "configuracion",   // ← nuevo: estado inicial al crear sesión
  "f1_bienvenida",
  "f1_conocidos",
  "f1_pre_sopa",
  "f1_sopa",
  "f1_ranking",
  "mapa_f2_empatia",
  "f2_transicion",
  "f2_tematicas",
  "f2_transicion_empatia",
  "f2_bubblemap",
  "f2_ranking",
  "mapa_f3_creatividad",
  "f3_transicion_creatividad",
  "f3_lego",
  "f3_ranking",
  "mapa_f4_final",
  "f4_transicion_comunicacion",
  "f4_construccion_pitch",
  "f4_orden_pitch",
  "f4_presentacion_pitch",
  "f5_transicion_apoyo",
  "f5_evaluacion_pitch",
  "f6_ranking",
  "reflexion",
] as const;
```

`TIEMPOS_POR_FASE` mantiene los mismos valores actuales más `configuracion: 0`.

### Impacto en módulos existentes

| Módulo | Impacto | Acción |
|--------|---------|--------|
| `profesor/servicio.ts` | FASES_ORDEN y TIEMPOS_POR_FASE → eliminar | Reemplazar con import |
| `profesor/servicio.ts:365` | `fase: "f1_bienvenida"` → `fase: "configuracion"` | Cambiar literal |
| `fase1/servicio.ts` | Valida fase activa internamente | Sin cambio — `configuracion` no es f1_sopa, grupos no pueden actuar |
| `fase2/servicio.ts` | Ídem | Sin cambio |
| `fase3/servicio.ts` | Ídem | Sin cambio |
| `pruebas/profesor.test.ts` | Tests de aislamiento usan `fase: "f1_bienvenida"` explícito | Sin cambio — es intencional para probar transiciones, no creación |

### Reglas técnicas críticas

- Import con extensión `.js` obligatoria: `import { FASES_ORDEN } from "../compartido/maquinaEstados.js"`
- El tipo `FaseSesion` derivado con `(typeof FASES_ORDEN)[number]` permite que TypeScript detecte strings de fase inválidos
- `TIEMPOS_POR_FASE` debe ser `Record<string, number>` (no `Record<FaseSesion, number>`) para evitar errores con `noUncheckedIndexedAccess`

### Snapshot de temática/desafío — por qué se difiere

Los campos `temaElegido` y `desafioNombre` se inicializan vacíos en `crearSesiones()` (líneas 396-397). La AC original de la historia pide "almacenar snapshot de temática y desafío seleccionados". Esto requiere:
1. Un catálogo de temáticas (historia 3-1) 
2. Un catálogo de desafíos (historia 3-2)

Ambas historias están en estado `backlog`. La historia 3-2 ("Gestión de Desafíos y Snapshot en Creación de Sesión") cubre explícitamente el snapshot. Se difiere allí. No tocar `temaElegido`/`desafioNombre` en este story.

### Estructura de archivo `compartido/maquinaEstados.ts`

Pertenece a `backend-serverless/src/compartido/` junto a `baseDatos.ts`, `respuestas.ts` y `seguridad.ts`. No agregar lógica de negocio aquí — solo constantes y el tipo derivado.

### Ejecutar pruebas

```bash
cd backend-serverless
npm run pruebas        # solo pruebas
npm run verificar      # tipos + pruebas + bundle
```

### Project Structure Notes

- `compartido/maquinaEstados.ts` es un nuevo archivo en módulo existente — agregar al `empaquetar:verificar` en `package.json` NO es necesario porque no es un entry point Lambda, sino un módulo compartido importado por otros
- El bundler (esbuild) lo incluirá automáticamente como dependencia de `profesor/api.ts`
- Verificar que aparece en el bundle con `npm run verificar`

### References

- FASES_ORDEN actual: [Source: backend-serverless/src/profesor/servicio.ts#42-67]
- TIEMPOS_POR_FASE actual: [Source: backend-serverless/src/profesor/servicio.ts#69-94]
- Estado inicial (bug): [Source: backend-serverless/src/profesor/servicio.ts#365]
- AD-2: [Source: _bmad-output/planning-artifacts/epics.md#105]
- AC de la historia: [Source: _bmad-output/planning-artifacts/epics.md#346-378]
- Sprint status nota: [Source: _bmad-output/implementation-artifacts/sprint-status.yaml#98-103]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Snapshot de temática/desafío diferido a historia 3-2 (requiere módulo `catalogo/`, Épica 3 en backlog)
- Tests de aislamiento existentes (`repositorioConSesiones` con `fase: "f1_bienvenida"` explícito) no requieren cambio — son fixtures para probar transiciones, no el estado de creación
- `maquinaEstados.ts` no se declara como entry point en `package.json` porque no es un handler Lambda
- Test AC-3 usa repo inline con `actualizarSesion` que captura `cambios.fase` para poder verificar la fase resultante (ya que `repositorioConSesiones` tiene no-op para ese método)
- `npm run verificar` (34 tests, 0 errores de tipos, bundle generado) pasó exitosamente
- `FASES_ORDEN` y `TIEMPOS_POR_FASE` eliminados de `profesor/servicio.ts` — ahora se importan desde `compartido/maquinaEstados.js`

### File List

- `backend-serverless/src/compartido/maquinaEstados.ts` — NUEVO
- `backend-serverless/src/profesor/servicio.ts` — MODIFICADO (eliminado FASES_ORDEN/TIEMPOS_POR_FASE inline, agregado import, cambiado estado inicial a "configuracion")
- `backend-serverless/pruebas/profesor.test.ts` — MODIFICADO (agregados tests de AC-1 y AC-3)

### Review Findings

- [x] [Review][Decision] Sesiones previas permanentemente inaccesibles — resuelto con `scripts/migrarProfesorId.ts`. Ejecutar: `NOMBRE_TABLA=<tabla> PROFESOR_ID=<id> npm run migrar:profesorId`
- [x] [Review][Patch] Fallback `"profesor-principal"` reemplazado por error explícito `CONFIGURACION_INVALIDA` si `PROFESOR_ID` no está definido [servicio.ts:75]
- [x] [Review][Patch] AC-4 cubierto: 2 tests nuevos verifican alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` y unicidad de códigos [profesor.test.ts]
- [x] [Review][Patch] `describe` de aislamiento renombrado a `"Aislamiento de sesiones por profesor (historia 1-4)"` [profesor.test.ts]
- [x] [Review][Patch] `afterEach` reubicado después de los imports, antes del primer `describe` [profesor.test.ts]
- [x] [Review][Patch] `repositorioConSesiones` actualizado: defaults de `fase` cambiados a `"configuracion"` [profesor.test.ts]
- [x] [Review][Defer] Estado `finalizado`/cierre de sesión ausente de `FASES_ORDEN` [maquinaEstados.ts] — deferred, pre-existing (documentado en sprint-status.yaml, historias 2-3 y 6-4)

## Change Log

- 2026-07-28: Implementación completa historia 2-1. Creado `compartido/maquinaEstados.ts` (AD-2), refactorizado `profesor/servicio.ts` para importar constantes desde ahí, cambiado estado inicial de sesión a `"configuracion"`, agregados 2 tests nuevos. 34/34 tests pasan.
- 2026-07-28: Code review — 1 decision_needed, 5 patch, 1 defer, 5 dismissed.
