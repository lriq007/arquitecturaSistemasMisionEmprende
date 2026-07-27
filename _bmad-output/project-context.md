---
project_name: 'PROYECTO-INGENIERIA-DE-SOFTWARE-BMAD'
user_name: 'Lucas'
date: '2026-07-26'
sections_completed: ['technology_stack', 'architecture', 'typescript_and_api_rules', 'testing', 'code_organization', 'critical_rules']
---

# Contexto del Proyecto para Agentes IA

_Este archivo contiene reglas críticas y patrones que los agentes IA deben seguir al implementar código en este proyecto. Se enfoca en detalles no obvios que los agentes podrían pasar por alto._

---

## Stack Tecnológico y Versiones

### Backend Serverless — módulo activo (toda implementación nueva va aquí)
- **Runtime:** Node.js 22.x (Lambda), TypeScript 7.0.2
- **Framework de despliegue:** AWS SAM
- **Base de datos:** DynamoDB vía `@aws-sdk/lib-dynamodb` v3.1085.0
- **Bundler:** esbuild 0.28.1 (target ES2022, format CJS, platform node)
- **Tests:** Vitest 4.1.10
- **Scripts locales:** tsx 4.23.1
- **Ruta del código:** `backend-serverless/src/`

### Backend Legacy Django — solo mantenimiento crítico
- **Python:** Django 5.2.7 + MySQL (mysqlclient 2.2.7)
- **Regla:** No agregar lógica de negocio nueva aquí. Solo intervenir si una parte activa falla. El backend serverless es el sucesor.
- **Ruta:** raíz del proyecto (`manage.py`, `config/`, apps Django)

### Frontend
- Vanilla JavaScript sin framework, HTML/CSS puro
- Comunicación con backend vía Fetch API nativa
- Token de acceso almacenado en `localStorage` como `tokenAcceso`

## Arquitectura: Clean Architecture adaptada a Serverless

### Estructura por módulo (patrón obligatorio)
Cada módulo en `backend-serverless/src/<modulo>/` tiene exactamente:
- `api.ts` — adaptador de entrada: recibe el evento Lambda, llama al servicio, devuelve JSON. No contiene lógica de negocio.
- `servicio.ts` — casos de uso: contiene las reglas del juego. No importa AWS SDK directamente.
- `repositorio.ts` — adaptador de salida: toda interacción con DynamoDB vive aquí. Define la interfaz del repositorio.

### Inyección de dependencias en Lambda (sin contenedor IoC)
Las Lambdas no tienen servidor en ejecución. La DI se implementa pasando el repositorio como parámetro de la función de servicio:

```typescript
// CORRECTO — repositorio como parámetro
export async function ingresarConCodigo(
  codigo: string,
  nombre: string,
  repositorio: RepositorioAcceso,  // ← inyección explícita
) { ... }

// INCORRECTO — no importar repositorio directamente en servicio.ts
import { repositorioAcceso } from "./repositorio.js";
```

Esto permite que las pruebas pasen un repositorio falso sin mocks de framework.

### DynamoDB single-table — reglas de acceso
- Las claves compuestas (`PK`, `SK`, prefijos `SESION#`, `GRUPO#`, `CODIGO#`) viven **solo en `repositorio.ts`**, nunca en el servicio.
- Usar `TransactWriteCommand` para operaciones que deben ser atómicas.
- El GSI1 (`GSI1PK`, `GSI1SK`) se usa para búsquedas secundarias (ejemplo: buscar grupo por código de acceso).

## Reglas de TypeScript y Lógica de APIs

### Reglas técnicas — hacen compilar el código correctamente

**Imports con extensión `.js` obligatoria** (aunque el archivo fuente es `.ts`):
```typescript
// CORRECTO
import { baseDatos } from "../compartido/baseDatos.js";

// INCORRECTO — falla en runtime con moduleResolution NodeNext
import { baseDatos } from "../compartido/baseDatos";
```

**`noUncheckedIndexedAccess: true`** — acceder a un array por índice devuelve `T | undefined`. Siempre verificar:
```typescript
// CORRECTO
const item = resultado.Items?.[0];
if (!item) return null;
const nombre = lista[indice] ?? "ValorPorDefecto";

// INCORRECTO — TypeScript lo rechaza
const nombre = lista[indice].toUpperCase();
```

**`exactOptionalPropertyTypes: true`** — no asignar `undefined` explícitamente a propiedades opcionales; simplemente omitirlas.

**Todo el código en español** — variables, funciones, interfaces, tipos, parámetros, mensajes de error. Inglés solo para nombres de tipos del AWS SDK y palabras técnicas sin traducción natural (`token`, `payload`).

### Lógica del manejador en `api.ts` — patrón obligatorio

Un `api.ts` nuevo siempre sigue esta estructura:

```typescript
export async function manejador(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const ruta = event.requestContext.http.path;
    const metodo = event.requestContext.http.method;

    if (ruta === "/api/<modulo>/<accion>" && metodo === "POST") {
      // 1. Autenticar (si la ruta lo requiere)
      const contexto = contextoDesdeEvento(event); // grupos
      // o: validarProfesorDesdeEvento(event);     // profesor

      // 2. Leer cuerpo si es POST
      const cuerpo = leerJson<TipoCuerpo>(event);

      // 3. Llamar al servicio
      const resultado = await accionDeServicio(
        contexto.sesionId,
        contexto.grupoId,
        repositorio,
      );

      return respuestaJson(200, resultado);
    }

    return respuestaJson(404, { ok: false, error: "Ruta no encontrada" });
  } catch (error) {
    return responderError(error); // captura ErrorAplicacion y errores inesperados
  }
}
```

**Reglas críticas del manejador:**
- No hay router (Express, Hono, etc.) — las rutas se discriminan manualmente con `if` sobre `ruta` y `metodo`.
- El `try/catch` con `responderError` es obligatorio — nunca exponer stack traces al cliente.
- La autenticación se hace **siempre** con `contextoDesdeEvento(event)` o `validarProfesorDesdeEvento(event)` de `compartido/seguridad.ts`. Nunca validar el token manualmente en `api.ts`.
- Los errores de negocio se lanzan desde `servicio.ts` como `ErrorAplicacion` — `api.ts` no toma decisiones de negocio.

### Patrón de errores — `ErrorAplicacion`
```typescript
throw new ErrorAplicacion(
  "Mensaje legible para el usuario",  // message
  400,                                 // HTTP status
  "CODIGO_SNAKE_UPPER",               // código para el cliente
);
```
La respuesta de error al cliente siempre incluye `{ ok: false, codigo, error }`.

## Reglas de Pruebas

### Dónde van las pruebas
- Carpeta: `backend-serverless/pruebas/`
- Nombre de archivo: `<modulo>.test.ts` (ej: `fase2.test.ts`)
- Una suite por módulo, enfocada en `servicio.ts` — no en `api.ts` ni en `repositorio.ts`.

### Repositorios falsos — no usar `vi.mock()`
Las pruebas no usan mocks del framework. Se crea una implementación manual del repositorio que cumple la interfaz:

```typescript
function crearRepositorioFalso(): RepositorioFase1 {
  const grupos: Record<string, GrupoFase1> = { ... };

  return {
    async buscarGrupo(_sesionId, grupoId) {
      return grupos[grupoId] ?? null;
    },
    async actualizarTokens(_sesionId, grupoId, tokens) {
      grupos[grupoId]!.tokens = tokens;
    },
    // ...resto de métodos de la interfaz
  };
}
```

El repositorio falso simula comportamiento real (incluyendo atomicidad y condiciones de carrera) mejor que un mock que solo verifica llamadas.

### Estructura de los tests
```typescript
import { describe, expect, it } from "vitest";
import { funcionDeServicio } from "../src/<modulo>/servicio.js";

describe("<Modulo>", () => {
  it("describe el comportamiento esperado en lenguaje natural", async () => {
    const repositorio = crearRepositorioFalso();
    const resultado = await funcionDeServicio("sesion1", "grupo1", repositorio);
    expect(resultado.campo).toBe(valorEsperado);
  });
});
```

### Qué prueba cada test
- El comportamiento de negocio de `servicio.ts`: bonificaciones, condiciones de victoria, transiciones de fase, idempotencia.
- Casos límite: segunda llamada al mismo grupo, orden de llegada, todos los grupos completando simultáneamente.
- NO se prueban rutas HTTP ni queries a DynamoDB.

### Ejecutar pruebas
```bash
cd backend-serverless
npm run pruebas        # solo pruebas
npm run verificar      # tipos + pruebas + verificación de bundle
```

## Organización del Código

### Módulo `compartido/` — responsabilidades fijas
`backend-serverless/src/compartido/` tiene tres archivos con roles específicos. No agregar utilidades genéricas aquí sin justificación:

| Archivo | Responsabilidad | No agregar |
|---|---|---|
| `baseDatos.ts` | Cliente DynamoDB + función `nombreTabla()` | Queries ni lógica de tabla |
| `respuestas.ts` | `respuestaJson`, `leerJson`, `responderError`, clase `ErrorAplicacion` | Lógica de negocio |
| `seguridad.ts` | Crear/validar tokens, `contextoDesdeEvento`, `validarProfesorDesdeEvento` | Reglas de autorización por ruta |

### Estructura de carpetas del frontend
```
frontend/
├── acceso/          # login de grupos y profesor
├── juego/
│   ├── fase1/       # archivos HTML/CSS/JS de fase 1
│   ├── fase2/
│   ├── fase3/
│   ├── mapa/
│   └── compartido.js  # funciones globales: llamarApiJuego, obtenerTokenGrupo, mostrarErrorJuego
└── profesor/
```

`compartido.js` en el frontend expone funciones globales (sin módulos ES). Todo JS del frontend es vanilla — no agregar bundlers, imports ni frameworks al frontend sin acuerdo explícito.

### Convenciones de nombres
- **Archivos backend:** `camelCase` (`baseDatos.ts`, `repositorio.ts`)
- **Archivos frontend:** `kebab-case` (`sopa-letras.html`, `modo-equipo.js`)
- **Funciones y variables:** `camelCase` en español
- **Interfaces y tipos:** `PascalCase` en español (`RepositorioAcceso`, `GrupoFase1`)
- **Constantes de error:** `SNAKE_UPPER` en español (`CODIGO_INVALIDO`, `TOKEN_EXPIRADO`)
- **Prefijos DynamoDB:** `SNAKE_UPPER` seguido de `#` (`SESION#`, `GRUPO#`, `CODIGO#`)

### Añadir un módulo nuevo al backend serverless
1. Crear `src/<modulo>/api.ts`, `servicio.ts`, `repositorio.ts`
2. Agregar la función Lambda y sus rutas en `template.yaml`
3. Agregar el entry point en el script `empaquetar:verificar` de `package.json`
4. Crear `pruebas/<modulo>.test.ts`
