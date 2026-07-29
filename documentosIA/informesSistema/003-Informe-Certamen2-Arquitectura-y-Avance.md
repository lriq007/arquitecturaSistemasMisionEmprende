# Informe Técnico — Certamen 2
## Misión Emprende UDD · Arquitectura de Software e Ingeniería de Sistemas

**Proyecto:** PROYECTO-INGENIERIA-DE-SOFTWARE-BMAD  
**Fecha:** 2026-07-29  
**Estado del sprint:** 9 historias terminadas · 7 en progreso · 13 en backlog  

---

## Índice

1. [Descripción General del Sistema](#1-descripción-general-del-sistema)
2. [Criterio 1 — Operatividad y Reglas del Cliente](#2-criterio-1--operatividad-y-reglas-del-cliente)
3. [Criterio 2 — Clean Architecture y Desacoplamiento](#3-criterio-2--clean-architecture-y-desacoplamiento)
4. [Criterio 3 — Infraestructura Serverless y Despliegue en la Nube](#4-criterio-3--infraestructura-serverless-y-despliegue-en-la-nube)
5. [Criterio 4 — Patrones de Diseño, Resiliencia y Datos](#5-criterio-4--patrones-de-diseño-resiliencia-y-datos)
6. [Estado de Avance del Proyecto](#6-estado-de-avance-del-proyecto)

---

## 1. Descripción General del Sistema

**Misión Emprende UDD** es una plataforma educativa gamificada que permite a un profesor de la Universidad del Desarrollo conducir sesiones de emprendimiento en clase. Los estudiantes, organizados en grupos, compiten y colaboran a través de cuatro fases de actividades:

| Fase | Actividad | Descripción |
|------|-----------|-------------|
| Fase 1 | Sopa de Letras | Trabajo en equipo: búsqueda de palabras clave del desafío |
| Fase 2 | Bubble Map de Empatía | Construcción colaborativa del mapa de usuario objetivo |
| Fase 3 | Creatividad LEGO | Prototipado físico fotografiado y subido a la nube |
| Fase 4 | Pitch con Evaluación Cruzada | Presentación y evaluación ponderada entre grupos |

El sistema opera en producción real sobre **AWS**. Su propósito académico es demostrar que una arquitectura serverless con Clean Architecture puede ejecutarse bajo uso real, con múltiples sesiones simultáneas y sin intervención manual de infraestructura.

### Actores del sistema

| Rol | Responsabilidad |
|-----|-----------------|
| **Administrador** | Configura el catálogo de temáticas y desafíos |
| **Profesor** | Crea sesiones, forma grupos, controla el avance entre fases y evalúa pitches |
| **Grupo de estudiantes** | Participa en las actividades de cada fase desde un dispositivo compartido |

---

## 2. Criterio 1 — Operatividad y Reglas del Cliente

### 2.1 Sistema funcional y flujo principal

El flujo principal del juego está operativo. Un profesor puede crear una sesión con grupos y códigos de acceso, los grupos pueden ingresar, y el sistema avanza por las fases bajo control del profesor. El siguiente diagrama de secuencia ilustra el flujo de una sesión completa:

```
Profesor                Grupo               API Gateway + Lambda        DynamoDB
  │                       │                         │                      │
  ├─ POST /profesor/sesiones ──────────────────────>│                      │
  │                       │                         ├── Guardar sesión + grupos ──>│
  │<─────────────────── { sesionId, grupos con códigos } ──────────────────┤
  │                       │                         │                      │
  │                       ├─ POST /acceso/ingresar ─>│                     │
  │                       │    { codigo, nombre }    ├── Buscar CODIGO# en GSI1 ──>│
  │                       │<── JWT { sesionId, grupoId } ──────────────────┤
  │                       │                         │                      │
  │                       ├─ GET /sesiones/actual ──>│ (polling cada ~3s)  │
  │                       │<── { fase, timerFin, tokens } ─────────────────┤
  │                       │                         │                      │
  ├─ POST /profesor/sesiones/{id}/acciones ─────────>│                     │
  │    { accion: "siguiente_fase" }                  ├── Actualizar fase ──>│
  │<─────────────────── Estado actualizado ──────────┤                     │
  │                       │                         │                      │
  │                       ├─ POST /fase1/palabras ──>│                     │
  │                       │    { palabra: "CREATIVIDAD" }  ├── ConditionExpression ─>│
  │                       │<── { ok: true, tokens: 11 } ───────────────────┤
```

### 2.2 Módulos funcionales actuales

Los siguientes módulos están implementados y desplegados:

| Módulo | Endpoint base | Estado |
|--------|---------------|--------|
| `acceso/` | `POST /api/acceso/ingresar` | Operativo |
| `admin/` | `POST /api/admin/ingresar` | En revisión (historia 1-5) |
| `profesor/` | `POST /api/profesor/sesiones` · `/acciones` | Operativo |
| `sesiones/` | `GET /api/sesiones/actual` | Operativo |
| `fase1/` | `POST /api/fase1/palabras` · `GET /api/fase1/ranking` | Operativo |
| `fase2/` | `POST /api/fase2/bubblemap` · completar · ranking | Operativo |
| `fase3/` | `POST /api/fase3/confirmar-foto` | Parcial (sin S3 real) |

### 2.3 Stack tecnológico

El sistema cumple el requerimiento de backend exclusivo en JavaScript/Node.js:

| Componente | Tecnología | Versión |
|------------|-----------|---------|
| Runtime Lambda | **Node.js** | 22.x |
| Lenguaje | **TypeScript** (compila a JS vía esbuild) | 7.0.2 |
| Empaquetado | esbuild | 0.28.1 |
| IaC | AWS SAM | latest |
| SDK AWS | @aws-sdk/lib-dynamodb | 3.1085.0 |
| Tests | Vitest | 4.1.10 |

> TypeScript se usa como capa de verificación de tipos en desarrollo; el artefacto desplegado en Lambda es JavaScript puro generado por esbuild, cumpliendo el requisito del cliente.

### 2.4 Cobertura de requisitos funcionales (FR) operativos

| FR | Descripción | Estado |
|----|-------------|--------|
| FR-003 | Acceso de grupos con código + nombre + JWT | Implementado |
| FR-004 | Rate limiting: máx. 5 intentos por IP en 5 min | Implementado |
| FR-005 | Aislamiento de sesiones por profesor (AD-3) | Implementado |
| FR-011 | Crear sesión con grupos y códigos únicos | Implementado |
| FR-015 | Transiciones de estado solo por el profesor | Implementado |
| FR-016 | Máquina de estados canónica en `compartido/` | Implementado |
| FR-017 | Grupos reciben 409 si están fuera de su fase | Implementado |
| FR-019–023 | Temporizadores sincronizados (timestampServidor) | Implementado |
| FR-024–028 | Sopa de Letras: envío, tokens, ranking Fase 1 | Implementado |
| FR-029–032 | Bubble Map de Empatía: preguntas, tokens, ranking Fase 2 | Implementado |
| FR-033–038 | Fotos LEGO + tokens Fase 3 | Parcial (sin flujo S3 real) |
| FR-052–053 | Polling del estado de sesión por grupos | Implementado |

---

## 3. Criterio 2 — Clean Architecture y Desacoplamiento

### 3.1 Principio fundamental: dependencias siempre hacia el núcleo

El sistema aplica Clean Architecture adaptada al modelo sin servidor. La regla invariante es que **las dependencias siempre apuntan hacia el núcleo**: ningún módulo de dominio importa el AWS SDK directamente; ese conocimiento queda confinado en la capa de adaptadores de salida.

```
         ┌───────────────────────────────────────────────┐
         │              ADAPTADORES DE ENTRADA            │
         │      api.ts  (Lambda handler)                  │
         │  · Parsea el evento AWS                        │
         │  · Extrae contexto del JWT (compartido/)       │
         │  · Llama al servicio                           │
         │  · Serializa la respuesta HTTP                 │
         │  · SIN lógica de negocio                       │
         └─────────────────┬─────────────────────────────┘
                           │ llama a
         ┌─────────────────▼─────────────────────────────┐
         │               NÚCLEO DE DOMINIO                │
         │      servicio.ts  (casos de uso)               │
         │  · Reglas del juego (tokens, transiciones)     │
         │  · Validación de estado de fase                │
         │  · Cálculo de rankings                         │
         │  · SIN imports de @aws-sdk                     │
         │  · SIN conocimiento de HTTP                    │
         └─────────────────┬─────────────────────────────┘
                           │ depende de «interfaz»
         ┌─────────────────▼─────────────────────────────┐
         │              ADAPTADORES DE SALIDA             │
         │      repositorio.ts  (implementación DynamoDB) │
         │  · Todo acceso a DynamoDB                      │
         │  · Prefijos de clave (SESION#, GRUPO#, etc.)   │
         │  · ConditionExpression para idempotencia       │
         │  · Implementa la interfaz que espera servicio  │
         └───────────────────────────────────────────────┘
```

### 3.2 Estructura de módulos: el patrón de tres archivos

Cada módulo de dominio tiene exactamente tres archivos con responsabilidades fijas y no intercambiables:

```
backend-serverless/src/
├── compartido/               ← transversal: cero dependencias a módulos funcionales
│   ├── baseDatos.ts          ← cliente DynamoDB + nombreTabla()
│   ├── respuestas.ts         ← respuestaJson, ErrorAplicacion
│   ├── seguridad.ts          ← crear/validar tokens, contextoDesdeEvento()
│   └── maquinaEstados.ts     ← FASES_ORDEN, TIEMPOS_POR_FASE, constantes de estado
│
├── acceso/                   ← login de grupos
│   ├── api.ts                ← adaptador entrada
│   ├── servicio.ts           ← lógica: validar código, emitir JWT
│   └── repositorio.ts        ← DynamoDB: buscar por GSI1 CODIGO#
│
├── profesor/                 ← auth + control de sesión
│   ├── api.ts
│   ├── servicio.ts           ← lógica: transiciones, timers, propiedad
│   └── repositorio.ts
│
├── fase1/                    ← sopa de letras
│   ├── api.ts
│   ├── servicio.ts           ← lógica: validar palabra, sumar token
│   └── repositorio.ts
│
└── fase2/, fase3/, sesiones/ ← mismo patrón
```

**Regla invariante entre módulos:** ningún módulo importa el `repositorio.ts` de otro módulo. Si la Fase 4 necesita leer resultados de Fase 3, lo hace a través de una interfaz explícita definida en `compartido/contratos/`, nunca importando directamente.

### 3.3 Frontend "tonto": cero lógica de negocio en la vista

El frontend es HTML/CSS/JavaScript puro (vanilla) sin framework. Su única responsabilidad es:
- Leer tokens del `localStorage`
- Hacer llamadas al API
- Renderizar la respuesta del backend

Toda lógica reside exclusivamente en el backend:

| Responsabilidad | Dónde vive |
|----------------|-----------|
| Validar que una palabra pertenece a la lista objetivo | `fase1/servicio.ts` |
| Contar tokens y aplicar idempotencia | `fase1/servicio.ts` + `fase1/repositorio.ts` |
| Determinar si el temporizador ha expirado | `fase1/servicio.ts` (lee `timerFin` de DynamoDB) |
| Calcular el ranking | `fase1/servicio.ts` |
| Validar que una transición de estado es legal | `profesor/servicio.ts` |
| Verificar que el profesor es dueño de la sesión | `profesor/servicio.ts` |

El frontend **nunca calcula nada** — pregunta al backend y muestra. El contador de tiempo visible en pantalla es la única excepción deliberada: el cliente calcula `segundosRestantes = timerFin − ahoraUTC` pero el valor de `timerFin` proviene del servidor, haciendo al servidor la única fuente de verdad.

### 3.4 Inyección de dependencias sin contenedor IoC

Las funciones Lambda no tienen servidor persistente. En lugar de un contenedor IoC, la dependencia se pasa como parámetro de función directamente en el handler:

```typescript
// api.ts — el adaptador instancia el repositorio y lo pasa al servicio
export async function manejador(event: APIGatewayProxyEvent) {
  const { sesionId, grupoId } = contextoDesdeEvento(event);
  const repositorio = new RepositorioFase1Real();

  const resultado = await registrarPalabra(
    sesionId,
    grupoId,
    body.palabra,
    repositorio   // ← inyección explícita: servicio.ts nunca instancia esto
  );

  return respuestaJson(200, resultado);
}
```

```typescript
// servicio.ts — el núcleo nunca sabe que existe DynamoDB
export async function registrarPalabra(
  sesionId: string,
  grupoId: string,
  palabra: string,
  repositorio: RepositorioFase1   // ← interfaz, no clase concreta
): Promise<ResultadoPalabra> {
  const estado = await repositorio.obtenerEstado(sesionId, grupoId);
  if (estado.fase !== FASES.F1_SOPA) throw new ErrorAplicacion("Fase incorrecta", 409, "FASE_INCORRECTA");
  if (estado.palabrasEncontradas.includes(palabra)) return { ok: true, yaRegistrada: true };
  // lógica de negocio...
}
```

### 3.5 Pruebas del núcleo sin infraestructura

Esta inyección de dependencias hace que las pruebas de negocio no requieran AWS. Se pasa un repositorio falso (objeto TypeScript simple) que cumple la misma interfaz:

```typescript
// pruebas/fase1.test.ts
it("entrega 1 token por cada palabra nueva encontrada", async () => {
  const repositorio = crearRepositorioFalso({ tokens: 10 });

  await registrarPalabra("sesion1", "grupo1", "CREATIVIDAD", repositorio);

  expect(repositorio.getTokens("grupo1")).toBe(11);
});

it("es idempotente: segunda llamada con la misma palabra no suma token", async () => {
  const repositorio = crearRepositorioFalso({ tokens: 10, palabras: ["CREATIVIDAD"] });

  await registrarPalabra("sesion1", "grupo1", "CREATIVIDAD", repositorio);

  expect(repositorio.getTokens("grupo1")).toBe(10); // sin cambio
});
```

No se usa `vi.mock()` ni ninguna librería de mocking — el repositorio falso es un objeto TypeScript puro. Esto demuestra que el núcleo es completamente independiente de DynamoDB y de AWS.

### 3.6 Máquina de estados canónica (AD-2)

La definición de todos los estados del juego vive en un único archivo `compartido/maquinaEstados.ts`. Ningún módulo usa strings literales de fase:

```
f1_bienvenida → f1_conocidos → f1_pre_sopa → f1_sopa → f1_ranking →
mapa_f2_empatia → f2_transicion → f2_tematicas → f2_bubblemap → f2_ranking →
mapa_f3_creatividad → f3_lego → f3_ranking →
mapa_f4_final → f4_construccion_pitch → f4_orden_pitch → f4_presentacion_pitch →
f5_evaluacion_pitch → f6_ranking → reflexion
```

Solo el profesor puede disparar transiciones. El backend valida que el estado destino sea el sucesor directo — cualquier salto ilegal retorna error 400.

---

## 4. Criterio 3 — Infraestructura Serverless y Despliegue en la Nube

### 4.1 Servicios AWS activos

```
Navegador (grupos y profesor)
        │
        ▼
  CloudFront (CDN)
   ├── S3 Frontend (HTML/CSS/JS estático)
   └── API Gateway (HTTP API)
        │
        ├── Lambda Acceso        POST /api/acceso/ingresar
        ├── Lambda Admin         POST /api/admin/ingresar
        ├── Lambda Profesor      POST /api/profesor/sesiones · /acciones
        ├── Lambda Sesiones      GET  /api/sesiones/actual
        ├── Lambda Fase1         POST /api/fase1/palabras
        ├── Lambda Fase2         POST /api/fase2/bubblemap
        ├── Lambda Fase3         POST /api/fase3/confirmar-foto
        ├── Lambda Fase4         [planificado]
        └── Lambda Catálogo      [planificado]
                 │
                 ├──────────────────────────────────> DynamoDB
                 │                                  MisionEmprende-{env}
                 ├──> S3 Fotos LEGO (planificado)
                 └──> Secrets Manager (CLAVE_TOKEN)
```

Cada ruta del juego es una **función Lambda independiente**. API Gateway actúa como router y primera capa de protección, rechazando peticiones sin token antes de que el código de negocio se ejecute.

### 4.2 Infraestructura como Código (IaC) con AWS SAM

Toda la infraestructura se define en `backend-serverless/template.yaml`. La consola de AWS se usa exclusivamente para observación — ningún recurso se crea o modifica desde la interfaz web:

```yaml
# Extracto representativo de template.yaml
Resources:

  TablaPrincipal:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub "MisionEmprende-${Entorno}"
      BillingMode: PAY_PER_REQUEST          # On-Demand: sin capacidad provisionada
      SSESpecification:
        SSEEnabled: true                    # Cifrado en reposo
      AttributeDefinitions:
        - { AttributeName: PK, AttributeType: S }
        - { AttributeName: SK, AttributeType: S }
        - { AttributeName: GSI1PK, AttributeType: S }
        - { AttributeName: GSI1SK, AttributeType: S }
      GlobalSecondaryIndexes:
        - IndexName: GSI1
          KeySchema:
            - { AttributeName: GSI1PK, KeyType: HASH }
            - { AttributeName: GSI1SK, KeyType: RANGE }
          Projection: { ProjectionType: ALL }

  LambdaFase1:
    Type: AWS::Serverless::Function
    Properties:
      Handler: fase1/api.manejador
      Runtime: nodejs22.x
      Timeout: 10
      MemorySize: 256
      Role: arn:aws:iam::815812412505:role/LabRole
      Events:
        EnviarPalabra:
          Type: HttpApi
          Properties:
            Path: /api/fase1/palabras
            Method: POST
```

### 4.3 Modelo de datos: single-table DynamoDB con GSI

Todo el sistema usa una sola tabla DynamoDB por entorno, con un índice secundario global (GSI1) para búsquedas que el índice primario no puede resolver:

```
Tabla: MisionEmprende-{env}

Entidad SESION:
  PK  = SESION#{sesionId}     SK = METADATOS
  GSI1PK = PROFESOR#{profesorId}   GSI1SK = SESION#{ts}#{sesionId}
  fase, timerCorriendo, timerFin, ...

Entidad GRUPO:
  PK  = SESION#{sesionId}     SK = GRUPO#{grupoId}
  GSI1PK = CODIGO#{codigoAcceso}   GSI1SK = GRUPO#{grupoId}
  tokens, palabrasEncontradas, ...

Entidad ALUMNO:
  PK  = SESION#{sesionId}     SK = ALUMNO#{alumnoId}
  grupoId, ...
```

| Búsqueda | Acceso |
|----------|--------|
| Sesiones de un profesor | `GSI1PK = PROFESOR#{profesorId}` |
| Grupo por código de acceso | `GSI1PK = CODIGO#{codigo}` |

Los prefijos (`SESION#`, `GRUPO#`, `CODIGO#`) viven **exclusivamente** en `repositorio.ts` — el servicio nunca los conoce (AD-6).

### 4.4 Entornos aislados

El sistema tiene dos entornos completamente separados por parámetro SAM:

| Recurso | `dev` | `prod` |
|---------|-------|--------|
| Tabla DynamoDB | `MisionEmprende-dev` | `MisionEmprende-prod` |
| PITR | deshabilitado | habilitado (en configuración pendiente) |
| CORS | `*` (en configuración) | solo dominio CloudFront |

### 4.5 Pipeline CI/CD (ejecutable manualmente en entorno educativo)

La cuenta AWS Academy impone restricciones conocidas (`iam:CreateRole` denegado, credenciales que rotan por sesión). El pipeline está definido con los mismos pasos que un ambiente con credenciales estables, ejecutado manualmente en el orden correcto:

```
1. type-check TypeScript   →   tsc --noEmit
2. Pruebas Vitest          →   npm run pruebas
3. Empaquetado esbuild     →   sam build
4. Validación SAM          →   sam validate
5. Despliegue a dev        →   sam deploy --config-env dev
6. [Aprobación manual]
7. Despliegue a prod       →   sam deploy --config-env prod
```

En una cuenta con credenciales estables (OIDC o IAM de larga duración), este mismo flujo se activa automáticamente con GitHub Actions.

---

## 5. Criterio 4 — Patrones de Diseño, Resiliencia y Datos

Esta sección distingue tres estados para cada patrón: **implementado**, **implementado parcialmente** (código existe pero incompleto), y **planificado** (historia en backlog con justificación). Se explica la razón de cada decisión.

---

### 5.1 Idempotencia — IMPLEMENTADO

**Patrón:** Toda operación que entregue tokens o registre progreso usa `ConditionExpression` en DynamoDB para garantizar que ejecutar la misma acción N veces tenga el mismo efecto que ejecutarla una sola vez.

**Dónde aplica:** FR-025 (sopa de letras), FR-031 (bubble map), FR-038 (LEGO), FR-046 (evaluación pitch — planificado en épica 6), NFR-004.

**Implementación en `repositorio.ts`:**

```typescript
// Si la palabra ya existe en el set, DynamoDB rechaza la escritura
// en lugar de sumar un token dos veces
await client.send(new UpdateCommand({
  TableName: nombreTabla(),
  Key: { PK: `SESION#${sesionId}`, SK: `GRUPO#${grupoId}` },
  UpdateExpression: "ADD palabrasEncontradas :palabra, tokens :uno",
  ConditionExpression: "NOT contains(palabrasEncontradas, :palabra)",
  ExpressionAttributeValues: {
    ":palabra": palabra,
    ":uno": 1,
  },
}));
```

**Justificación:** En un juego de clase con dispositivos múltiples, una doble entrega de tokens es irreversible socialmente — no se puede "deshacer" un token frente a toda la clase. La idempotencia no es un adorno: es el mecanismo que garantiza la integridad del puntaje ante reintentos de red, presiones del usuario o reconexiones.

---

### 5.2 Rate Limiting (protección contra fuerza bruta) — IMPLEMENTADO

**Patrón:** Conteo de intentos fallidos por IP con TTL en DynamoDB. Ventana deslizante de 5 minutos con bloqueo automático tras 5 intentos.

**Dónde aplica:** FR-004, Historia 1-2.

**Justificación:** Los códigos de acceso de grupo son alfanuméricos de 6 caracteres — espacio de búsqueda que puede recorrerse por fuerza bruta en minutos. Sin rate limiting, un alumno malicioso podría entrar a otra sesión con el token de otro grupo. El patrón usa DynamoDB (ya disponible) en lugar de WAF o API Gateway throttling, manteniendo el control en la capa de dominio.

**Deuda técnica documentada:** Códigos vacíos no consumen el contador (bypass parcial) porque la validación de formato ocurre antes del incremento. Registrado en `deferred-work.md`.

---

### 5.3 Aislamiento de datos por identidad (filtro obligatorio por profesorId) — IMPLEMENTADO

**Patrón:** Toda consulta DynamoDB de rutas de profesor incluye `profesorId` derivado del token como condición de filtro obligatoria en el índice GSI1. Nunca del body ni del query string.

**Dónde aplica:** AD-3, FR-005, NFR-014, Historias 1-3 y 1-4.

```typescript
// repositorio.ts — el profesorId del token fuerza la query
const respuesta = await client.send(new QueryCommand({
  TableName: nombreTabla(),
  IndexName: "GSI1",
  KeyConditionExpression: "GSI1PK = :pk",
  ExpressionAttributeValues: {
    ":pk": `PROFESOR#${contexto.profesorId}`,  // ← del token, nunca del request
  },
}));
```

**Justificación:** Sin este filtro, un profesor con token válido podía acceder a las sesiones de otro pasando una `sesionId` ajena en el request. AD-3 fue una deuda técnica explícita que se resolvió en la Historia 1-4.

---

### 5.4 Dead Letter Queue (DLQ) para procesamiento de fotos LEGO — PLANIFICADO (Épica 5, Historia 5-3)

**Patrón:** Cuando un grupo confirma que subió su foto LEGO, el backend publica un mensaje a SQS. Una Lambda de procesamiento lo consume para generar miniatura y validar el archivo. Si el procesamiento falla (3 intentos), el mensaje va a una DLQ. El grupo **no queda en estado inválido** — la foto original se preserva y el flujo de tokens no se bloquea.

**Estado actual:** La Historia 5-2 (`in-progress`) implementa `confirmarFoto()` que acepta `{conFoto: true}` y entrega tokens, pero sin verificar la existencia real del objeto S3 y sin publicar a SQS. La Historia 5-1 (backlog) debe agregar el bucket S3 y el endpoint de URL prefirmada. La Historia 5-3 (backlog) implementa el worker SQS + DLQ.

**Justificación para la planificación:** El procesamiento de imágenes (miniatura, validación de contenido) puede tardar segundos y tiene dependencias externas (S3, biblioteca de procesamiento). Bloquear al grupo esperando ese resultado degrada la experiencia de clase. El patrón SQS + DLQ desacopla la confirmación del procesamiento, garantizando que el grupo avanza independientemente del resultado del procesamiento. La DLQ preserva evidencia de fallos sin corromper el estado del juego.

**Referencia:** FR-035, FR-036, NFR-005.

---

### 5.5 Retry con Backoff Exponencial + Jitter — PLANIFICADO (Épica 7, Historia 7-5)

**Patrón:** Las llamadas al AWS SDK desde Lambda se configuran con `maxAttempts: 3` y backoff exponencial con jitter aleatorio. Esto reduce la presión sobre DynamoDB en picos de tráfico y previene la "manada sincronizada" (thundering herd) donde múltiples Lambdas reintentan simultáneamente.

**Estado actual:** El SDK de AWS tiene retry automático habilitado por defecto, pero sin configuración explícita de `maxAttempts` ni estrategia de jitter. La Historia 7-5 (`backlog`) formaliza esta configuración.

**Justificación para la planificación:** A la escala actual del proyecto (10 grupos × 3 sesiones simultáneas), los reintentos por defecto del SDK son suficientes. La Historia 7-5 se prioriza después de completar la funcionalidad de las épicas de gameplay (4, 5, 6) porque el impacto del patrón es visible solo bajo carga real sostenida, que se validará con pruebas de carga (Historia 7-6).

**Referencia:** NFR-006.

---

### 5.6 Circuit Breaker — PLANIFICADO (Épica 7, Historia 7-5)

**Patrón:** Circuit Breaker aplicado en dos puntos de integración críticos: (1) Lambda Fase 3 → S3 para la confirmación de foto LEGO; (2) Lambda Profesor → Secrets Manager para obtener la clave de firma del JWT.

**Estado actual:** No implementado. Los puntos de integración actuales fallan directamente (propagando el error al cliente) sin control de degradación.

**Justificación para la planificación:** En un entorno de clase real, si Secrets Manager tiene una interrupción transitoria, no es aceptable que todos los logins del profesor fallen indefinidamente. El Circuit Breaker cortaría el flujo después de N fallos consecutivos y permitiría una respuesta de degradación controlada. Se planifica para la Historia 7-5 porque requiere instrumentación de métricas (CloudWatch, Historia 7-3) para ser efectivo — sin métricas no hay umbral de corte confiable.

**Referencia:** NFR-007.

---

### 5.7 Procesamiento asíncrono con SQS (variante de desacoplamiento de colas) — PLANIFICADO (Épica 5, Historia 5-3)

**Patrón:** Variante de Cola de Mensajes para desacoplar el trigger de confirmación del grupo del procesamiento pesado de la imagen. El grupo recibe respuesta inmediata; la Lambda de procesamiento consume el mensaje de forma independiente.

**Justificación:** Mismo argumento que la DLQ (sección 5.4). La cola SQS es la infraestructura base; la DLQ es el mecanismo de resiliencia sobre esa cola.

**Referencia:** FR-035.

---

### 5.8 Decisiones arquitectónicas de datos: patrones diferidos con justificación

Los siguientes patrones están en la rúbrica pero **no están planificados en el sprint actual**, con justificación explícita:

| Patrón | Estado | Justificación |
|--------|--------|---------------|
| **Cache-Aside** | No planificado | DynamoDB On-Demand (PAY_PER_REQUEST) absorbe picos sin degradación. A la escala de 10 grupos × 3 sesiones, el costo de un cache layer (ElastiCache) supera el beneficio. Decisión revisable si se escala a >100 sesiones simultáneas. |
| **Event Sourcing** | Diferido (AD-4) | El sistema actual almacena el estado actual (no el historial de eventos). Event Sourcing se difiere por complejidad de implementación (reconstrucción de estado, snapshots) que no se justifica para el volumen de trazabilidad requerido en el contexto educativo. |
| **CQRS** | No planificado | Los endpoints de lectura (ranking, estado de sesión) son síncronos y se ejecutan en la misma Lambda que las escrituras. El volumen de lecturas (polling cada 3s × 10 grupos × 3 sesiones = ~10 req/s) no justifica separar los modelos de lectura y escritura. |
| **EventBridge (rankings async)** | Diferido (AD-4) | Los rankings se calculan síncronamente en `/api/faseN/ranking`. La latencia de cálculo sobre 10 grupos es despreciable. EventBridge agrega complejidad de infraestructura sin beneficio real a esta escala. Revisable si se requiere demostrarlo académicamente. |

---

## 6. Estado de Avance del Proyecto

### 6.1 Dashboard general (al 2026-07-29)

```
Historias:  ████████████░░░░░░░░░░░░░░░░░░
            9 done  |  7 in-progress  |  1 review  |  13 backlog

Épicas:     ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
            0 done  |  5 in-progress  |  2 backlog
```

### 6.2 Estado por épica

#### Épica 1: Identidad y Acceso Seguro — 4/5 historias terminadas

| Historia | Estado | Qué implementa |
|----------|--------|----------------|
| 1-1 Acceso de grupos | done | Código → nombre → JWT firmado |
| 1-2 Protección fuerza bruta | done | Rate limiting por IP con TTL DynamoDB |
| 1-3 Auth profesor con profesorId | done | JWT con `profesorId`, `validarProfesorDesdeEvento()` |
| 1-4 Aislamiento sesiones por profesor | done | GSI1 filter por profesorId, `verificarPropiedadSesion()` |
| 1-5 Auth administrador | **review** | Módulo `admin/`, token con `rol:admin`, rutas separadas |

**Deuda técnica documentada:** Login de profesor usa código estático (no correo+contraseña) por limitación del entorno AWS Academy sin Cognito. `profesorId` viene de variable de entorno, no de Secrets Manager. Comportamiento suficiente para mono-profesor en contexto educativo.

---

#### Épica 2: Orquestación de Sesión y Control del Juego — 2/5 historias terminadas

| Historia | Estado | Qué implementa |
|----------|--------|----------------|
| 2-1 Crear sesión con grupos | done | Sesión en DynamoDB, N grupos, N códigos únicos, `maquinaEstados.ts` |
| 2-2 Listado y ajuste de grupos | **in-progress** | Listar sesiones funciona; falta agregar/eliminar grupos en `configuracion` |
| 2-3 Transiciones de estado y cierre | **in-progress** | `siguiente_fase`/`fase_anterior` funcionan; falta estado terminal `finalizado` |
| 2-4 Temporizadores sincronizados | done | `timerFin` en DynamoDB, `calcularSegundosRestantes()` desde servidor |
| 2-5 Estado de sesión y endpoint de salud | **in-progress** | `GET /api/sesiones/actual` funciona; falta `GET /api/salud` |

---

#### Épica 3: Catálogo de Temáticas y Desafíos — BACKLOG

No iniciada. Módulo `catalogo/` no existe. Las temáticas están hardcodeadas en el frontend (`fase2/tematicas.html`). Se prioriza después de estabilizar las épicas de gameplay porque depende de la autenticación de administrador (Historia 1-5, en review).

---

#### Épica 4: Fase 1 (Sopa de Letras) y Fase 2 (Mapa de Empatía) — 3/4 historias terminadas

| Historia | Estado | Qué implementa |
|----------|--------|----------------|
| 4-1 Tablero y envío de palabras | done | `registrarPalabra()`, 1 token/palabra, idempotencia DynamoDB |
| 4-2 Progreso del grupo y ranking Fase 1 | done | `obtenerEstadoFase1()`, `obtenerRankingFase1()` |
| 4-3 Bubble Map de Empatía | done | 6 preguntas obligatorias, recompensa idempotente, bloqueo por timer |
| 4-4 Vista del profesor en Fase 2 | **in-progress** | Estado por grupo visible en `obtenerControlSesion()`; falta endpoint dedicado `GET /api/fase2/progreso-profesor` |

---

#### Épica 5: Fase 3 — LEGO (Flujo S3) — 0/3 historias completadas

| Historia | Estado | Qué implementa |
|----------|--------|----------------|
| 5-1 Infraestructura S3 y URL prefirmada | **backlog** | Bucket S3 en `template.yaml`, endpoint `POST /api/fase3/url-foto` |
| 5-2 Confirmación de foto y tokens | **in-progress** | `confirmarFoto({conFoto:true})` entrega tokens; sin verificación S3 real |
| 5-3 Procesamiento asíncrono SQS + DLQ | **backlog** | Lambda S3 trigger, SQS, DLQ — patrón completo de resiliencia |

**Estado real del flujo LEGO:** El frontend actual guarda la imagen en `localStorage` y envía solo `{conFoto: true}`. El backend acepta esto y entrega tokens, pero no hay flujo S3 real. Esta deuda técnica está documentada y es el foco de las historias 5-1 y 5-3.

---

#### Épica 6: Fase 4 — Pitch y Evaluación Cruzada — BACKLOG

No iniciada. No existe módulo `fase4/`. Los rankings de Fase 1, 2 y 3 sí existen; falta el ranking final acumulativo. Esta épica es la más compleja del proyecto (control de turno, evaluación con pesos, cálculo ponderado).

---

#### Épica 7: Sistema Listo para Producción — 0/6 historias completadas

| Historia | Estado | Qué implementa |
|----------|--------|----------------|
| 7-1 SAM completo (CloudFront + S3 + PITR) | **in-progress** | DynamoDB con GSI1 y SSE done; falta CloudFront, S3 frontend, PITR=true en prod |
| 7-2 Seguridad hardened (CORS + secretos) | **in-progress** | CLAVE_TOKEN en parámetro SAM (no Secrets Manager); CORS `*` en todos los entornos |
| 7-3 Observabilidad (logs JSON + alarmas) | **backlog** | Logs estructurados a CloudWatch, alarmas de errores Lambda |
| 7-4 Pipeline CI/CD documentado | **backlog** | Archivo de pipeline ejecutable manualmente en AWS Academy |
| 7-5 Resiliencia y pruebas de caos | **backlog** | Retry/backoff, Circuit Breaker, casos de prueba de fallos externos |
| 7-6 Prueba de carga (k6 / Artillery) | **backlog** | Validar NFR-001: P95 ≤ 500ms bajo 10 grupos × 3 sesiones |

---

### 6.3 Lo que funciona hoy (flujo ejecutable)

Un profesor puede, en este momento:

1. Autenticarse y obtener un JWT con su `profesorId`
2. Crear una sesión con N grupos y códigos de acceso únicos
3. Los grupos pueden ingresar con su código y recibir su JWT de grupo
4. El profesor avanza las fases (f1_bienvenida → ... → f1_sopa → ...)
5. Los grupos juegan la Sopa de Letras y reciben tokens (con idempotencia real)
6. El profesor ve el ranking de Fase 1 en tiempo real
7. Los grupos completan el Bubble Map y reciben recompensa
8. Se puede ver el estado de la sesión por polling (`GET /api/sesiones/actual`)
9. Los temporizadores están sincronizados entre todos los dispositivos

### 6.4 Lo que falta para una sesión completa de producción

| Prioridad | Qué falta | Épica / Historia |
|-----------|-----------|------------------|
| Alta | Flujo real S3 para fotos LEGO | Épica 5 (hist. 5-1, 5-3) |
| Alta | Módulo Fase 4 (Pitch y Evaluación) | Épica 6 (5 historias) |
| Alta | Ranking final acumulativo multi-fase | Hist. 6-4 |
| Alta | Estado terminal `finalizado` en máquina de estados | Hist. 2-3 |
| Media | CloudFront + S3 frontend en SAM | Hist. 7-1 |
| Media | Catálogo de temáticas (reemplazar hardcoded) | Épica 3 |
| Media | CORS restringido en producción | Hist. 7-2 |
| Baja | Observabilidad (logs JSON + alarmas) | Hist. 7-3 |
| Baja | Retry/backoff explícito + Circuit Breaker | Hist. 7-5 |

---

### 6.5 Decisiones arquitectónicas que guían el trabajo pendiente

| ID | Decisión | Impacto en el trabajo pendiente |
|----|----------|---------------------------------|
| AD-1 | Sin imports cruzados entre repositorios de módulo | `fase4/` leerá resultados de `fase3/` solo a través de interfaz en `compartido/contratos/` |
| AD-2 | Máquina de estados en `compartido/maquinaEstados.ts` | Estado `finalizado` y estados de ranking se agregan en un único lugar |
| AD-3 | `profesorId` en el token (resuelto) | Historia 1-4 lo implementó; FR-005 está activo |
| AD-4 | Rankings sincrónicos (EventBridge diferido) | Los endpoints `/api/faseN/ranking` son síncronos; sin Lambda de ranking async |
| AD-5 | Dependencias siempre hacia el núcleo | Todo módulo nuevo (fase4, catálogo) sigue el patrón `api → servicio → repositorio` |
| AD-6 | Tabla DynamoDB única con GSI | `fase4/` agrega nuevas entidades a la misma tabla; sin crear tablas adicionales |
| AD-7 | Auth solo vía helpers de `compartido/seguridad.ts` | Ningún `api.ts` nuevo parsea tokens manualmente |

---

*Fuentes de este informe:*
- `INFORME-ARQUITECTURA.md` (arquitectura técnica completa, 2026-07-27)
- `ARCHITECTURE-SPINE.md` (invariantes y reglas de diseño, 2026-07-27)
- `epics.md` (FR, NFR y descomposición en historias, 2026-07-28)
- `sprint-status.yaml` (estado de avance actualizado al 2026-07-29)
- `deferred-work.md` (deudas técnicas documentadas por historia)
- Código fuente: `backend-serverless/src/` y `backend-serverless/pruebas/`
