---
baseline_commit: 212d62169efb6c1eacd3159c054f89c7c89dbd2a
---

# Historia 1.4: Aislamiento de Sesiones por Profesor — Resolución Deuda Técnica AD-3

Status: done

## Story

Como profesor,
quiero que cada petición a mis sesiones sea filtrada por mi `profesorId` a nivel de la consulta DynamoDB,
para que no pueda leer ni modificar sesiones de otros profesores, incluso con un token válido.

## Acceptance Criteria

**AC-1:** Dado que el Profesor A está autenticado con su `profesorId` en el token, cuando solicita listar sus sesiones, entonces la query DynamoDB usa `GSI1PK = PROFESOR#{profesorId}` como condición obligatoria de filtro y ninguna sesión de otro profesor aparece en el resultado.

**AC-2:** Dado que el Profesor A construye una petición apuntando a una `sesionId` que pertenece al Profesor B, cuando realiza cualquier acción sobre esa sesión (leer estado, avanzar fase, cerrar sesión), entonces el sistema verifica la propiedad usando `profesorId` del token contra el dueño almacenado en DynamoDB y retorna 403 con `{ ok: false, codigo: "ACCESO_DENEGADO", error: "No tienes acceso a esta sesión" }` si la propiedad no coincide.

**AC-3:** Dado cualquier endpoint de profesor en `api.ts`, cuando llega una petición autenticada, entonces `profesorId` se obtiene siempre del token validado, nunca del body o query string (NFR-014).

## Tasks / Subtasks

- [x] Task 1 — Agregar `profesorId` al token de profesor en `compartido/seguridad.ts` (AC: 3)
  - [x] Agregar `profesorId: string` a la interfaz `ContextoProfesor`
  - [x] Agregar `profesorId: string` a la interfaz `ContenidoTokenProfesor`
  - [x] Cambiar firma de `crearTokenProfesor(profesorId: string)` — recibe el id y lo embebe en el token
  - [x] Modificar `validarProfesorDesdeEvento()` — retorna `{ rol: "profesor", profesorId }` en vez de solo `{ rol: "profesor" }`

- [x] Task 2 — Agregar parámetro `PROFESOR_ID` en `backend-serverless/template.yaml` (AC: 3)
  - [x] Agregar parámetro SAM `ProfesorId` con `Default: "profesor-principal"` y `NoEcho: true`
  - [x] Agregar `PROFESOR_ID: !Ref ProfesorId` dentro de `Globals > Function > Environment > Variables`

- [x] Task 3 — Actualizar `profesor/servicio.ts` para usar `profesorId` en todas las operaciones (AC: 1, 2, 3)
  - [x] `ingresarProfesor(codigo)`: leer `process.env.PROFESOR_ID || "profesor-principal"` y pasarlo a `crearTokenProfesor(profesorId)`; incluir `profesorId` en la respuesta
  - [x] Cambiar firma de `listarSesionesProfesor` a `(profesorId: string, repositorio)` — eliminar `correoProfesor` opcional
  - [x] Cambiar firma de `crearSesiones` a `(profesorId: string, entrada, repositorio)` — usar `GSI1PK = PROFESOR#${profesorId}` y agregar campo `profesorId` en metadata de sesión
  - [x] Cambiar firma de `obtenerControlSesion` a `(sesionId, profesorId, repositorio)` — agregar verificación de propiedad antes de retornar datos
  - [x] Cambiar firma de `ejecutarAccionSesion` a `(sesionId, accion, profesorId, repositorio)` — agregar verificación de propiedad antes de ejecutar
  - [x] Extraer función privada `verificarPropiedadSesion(sesion, profesorId)` que lanza `ErrorAplicacion(403, "ACCESO_DENEGADO")` si la propiedad no coincide

- [x] Task 4 — Actualizar `profesor/repositorio.ts` para aislamiento real en DynamoDB (AC: 1)
  - [x] Cambiar firma de `listarSesiones(profesorId: string)` — eliminar el parámetro opcional y el fallback `ScanCommand`; siempre query por `PROFESOR#${profesorId}`
  - [x] Agregar `profesorId` al `SesionResumen` interface (para que sea visible en respuestas del listado)

- [x] Task 5 — Actualizar `profesor/api.ts` para leer `profesorId` del token (AC: 3)
  - [x] Capturar el resultado de `validarProfesorDesdeEvento(event)` en `const contextoProfesor` (actualmente el resultado se descarta en línea 57)
  - [x] Eliminar `event.queryStringParameters?.correo` del handler de `GET /api/profesor/sesiones`
  - [x] Pasar `contextoProfesor.profesorId` a todas las funciones de servicio que lo requieran: `crearSesiones`, `listarSesionesProfesor`, `obtenerControlSesion`, `ejecutarAccionSesion`

- [x] Task 6 — Actualizar y ampliar `pruebas/profesor.test.ts` (AC: 1, 2, 3)
  - [x] Agregar `process.env.PROFESOR_ID = "prof-test"` al setup del archivo de tests
  - [x] Adaptar test existente "permite ingresar con la clave configurada": verificar que el token incluye `profesorId` extraíble con `validarProfesorDesdeEvento` (o decodificación manual)
  - [x] Adaptar tests existentes de `crearSesiones`: agregar `"prof-test"` como primer argumento
  - [x] Test nuevo: `listarSesionesProfesor("prof-A", repositorio)` retorna solo las sesiones de `prof-A`; sesiones de `prof-B` no aparecen (AC-1)
  - [x] Test nuevo: `obtenerControlSesion(sesionId, "prof-B", repositorio)` lanza `ACCESO_DENEGADO` (403) cuando la sesión le pertenece a `prof-A` (AC-2)
  - [x] Test nuevo: `ejecutarAccionSesion(sesionId, "siguiente_fase", "prof-B", repositorio)` lanza `ACCESO_DENEGADO` (403) (AC-2)

- [x] Task 7 — Ejecutar `npm run verificar` (tipos + pruebas + bundle) y confirmar que pasa sin errores

### Review Findings

- [x] [Review][Decision] `nombreGrupo` bundled en esta historia — aceptado: corrección retroactiva al gap de historia 1-1.
- [x] [Review][Decision] `TimeToLiveSpecification` bundled en `template.yaml` — aceptado: infraestructura TTL incluida en este commit.
- [x] [Review][Patch] `validarProfesorDesdeEvento` devuelve `profesorId: ""` en vez de lanzar `TOKEN_INVALIDO` cuando el campo falta en el token — permite que tokens legacy operen con identidad vacía [seguridad.ts:202]
- [x] [Review][Patch] Falta test de happy-path: propietario correcto no debe recibir `ACCESO_DENEGADO` en `obtenerControlSesion` ni `ejecutarAccionSesion` [profesor.test.ts]
- [x] [Review][Patch] `process.env.PROFESOR_ID` seteado en tests sin limpieza en `afterEach` — fuga de estado entre suites [profesor.test.ts:52,66]
- [x] [Review][Defer] Paginación: `QueryCommand` no maneja `LastEvaluatedKey` en `listarSesiones` [repositorio.ts] — deferred, pre-existing
- [x] [Review][Defer] Cobertura AC-2 para acción "cerrar sesión" — acción aún no implementada (historia 2-3) — deferred, pre-existing
- [x] [Review][Defer] Colisión GSI1PK entre sesiones y códigos de acceso en el mismo GSI — diseño pre-existente, mitigado con `.filter(tipo === "SESION")` [repositorio.ts] — deferred, pre-existing
- [x] [Review][Defer] Aislamiento real requiere identidad per-usuario — con una sola `CLAVE_ACCESO_PROFESOR` compartida todos obtienen el mismo `profesorId` — deferred, pre-existing, limitación del modelo mono-profesor

## Dev Notes

### El problema central (AD-3)

La deuda técnica AD-3 dice: "El token de profesor debe incluir `profesorId` estable. FR-005 no está implementado hasta que el token lleve identidad."

**Estado actual — lo que NO funciona:**

```typescript
// compartido/seguridad.ts — línea 13
export interface ContextoProfesor {
  rol: "profesor";            // ← sin profesorId
}

// compartido/seguridad.ts — línea 79
export function crearTokenProfesor(): string {  // ← no recibe id
  return crearTokenBase({
    tipo: "profesor",
    rol: "profesor",          // ← solo el rol, sin identidad
  });
}

// compartido/seguridad.ts — línea 185
export function validarProfesorDesdeEvento(event) {
  // ...
  return { rol: "profesor" };  // ← no retorna profesorId
}

// profesor/api.ts — línea 57
validarProfesorDesdeEvento(event);  // ← resultado DESCARTADO, no se usa

// profesor/api.ts — línea 63
const correo = event.queryStringParameters?.correo;  // ← violación NFR-014
```

### Diseño de la solución

**Derivación del `profesorId` en el flujo de clave estática:**

Cognito no está disponible. El profesor se autentica con `CLAVE_ACCESO_PROFESOR`. No hay "correo en el login". Se introduce `PROFESOR_ID` en `template.yaml` como parámetro SAM, con default `"profesor-principal"`. `ingresarProfesor` lo lee de `process.env.PROFESOR_ID` y lo embebe en el token.

```
POST /api/profesor/ingresar { codigo: "profe123" }
  → servicio lee process.env.PROFESOR_ID = "profesor-principal"
  → crearTokenProfesor("profesor-principal")
  → token contiene: { tipo:"profesor", rol:"profesor", profesorId:"profesor-principal", exp:... }
```

**Flujo de aislamiento en listar sesiones:**

```
GET /api/profesor/sesiones
  → api.ts: contextoProfesor = validarProfesorDesdeEvento(event) → { rol, profesorId }
  → servicio: listarSesionesProfesor(contextoProfesor.profesorId, repositorio)
  → repositorio: QueryCommand GSI1PK = PROFESOR#profesor-principal (NO ScanCommand)
```

**Flujo de verificación de propiedad al acceder a sesión:**

```
GET /api/profesor/sesiones/{sesionId}
  → api.ts: contextoProfesor = validarProfesorDesdeEvento(event)
  → servicio: obtenerControlSesion(sesionId, contextoProfesor.profesorId, repositorio)
  → obtenerSesion(sesionId) → item.profesorId
  → if (String(sesion.profesorId || "") !== profesorId) → throw 403 ACCESO_DENEGADO
```

### Cambios exactos en `compartido/seguridad.ts`

```typescript
// ANTES
export interface ContextoProfesor {
  rol: "profesor";
}

// DESPUÉS
export interface ContextoProfesor {
  rol: "profesor";
  profesorId: string;
}

// ANTES
interface ContenidoTokenProfesor extends ContextoProfesor {
  tipo: "profesor";
  exp: number;
}

// DESPUÉS
interface ContenidoTokenProfesor extends ContextoProfesor {
  tipo: "profesor";
  exp: number;
  // profesorId ya viene de ContextoProfesor extendido
}

// ANTES
export function crearTokenProfesor(): string {
  return crearTokenBase({
    tipo: "profesor",
    rol: "profesor",
  });
}

// DESPUÉS
export function crearTokenProfesor(profesorId: string): string {
  return crearTokenBase({
    tipo: "profesor",
    rol: "profesor",
    profesorId,
  });
}

// ANTES — validarProfesorDesdeEvento retorna solo {rol}
export function validarProfesorDesdeEvento(event): ContextoProfesor {
  // ...
  return { rol: "profesor" };
}

// DESPUÉS — retorna {rol, profesorId}
export function validarProfesorDesdeEvento(event): ContextoProfesor {
  const contenido = validarTokenBase(obtenerBearer(event));
  if (contenido.tipo !== "profesor") {
    throw new ErrorAplicacion(
      "El token no corresponde a un profesor",
      403,
      "ROL_INVALIDO",
    );
  }
  return {
    rol: "profesor",
    profesorId: String((contenido as ContenidoTokenProfesor).profesorId || ""),
  };
}
```

**ADVERTENCIA de compatibilidad hacia atrás:** Tokens de profesor emitidos antes de este cambio no tendrán `profesorId`. El campo `(contenido as ContenidoTokenProfesor).profesorId` será `undefined` → `String(undefined || "")` = `""`. Esto es aceptable en dev: los tokens expirarán o el profesor volverá a autenticarse.

### Cambios exactos en `profesor/servicio.ts`

#### `ingresarProfesor(codigo)`
```typescript
// ANTES
export function ingresarProfesor(codigo: string) {
  // ...valida código...
  return {
    ok: true,
    token: crearTokenProfesor(),
    rol: "profesor",
  };
}

// DESPUÉS
export function ingresarProfesor(codigo: string) {
  // ...misma validación de código...
  const profesorId = process.env.PROFESOR_ID || "profesor-principal";
  return {
    ok: true,
    token: crearTokenProfesor(profesorId),
    rol: "profesor",
    profesorId,
  };
}
```

#### `crearSesiones` — firma nueva y metadata
```typescript
// ANTES
export async function crearSesiones(
  entrada: CrearSesionesEntrada,
  repositorio: RepositorioProfesor,
)

// DESPUÉS
export async function crearSesiones(
  profesorId: string,
  entrada: CrearSesionesEntrada,
  repositorio: RepositorioProfesor,
)
```

En el item de SESION dentro de `items.push({...})`, agregar:
```typescript
profesorId,                          // ← NUEVO campo en metadata
GSI1PK: `PROFESOR#${profesorId}`,   // ← antes era PROFESOR#${correoProfesor}
GSI1SK: `SESION#${ahora}#${sesionId}`,
```

Mantener `correoProfesor` en el item (se sigue usando para mostrar en la vista). Solo el `GSI1PK` cambia a `PROFESOR#${profesorId}`.

#### `listarSesionesProfesor` — firma nueva
```typescript
// ANTES
export async function listarSesionesProfesor(
  correoProfesor: string | undefined,
  repositorio: RepositorioProfesor,
)

// DESPUÉS
export async function listarSesionesProfesor(
  profesorId: string,
  repositorio: RepositorioProfesor,
)
```

El servicio pasa `profesorId` directamente al repositorio. Sin fallback.

#### `obtenerControlSesion` — firma nueva con ownership check
```typescript
// ANTES
export async function obtenerControlSesion(
  sesionId: string,
  repositorio: RepositorioProfesor,
)

// DESPUÉS
export async function obtenerControlSesion(
  sesionId: string,
  profesorId: string,
  repositorio: RepositorioProfesor,
)
```

Agregar después de obtener `sesion`:
```typescript
const sesion = elementos.find((item) => item.SK === "METADATOS");
if (!sesion) { throw new ErrorAplicacion("...", 404, "SESION_NO_ENCONTRADA"); }

// NUEVO: verificación de propiedad
verificarPropiedadSesion(sesion, profesorId);
```

#### `ejecutarAccionSesion` — firma nueva con ownership check
```typescript
// ANTES
export async function ejecutarAccionSesion(
  sesionId: string,
  accion: AccionSesion,
  repositorio: RepositorioProfesor,
)

// DESPUÉS
export async function ejecutarAccionSesion(
  sesionId: string,
  accion: AccionSesion,
  profesorId: string,
  repositorio: RepositorioProfesor,
)
```

Agregar después de obtener `sesion`:
```typescript
const sesion = await repositorio.obtenerSesion(sesionId);
if (!sesion) { throw new ErrorAplicacion("...", 404, "SESION_NO_ENCONTRADA"); }

// NUEVO: verificación de propiedad
verificarPropiedadSesion(sesion, profesorId);
```

#### Función privada `verificarPropiedadSesion`
```typescript
function verificarPropiedadSesion(
  sesion: ItemDynamo,
  profesorId: string,
): void {
  const duenio = String(sesion.profesorId || "");
  if (duenio !== profesorId) {
    throw new ErrorAplicacion(
      "No tienes acceso a esta sesión",
      403,
      "ACCESO_DENEGADO",
    );
  }
}
```

**Nota sobre sesiones sin `profesorId`:** Sesiones creadas antes de este cambio tendrán `duenio = ""`. Como `profesorId` nunca es `""` (es `"profesor-principal"` como mínimo), esas sesiones retornarán 403. Esto es correcto: las sesiones antiguas quedan huérfanas y el profesor debe crear sesiones nuevas.

### Cambios exactos en `profesor/repositorio.ts`

#### `RepositorioProfesor` — interfaz
```typescript
// ANTES
listarSesiones(
  correoProfesor?: string,
): Promise<SesionResumen[]>;

// DESPUÉS
listarSesiones(
  profesorId: string,
): Promise<SesionResumen[]>;
```

#### `SesionResumen` — agregar profesorId
```typescript
export interface SesionResumen {
  sesionId: string;
  nombre: string;
  correoProfesor: string;
  facultad: string;
  fase: string;
  fechaCreacion: string;
  totalGrupos: number;
  totalAlumnos: number;
  profesorId: string;  // ← NUEVO
}
```

Actualizar `convertirSesion`:
```typescript
function convertirSesion(item): SesionResumen {
  return {
    // ...campos existentes...
    profesorId: String(item.profesorId || ""),  // ← NUEVO
  };
}
```

#### `listarSesiones(profesorId: string)` — sin ScanCommand
```typescript
// DESPUÉS: siempre QueryCommand, sin Scan fallback
async listarSesiones(profesorId: string): Promise<SesionResumen[]> {
  const resultado = await baseDatos.send(
    new QueryCommand({
      TableName: nombreTabla(),
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `PROFESOR#${profesorId}`,
      },
      ScanIndexForward: false,
    }),
  );

  const items = (resultado.Items ?? []) as Array<Record<string, unknown>>;

  return items
    .filter((item) => item.tipo === "SESION")
    .map((item) => convertirSesion(item))
    .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
},
```

**El bloque `ScanCommand` se elimina completamente.** Esto resuelve el riesgo de que todos los profesores pudieran ver todas las sesiones si el correo se omitía.

También eliminar `ScanCommand` del import si queda sin uso.

### Cambios exactos en `profesor/api.ts`

```typescript
// ANTES — línea 57: resultado de validarProfesorDesdeEvento se descarta
validarProfesorDesdeEvento(event);

// DESPUÉS — capturar contextoProfesor
const contextoProfesor = validarProfesorDesdeEvento(event);

// ANTES — listar sesiones usa query string
const correo = event.queryStringParameters?.correo;
return respuestaJson(200, await listarSesionesProfesor(correo, repositorioProfesor));

// DESPUÉS — listar sesiones usa profesorId del token (AC-3)
return respuestaJson(200, await listarSesionesProfesor(
  contextoProfesor.profesorId,
  repositorioProfesor,
));

// ANTES — crear sesiones
await crearSesiones(entrada, repositorioProfesor)

// DESPUÉS — crear sesiones con profesorId
await crearSesiones(contextoProfesor.profesorId, entrada, repositorioProfesor)

// ANTES — obtener control sesión
await obtenerControlSesion(decodeURIComponent(sesionIdDetalle), repositorioProfesor)

// DESPUÉS
await obtenerControlSesion(
  decodeURIComponent(sesionIdDetalle),
  contextoProfesor.profesorId,
  repositorioProfesor,
)

// ANTES — ejecutar acción
await ejecutarAccionSesion(decodeURIComponent(sesionIdAccion), entrada.accion, repositorioProfesor)

// DESPUÉS
await ejecutarAccionSesion(
  decodeURIComponent(sesionIdAccion),
  entrada.accion,
  contextoProfesor.profesorId,
  repositorioProfesor,
)
```

**IMPORTANTE:** El `validarProfesorDesdeEvento` ya está siendo llamado en la línea 57, antes del bloque de rutas. Solo hay que capturar su retorno.

### Cambios en `pruebas/profesor.test.ts`

Los tests existentes tienen estas llamadas que deben actualizarse:

```typescript
// ANTES — línea 72
await crearSesiones({ nombre: "Prueba", correoProfesor: "...", ... }, memoria.repositorio)

// DESPUÉS
await crearSesiones("prof-test", { nombre: "Prueba", correoProfesor: "...", ... }, memoria.repositorio)
```

El test de `ingresarProfesor` debe verificar que el token incluye `profesorId`:

```typescript
it("el token emitido por ingresarProfesor incluye profesorId extraíble", () => {
  process.env.CLAVE_ACCESO_PROFESOR = "profe123";
  process.env.CLAVE_TOKEN = "clave-de-prueba-con-mas-de-treinta-y-dos-caracteres";
  process.env.PROFESOR_ID = "prof-test";

  const resultado = ingresarProfesor("profe123");

  expect(resultado.ok).toBe(true);
  expect(resultado.profesorId).toBe("prof-test");
  // Verificar que el token decodificado contiene profesorId
  const [cuerpoB64] = resultado.token.split(".");
  const contenido = JSON.parse(Buffer.from(cuerpoB64!, "base64url").toString("utf8"));
  expect(contenido.profesorId).toBe("prof-test");
});
```

Repositorio falso ampliado para los nuevos tests:

```typescript
function repositorioConSesiones(
  itemsPorSesion: Record<string, { profesorId: string; sesion: Partial<ItemDynamo>; grupos?: Partial<ItemDynamo>[] }>,
) {
  const repositorio: RepositorioProfesor = {
    async guardarProfesor() {},
    async guardarItems() {},
    async listarSesiones(profesorId: string): Promise<SesionResumen[]> {
      return Object.entries(itemsPorSesion)
        .filter(([, v]) => v.profesorId === profesorId)
        .map(([sesionId, v]) => ({
          sesionId,
          nombre: String(v.sesion.nombre ?? "Sesión"),
          correoProfesor: String(v.sesion.correoProfesor ?? ""),
          facultad: "",
          fase: "f1_bienvenida",
          fechaCreacion: new Date().toISOString(),
          totalGrupos: 1,
          totalAlumnos: 0,
          profesorId: v.profesorId,
        }));
    },
    async obtenerSesion(sesionId: string): Promise<ItemDynamo | null> {
      const entrada = itemsPorSesion[sesionId];
      if (!entrada) return null;
      return {
        PK: `SESION#${sesionId}`,
        SK: "METADATOS",
        tipo: "SESION",
        sesionId,
        profesorId: entrada.profesorId,
        fase: "f1_bienvenida",
        ...entrada.sesion,
      } as ItemDynamo;
    },
    async listarElementosSesion(sesionId: string): Promise<ItemDynamo[]> {
      const entrada = itemsPorSesion[sesionId];
      if (!entrada) return [];
      const metadatos: ItemDynamo = {
        PK: `SESION#${sesionId}`,
        SK: "METADATOS",
        tipo: "SESION",
        sesionId,
        profesorId: entrada.profesorId,
        fase: "f1_bienvenida",
        ...entrada.sesion,
      };
      return [metadatos, ...(entrada.grupos ?? []).map(g => ({
        PK: `SESION#${sesionId}`,
        SK: `GRUPO#${g.grupoId ?? "g1"}`,
        tipo: "GRUPO",
        ...g,
      } as ItemDynamo))];
    },
    async actualizarSesion() {},
  };
  return repositorio;
}
```

### Reglas técnicas del proyecto a respetar

- **Imports con `.js`**: `import { crearTokenProfesor } from "../compartido/seguridad.js"`
- **`noUncheckedIndexedAccess: true`**: `String((contenido as ContenidoTokenProfesor).profesorId || "")`
- **Todo en español**: `profesorId`, `verificarPropiedadSesion`, `contextoProfesor`, `duenio`
- **`ErrorAplicacion`** con 3 args: `(mensaje, estado, codigo)` — estado antes que codigo
- **No usar `vi.mock()`** — repositorios falsos implementados manualmente
- **`crearTokenProfesor`** se llama en servicio, no en api — la DI se mantiene

### Archivos a modificar

| Archivo | Acción | Descripción del cambio |
|---|---|---|
| `backend-serverless/src/compartido/seguridad.ts` | MODIFICAR | Agregar `profesorId` a `ContextoProfesor`, `ContenidoTokenProfesor`; actualizar `crearTokenProfesor` y `validarProfesorDesdeEvento` |
| `backend-serverless/template.yaml` | MODIFICAR | Agregar parámetro `ProfesorId` y variable de entorno `PROFESOR_ID` |
| `backend-serverless/src/profesor/servicio.ts` | MODIFICAR | Firmas de las 4 funciones públicas; función privada `verificarPropiedadSesion`; `ingresarProfesor` lee PROFESOR_ID |
| `backend-serverless/src/profesor/repositorio.ts` | MODIFICAR | Firma de `listarSesiones`, interfaz `SesionResumen`, eliminar `ScanCommand` |
| `backend-serverless/src/profesor/api.ts` | MODIFICAR | Capturar `contextoProfesor`; eliminar lectura de `queryStringParameters?.correo`; pasar `profesorId` a servicios |
| `backend-serverless/pruebas/profesor.test.ts` | MODIFICAR | Adaptar tests existentes; agregar setup `PROFESOR_ID`; agregar 3 tests nuevos de aislamiento |

**No crear archivos nuevos.** No tocar módulos de otras fases (fase1, fase2, fase3, sesiones, acceso).

### Ejecución de pruebas

```bash
cd backend-serverless
npm run pruebas        # solo pruebas
npm run verificar      # tipos + pruebas + bundle (obligatorio antes de marcar done)
```

### Project Structure Notes

- Módulo afectado principal: `backend-serverless/src/profesor/` — los tres archivos del módulo se modifican
- Módulo compartido: `backend-serverless/src/compartido/seguridad.ts` — interfaz y dos funciones
- Infraestructura: `backend-serverless/template.yaml` — solo el bloque `Parameters` y `Globals.Function.Environment.Variables`
- Tests: `backend-serverless/pruebas/profesor.test.ts` — NO reemplazar, EXTENDER y adaptar
- El `ScanCommand` en `repositorio.ts` se elimina — era un riesgo de seguridad latente

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Historia 1.4]
- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements — AD-3]
- [Source: _bmad-output/project-context.md#Arquitectura: Clean Architecture adaptada a Serverless]
- [Source: _bmad-output/project-context.md#Reglas de TypeScript y Lógica de APIs]
- [Source: _bmad-output/project-context.md#Reglas de Pruebas]
- [Source: backend-serverless/src/compartido/seguridad.ts — estado actual líneas 12-24, 79-84, 185-201]
- [Source: backend-serverless/src/profesor/api.ts — línea 57 (resultado descartado), línea 63 (query string violación NFR-014)]
- [Source: backend-serverless/src/profesor/servicio.ts — firmas actuales de las 4 funciones exportadas]
- [Source: backend-serverless/src/profesor/repositorio.ts — ScanCommand en listarSesiones (líneas 203-225)]
- [Source: backend-serverless/pruebas/profesor.test.ts — tests existentes a adaptar]
- [Source: backend-serverless/template.yaml — sección Globals > Function > Environment > Variables]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Resuelve AD-3 completamente: `profesorId` embebido en el token JWT del profesor, derivado de `process.env.PROFESOR_ID` (SAM parameter `ProfesorId`, default `"profesor-principal"`).
- `ContextoProfesor` ahora incluye `profesorId: string`; `validarProfesorDesdeEvento` lo extrae del token validado.
- `crearTokenProfesor(profesorId)` acepta el id y lo incluye en el payload del token.
- `ScanCommand` eliminado de `repositorio.ts`; `listarSesiones` siempre usa `QueryCommand` con `GSI1PK = PROFESOR#${profesorId}`.
- `SesionResumen` expone `profesorId` para trazabilidad.
- `verificarPropiedadSesion` privada lanza 403/ACCESO_DENEGADO si el `duenio` de la sesión no coincide con el `profesorId` del token.
- `api.ts` captura `contextoProfesor` y propaga `profesorId` a todos los servicios; eliminado el uso de `queryStringParameters?.correo` (violación NFR-014).
- 30/30 tests pasan (5 archivos): 3 tests nuevos de aislamiento + 2 tests adaptados en `profesor.test.ts`.
- `npm run verificar` (tipos + pruebas + bundle) sin errores.

### File List

- backend-serverless/src/compartido/seguridad.ts
- backend-serverless/template.yaml
- backend-serverless/src/profesor/servicio.ts
- backend-serverless/src/profesor/repositorio.ts
- backend-serverless/src/profesor/api.ts
- backend-serverless/pruebas/profesor.test.ts

## Change Log

- 2026-07-28: Implementación completa Historia 1-4 — AD-3 resuelto. `profesorId` en token, filtro GSI1 por profesor, verificación de propiedad en obtenerControlSesion y ejecutarAccionSesion, eliminación de ScanCommand, 3 nuevos tests de aislamiento. 30/30 tests pasan.
