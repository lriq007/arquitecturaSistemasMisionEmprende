# Guía de autenticación vía token

## 1. Propósito y alcance

Este documento explica la autenticación y autorización vía token implementada en el backend serverless de Misión Emprende. Está pensado tanto para entender la versión actual como para trasladar el mecanismo a una copia mejorada del proyecto.

> En este proyecto la palabra **token** también significa punto o recompensa del juego. Ese token de juego no tiene relación con los tokens de acceso descritos aquí.

La implementación actual protege tres identidades:

| Actor | Cómo inicia sesión | Identidad incluida en el token | Validador usado en las rutas |
|---|---|---|---|
| Grupo | Código de grupo y nombre | `sesionId`, `grupoId`, `nombreGrupo` | `contextoDesdeEvento(event)` |
| Profesor | Código estático | `rol: "profesor"`, `profesorId` | `validarProfesorDesdeEvento(event)` |
| Administrador | Clave estática | `rol: "admin"`, `adminId` | `validarAdminDesdeEvento(event)` |

El núcleo está en `backend-serverless/src/compartido/seguridad.ts`. Los endpoints públicos de ingreso emiten tokens; las demás rutas extraen el token desde `Authorization: Bearer ...`, verifican su firma, expiración y tipo, y convierten el contenido en un contexto confiable para el servicio.

## 2. Qué clase de token es realmente

Aunque algunos requisitos y archivos históricos lo llaman JWT, el formato implementado **no es un JWT estándar**. Un JWT firmado normalmente tiene tres segmentos:

```text
header.payload.signature
```

El formato de este proyecto tiene dos:

```text
base64url(JSON).base64url(HMAC-SHA256)
```

Ejemplo conceptual:

```text
eyJ0aXBvIjoiZ3J1cG8iLCJzZXNpb25JZCI6Ii4uLiIsImV4cCI6MTIzfQ.firma
```

Esto es un token propietario firmado. Tiene integridad y autenticidad si `CLAVE_TOKEN` permanece secreta, pero no es directamente interoperable con Cognito, OAuth/OIDC, librerías JWT, authorizers JWT de API Gateway ni herramientas que esperen el encabezado estándar `alg`/`typ`.

Tampoco está cifrado: el primer segmento solo está codificado en Base64URL. Cualquier persona que posea el token puede leer su contenido, aunque no puede modificarlo sin invalidar la firma. Por eso nunca debe contener contraseñas, claves privadas ni datos sensibles.

## 3. Componentes de la arquitectura

### 3.1 Frontend

El navegador obtiene el token desde un endpoint de ingreso y lo guarda en `localStorage`:

- Grupo: `tokenAcceso`.
- Profesor: `tokenProfesor`.
- No existe todavía un flujo frontend completo equivalente para administrador.

En cada solicitud autenticada agrega:

```http
Authorization: Bearer <token>
```

Cuando una respuesta de profesor retorna HTTP 401, `frontend/profesor/comun.js` elimina `tokenProfesor`. El frontend de juego aplica una conducta equivalente para `tokenAcceso`.

### 3.2 API Gateway y Lambda

`backend-serverless/template.yaml` expone rutas HTTP API. API Gateway permite el encabezado `Authorization` mediante CORS, pero **no valida el token**: no hay authorizer configurado. Cada Lambda ejecuta la validación en código.

Las rutas de ingreso son públicas:

- `POST /api/acceso/ingresar`
- `POST /api/profesor/ingresar`
- `POST /api/admin/ingresar`

Después del bloque de ingreso, cada handler protegido llama al validador correspondiente antes de resolver las demás rutas. Esta posición es importante: impide que una ruta nueva quede expuesta por olvidar una validación dentro de cada caso individual.

### 3.3 Servicio de seguridad compartido

`compartido/seguridad.ts` concentra cinco responsabilidades:

1. Leer `CLAVE_TOKEN` desde las variables de entorno.
2. Agregar `exp` al contenido.
3. Codificar el contenido como Base64URL.
4. Firmar el contenido con HMAC-SHA256.
5. Validar formato, firma, expiración y rol/tipo.

No se debe volver a implementar esta lógica dentro de cada `api.ts`.

### 3.4 Configuración

Las variables relevantes son:

| Variable | Uso | Valor actual de despliegue por defecto |
|---|---|---|
| `CLAVE_TOKEN` | Firma y valida todos los tokens | Parámetro SAM `ClaveToken` |
| `DURACION_TOKEN_SEGUNDOS` | Tiempo de vida desde la emisión | 28.800 s (8 horas) en SAM |
| `CLAVE_ACCESO_PROFESOR` | Credencial temporal del profesor | Parámetro SAM |
| `PROFESOR_ID` | Identidad fija incluida en el token de profesor | Parámetro SAM |
| `CLAVE_ACCESO_ADMIN` | Credencial temporal del administrador | Parámetro SAM |
| `ADMIN_ID` | Identidad fija incluida en el token admin | Parámetro SAM |

El código usa 43.200 segundos (12 horas) como fallback si no se define la duración. En despliegue SAM prevalecen las 8 horas configuradas en la plantilla.

## 4. Flujo completo de un grupo

```text
Navegador
  -> POST /api/acceso/ingresar { codigo, nombreGrupo }
API Gateway
  -> Lambda acceso/api.ts
Servicio acceso
  -> busca el código en DynamoDB
  -> actualiza el nombre del grupo
  -> crea token { tipo, sesionId, grupoId, nombreGrupo, exp }
Navegador
  -> guarda tokenAcceso en localStorage
  -> GET/POST de juego con Authorization: Bearer <token>
Lambda de fase o sesiones
  -> contextoDesdeEvento(event)
  -> valida firma, expiración y tipo "grupo"
  -> entrega { sesionId, grupoId, nombreGrupo } al servicio
```

La identidad no se acepta desde el body ni desde query parameters. El backend confía únicamente en los valores recuperados desde un token cuya firma ya fue validada.

## 5. Flujo completo de profesor

```text
Navegador
  -> POST /api/profesor/ingresar { codigo }
Servicio profesor
  -> compara codigo con CLAVE_ACCESO_PROFESOR
  -> exige PROFESOR_ID
  -> crea token { tipo:"profesor", rol:"profesor", profesorId, exp }
Navegador
  -> guarda tokenProfesor en localStorage
  -> llama rutas de profesor con Bearer token
profesor/api.ts
  -> validarProfesorDesdeEvento(event)
  -> obtiene profesorId confiable
Servicio/repositorio
  -> filtra sesiones por PROFESOR#{profesorId}
  -> verifica propiedad antes de leer o modificar una sesión
```

Esta fue la corrección de la deuda AD-3: antes el token probaba que alguien tenía rol profesor, pero no identificaba a cuál profesor pertenecía la petición. Ahora `profesorId` viaja firmado y se usa para aislar datos.

La limitación es que la identidad sigue siendo mono-profesor: todas las personas que conocen la misma clave reciben el mismo `PROFESOR_ID` configurado en el ambiente.

## 6. Flujo completo de administrador

El administrador usa el mismo mecanismo criptográfico, pero un contenido y validador diferentes. Un token de profesor enviado a una ruta admin, o viceversa, retorna:

```json
{
  "codigo": "ROL_INVALIDO"
}
```

con HTTP 403. Esta separación evita que poseer un token válido de un rol otorgue acceso automático a otro.

El ingreso de grupo y administrador incorpora rate limiting por IP: cinco intentos fallidos dentro de cinco minutos provocan HTTP 429. El login de profesor todavía no usa ese rate limiting.

## 7. Algoritmo de emisión

El algoritmo actual puede resumirse así:

```typescript
contenidoCompleto = {
  ...contenidoDelActor,
  exp: unixAhora + DURACION_TOKEN_SEGUNDOS,
};

cuerpo = base64url(JSON.stringify(contenidoCompleto));
firma = base64url(HMAC_SHA256(CLAVE_TOKEN, cuerpo));
token = cuerpo + "." + firma;
```

La firma cubre exactamente el texto Base64URL del cuerpo. Modificar un carácter del contenido cambia la firma esperada.

## 8. Algoritmo de validación

La validación sigue este orden:

1. Extraer el encabezado `authorization` o `Authorization`.
2. Exigir el prefijo exacto `Bearer `.
3. Separar el token por `.` en cuerpo y firma.
4. Calcular nuevamente HMAC-SHA256 con `CLAVE_TOKEN`.
5. Comparar firmas con `timingSafeEqual` para reducir filtraciones temporales.
6. Decodificar y parsear el JSON.
7. Exigir `exp` vigente.
8. Exigir el `tipo` correcto para la ruta.
9. Para profesor/admin, exigir además una identidad no vacía.

Errores principales:

| Código | HTTP | Significado |
|---|---:|---|
| `SIN_TOKEN` | 401 | Falta el Bearer token |
| `TOKEN_INVALIDO` | 401 | Formato, firma, JSON o identidad inválidos |
| `TOKEN_EXPIRADO` | 401 | Se superó `exp` |
| `ROL_INVALIDO` | 403 | Token válido, pero de otro actor |
| `ACCESO_DENEGADO` | 403 | Profesor válido intentando acceder a una sesión ajena |

## 9. Por qué pudo no funcionar anteriormente

El repositorio deja evidencia de varios problemas históricos y operacionales posibles:

1. **El token antiguo de profesor no tenía `profesorId`.** Ese problema fue corregido. Los tokens emitidos antes del cambio deben descartarse e iniciar sesión nuevamente.
2. **`PROFESOR_ID` ausente.** La versión actual retorna HTTP 500 `CONFIGURACION_INVALIDA` durante el ingreso si esta variable no está configurada.
3. **`CLAVE_TOKEN` distinta entre emisión y validación.** Todas las Lambdas que crean o reciben tokens deben compartir exactamente la misma clave. Un cambio de clave invalida inmediatamente los tokens existentes.
4. **Frontend apuntando a otra API.** Los helpers permiten una `urlApi` en `localStorage`; un valor viejo puede dirigir el navegador a otro ambiente.
5. **Token expirado o almacenado con un nombre incorrecto.** Grupo y profesor usan claves distintas en `localStorage`.
6. **CORS/origen.** La plantilla permite `Authorization`, pero el `OrigenCors` del despliegue debe coincidir con el frontend si se endurece desde `*`.
7. **Se esperaba un JWT estándar o Cognito.** La implementación desplegada es el fallback propietario, sin Cognito Authorizer. Una integración configurada como JWT/OIDC no reconocerá este formato de dos segmentos.
8. **Sesiones antiguas sin `profesorId`.** Aunque el token sea correcto, las sesiones creadas antes de AD-3 pueden responder `ACCESO_DENEGADO`. Existe `scripts/migrarProfesorId.ts` para migrarlas.
9. **Expiración no ligada al cierre de sesión.** El token sigue siendo criptográficamente válido hasta `exp`; cerrar una sesión no lo revoca por sí solo.

En la revisión de esta guía, `npm run verificar` terminó correctamente: compilación TypeScript, 42 pruebas y bundle de las siete Lambdas. Esto verifica el código en local, pero todavía hace falta un smoke test contra el ambiente AWS realmente desplegado para afirmar que configuración, CORS, API URL y datos están alineados.

## 10. Diagnóstico reproducible

### 10.1 Verificación estática y unitaria

```bash
cd backend-serverless
npm run verificar
```

### 10.2 Ingreso y consumo manual

```bash
curl -i -X POST "$API_URL/api/acceso/ingresar" \
  -H 'Content-Type: application/json' \
  -d '{"codigo":"ABC123","nombreGrupo":"Equipo Prueba"}'

curl -i "$API_URL/api/sesiones/actual" \
  -H "Authorization: Bearer $TOKEN_OBTENIDO"
```

Para depurar sin divulgar secretos, se puede decodificar solo el cuerpo:

```bash
node -e 'const t=process.argv[1].split(".")[0]; console.log(JSON.parse(Buffer.from(t,"base64url")))' "$TOKEN"
```

Comprobar `tipo`, identidad y `exp`. No registrar el token completo en logs ni compartirlo en documentación.

### 10.3 Matriz mínima de smoke tests

| Caso | Resultado esperado |
|---|---|
| Login de grupo válido | 200 y token con dos segmentos |
| Ruta de grupo sin token | 401 `SIN_TOKEN` |
| Token manipulado | 401 `TOKEN_INVALIDO` |
| Token expirado | 401 `TOKEN_EXPIRADO` |
| Token profesor en ruta admin | 403 `ROL_INVALIDO` |
| Profesor sobre sesión propia | 200 |
| Profesor sobre sesión ajena | 403 `ACCESO_DENEGADO` |
| Cinco credenciales admin inválidas desde misma IP | 429 |

## 11. Cómo copiar la implementación actual

Para una copia fiel deben migrarse juntos estos elementos; copiar solo `seguridad.ts` no basta:

1. `compartido/seguridad.ts` y `compartido/respuestas.ts`.
2. Endpoints públicos que validan credenciales y emiten tokens.
3. Validación al comienzo de cada handler protegido.
4. Propagación de contextos tipados hacia la capa de servicio.
5. Filtros y verificaciones de propiedad en repositorios/servicios.
6. Variables de entorno compartidas por todas las Lambdas.
7. CORS con el encabezado `Authorization` permitido.
8. Helpers frontend que almacenan y adjuntan el token.
9. Pruebas de emisión, firma, expiración, rol e identidad.

Regla fundamental: `sesionId`, `grupoId`, `profesorId`, `adminId` y rol nunca deben aceptarse como autoridad desde el body, query string o una variable editable del frontend. Deben derivarse del contexto autenticado.

## 12. Diseño recomendado para la copia mejorada

No conviene replicar literalmente el mecanismo propietario si la nueva versión busca producción real o múltiples profesores.

### Opción recomendada: proveedor OIDC/Cognito para personas y token de grupo controlado

- Profesor y administrador: Cognito User Pool u otro proveedor OIDC.
- API Gateway: JWT Authorizer valida firma, issuer, audience y expiración antes de Lambda.
- Lambda: deriva `sub`, roles/grupos y claims desde el contexto autorizado.
- Grupo: mantener un token de capacidad de corta duración, pero usar JWT estándar con una biblioteca mantenida o una sesión opaca almacenada del lado servidor.
- Secretos: Secrets Manager/SSM, sin valores reales por defecto en `template.yaml`.
- Revocación: verificar que la sesión de juego siga activa, o mantener una versión/estado de sesión.

### Contrato mínimo sugerido para tokens de grupo

```json
{
  "iss": "mision-emprende",
  "aud": "api-mision-emprende",
  "sub": "grupo:<grupoId>",
  "tipo": "grupo",
  "sesionId": "...",
  "grupoId": "...",
  "iat": 0,
  "exp": 0,
  "jti": "identificador-unico"
}
```

No es necesario incluir `nombreGrupo`: puede leerse desde DynamoDB y así evitar datos duplicados o desactualizados dentro del token.

### Mejoras prioritarias

1. Reemplazar claves compartidas de profesor/admin por identidades individuales.
2. Usar JWT estándar u OIDC y validar `iss`, `aud`, `sub`, `exp` e idealmente `nbf`/`iat`.
3. Separar claves por ambiente y rotarlas; considerar firma asimétrica (`RS256`/`ES256`) si varios servicios solo necesitan verificar.
4. Reducir exposición en `localStorage`. Para aplicaciones web con backend propio, evaluar cookie `HttpOnly`, `Secure`, `SameSite`; si se mantiene Bearer, reforzar CSP y prevención XSS.
5. Implementar cierre/revocación de sesión de grupo en cada operación protegida.
6. Añadir rate limiting también al login de profesor.
7. No usar defaults `profe123`, `admin123` ni `cambiar-antes-de-produccion` fuera de desarrollo.
8. Validar la estructura completa del contenido, no solo `tipo`, `exp` e identidad.
9. Agregar pruebas end-to-end desplegadas y casos explícitos de expiración/firma alterada.
10. Incluir observabilidad sin registrar credenciales: actor, `sub`, resultado y código de error, nunca el token completo.

## 13. Criterios de aceptación para la reimplementación

La copia mejorada no debería considerarse terminada hasta demostrar:

- Ninguna ruta protegida funciona sin autenticación.
- Cada rol solo accede a sus rutas.
- Cada profesor solo accede a sus recursos.
- Los tokens manipulados, expirados y de otro ambiente son rechazados.
- Rotar una clave tiene un procedimiento conocido.
- Cerrar una sesión impide operaciones posteriores del grupo.
- Los secretos no aparecen en repositorio, frontend ni logs.
- La suite incluye pruebas unitarias, integración API y smoke tests del despliegue.
- La documentación identifica issuer, audience, duración, almacenamiento, renovación y revocación.

## 14. Archivos fuente de referencia

- `backend-serverless/src/compartido/seguridad.ts`: emisión y validación central.
- `backend-serverless/src/acceso/servicio.ts`: emisión para grupos.
- `backend-serverless/src/profesor/servicio.ts`: ingreso y emisión para profesor.
- `backend-serverless/src/admin/servicio.ts`: ingreso y emisión para admin.
- `backend-serverless/src/*/api.ts`: aplicación de validadores en handlers.
- `backend-serverless/template.yaml`: parámetros, ambiente, CORS y rutas.
- `frontend/compartido/js/api.js`: persistencia y Bearer del grupo.
- `frontend/profesor/comun.js`: persistencia y Bearer del profesor.
- `backend-serverless/pruebas/acceso.test.ts`, `admin.test.ts`, `profesor.test.ts`: evidencia automatizada.
- `_bmad-output/implementation-artifacts/deferred-work.md`: limitaciones conocidas.

## 15. Conclusión

La herramienta implementada sí ofrece autenticación stateless básica, separación de roles e identidad firmada para aislar sesiones. Su núcleo está operativo según la verificación local actual. Sin embargo, es un fallback educativo: token propietario, credenciales estáticas y configuración basada en variables de entorno. Para una copia mejorada, debe conservarse la separación entre autenticación, contexto confiable y autorización de recursos, pero conviene sustituir el mecanismo de identidad humana por OIDC/Cognito y añadir revocación real para los grupos.
