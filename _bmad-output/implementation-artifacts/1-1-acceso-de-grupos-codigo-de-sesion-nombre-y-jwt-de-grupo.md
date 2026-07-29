---
baseline_commit: 212d62169efb6c1eacd3159c054f89c7c89dbd2a
---

# Historia 1.1: Acceso de Grupos — Código de Sesión, Nombre y JWT de Grupo

Status: done

## Story

Como grupo de estudiantes,
quiero ingresar el código alfanumérico de 6 caracteres entregado por el profesor, definir el nombre de mi grupo y recibir un JWT firmado que identifique a mi grupo en la sesión,
para que mi grupo pueda participar en las actividades del juego con una identidad segura y verificada.

## Acceptance Criteria

**AC-1:** Dado que existe una sesión activa con un grupo configurado con ese código, cuando el grupo ingresa el código correcto y proporciona un nombre de grupo, entonces el sistema emite un JWT firmado que contiene `sesionId`, `grupoId` y `nombreGrupo`, y el JWT expira cuando la sesión es cerrada.

**AC-2:** Dado que el grupo envía el mismo código de acceso una segunda vez, cuando el grupo ya había sido registrado con ese código, entonces el sistema emite un nuevo JWT para el grupo existente sin crear un grupo duplicado (login idempotente).

**AC-3:** Dado que el código de acceso no corresponde a ningún grupo en sesiones activas, cuando el grupo intenta autenticarse con ese código, entonces el sistema retorna 400 con `{ ok: false, codigo: "CODIGO_INVALIDO", error: "Código de acceso no encontrado" }`.

**AC-4:** Dado que cualquier `api.ts` de grupos recibe una petición autenticada, cuando se llama a `contextoDesdeEvento(event)`, entonces extrae `sesionId`, `grupoId` y `nombreGrupo` del token sin parsear el JWT manualmente.

## Tasks / Subtasks

- [x] Task 1 — Agregar `nombreGrupo` a `ContextoGrupo` en `seguridad.ts` (AC: 1, 4)
  - [x] Agregar `nombreGrupo: string` a la interfaz `ContextoGrupo`
  - [x] Actualizar `validarToken()` para extraer y retornar `nombreGrupo` del payload del token
  - [x] Verificar que `contextoDesdeEvento()` retorna automáticamente `nombreGrupo` (hereda de `validarToken`)

- [x] Task 2 — Corregir errores en `acceso/servicio.ts` (AC: 1, 2, 3)
  - [x] Cambiar código de error `GRUPO_NO_ENCONTRADO` → `CODIGO_INVALIDO`
  - [x] Cambiar HTTP status `404` → `400`
  - [x] Cambiar mensaje de error → `"Código de acceso no encontrado"`
  - [x] Pasar `nombreGrupo` al llamar `crearToken({sesionId, grupoId, nombreGrupo})`

- [x] Task 3 — Crear suite de pruebas `pruebas/acceso.test.ts` (AC: 1, 2, 3)
  - [x] Test: código válido → retorna token + grupo con `nombreGrupo`
  - [x] Test: código inválido → `ErrorAplicacion` con código `CODIGO_INVALIDO` y status 400
  - [x] Test: segundo login con mismo código → retorna grupoId existente sin duplicar (idempotencia)
  - [x] Test: nombre de grupo vacío → asigna nombre aleatorio de la lista predefinida

- [x] Task 4 — Verificar que `npm run verificar` pasa sin errores (tipos + pruebas + bundle)

### Review Findings

- [x] [Review][Patch] Runtime: `validarToken()` no verifica que `nombreGrupo` exista en el payload — tokens emitidos antes de este cambio retornarían `undefined` tipado como `string` [seguridad.ts:153-157]
- [x] [Review][Patch] Tests: `process.env` mutados a nivel de módulo en lugar de `beforeAll` — riesgo de contaminación entre suites [acceso.test.ts:6-7]
- [x] [Review][Patch] Tests: sin test para error `CODIGO_REQUERIDO` (código vacío o solo espacios) [acceso.test.ts]
- [x] [Review][Patch] Tests: sin test para normalización del código (`trim().toUpperCase()`) — si se elimina, los tests actuales no lo detectan [acceso.test.ts]
- [x] [Review][Patch] Tests: test de idempotencia no verifica que `segundo.token` exista ni que su `nombreGrupo` sea el actualizado [acceso.test.ts:59-68]
- [x] [Review][Patch] Tests: test de nombre vacío no verifica que el token contenga el `nombreGrupo` asignado [acceso.test.ts:70-78]
- [x] [Review][Patch] Tests: AC-3 no verifica el campo `message` de `ErrorAplicacion` (spec exige `"Código de acceso no encontrado"`) [acceso.test.ts:48-57]
- [x] [Review][Defer] Token en base64 sin cifrar incluye `nombreGrupo` en texto plano — decisión arquitectónica preexistente, no introducida aquí [seguridad.ts] — deferred, pre-existing
- [x] [Review][Defer] Ruta de error de `actualizarNombre` (fallo transitorio DynamoDB) sin cobertura de test — fuera de scope de esta historia [acceso.test.ts] — deferred, pre-existing
- [x] [Review][Defer] AC-1: expiración del JWT por tiempo fijo, no vinculada al cierre de sesión — deuda arquitectónica preexistente, no introducida aquí [seguridad.ts] — deferred, pre-existing

## Dev Notes

### Estado actual del módulo `acceso/`

**`src/acceso/servicio.ts` — 3 gaps a corregir:**

1. `ErrorAplicacion` al no encontrar el código usa `"GRUPO_NO_ENCONTRADO"` y status `404`. Debe ser `"CODIGO_INVALIDO"` con status `400` y mensaje `"Código de acceso no encontrado"`.
2. `crearToken({sesionId, grupoId})` — falta pasar `nombreGrupo`. El token resultante no contiene el nombre del grupo.
3. Sin test file en `pruebas/`. El módulo no tiene cobertura de pruebas.

**`src/compartido/seguridad.ts` — 1 gap:**

`ContextoGrupo` tiene solo `sesionId` y `grupoId`:
```typescript
export interface ContextoGrupo {
  sesionId: string;
  grupoId: string;
  // ← falta nombreGrupo: string
}
```

`validarToken()` extrae el contenido del token pero solo retorna `{sesionId, grupoId}`, ignorando `nombreGrupo` aunque esté en el payload.

### Cambios exactos en `seguridad.ts`

**Interfaz `ContextoGrupo`** — agregar `nombreGrupo`:
```typescript
export interface ContextoGrupo {
  sesionId: string;
  grupoId: string;
  nombreGrupo: string;   // ← AGREGAR
}
```

`ContenidoTokenGrupo extends ContextoGrupo` — heredará `nombreGrupo` automáticamente. No requiere cambio.

**`validarToken()` líneas 131-149** — agregar extracción de `nombreGrupo`:
```typescript
export function validarToken(token: string): ContextoGrupo {
  const contenido = validarTokenBase(token);
  if (contenido.tipo !== "grupo") {
    throw new ErrorAplicacion("El token no corresponde a un grupo", 403, "ROL_INVALIDO");
  }
  return {
    sesionId: contenido.sesionId,
    grupoId: contenido.grupoId,
    nombreGrupo: contenido.nombreGrupo,   // ← AGREGAR
  };
}
```

### Cambios exactos en `acceso/servicio.ts`

**Error al no encontrar código** — líneas 34-39:
```typescript
// ANTES
throw new ErrorAplicacion("Código de grupo inválido", 404, "GRUPO_NO_ENCONTRADO");

// DESPUÉS
throw new ErrorAplicacion("Código de acceso no encontrado", 400, "CODIGO_INVALIDO");
```

**Llamada a `crearToken()`** — líneas 62-65:
```typescript
// ANTES
const token = crearToken({
  sesionId: grupo.sesionId,
  grupoId: grupo.grupoId,
});

// DESPUÉS
const token = crearToken({
  sesionId: grupo.sesionId,
  grupoId: grupo.grupoId,
  nombreGrupo,           // ← AGREGAR (usa la variable ya calculada)
});
```

### Impacto en módulos existentes

Los siguientes módulos llaman `contextoDesdeEvento(event)` y recibirán `nombreGrupo` en el objeto retornado, pero no lo usan → **sin cambios requeridos**, TypeScript no protesta por campos extra no usados:

- `src/fase1/api.ts` — usa solo `contexto.sesionId`, `contexto.grupoId`
- `src/fase2/api.ts` — usa solo `contexto.sesionId`, `contexto.grupoId`
- `src/fase3/api.ts` — usa solo `contexto.sesionId`, `contexto.grupoId`
- `src/sesiones/api.ts` — usa solo `contexto.sesionId`, `contexto.grupoId`

**Riesgo real:** Tokens emitidos antes de este cambio no tendrán `nombreGrupo` en el payload. En el contexto de desarrollo esto es aceptable; en producción requeriría que los grupos vuelvan a hacer login.

### Patrón de test a seguir (basado en `pruebas/fase1.test.ts`)

```typescript
import { describe, expect, it } from "vitest";
import { ingresarConCodigo } from "../src/acceso/servicio.js";
import type { GrupoAcceso, RepositorioAcceso } from "../src/acceso/repositorio.js";

function crearRepositorioFalso(): RepositorioAcceso {
  const grupos: Record<string, GrupoAcceso> = {
    "ABC123": {
      sesionId: "sesion-1",
      grupoId: "grupo-1",
      nombreGrupo: "Nombre Previo",
      codigoAcceso: "ABC123",
    },
  };

  return {
    async buscarPorCodigo(codigo: string) {
      return grupos[codigo] ?? null;
    },
    async actualizarNombre(sesionId, grupoId, nombreGrupo) {
      const grupo = Object.values(grupos).find(
        g => g.sesionId === sesionId && g.grupoId === grupoId
      );
      if (grupo) grupo.nombreGrupo = nombreGrupo;
    },
  };
}
```

**Regla de tests:** NO usar `vi.mock()`. Crear repositorios falsos que implementan la interfaz manualmente. Ver `pruebas/fase1.test.ts` para el patrón exacto.

### Idempotencia del login (AC-2)

El comportamiento idempotente ya existe estructuralmente: `buscarPorCodigo()` retorna el grupo existente sin crear uno nuevo; `actualizarNombre()` es un UPDATE que sobreescribe, no un INSERT. El test debe verificar que dos llamadas al mismo código retornan el mismo `grupoId` sin errores.

**Nota sobre nombre en segundo login:** Si el grupo hace login por segunda vez sin proporcionar nombre, `servicio.ts` le asigna un nombre aleatorio de `nombresAleatorios[]`. Este comportamiento es aceptable — la lógica actual no preserva el nombre previo si el nuevo request llega vacío. No se requiere cambio en esta historia; la spec solo pide que no se cree un grupo duplicado.

### Reglas críticas del proyecto

- **Imports con `.js`** obligatorio: `import { ... } from "../compartido/seguridad.js"` (no `.ts`)
- **`noUncheckedIndexedAccess: true`**: Usar `?? "fallback"` al acceder arrays por índice
- **Todo en español**: variables, interfaces, mensajes. Solo inglés para tipos AWS SDK y `token`/`payload`
- **`ErrorAplicacion`** siempre desde `compartido/respuestas.js`, nunca construir el JSON manualmente
- **Tests**: `describe("Acceso", () => { ... })` en `pruebas/acceso.test.ts`, importar desde `../src/acceso/servicio.js`

### Ejecutar pruebas

```bash
cd backend-serverless
npm run pruebas          # solo pruebas (Vitest)
npm run verificar        # tipos + pruebas + bundle (obligatorio antes de marcar done)
```

### Project Structure Notes

- Módulo: `backend-serverless/src/acceso/` (api.ts, servicio.ts, repositorio.ts ya existen)
- Test nuevo: `backend-serverless/pruebas/acceso.test.ts`
- Compartido modificado: `backend-serverless/src/compartido/seguridad.ts`
- No crear archivos adicionales; no tocar otros módulos

### References

- [Source: _bmad-output/project-context.md#Reglas de TypeScript y Lógica de APIs]
- [Source: _bmad-output/project-context.md#Reglas de Pruebas]
- [Source: _bmad-output/planning-artifacts/epics.md#Historia 1.1]
- [Source: _bmad-output/planning-artifacts/architecture/ARCHITECTURE-SPINE.md#AD-7]
- [Source: backend-serverless/src/compartido/seguridad.ts — estado actual completo]
- [Source: backend-serverless/src/acceso/servicio.ts — estado actual completo]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: Agregado `nombreGrupo: string` a `ContextoGrupo`. Actualizado `validarToken()` para retornar `nombreGrupo` del payload. `contextoDesdeEvento()` hereda el campo sin cambios adicionales.
- Task 2: Corregido `acceso/servicio.ts`: error code `GRUPO_NO_ENCONTRADO`→`CODIGO_INVALIDO`, status `404`→`400`, mensaje actualizado, `nombreGrupo` pasado a `crearToken()`.
- Task 3: Creado `pruebas/acceso.test.ts` con 4 tests que cubren AC-1, AC-2 y AC-3. Tests usan repositorio falso manual sin `vi.mock()`. `CLAVE_TOKEN` configurado como variable de entorno de test.
- Task 4: `npm run verificar` pasa sin errores — tipos TypeScript sin errores, 19/19 tests verdes, bundle esbuild exitoso.

### File List

- `backend-serverless/src/compartido/seguridad.ts` — MODIFICADO: agregado `nombreGrupo: string` a `ContextoGrupo`; `validarToken()` retorna `nombreGrupo`
- `backend-serverless/src/acceso/servicio.ts` — MODIFICADO: error code `CODIGO_INVALIDO`, status 400, mensaje corregido, `nombreGrupo` pasado a `crearToken()`
- `backend-serverless/pruebas/acceso.test.ts` — CREADO: suite con 4 tests (código válido, código inválido, idempotencia, nombre vacío)

## Change Log

- 2026-07-28: Implementación completa de Historia 1.1. Corregidos 3 gaps en `acceso/servicio.ts` (error code, status, nombreGrupo en token). Extendida interfaz `ContextoGrupo` con `nombreGrupo`. Creada suite de pruebas con 4 tests. `npm run verificar` pasa 19/19 tests sin errores de tipos ni bundle.
