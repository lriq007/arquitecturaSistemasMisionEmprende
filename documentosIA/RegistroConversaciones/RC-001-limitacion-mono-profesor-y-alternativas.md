# RC-001 — Limitación Mono-Profesor y Alternativas de Solución

**Código de registro:** RC-001  
**Fecha:** 2026-07-29  
**Contexto:** Conversación sobre el alcance real del módulo `profesor` al finalizar el sprint actual  
**Área afectada:** `backend-serverless/src/profesor/`, `backend-serverless/src/acceso/`, `backend-serverless/template.yaml`

---

## 1. Pregunta que originó este registro

> "¿Es acaso el profesor en el sistema solo un usuario posible? Es decir, ¿no puedo tener más de un profesor asociado a mi sistema y asociado a múltiples sesiones del juego?"

La respuesta corta es: **sí, actualmente el sistema solo soporta una identidad de profesor**, y esto es una limitación intencional y documentada como deuda técnica, no un error de implementación.

---

## 2. Diagnóstico: cómo funciona el login hoy

### 2.1 El mecanismo de autenticación actual

El login del profesor está implementado en `backend-serverless/src/profesor/servicio.ts` (función `ingresarProfesor`, líneas 60–83):

```typescript
export function ingresarProfesor(codigo: string) {
  const esperado = process.env.CLAVE_ACCESO_PROFESOR || "profe123";

  if (!codigo || !compararSeguro(codigo.trim(), esperado)) {
    throw new ErrorAplicacion("Código de profesor incorrecto", 401, "CODIGO_PROFESOR_INVALIDO");
  }

  // ← PROBLEMA: todos los que conocen la clave obtienen el mismo profesorId
  const profesorId = process.env.PROFESOR_ID || "profesor-principal";

  return {
    ok: true,
    token: crearTokenProfesor(profesorId),
    rol: "profesor",
    profesorId,
  };
}
```

**Lo que esto implica:**

| Variable de entorno     | Valor por defecto     | Efecto                                              |
|-------------------------|-----------------------|-----------------------------------------------------|
| `CLAVE_ACCESO_PROFESOR` | `"profe123"`          | Contraseña única compartida entre todos los profesores |
| `PROFESOR_ID`           | `"profesor-principal"`| Identidad única compartida entre todos los profesores |

Cualquier persona con la clave de acceso obtiene un JWT con el **mismo `profesorId`**, lo que la hace ver todas las sesiones de ese id único.

### 2.2 Por qué el token no resuelve el problema

La historia 1-4 (ya implementada y marcada `done`) sí resolvió que el token lleva `profesorId`. El token ya tiene la estructura correcta:

```json
{
  "tipo": "profesor",
  "rol": "profesor",
  "profesorId": "profesor-principal",
  "exp": 1753920000
}
```

El problema no está en el token — está en que **todos reciben el mismo `profesorId`** porque la autenticación no distingue entre usuarios.

---

## 3. Qué sí funciona: el modelo de datos es multi-profesor

La historia 1-4 construyó correctamente toda la infraestructura de aislamiento. Esta parte **ya está lista** y no requiere cambios:

### 3.1 Aislamiento en DynamoDB

Las sesiones se guardan con `GSI1PK = PROFESOR#{profesorId}`, por lo que si dos profesores tuviesen ids distintos, sus sesiones estarían completamente separadas en la base de datos:

```
PROFESOR#prof-garcia  →  sesion-A, sesion-B
PROFESOR#prof-silva   →  sesion-C, sesion-D
```

### 3.2 Verificación de propiedad en el backend

La función privada `verificarPropiedadSesion` en `profesor/servicio.ts` (líneas 169–182) impide el acceso cruzado:

```typescript
function verificarPropiedadSesion(sesion: ItemDynamo, profesorId: string): void {
  const duenio = String(sesion.profesorId || "");
  if (duenio !== profesorId) {
    throw new ErrorAplicacion("No tienes acceso a esta sesión", 403, "ACCESO_DENEGADO");
  }
}
```

Esto garantiza que aunque dos profesores compartan el sistema, el Profesor A nunca puede leer ni modificar sesiones del Profesor B.

### 3.3 Queries siempre filtradas por profesorId

El repositorio en `profesor/repositorio.ts` (función `listarSesiones`, líneas 176–200) siempre usa QueryCommand con el `profesorId` como condición obligatoria — el `ScanCommand` que antes existía fue eliminado en la historia 1-4:

```typescript
async listarSesiones(profesorId: string): Promise<SesionResumen[]> {
  const resultado = await baseDatos.send(
    new QueryCommand({
      TableName: nombreTabla(),
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": `PROFESOR#${profesorId}` },
      ScanIndexForward: false,
    }),
  );
  // ...
}
```

---

## 4. Dónde está documentada esta limitación

Esta limitación no es un olvido — aparece registrada explícitamente en tres artefactos del proyecto:

### 4.1 Architecture Spine — AD-3

Archivo: `_bmad-output/planning-artifacts/architecture/architecture-PROYECTO-INGENIERIA-DE-SOFTWARE-BMAD-2026-07-26/ARCHITECTURE-SPINE.md`

> "La implementación actual (contraseña compartida, token sin `profesorId`) es **deuda técnica explícita**: FR-005 no está implementado hasta que el token lleve identidad."

La historia 1-4 resolvió la parte del token. Lo que queda pendiente es la parte de la contraseña compartida.

### 4.2 Historia 1-4 — Review Findings (línea 72)

Archivo: `_bmad-output/implementation-artifacts/1-4-aislamiento-de-sesiones-por-profesor-resolucion-deuda-tecnica-ad-3.md`

> "[Review][Defer] Aislamiento real requiere identidad per-usuario — con una sola `CLAVE_ACCESO_PROFESOR` compartida todos obtienen el mismo `profesorId` — deferred, pre-existing, limitación del modelo mono-profesor"

### 4.3 PRD — NFR-012

Archivo: `_bmad-output/planning-artifacts/prds/prd-mision-emprende-2026-07-26/prd.md`

> "Si la creación de User Pools resulta no disponible, la autenticación de profesores se implementa con un JWT firmado internamente (clave en Secrets Manager), eliminando el Cognito Authorizer de API Gateway y validando el token en la capa de servicio."

Y también:

> "El sistema soporta más de 100 profesores con cuentas activas operando sesiones simultáneas e independientes."

El PRD sí describe un sistema multi-profesor. La implementación actual es una aproximación temporal.

---

## 5. Alternativas para resolver la limitación

### Alternativa A — Credenciales por profesor en DynamoDB (mínima, sin Cognito)

**Descripción:** Cada profesor tiene un registro en DynamoDB con `correo` y `passwordHash`. El login recibe `{ correo, password }`, verifica contra la base de datos, y emite un token con el `profesorId` correspondiente al correo.

**Archivos a modificar:**
- `backend-serverless/src/acceso/api.ts` — agregar ruta `POST /api/acceso/ingresar-profesor`
- `backend-serverless/src/acceso/servicio.ts` — lógica de verificación de credenciales
- `backend-serverless/src/acceso/repositorio.ts` — consulta de profesor por correo
- `backend-serverless/src/profesor/servicio.ts` — eliminar `ingresarProfesor` o repurposarlo
- `backend-serverless/template.yaml` — eliminar `CLAVE_ACCESO_PROFESOR` y `PROFESOR_ID`

**Esquema DynamoDB propuesto:**

```
PK: PROFESOR#{profesorId}
SK: METADATOS
tipo: PROFESOR
correo: "garcia@udd.cl"
passwordHash: "$argon2id$..."   ← nunca plaintext
profesorId: "uuid-estable"
facultad: "Ingeniería"
creadoEn: "2026-07-29T..."
```

**Flujo de login:**

```
POST /api/acceso/ingresar-profesor { correo, password }
  → buscar profesor por correo (GSI en DynamoDB)
  → verificar hash de contraseña
  → emitir token con profesorId del registro
  → responder con token + profesorId
```

**Ventajas:**
- No requiere Cognito (que puede no estar disponible en la cuenta educativa)
- Implementación completamente bajo control del equipo
- Compatible con el modelo DynamoDB actual

**Desventajas:**
- El equipo asume la responsabilidad de gestión segura de contraseñas (hashing, rotación)
- No hay autoregistro — las cuentas se crean vía endpoint de admin o script
- No hay recuperación de contraseña nativa (habría que implementarla)

**Esfuerzo estimado:** Historia de tamaño medio (comparable a historia 1-4). No hay dependencias bloqueantes.

---

### Alternativa B — Amazon Cognito User Pool (según PRD, NFR-012)

**Descripción:** Cada profesor se gestiona como un usuario en un Cognito User Pool. El login ocurre en el frontend contra Cognito directamente (flujo `USER_PASSWORD_AUTH`). El token de Cognito llega al backend y API Gateway lo valida automáticamente via Cognito Authorizer. El `sub` del token es el `profesorId`.

**Archivos a modificar:**
- `backend-serverless/template.yaml` — agregar `AWS::Cognito::UserPool`, `AWS::Cognito::UserPoolClient`, Cognito Authorizer en API Gateway
- `backend-serverless/src/profesor/servicio.ts` — eliminar `ingresarProfesor` (el login pasa a ser externo)
- `backend-serverless/src/profesor/api.ts` — leer `profesorId` del contexto de autorización de API Gateway en vez del JWT interno
- `backend-serverless/src/compartido/seguridad.ts` — `validarProfesorDesdeEvento` ya no necesita validar el token manualmente (API Gateway lo hace)

**Flujo de login:**

```
Frontend → Cognito (flujo USER_PASSWORD_AUTH)
  → Cognito emite idToken/accessToken
  → Frontend envía accessToken en Authorization: Bearer <token>
  → API Gateway valida token con Cognito Authorizer
  → Lambda recibe requestContext.authorizer.claims.sub = profesorId
```

**Ventajas:**
- Gestión de usuarios delegada a AWS (recuperación de contraseña, MFA, etc.)
- Alineado con el diseño original del PRD
- API Gateway rechaza tokens inválidos antes de llegar a Lambda (menor carga y superficie de ataque)

**Desventajas:**
- Requiere verificar que la cuenta educativa de AWS permita crear User Pools (el PRD lo señala explícitamente como riesgo: "la creación de User Pools debe verificarse antes de iniciar la implementación de este módulo")
- Mayor esfuerzo de configuración en SAM/CloudFormation
- Introduce dependencia de un servicio externo en el flujo de autenticación (cubierto por el circuit breaker de NFR-007)
- El frontend necesita integrar el SDK de Cognito (Amplify o `amazon-cognito-identity-js`)

**Esfuerzo estimado:** Historia grande. Requiere validar disponibilidad de Cognito en la cuenta antes de empezar.

---

### Alternativa C — Múltiples claves estáticas con mapa de identidad (solución mínima de transición)

**Descripción:** Extender el mecanismo actual para soportar un mapa `{ clave → profesorId }` almacenado en Secrets Manager o como parámetros SAM. Cada profesor recibe su propia clave de acceso y su propio `profesorId` predefinido.

**Ejemplo en template.yaml:**

```yaml
Parameters:
  MapaProfesor:
    Type: String
    NoEcho: true
    Default: '{"clave-garcia":"prof-garcia","clave-silva":"prof-silva"}'
```

**Ventajas:**
- Cambio mínimo en el código (solo `ingresarProfesor`)
- Sin base de datos adicional ni servicios externos

**Desventajas:**
- No escala: agregar un profesor requiere redesplegar la Lambda
- Las claves viven en configuración de infraestructura, no en datos
- Gestión engorrosa a partir de 5+ profesores

**Esfuerzo estimado:** Historia pequeña. Útil solo como puente temporal mientras se implementa A o B.

---

## 6. Comparación de alternativas

| Criterio                        | Alt. A (DynamoDB)     | Alt. B (Cognito)       | Alt. C (mapa estático)  |
|---------------------------------|-----------------------|------------------------|-------------------------|
| Múltiples profesores            | Sí                    | Sí                     | Sí (limitado)           |
| Requiere Cognito disponible     | No                    | Sí                     | No                      |
| Escala sin redespliegue         | Sí                    | Sí                     | No                      |
| Esfuerzo de implementación      | Medio                 | Grande                 | Pequeño                 |
| Alineado con PRD                | Parcialmente          | Totalmente             | No                      |
| Gestión de contraseñas propia   | Sí (riesgo asumido)   | No (delegada a AWS)    | Sí (muy simple)         |
| Recomendada para producción     | Sí (si no hay Cognito)| Sí (opción preferida)  | No                      |
| Tiempo estimado hasta tener demo| Días                  | Semanas                | Horas                   |

---

## 7. Estado actual al cierre de esta conversación

- **Historia 1-4:** `done` — el modelo de datos, el aislamiento en DynamoDB y la verificación de propiedad están implementados y testeados (30/30 tests pasan).
- **Limitación pendiente:** Una sola identidad de profesor por despliegue (`PROFESOR_ID`).
- **Trabajo diferido:** La limitación está registrada como `[Review][Defer]` en la historia 1-4 y como riesgo en NFR-012 del PRD.
- **Próximo paso sugerido:** Verificar si Cognito está disponible en la cuenta educativa antes de elegir entre Alt. A y Alt. B. Si no lo está, Alt. A es la ruta natural y no requiere decisiones externas.

---

## 8. Archivos de referencia consultados

| Archivo | Relevancia |
|---|---|
| `backend-serverless/src/profesor/servicio.ts:60-83` | Función `ingresarProfesor` — origen de la limitación |
| `backend-serverless/src/compartido/seguridad.ts` | Token de profesor — ya incluye `profesorId` correctamente |
| `backend-serverless/src/profesor/repositorio.ts:176-200` | `listarSesiones` — filtro por `profesorId` funcionando |
| `_bmad-output/implementation-artifacts/1-4-aislamiento-de-sesiones-por-profesor-resolucion-deuda-tecnica-ad-3.md` | Historial completo de la historia 1-4 y sus review findings |
| `_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md` | AD-3 y NFR-012/NFR-014 |
| `_bmad-output/planning-artifacts/prds/.../prd.md` | FR-001, FR-005, NFR-012, escala de 100+ profesores |
