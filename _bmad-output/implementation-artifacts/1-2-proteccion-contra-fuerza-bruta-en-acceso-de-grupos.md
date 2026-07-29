---
baseline_commit: 212d62169efb6c1eacd3159c054f89c7c89dbd2a
---

# Historia 1.2: Protección contra Fuerza Bruta en Acceso de Grupos

Status: done

## Story

Como administrador del sistema,
quiero limitar los intentos fallidos de ingreso con código de grupo a un máximo de 5 por IP en una ventana de 5 minutos,
para que las sesiones estén protegidas contra ataques de fuerza bruta sobre los códigos de acceso.

## Acceptance Criteria

**AC-1:** Dado que una IP ha realizado 4 intentos fallidos en los últimos 5 minutos, cuando esa IP realiza un 5° intento fallido, entonces el sistema retorna 429 con `{ ok: false, codigo: "LIMITE_INTENTOS_EXCEDIDO", error: "Demasiados intentos. Espere 5 minutos." }` y los intentos posteriores de esa IP son bloqueados hasta que la ventana de 5 minutos expire.

**AC-2:** Dado que una IP ha alcanzado el límite y la ventana de 5 minutos expiró, cuando esa IP realiza un nuevo intento de acceso, entonces el contador se resetea y la petición se procesa con normalidad.

**AC-3:** Dado que una IP hizo 3 intentos fallidos seguidos de un acceso exitoso, cuando esa IP realiza otro intento posterior al éxito, entonces el contador no acumula los intentos previos al login exitoso.

## Tasks / Subtasks

- [x] Task 1 — Extender `RepositorioAcceso` con operaciones de contador en `acceso/repositorio.ts` (AC: 1, 2, 3)
  - [x] Exportar interfaz `ContadorIntentos { intentosFallidos: number; ventanaExpira: number }`
  - [x] Agregar `obtenerContador(ip: string): Promise<ContadorIntentos | null>` a la interfaz
  - [x] Agregar `incrementarIntentosFallidos(ip: string, ventanaExpira: number): Promise<number>` a la interfaz
  - [x] Agregar `reiniciarContador(ip: string): Promise<void>` a la interfaz
  - [x] Implementar los tres métodos en `repositorioAcceso` usando `GetCommand` y `UpdateCommand` con `ADD` + `if_not_exists`

- [x] Task 2 — Agregar lógica de rate limiting a `acceso/servicio.ts` (AC: 1, 2, 3)
  - [x] Agregar constantes `MAX_INTENTOS = 5` y `VENTANA_SEGUNDOS = 300`
  - [x] Agregar parámetro `ip: string` a la firma de `ingresarConCodigo`
  - [x] Al inicio: consultar contador; si `intentosFallidos >= MAX_INTENTOS` y ventana activa → lanzar 429 `LIMITE_INTENTOS_EXCEDIDO`
  - [x] Cuando el código no existe (`CODIGO_INVALIDO`): llamar `incrementarIntentosFallidos`; si el nuevo conteo >= MAX_INTENTOS lanzar 429 en lugar de 400
  - [x] Cuando el login es exitoso: llamar `reiniciarContador` antes de retornar

- [x] Task 3 — Actualizar `acceso/api.ts` para extraer la IP y pasarla al servicio (AC: 1)
  - [x] Extraer `const ip = event.requestContext.http.sourceIp` antes de llamar al servicio
  - [x] Pasar `ip` como tercer argumento a `ingresarConCodigo`

- [x] Task 4 — Habilitar TTL en `TablaMision` dentro de `backend-serverless/template.yaml` (AC: 2)
  - [x] Agregar bloque `TimeToLiveSpecification: { AttributeName: ttl, Enabled: true }` a la tabla DynamoDB

- [x] Task 5 — Actualizar `pruebas/acceso.test.ts` con pruebas de rate limiting y adaptar tests existentes (AC: 1, 2, 3)
  - [x] Actualizar todos los `ingresarConCodigo(...)` existentes en los tests para incluir el nuevo parámetro `ip` (e.g. `"1.1.1.1"`)
  - [x] Extender `crearRepositorioFalso()` con los tres métodos nuevos (o crear uno dedicado al rate limiting)
  - [x] Test: 5° intento fallido de la misma IP retorna error con código `LIMITE_INTENTOS_EXCEDIDO` y estado 429
  - [x] Test: 6° intento fallido (después de alcanzar el límite) también retorna 429 sin consultar el código
  - [x] Test: 3 fallos + login exitoso resetean el contador; siguiente intento falla con 400 no con 429
  - [x] Test: login exitoso llama a `reiniciarContador` (verificar con contador simulado)

- [x] Task 6 — Ejecutar `npm run verificar` (tipos + pruebas + bundle) y confirmar que pasa sin errores

## Dev Notes

### Diseño de rate limiting: dónde vive cada responsabilidad

La IP llega desde `event.requestContext.http.sourceIp` en API Gateway HTTP API v2. Esta información está en el evento Lambda, no en el dominio — por eso `api.ts` la extrae y la pasa como parámetro explícito a `ingresarConCodigo`. El servicio nunca importa nada de `aws-lambda`.

```
api.ts   → extrae ip del evento → llama ingresarConCodigo(codigo, nombre, ip, repositorio)
servicio.ts → aplica regla de negocio (max 5) → delega lecturas/escrituras al repositorio
repositorio.ts → opera DynamoDB (GetItem, UpdateItem)
```

### Esquema DynamoDB para el contador

Dentro de la tabla única `MisionEmprende-{env}`:

| Campo | Tipo | Valor |
|---|---|---|
| `PK` | S | `IP#${ip}` |
| `SK` | S | `ACCESO_INTENTOS` |
| `intentosFallidos` | N | contador (ADD atómico) |
| `ventanaExpira` | N | Unix epoch, se fija en el 1° intento fallido |
| `ttl` | N | igual a `ventanaExpira` → DynamoDB elimina el ítem automáticamente |

**Precaución con `ttl`:** `ttl` es una palabra reservada en DynamoDB. El `UpdateExpression` debe usar `ExpressionAttributeNames: { "#ttl": "ttl" }`.

### Implementación de `incrementarIntentosFallidos` en repositorio.ts

```typescript
async incrementarIntentosFallidos(ip: string, ventanaExpira: number): Promise<number> {
  const resultado = await baseDatos.send(
    new UpdateCommand({
      TableName: nombreTabla(),
      Key: {
        PK: `IP#${ip}`,
        SK: "ACCESO_INTENTOS",
      },
      UpdateExpression:
        "ADD intentosFallidos :uno SET ventanaExpira = if_not_exists(ventanaExpira, :expira), #ttl = if_not_exists(#ttl, :expira)",
      ExpressionAttributeNames: { "#ttl": "ttl" },
      ExpressionAttributeValues: {
        ":uno": 1,
        ":expira": ventanaExpira,
      },
      ReturnValues: "ALL_NEW",
    }),
  );
  return Number(resultado.Attributes?.intentosFallidos ?? 0);
},
```

`if_not_exists` garantiza que `ventanaExpira` y `ttl` se fijan solo en el primer intento; los intentos posteriores solo suman al contador. Esto evita que cada fallo extienda la ventana.

### Lógica exacta de `ingresarConCodigo` con rate limiting

```typescript
const MAX_INTENTOS = 5;
const VENTANA_SEGUNDOS = 300;

export async function ingresarConCodigo(
  codigoRecibido: string,
  nombreRecibido: string,
  ip: string,
  repositorio: RepositorioAcceso,
) {
  // 1. Verificar si la IP está bloqueada
  const contador = await repositorio.obtenerContador(ip);
  const ahora = Math.floor(Date.now() / 1000);
  if (contador && contador.intentosFallidos >= MAX_INTENTOS && contador.ventanaExpira > ahora) {
    throw new ErrorAplicacion(
      "Demasiados intentos. Espere 5 minutos.",
      429,
      "LIMITE_INTENTOS_EXCEDIDO",
    );
  }

  // 2. Validar código (lógica existente)
  const codigo = codigoRecibido.trim().toUpperCase();
  if (!codigo) {
    throw new ErrorAplicacion("Debes ingresar un código de grupo", 400, "CODIGO_REQUERIDO");
  }

  const grupo = await repositorio.buscarPorCodigo(codigo);

  if (!grupo) {
    const ventanaExpira = ahora + VENTANA_SEGUNDOS;
    const nuevoConteo = await repositorio.incrementarIntentosFallidos(ip, ventanaExpira);
    if (nuevoConteo >= MAX_INTENTOS) {
      throw new ErrorAplicacion(
        "Demasiados intentos. Espere 5 minutos.",
        429,
        "LIMITE_INTENTOS_EXCEDIDO",
      );
    }
    throw new ErrorAplicacion("Código de acceso no encontrado", 400, "CODIGO_INVALIDO");
  }

  // 3. Login exitoso → resetear contador (AC-3)
  await repositorio.reiniciarContador(ip);

  // ... resto de la lógica existente (nombreLimpio, nombreGrupo, crearToken, etc.)
}
```

### Cambio de firma — impacto en tests existentes

`ingresarConCodigo` pasa de 3 parámetros a 4. **Todos los tests existentes en `pruebas/acceso.test.ts` deben actualizarse** para añadir `"1.1.1.1"` (u otra IP de prueba) como tercer argumento. El repositorio falso existente también debe implementar los tres métodos nuevos.

Repositorio falso extendido mínimo (compatible con tests existentes):

```typescript
function crearRepositorioFalso(): RepositorioAcceso {
  const grupos: Record<string, GrupoAcceso> = {
    ABC123: { sesionId: "sesion-1", grupoId: "grupo-1", nombreGrupo: "Nombre Previo", codigoAcceso: "ABC123" },
  };
  const contadores: Record<string, ContadorIntentos> = {};

  return {
    async buscarPorCodigo(codigo) { return grupos[codigo] ?? null; },
    async actualizarNombre(sesionId, grupoId, nombreGrupo) { /* ... igual que antes ... */ },
    async obtenerContador(ip) { return contadores[ip] ?? null; },
    async incrementarIntentosFallidos(ip, ventanaExpira) {
      const actual = contadores[ip] ?? { intentosFallidos: 0, ventanaExpira };
      if (!contadores[ip]) actual.ventanaExpira = ventanaExpira;
      actual.intentosFallidos += 1;
      contadores[ip] = actual;
      return actual.intentosFallidos;
    },
    async reiniciarContador(ip) { delete contadores[ip]; },
  };
}
```

### Template.yaml: TTL en TablaMision

Agregar dentro de `Properties` de `TablaMision`, al mismo nivel que `SSESpecification`:

```yaml
TimeToLiveSpecification:
  AttributeName: ttl
  Enabled: true
```

No se requiere cambiar `AttributeDefinitions` — DynamoDB no indexa el atributo TTL y no necesita declaración de tipo.

### Comportamiento del quinto intento (AC-1 — traza exacta)

1. Intentos 1–4 fallidos: contador sube a 1, 2, 3, 4. Respuesta: 400 `CODIGO_INVALIDO`.
2. Intento 5 fallido: verificación inicial → contador = 4 < 5 → pasa. Código inválido → `incrementar` → contador = 5 ≥ 5 → 429 `LIMITE_INTENTOS_EXCEDIDO`.
3. Intentos 6+ (ventana activa): verificación inicial → contador = 5 ≥ 5 y ventana activa → 429 inmediato, sin consultar el código.

### Comportamiento de login exitoso que resetea el contador (AC-3 — traza exacta)

1. Intentos 1–3 fallidos: contador = 3.
2. Intento 4 con código correcto: verificación → 3 < 5 → pasa. `buscarPorCodigo` encuentra el grupo. `reiniciarContador` → contador eliminado. Respuesta: 200 OK.
3. Intento 5 posterior (código incorrecto): verificación → `obtenerContador` → `null`. Código inválido → incrementar a 1 → 400 `CODIGO_INVALIDO` (no 429).

### Reglas técnicas del proyecto a respetar

- **Imports con `.js`**: `import type { ContadorIntentos } from "./repositorio.js"`
- **`noUncheckedIndexedAccess: true`**: `resultado.Attributes?.intentosFallidos ?? 0` (no acceder sin `??`)
- **Todo en español**: `contadorIntentos`, `intentosFallidos`, `ventanaExpira`, `reiniciarContador`
- **`ErrorAplicacion`** con 3 argumentos: `(mensaje, estado, codigo)`
- **No usar `vi.mock()`**: implementar el repositorio falso manualmente

### Archivos a modificar / crear

| Archivo | Acción | Descripción |
|---|---|---|
| `backend-serverless/src/acceso/repositorio.ts` | MODIFICAR | Exportar `ContadorIntentos`, extender interfaz y objeto `repositorioAcceso` |
| `backend-serverless/src/acceso/servicio.ts` | MODIFICAR | Agregar `ip` param, constantes, lógica de rate limit |
| `backend-serverless/src/acceso/api.ts` | MODIFICAR | Extraer IP y pasarla al servicio |
| `backend-serverless/template.yaml` | MODIFICAR | Agregar `TimeToLiveSpecification` |
| `backend-serverless/pruebas/acceso.test.ts` | MODIFICAR | Adaptar tests existentes + agregar nuevos |

**No crear archivos nuevos.** No tocar ningún otro módulo.

### Ejecutar pruebas

```bash
cd backend-serverless
npm run pruebas        # solo pruebas
npm run verificar      # tipos + pruebas + bundle (obligatorio antes de marcar done)
```

### Project Structure Notes

- Módulo: `backend-serverless/src/acceso/` — los tres archivos existentes se modifican
- Tabla DynamoDB: clave `IP#${ip}` / `ACCESO_INTENTOS` sigue el patrón de prefijos del proyecto (solo en `repositorio.ts`)
- `template.yaml`: ruta `backend-serverless/template.yaml` — solo añadir `TimeToLiveSpecification` a `TablaMision`
- Tests: `backend-serverless/pruebas/acceso.test.ts` — NO reemplazar, EXTENDER

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Historia 1.2]
- [Source: _bmad-output/project-context.md#Arquitectura: Clean Architecture adaptada a Serverless]
- [Source: _bmad-output/project-context.md#Reglas de TypeScript y Lógica de APIs]
- [Source: _bmad-output/project-context.md#Reglas de Pruebas]
- [Source: _bmad-output/planning-artifacts/architecture/ARCHITECTURE-SPINE.md#AD-5, AD-6, AD-7]
- [Source: backend-serverless/src/acceso/servicio.ts — firma actual de ingresarConCodigo]
- [Source: backend-serverless/src/acceso/repositorio.ts — interfaz RepositorioAcceso actual]
- [Source: backend-serverless/src/acceso/api.ts — extracción de sourceIp]
- [Source: backend-serverless/template.yaml#TablaMision — sin TTL actualmente]
- [Source: backend-serverless/pruebas/acceso.test.ts — tests existentes a adaptar]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Interfaz `ContadorIntentos` exportada desde `repositorio.ts`; tres métodos añadidos a `RepositorioAcceso` e implementados con `GetCommand`, `UpdateCommand` (ADD atómico + `if_not_exists`) y `DeleteCommand`.
- `ingresarConCodigo` extendida con parámetro `ip`; lógica de bloqueo previo al inicio y acumulación de fallos al final del flujo de código inválido, con reset en login exitoso. Constantes `MAX_INTENTOS=5` y `VENTANA_SEGUNDOS=300`.
- `api.ts` extrae `sourceIp` del evento HTTP API v2 y lo pasa al servicio.
- TTL habilitado en `TablaMision` (atributo `ttl`) para que DynamoDB expire automáticamente los ítems `IP#<ip>` al vencer la ventana.
- 9 tests en `pruebas/acceso.test.ts` (5 existentes adaptados + 4 nuevos de rate limiting). `npm run verificar` pasa: 25 tests en 5 archivos, tipos OK, bundle OK.

### File List

- backend-serverless/src/acceso/repositorio.ts
- backend-serverless/src/acceso/servicio.ts
- backend-serverless/src/acceso/api.ts
- backend-serverless/template.yaml
- backend-serverless/pruebas/acceso.test.ts

## Review Findings

- [x] [Review][Decision] validarToken invalida tokens existentes al deploy — Resuelto: fallback legacy `(contenido.nombreGrupo as string | undefined) ?? ""` en `seguridad.ts`.
- [x] [Review][Decision] Cambio de contrato 404/GRUPO_NO_ENCONTRADO → 400/CODIGO_INVALIDO — Descartado: frontend confirmado por desarrollador.
- [x] [Review][Patch] IP sin fallback — sourceIp puede ser undefined en invocaciones no-HTTP [acceso/api.ts:26]
- [x] [Review][Patch] Ventana expirada no se resetea — if_not_exists retiene timestamp expirado cuando TTL no ha limpiado [acceso/repositorio.ts:incrementarIntentosFallidos, acceso/servicio.ts:53]
- [x] [Review][Patch] AC-2 sin cobertura — no hay test que simule ventana expirada [pruebas/acceso.test.ts]
- [x] [Review][Defer] Códigos vacíos no consumen el contador [acceso/servicio.ts:42-48] — deferred, pre-existing (CODIGO_REQUERIDO existía antes; spec no define comportamiento para este caso)
- [x] [Review][Defer] TTL puede mantener bloqueo más de 5 minutos [acceso/repositorio.ts:incrementarIntentosFallidos] — deferred, known AWS behavior

## Change Log

- 2026-07-28: Implementación completa de protección contra fuerza bruta — contador por IP en DynamoDB (TTL automático), rate limiting en servicio con máx. 5 intentos / 5 min, extracción de IP en api.ts, 4 nuevos tests de rate limiting, 5 tests existentes adaptados a nueva firma. `npm run verificar` pasa sin errores.
