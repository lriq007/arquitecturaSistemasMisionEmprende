# Tutorial: Pruebas y Demostración — Certamen 2

**Proyecto:** Misión Emprende — Backend Serverless  
**Fecha:** 2026-07-29  
**Objetivo:** Guía paso a paso para probar el proyecto, verificar qué está funcionando y demostrárselo al profesor según la rúbrica del Certamen 2.

---

## Mapa de la rúbrica vs. implementación actual

| Criterio de la Rúbrica | Implementado en | Estado |
|---|---|---|
| Stack TypeScript → JS (NodeJS) | `package.json` scripts de esbuild | ✅ |
| Sistema funcional con flujo principal | Fases 1, 2, 3 + acceso + profesor | ✅ |
| Lógica 0% en frontend | Todo en `servicio.ts` de cada módulo | ✅ |
| Core desacoplado de DB | Interfaces en `repositorio.ts` + tests en memoria | ✅ |
| Interfaces y adaptadores | `api.ts` (adapter) / `repositorio.ts` (interface) | ✅ |
| Lambda + API Gateway + DynamoDB | `template.yaml` (SAM) | ✅ |
| Infraestructura como Código (SAM) | `template.yaml` + `samconfig.toml` | ✅ |
| Idempotencia | `TransactWriteCommand` en `fase1/repositorio.ts` | ✅ |
| Resiliencia / Rate limiting | `MAX_INTENTOS` en `acceso/servicio.ts` | ✅ |

---

## Estructura de Clean Architecture del proyecto

```
src/
  acceso/
    api.ts          ← Capa 1: Adapter (Lambda → Dominio)
    servicio.ts     ← Capa 2: Use Case (lógica pura, sin deps de AWS)
    repositorio.ts  ← Capa 3: Interface + implementación DynamoDB
  profesor/
    api.ts
    servicio.ts
    repositorio.ts
  fase1/
    api.ts
    servicio.ts
    repositorio.ts
  fase2/ ... fase3/ ... admin/ ... sesiones/
  compartido/
    maquinaEstados.ts  ← Entidad de dominio: define FASES_ORDEN y TIEMPOS_POR_FASE
    seguridad.ts       ← Servicio de dominio: firma y valida tokens (HMAC-SHA256)
    respuestas.ts      ← ErrorAplicacion, respuestaJson, responderError
    baseDatos.ts       ← Cliente DynamoDB (solo lo importa repositorio.ts)
```

**Regla que demuestra el desacoplamiento:** `servicio.ts` nunca importa `baseDatos.ts`. Solo conoce la interfaz definida en `repositorio.ts`. Eso permite testear el core sin ninguna infraestructura.

---

## PASO 1 — Tests unitarios sin AWS ni Docker

Este es el argumento más directo para demostrar Clean Architecture: el núcleo del sistema funciona de forma totalmente aislada.

```bash
cd backend-serverless
npm run pruebas
```

**Qué hace internamente:**

```
vitest run
  acceso.test.ts     → inyecta RepositorioAcceso en memoria (no DynamoDB)
  profesor.test.ts   → inyecta RepositorioProfesor en memoria
  fase1.test.ts      → inyecta RepositorioFase1 en memoria
  fase2.test.ts      → ídem
  fase3.test.ts      → ídem
  admin.test.ts      → ídem
```

**Resultado esperado:** Todos los tests en verde, sin necesitar credenciales AWS, sin Docker, sin red.

**Argumento para el profesor:**

> "El test de acceso define `crearRepositorioFalso()` que implementa la interfaz `RepositorioAcceso`. El servicio `ingresarConCodigo()` recibe esa interfaz como parámetro. No sabe si habla con DynamoDB o con un array. Eso es el aislamiento del núcleo que pide la rúbrica."

Ubicaciones clave en el código:
- Interfaz: `src/acceso/repositorio.ts` — `export interface RepositorioAcceso`
- Implementación real: mismo archivo — `export const repositorioAcceso: RepositorioAcceso`
- Test con fake: `pruebas/acceso.test.ts` — función `crearRepositorioFalso()`
- Servicio puro: `src/acceso/servicio.ts` — `ingresarConCodigo(..., repositorio: RepositorioAcceso)`

---

## PASO 2 — Verificar tipos y empaquetado completo

```bash
npm run verificar
```

Corre en secuencia:
1. `tsc --noEmit` — verifica que no haya errores de tipos
2. `vitest run` — todos los tests
3. `esbuild src/*/api.ts --bundle ...` — empaqueta cada Lambda como JS

Si los tres pasan, el código es correcto y desplegable.

---

## PASO 3 — Desplegar en AWS Educativa (Learner Lab)

### 3.1 Verificar credenciales

Las credenciales del Learner Lab duran 4 horas. Antes de cada sesión verifica:

```bash
aws sts get-caller-identity
```

Debe responder con tu `Account` de AWS Academy. Si falla, copia las credenciales desde el portal del Learner Lab y pégalas en `~/.aws/credentials`.

### 3.2 Construir con SAM

```bash
cd backend-serverless
npm run sam:build
```

SAM usa esbuild (via `BuildMethod: esbuild` en el `template.yaml`) para bundlear cada función Lambda por separado. El output queda en `.aws-sam/build/`.

### 3.3 Desplegar

```bash
sam deploy
```

Usa `samconfig.toml` automáticamente:
- Stack name: `mision-emprende-dev`
- Región: `us-east-1`
- Parámetros: `Entorno=dev`, `OrigenCors=*`

El primer deploy pedirá confirmación del changeset. Responde `y`.

**Por qué funciona con cuenta educativa:** Las funciones usan `Role: arn:aws:iam::876388743639:role/LabRole` — el rol preexistente de AWS Academy. No necesitas crear roles ni tocar IAM.

### 3.4 Guardar la URL de la API

Al finalizar el deploy, SAM imprime los Outputs:

```
Outputs:
  UrlApi      = https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com
  NombreTabla = MisionEmprende-dev
```

```bash
export API="https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com"
```

---

## PASO 4 — Probar el flujo completo con curl

### 4.1 Ingresar como profesor

```bash
curl -s -X POST "$API/api/profesor/ingresar" \
  -H "Content-Type: application/json" \
  -d '{"clave":"profe123"}' | jq .
```

Respuesta esperada:
```json
{
  "ok": true,
  "rol": "profesor",
  "token": "eyJ...",
  "profesorId": "profesor-principal"
}
```

```bash
export TOKEN_PROF="<token del response>"
```

### 4.2 Crear una sesión con alumnos

```bash
curl -s -X POST "$API/api/profesor/sesiones" \
  -H "Authorization: Bearer $TOKEN_PROF" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Sesión Demo Certamen",
    "correoProfesor": "profesor@udd.cl",
    "facultad": "Ingeniería",
    "modoCreacion": "recomendado",
    "alumnos": [
      {"correo":"a1@udd.cl","rut":"","nombre":"Ana","apellidoPaterno":"García","apellidoMaterno":"","carrera":"Civil"},
      {"correo":"a2@udd.cl","rut":"","nombre":"Luis","apellidoPaterno":"Pérez","apellidoMaterno":"","carrera":"Civil"},
      {"correo":"a3@udd.cl","rut":"","nombre":"María","apellidoPaterno":"López","apellidoMaterno":"","carrera":"Civil"},
      {"correo":"a4@udd.cl","rut":"","nombre":"Pedro","apellidoPaterno":"Soto","apellidoMaterno":"","carrera":"Civil"}
    ]
  }' | jq .
```

La respuesta incluye `sesiones[].grupos[].codigoAcceso` — guarda uno:

```bash
export CODIGO_GRUPO="XXXXXX"
export SESION_ID="<id de la sesión>"
```

### 4.3 Ingresar como alumno (grupo)

```bash
curl -s -X POST "$API/api/acceso/ingresar" \
  -H "Content-Type: application/json" \
  -d "{\"codigo\":\"$CODIGO_GRUPO\",\"nombreGrupo\":\"Equipo Demo\"}" | jq .
```

```bash
export TOKEN_GRUPO="<token del response>"
```

### 4.4 Avanzar fases desde el panel del profesor

```bash
# Ver sesiones activas
curl -s "$API/api/profesor/sesiones" \
  -H "Authorization: Bearer $TOKEN_PROF" | jq .

# Avanzar a la siguiente fase
curl -s -X POST "$API/api/profesor/sesiones/$SESION_ID/accion" \
  -H "Authorization: Bearer $TOKEN_PROF" \
  -H "Content-Type: application/json" \
  -d '{"accion":"siguiente_fase"}' | jq .
```

Repite el avance de fase hasta llegar a `f1_sopa` para probar la Fase 1.

### 4.5 Probar la sopa de letras (Fase 1)

```bash
# Ver estado actual del grupo
curl -s "$API/api/fase1/estado" \
  -H "Authorization: Bearer $TOKEN_GRUPO" | jq .

# Registrar una palabra válida
curl -s -X POST "$API/api/fase1/palabras" \
  -H "Authorization: Bearer $TOKEN_GRUPO" \
  -H "Content-Type: application/json" \
  -d '{"palabra":"IDEA"}' | jq .

# Intentar registrar la misma palabra de nuevo (debe rechazarla)
curl -s -X POST "$API/api/fase1/palabras" \
  -H "Authorization: Bearer $TOKEN_GRUPO" \
  -H "Content-Type: application/json" \
  -d '{"palabra":"IDEA"}' | jq .
```

La segunda llamada demuestra **idempotencia**: la operación atómica en DynamoDB impide que se dupliquen puntos aunque Lambda se ejecute dos veces.

---

## PASO 5 — Demostrar IaC en la consola de AWS (sin haber tocado nada manualmente)

Muestra esto en el browser durante la demo:

1. **CloudFormation** → Stack `mision-emprende-dev` → pestaña "Template"
   - El YAML completo está ahí. Todo fue creado por `sam deploy`, ningún clic.

2. **Lambda** → Buscar "mision"
   - Aparecen: `FuncionAcceso`, `FuncionProfesor`, `FuncionAdmin`, `FuncionSesiones`, `FuncionFase1`, `FuncionFase2`, `FuncionFase3`

3. **API Gateway** → `mision-emprende-dev` → pestaña "Routes"
   - Todas las rutas `/api/acceso/*`, `/api/profesor/*`, `/api/fase1/*`, etc.

4. **DynamoDB** → Tabla `MisionEmprende-dev`
   - Pestaña "Indexes": GSI1 para buscar grupos por código de acceso
   - Pestaña "Additional settings": TTL habilitado en campo `ttl`, SSE activado

---

## PASO 6 — Justificación de patrones para el profesor

### Rate Limiting — Resiliencia básica

**Dónde:** `src/acceso/servicio.ts` líneas iniciales

```typescript
const MAX_INTENTOS = 5;
const VENTANA_SEGUNDOS = 300;
```

Si un cliente envía 5 códigos incorrectos en 5 minutos, el sistema responde `429 LIMITE_INTENTOS_EXCEDIDO`. El contador se almacena en DynamoDB con TTL para limpiarse automáticamente. Esto protege la API de fuerza bruta y abuso.

### Idempotencia — Operaciones atómicas

**Dónde:** `src/fase1/repositorio.ts` — `registrarPalabraAtomica` y `completarSopaAtomica`

Lambda tiene semántica at-least-once: puede invocar la misma función dos veces en caso de reintento. Las operaciones de puntaje usan `TransactWriteCommand` con `ConditionExpression`, lo que hace que el segundo intento falle sin efecto secundario. El grupo no acumula puntos dobles.

### Single Table Design + TTL (DynamoDB)

Una sola tabla `MisionEmprende-dev` almacena todos los tipos de entidad usando prefijos en `PK`/`SK`:
- `SESION#<id>` / `GRUPO#<id>` → datos del grupo
- `CODIGO#<codigo>` → índice GSI1 para acceso rápido por código
- `IP#<ip>` / `ACCESO_INTENTOS` → contador de rate limiting con TTL automático

### Máquina de Estados — Consistencia de flujo

**Dónde:** `src/compartido/maquinaEstados.ts`

`FASES_ORDEN` define el orden estricto de las 25 fases de la sesión. El sistema no permite saltar fases arbitrariamente ni retroceder sin autorización del profesor. Esto es una entidad de dominio pura: no importa nada de AWS.

---

## Checklist pre-demo

```
[ ] npm run pruebas              → todos verdes (sin AWS)
[ ] npm run verificar            → tipos + tests + build
[ ] aws sts get-caller-identity  → credenciales vigentes
[ ] npm run sam:build            → build ok
[ ] sam deploy                   → stack desplegado
[ ] export API="https://..."     → URL guardada en terminal
[ ] jq instalado                 → sudo pacman -S jq
[ ] Browser abierto en CloudFormation → stack mision-emprende-dev
[ ] Editor abierto en src/acceso/ → para mostrar las 3 capas
```

---

## Guión de 10 minutos para la demo

| Minuto | Acción |
|---|---|
| 0-2 | Terminal: `npm run pruebas` → verde. "El core funciona sin AWS." |
| 2-4 | Editor: mostrar `api.ts` → `servicio.ts` → `repositorio.ts` en acceso. Explicar las 3 capas. |
| 4-5 | Editor: `maquinaEstados.ts`. "Esta es la entidad de dominio, TypeScript puro." |
| 5-6 | Terminal: curl login profesor → crear sesión → guardar código. |
| 6-7 | Terminal: curl acceso grupo → curl registrar IDEA → curl IDEA de nuevo (idempotencia). |
| 7-9 | Browser: CloudFormation template → Lambda functions → DynamoDB indexes. |
| 9-10 | Explicar: "Cada cambio de infraestructura es un `sam deploy`, nunca un clic." |
