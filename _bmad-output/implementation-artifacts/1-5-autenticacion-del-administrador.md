---
baseline_commit: 212d62169efb6c1eacd3159c054f89c7c89dbd2a
---

# Historia 1.5: Autenticación del Administrador

Status: done

## Story

Como administrador,
quiero autenticarme con un mecanismo separado del profesor para acceder al panel de configuración del catálogo,
para que el rol de administrador esté limpiamente separado del acceso de profesores y la gestión del catálogo esté apropiadamente restringida.

## Acceptance Criteria

**AC-1:** Dado que el sistema tiene un endpoint `POST /api/admin/ingresar`, cuando un usuario envía la clave admin correcta, entonces el sistema emite un token de dominio con `rol: admin` y `adminId` en el payload, y retorna `{ ok: true, token: "...", rol: "admin", adminId: "..." }`.

**AC-2:** Dado un token de profesor (sin `rol: admin`), cuando se usa para acceder a una ruta de catálogo restringida a admin (vía `validarAdminDesdeEvento`), entonces el sistema retorna 403 con `{ ok: false, codigo: "ROL_INVALIDO", error: "El token no corresponde a un administrador" }`.

**AC-3:** Dado un token de admin, cuando se usa para acceder a rutas de gestión de sesiones del profesor (vía `validarProfesorDesdeEvento`), entonces el sistema retorna 403 con `{ ok: false, codigo: "ROL_INVALIDO", error: "El token no corresponde a un profesor" }`.

**AC-4:** Dado que el administrador envía una clave incorrecta, cuando llama a `POST /api/admin/ingresar`, entonces el sistema retorna 401 con `{ ok: false, codigo: "CREDENCIALES_INVALIDAS", error: "Clave de administrador incorrecta" }`.

## Tasks / Subtasks

- [x] Task 1 — Extender `compartido/seguridad.ts` con soporte de token admin (AC: 1, 2, 3)
  - [x] Agregar `export interface ContextoAdmin { rol: "admin"; adminId: string; }` (análogo a `ContextoProfesor`)
  - [x] Agregar `interface ContenidoTokenAdmin extends ContextoAdmin { tipo: "admin"; exp: number; }` (análogo a `ContenidoTokenProfesor`)
  - [x] Extender `ContenidoToken` = `ContenidoTokenGrupo | ContenidoTokenProfesor | ContenidoTokenAdmin`
  - [x] Extender `ContenidoTokenSinExp` con `| Omit<ContenidoTokenAdmin, "exp">`
  - [x] Agregar `export function crearTokenAdmin(adminId: string): string` — llama a `crearTokenBase({ tipo: "admin", rol: "admin", adminId })`
  - [x] Agregar `export function validarAdminDesdeEvento(event: APIGatewayProxyEventV2): ContextoAdmin` — verifica `contenido.tipo === "admin"`, lanza `ROL_INVALIDO` 403 si no coincide, retorna `{ rol: "admin", adminId: String((contenido as ContenidoTokenAdmin).adminId || "") }`

- [x] Task 2 — Crear `admin/servicio.ts` (AC: 1, 4)
  - [x] Importar `crearTokenAdmin` desde `../compartido/seguridad.js`
  - [x] Importar `ErrorAplicacion` desde `../compartido/respuestas.js`
  - [x] Crear función `export function ingresarAdmin(clave: string): { ok: true; token: string; rol: "admin"; adminId: string }` siguiendo exactamente el patrón de `ingresarProfesor`:
    - Leer `process.env.CLAVE_ACCESO_ADMIN || "admin123"` con `timingSafeEqual`
    - Leer `process.env.ADMIN_ID?.trim()` (lanzar `ErrorAplicacion(500, "CONFIGURACION_INVALIDA", "Variable ADMIN_ID no configurada")` si falta)
    - Si clave inválida: `throw new ErrorAplicacion("Clave de administrador incorrecta", 401, "CREDENCIALES_INVALIDAS")`
    - Si clave válida: retornar `{ ok: true, token: crearTokenAdmin(adminId), rol: "admin", adminId }`
  - [x] **No crear `admin/repositorio.ts`** — el admin no necesita DynamoDB para autenticarse

- [x] Task 3 — Crear `admin/api.ts` (AC: 1, 4)
  - [x] Seguir exactamente el patrón de `profesor/api.ts`: handler `manejador`, try/catch con `responderError`, rutas con `if (ruta === ... && metodo === ...)`
  - [x] Importar `leerJson`, `responderError`, `respuestaJson` desde `../compartido/respuestas.js`
  - [x] Importar `validarAdminDesdeEvento` desde `../compartido/seguridad.js`
  - [x] Importar `ingresarAdmin` desde `./servicio.js`
  - [x] Ruta pública: `POST /api/admin/ingresar` → llama a `ingresarAdmin(entrada.clave)`, retorna `respuestaJson(200, resultado)`
  - [x] Ruta de verificación (para Épica 3): Tras validar con `validarAdminDesdeEvento`, implementar `GET /api/admin/perfil` que retorna `{ ok: true, rol: contextoAdmin.rol, adminId: contextoAdmin.adminId }` — sirve como endpoint de prueba de que el token admin funciona
  - [x] Ruta catch-all: `respuestaJson(404, { ok: false, error: "Ruta no encontrada" })`

- [x] Task 4 — Actualizar `template.yaml` (AC: 1)
  - [x] Agregar parámetro `ClaveAccesoAdmin` (tipo `String`, `NoEcho: true`, `Default: admin123`, descripción clara)
  - [x] Agregar parámetro `AdminId` (tipo `String`, `NoEcho: true`, `Default: admin-principal`, descripción clara)
  - [x] Agregar variables de entorno globales: `CLAVE_ACCESO_ADMIN: !Ref ClaveAccesoAdmin` y `ADMIN_ID: !Ref AdminId` dentro de `Globals > Function > Environment > Variables`
  - [x] Agregar recurso `FuncionAdmin` copiando la estructura de `FuncionProfesor` (CodeUri: `.`, Handler: `src/admin/api.manejador`, Role: `arn:aws:iam::876388743639:role/LabRole`)
  - [x] Registrar eventos HTTP en `FuncionAdmin`:
    - `IngresarAdmin`: `POST /api/admin/ingresar`
    - `PerfilAdmin`: `GET /api/admin/perfil`
  - [x] Agregar `Metadata > BuildMethod: esbuild` con `EntryPoints: [src/admin/api.ts]`, mismas opciones que `FuncionProfesor`
  - [x] Agregar `src/admin/api.ts` al script `empaquetar:verificar` en `package.json`

- [x] Task 5 — Crear `pruebas/admin.test.ts` (AC: 1, 4)
  - [x] Setup: `process.env.CLAVE_ACCESO_ADMIN = "admin-test"` y `process.env.ADMIN_ID = "admin-test-id"` antes de cada test (en `beforeEach`, limpiar en `afterEach` con `delete process.env.CLAVE_ACCESO_ADMIN` etc.)
  - [x] Test AC-1 happy path: `ingresarAdmin("admin-test")` retorna `{ ok: true, rol: "admin", adminId: "admin-test-id" }` y el token decodificado contiene `tipo: "admin"` y `adminId: "admin-test-id"`
  - [x] Test AC-4: `ingresarAdmin("clave-incorrecta")` lanza `ErrorAplicacion` con `codigo: "CREDENCIALES_INVALIDAS"` y status 401
  - [x] Test AC-2 (token cruzado profesor→admin): generar un token de profesor con `crearTokenProfesor("prof-test")`, llamar a `validarAdminDesdeEvento` con ese token en el header, verificar que lanza `ROL_INVALIDO` 403
  - [x] Test AC-3 (token cruzado admin→profesor): generar un token admin con `crearTokenAdmin("admin-test-id")`, llamar a `validarProfesorDesdeEvento` con ese token en el header, verificar que lanza `ROL_INVALIDO` 403
  - [x] Importar con extensión `.js`: `import { ingresarAdmin } from "../src/admin/servicio.js"`
  - [x] Usar `crearTokenProfesor` y `crearTokenAdmin` desde `../src/compartido/seguridad.js` para los tests de cross-rejection

- [x] Task 6 — Ejecutar `npm run verificar` (tipos + pruebas + bundle) y confirmar que pasa sin errores

## Dev Notes

### Contexto: sin Cognito, mismo patrón que el profesor

La cuenta educativa AWS Academy no tiene Cognito disponible. La historia 1-3 estableció el patrón: autenticación con clave estática desde env var, `profesorId` desde `PROFESOR_ID`. **Esta historia replica exactamente ese patrón para el admin**, usando `CLAVE_ACCESO_ADMIN` y `ADMIN_ID`.

El `rol: admin` en el token es lo que separa al admin del profesor: `validarAdminDesdeEvento` rechaza tokens de profesor; `validarProfesorDesdeEvento` ya rechaza tokens de admin (porque `tipo !== "profesor"`). No hace falta tocar el código existente de profesor para que AC-3 funcione.

### Estado actual de `compartido/seguridad.ts` — lo que HAY que modificar

```typescript
// ANTES — línea 27: solo dos tipos en la unión
type ContenidoToken = ContenidoTokenGrupo | ContenidoTokenProfesor;

// ANTES — línea 29-31: igual
type ContenidoTokenSinExp =
  | Omit<ContenidoTokenGrupo, "exp">
  | Omit<ContenidoTokenProfesor, "exp">;
```

```typescript
// DESPUÉS — agregar admin a ambas uniones
type ContenidoToken =
  | ContenidoTokenGrupo
  | ContenidoTokenProfesor
  | ContenidoTokenAdmin;

type ContenidoTokenSinExp =
  | Omit<ContenidoTokenGrupo, "exp">
  | Omit<ContenidoTokenProfesor, "exp">
  | Omit<ContenidoTokenAdmin, "exp">;
```

Nuevas definiciones a agregar **después de la línea 25** (`interface ContenidoTokenProfesor`):

```typescript
export interface ContextoAdmin {
  rol: "admin";
  adminId: string;
}

interface ContenidoTokenAdmin extends ContextoAdmin {
  tipo: "admin";
  exp: number;
}
```

Nuevas funciones a agregar al final del archivo:

```typescript
export function crearTokenAdmin(adminId: string): string {
  return crearTokenBase({
    tipo: "admin",
    rol: "admin",
    adminId,
  });
}

export function validarAdminDesdeEvento(
  event: APIGatewayProxyEventV2,
): ContextoAdmin {
  const contenido = validarTokenBase(obtenerBearer(event));

  if (contenido.tipo !== "admin") {
    throw new ErrorAplicacion(
      "El token no corresponde a un administrador",
      403,
      "ROL_INVALIDO",
    );
  }

  const adminId = String(
    (contenido as ContenidoTokenAdmin).adminId || "",
  );

  if (!adminId) {
    throw new ErrorAplicacion(
      "Token sin identidad de administrador",
      401,
      "TOKEN_INVALIDO",
    );
  }

  return {
    rol: "admin",
    adminId,
  };
}
```

### Implementación completa de `admin/servicio.ts`

```typescript
import { timingSafeEqual } from "node:crypto";

import { ErrorAplicacion } from "../compartido/respuestas.js";
import { crearTokenAdmin } from "../compartido/seguridad.js";

export function ingresarAdmin(
  clave: string,
): { ok: true; token: string; rol: "admin"; adminId: string } {
  const claveEsperada =
    process.env.CLAVE_ACCESO_ADMIN || "admin123";

  const claveValida =
    clave.length === claveEsperada.length &&
    timingSafeEqual(
      Buffer.from(clave),
      Buffer.from(claveEsperada),
    );

  if (!claveValida) {
    throw new ErrorAplicacion(
      "Clave de administrador incorrecta",
      401,
      "CREDENCIALES_INVALIDAS",
    );
  }

  const adminId = process.env.ADMIN_ID?.trim();

  if (!adminId) {
    throw new ErrorAplicacion(
      "Variable de entorno ADMIN_ID no configurada",
      500,
      "CONFIGURACION_INVALIDA",
    );
  }

  return {
    ok: true,
    token: crearTokenAdmin(adminId),
    rol: "admin",
    adminId,
  };
}
```

### Implementación completa de `admin/api.ts`

```typescript
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

import {
  leerJson,
  responderError,
  respuestaJson,
} from "../compartido/respuestas.js";
import {
  validarAdminDesdeEvento,
} from "../compartido/seguridad.js";
import { ingresarAdmin } from "./servicio.js";

interface IngresoAdminEntrada {
  clave: string;
}

export async function manejador(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const ruta = event.requestContext.http.path;
    const metodo = event.requestContext.http.method;

    if (ruta === "/api/admin/ingresar" && metodo === "POST") {
      const entrada = leerJson<IngresoAdminEntrada>(event);
      return respuestaJson(
        200,
        ingresarAdmin(String(entrada.clave || "")),
      );
    }

    const contextoAdmin = validarAdminDesdeEvento(event);

    if (ruta === "/api/admin/perfil" && metodo === "GET") {
      return respuestaJson(200, {
        ok: true,
        rol: contextoAdmin.rol,
        adminId: contextoAdmin.adminId,
      });
    }

    return respuestaJson(404, { ok: false, error: "Ruta no encontrada" });
  } catch (error) {
    return responderError(error);
  }
}
```

### Bloque `FuncionAdmin` para `template.yaml`

Insertar **después del bloque `FuncionProfesor`** (después de su cierre `Metadata`):

```yaml
  FuncionAdmin:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: .
      Handler: src/admin/api.manejador
      Role: arn:aws:iam::876388743639:role/LabRole
      Events:
        IngresarAdmin:
          Type: HttpApi
          Properties:
            ApiId: !Ref ApiBackend
            Path: /api/admin/ingresar
            Method: POST
        PerfilAdmin:
          Type: HttpApi
          Properties:
            ApiId: !Ref ApiBackend
            Path: /api/admin/perfil
            Method: GET
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        EntryPoints:
          - src/admin/api.ts
        Bundle: true
        Minify: false
        Sourcemap: true
        Target: es2022
        Platform: node
        Format: cjs
```

### Parámetros a agregar en `template.yaml` (sección `Parameters`)

```yaml
  ClaveAccesoAdmin:
    Type: String
    NoEcho: true
    Default: admin123
    Description: Clave temporal de acceso del administrador.

  AdminId:
    Type: String
    NoEcho: true
    Default: admin-principal
    Description: Identificador estable del administrador.
```

Variables de entorno globales a agregar en `Globals > Function > Environment > Variables`:

```yaml
        CLAVE_ACCESO_ADMIN: !Ref ClaveAccesoAdmin
        ADMIN_ID: !Ref AdminId
```

### Tests completos para `pruebas/admin.test.ts`

```typescript
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { ingresarAdmin } from "../src/admin/servicio.js";
import {
  crearTokenAdmin,
  crearTokenProfesor,
  validarAdminDesdeEvento,
  validarProfesorDesdeEvento,
} from "../src/compartido/seguridad.js";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

function eventoConToken(token: string): APIGatewayProxyEventV2 {
  return {
    headers: { authorization: `Bearer ${token}` },
    requestContext: { http: { method: "GET", path: "/api/admin/perfil" } },
  } as unknown as APIGatewayProxyEventV2;
}

describe("Admin — autenticación", () => {
  beforeEach(() => {
    process.env.CLAVE_ACCESO_ADMIN = "admin-test";
    process.env.ADMIN_ID = "admin-test-id";
    process.env.CLAVE_TOKEN = "clave-de-prueba-con-mas-de-treinta-y-dos-caracteres";
    process.env.CLAVE_ACCESO_PROFESOR = "profe123";
    process.env.PROFESOR_ID = "prof-test";
  });

  afterEach(() => {
    delete process.env.CLAVE_ACCESO_ADMIN;
    delete process.env.ADMIN_ID;
    delete process.env.CLAVE_TOKEN;
    delete process.env.CLAVE_ACCESO_PROFESOR;
    delete process.env.PROFESOR_ID;
  });

  it("emite token admin con adminId cuando la clave es correcta", () => {
    const resultado = ingresarAdmin("admin-test");
    expect(resultado.ok).toBe(true);
    expect(resultado.rol).toBe("admin");
    expect(resultado.adminId).toBe("admin-test-id");
    // Verificar contenido del token
    const [cuerpoB64] = resultado.token.split(".");
    const contenido = JSON.parse(
      Buffer.from(cuerpoB64!, "base64url").toString("utf8"),
    );
    expect(contenido.tipo).toBe("admin");
    expect(contenido.adminId).toBe("admin-test-id");
  });

  it("lanza CREDENCIALES_INVALIDAS con clave incorrecta", () => {
    expect(() => ingresarAdmin("clave-incorrecta")).toThrow(
      expect.objectContaining({ codigo: "CREDENCIALES_INVALIDAS", estado: 401 }),
    );
  });

  it("token de profesor es rechazado por validarAdminDesdeEvento con ROL_INVALIDO 403", () => {
    const tokenProfesor = crearTokenProfesor("prof-test");
    expect(() =>
      validarAdminDesdeEvento(eventoConToken(tokenProfesor)),
    ).toThrow(
      expect.objectContaining({ codigo: "ROL_INVALIDO", estado: 403 }),
    );
  });

  it("token de admin es rechazado por validarProfesorDesdeEvento con ROL_INVALIDO 403", () => {
    const tokenAdmin = crearTokenAdmin("admin-test-id");
    expect(() =>
      validarProfesorDesdeEvento(eventoConToken(tokenAdmin)),
    ).toThrow(
      expect.objectContaining({ codigo: "ROL_INVALIDO", estado: 403 }),
    );
  });
});
```

### Reglas técnicas del proyecto a respetar

- **Imports con `.js`**: obligatorio con `moduleResolution NodeNext`
- **`noUncheckedIndexedAccess: true`**: `String((contenido as ContenidoTokenAdmin).adminId || "")` — nunca acceso directo sin guard
- **`exactOptionalPropertyTypes: true`**: no asignar `undefined` explícitamente
- **Todo en español**: `adminId`, `contextoAdmin`, `claveValida`, `claveEsperada`, `ingresarAdmin`
- **`ErrorAplicacion(mensaje, estado, codigo)`** — orden: mensaje primero, estado HTTP después, código de error al final
- **No usar `vi.mock()`** — repositorios falsos para tests de servicio (aquí no hay repositorio)
- **No crear `admin/repositorio.ts`** — el admin no necesita DynamoDB en esta historia
- **`timingSafeEqual`** de `node:crypto` para comparación de claves — mismo patrón que `ingresarProfesor`

### Archivos a crear y modificar

| Archivo | Acción | Descripción |
|---|---|---|
| `backend-serverless/src/compartido/seguridad.ts` | MODIFICAR | Agregar `ContextoAdmin`, `ContenidoTokenAdmin`, extender uniones de tipo, agregar `crearTokenAdmin`, `validarAdminDesdeEvento` |
| `backend-serverless/src/admin/api.ts` | CREAR | Handler Lambda con rutas `/api/admin/ingresar` y `/api/admin/perfil` |
| `backend-serverless/src/admin/servicio.ts` | CREAR | `ingresarAdmin(clave)` — autenticación por clave estática desde env var |
| `backend-serverless/template.yaml` | MODIFICAR | Parámetros `ClaveAccesoAdmin` y `AdminId`, variables globales, bloque `FuncionAdmin` |
| `backend-serverless/package.json` | MODIFICAR | Agregar `src/admin/api.ts` al script `empaquetar:verificar` |
| `backend-serverless/pruebas/admin.test.ts` | CREAR | Suite de tests para `ingresarAdmin` y cross-rejection de tokens |

**No tocar**: `profesor/`, `acceso/`, `sesiones/`, `fase1/`, `fase2/`, `fase3/`, `compartido/baseDatos.ts`, `compartido/respuestas.ts`, `compartido/maquinaEstados.ts`.

### Límite de scope — qué NO hacer

- **No crear rutas del catálogo** (Épica 3). `admin/api.ts` solo tiene login y perfil. Las rutas de temáticas/desafíos son de las historias 3-1 y 3-2.
- **No implementar Cognito** — el entorno educativo no lo tiene disponible (deferred-work.md).
- **No crear panel frontend** — solo backend. El frontend admin es scope de épicas posteriores.
- **No agregar DynamoDB** para admin — no es necesario para autenticarse con clave estática.

### Verificación de `package.json` — script `empaquetar:verificar`

Buscar el script `empaquetar:verificar` (o similar) en `package.json` que lista los entry points de esbuild. Agregar `src/admin/api.ts` a esa lista para que el bundle de verificación incluya el módulo admin.

### Ejecución de pruebas

```bash
cd backend-serverless
npm run pruebas        # solo pruebas
npm run verificar      # tipos + pruebas + bundle (obligatorio antes de marcar done)
```

### Project Structure Notes

- Nuevo módulo `admin/` sigue exactamente la misma organización que `profesor/`: `api.ts` + `servicio.ts` (sin `repositorio.ts` porque no hay DynamoDB en esta historia)
- El módulo `compartido/seguridad.ts` es el único compartido que se modifica — extiende las uniones de tipos internos sin romper las funciones exportadas existentes
- Los tests van en `backend-serverless/pruebas/admin.test.ts` — patrón consistente con todos los otros módulos

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Historia 1.5]
- [Source: _bmad-output/planning-artifacts/epics.md#FR-006]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-PROYECTO-INGENIERIA-DE-SOFTWARE-BMAD-2026-07-26/ARCHITECTURE-SPINE.md#AD-7]
- [Source: _bmad-output/project-context.md#Módulo compartido/ — responsabilidades fijas]
- [Source: _bmad-output/project-context.md#Añadir un módulo nuevo al backend serverless]
- [Source: _bmad-output/implementation-artifacts/1-4-aislamiento-de-sesiones-por-profesor-resolucion-deuda-tecnica-ad-3.md#Dev Notes — patrón de profesor]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — Mecanismo conmutable Cognito ↔ JWT no implementado]
- [Source: backend-serverless/src/compartido/seguridad.ts — líneas 12-31 (interfaces y uniones a extender)]
- [Source: backend-serverless/src/profesor/servicio.ts — función ingresarProfesor (patrón a replicar)]
- [Source: backend-serverless/src/profesor/api.ts — estructura de manejador (patrón a replicar)]
- [Source: backend-serverless/template.yaml — parámetros ProfesorId, ClaveAccesoProfesor y bloque FuncionProfesor (patrón a replicar)]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implementado módulo `admin/` con `servicio.ts` y `api.ts` siguiendo exactamente el patrón de `profesor/`.
- Extendido `compartido/seguridad.ts`: nuevas interfaces `ContextoAdmin` y `ContenidoTokenAdmin`, uniones `ContenidoToken` y `ContenidoTokenSinExp` extendidas, funciones `crearTokenAdmin` y `validarAdminDesdeEvento` agregadas.
- AC-2 y AC-3 (cross-rejection) funcionan sin modificar código de profesor: `validarProfesorDesdeEvento` rechaza tokens con `tipo !== "profesor"` y `validarAdminDesdeEvento` rechaza tokens con `tipo !== "admin"`.
- `npm run verificar` (tipos + 40 tests + bundle): 100% OK. Bundle `admin/api.js` = 6.3kb.

### File List

- `backend-serverless/src/compartido/seguridad.ts` — modificado: ContextoAdmin, ContenidoTokenAdmin, uniones extendidas, crearTokenAdmin, validarAdminDesdeEvento
- `backend-serverless/src/admin/servicio.ts` — creado: ingresarAdmin con timingSafeEqual
- `backend-serverless/src/admin/api.ts` — creado: manejador con rutas POST /api/admin/ingresar y GET /api/admin/perfil
- `backend-serverless/template.yaml` — modificado: parámetros ClaveAccesoAdmin y AdminId, variables globales, bloque FuncionAdmin
- `backend-serverless/package.json` — modificado: src/admin/api.ts en script empaquetar:verificar
- `backend-serverless/pruebas/admin.test.ts` — creado: 4 tests (AC-1, AC-4, AC-2 cross, AC-3 cross)

### Review Findings

- [x] [Review][Defer] Sesiones pre-migración quedan inaccesibles tras deploy [`profesor/servicio.ts:177-189`] — deferred: no hay datos en producción; riesgo hipotético.
- [x] [Review][Defer] `fase_anterior` desde `"f1_bienvenida"` retrocede a `"configuracion"` [`compartido/maquinaEstados.ts:1`, `profesor/servicio.ts:524`] — deferred: decidir en historia 2-3 cuando se implemente el control de flujo completo.
- [x] [Review][Patch] Admin endpoint sin rate limiting — `POST /api/admin/ingresar` no tiene control de frecuencia; un atacante puede hacer fuerza bruta sin límite. [`admin/api.ts`] ✅ aplicado: `ingresarAdmin` ahora recibe `ip` + `RepositorioRateLimit`; `admin/api.ts` pasa `repositorioAcceso`; tests de rate limiting agregados.
- [x] [Review][Patch] `timingSafeEqual` puede lanzar ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH con input multibyte — `clave.length` cuenta caracteres JS, no bytes. [`admin/servicio.ts:13`] ✅ aplicado: comparación usa `Buffer.from(clave).length` vs `Buffer.from(claveEsperada).length`.
- [x] [Review][Patch] Fallback de fase `"f1_bienvenida"` obsoleto — `sesion.fase || "f1_bienvenida"` salta el nuevo estado inicial. [`profesor/servicio.ts:521`] ✅ aplicado: cambiado a `|| "configuracion"`.
- [x] [Review][Defer] Credenciales por defecto en source control [`template.yaml`] — deferred, pre-existing — patrón pre-existente (ProfesorId, ClaveAccesoProfesor); entorno educativo con NoEcho:true es suficiente.
- [x] [Review][Defer] Race condition en rate limiting [`acceso/servicio.ts:31-43`] — deferred, pre-existing — riesgo teórico bajo en carga educativa; DynamoDB ADD es atómico; mitigación perfecta requeriría transacción condicional.
- [x] [Review][Defer] IP "desconocida" como bucket compartido [`acceso/api.ts`] — deferred, pre-existing — sourceIp siempre está presente en Lambda vía HTTP API en producción; riesgo solo en SAM local o tests.
- [x] [Review][Defer] Código vacío no incrementa contador [`acceso/servicio.ts:47-53`] — deferred, pre-existing — ya documentado en deferred-work.md (1-2); no es vector de brute-force útil.

## Change Log

- 2026-07-29: Historia implementada por claude-sonnet-4-6. Módulo admin/ creado (servicio.ts, api.ts). seguridad.ts extendido con ContextoAdmin, crearTokenAdmin, validarAdminDesdeEvento. template.yaml y package.json actualizados. 40/40 tests pasan.
