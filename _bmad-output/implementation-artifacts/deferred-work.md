# Deferred Work

## Deferred from: code review of 1-1-acceso-de-grupos-codigo-de-sesion-nombre-y-jwt-de-grupo (2026-07-28)

- **Token en base64 sin cifrar expone `nombreGrupo` en texto plano** — El token firmado codifica el payload en base64url sin cifrado. `sesionId`, `grupoId` y `nombreGrupo` son legibles por cualquiera que intercepte el token. Decisión arquitectónica preexistente. Evaluar si el contexto educativo requiere cifrado en algún momento futuro.
- **Ruta de error de `actualizarNombre` (fallo transitorio DynamoDB) sin cobertura** — Si `repositorio.actualizarNombre()` lanza una excepción, el error se propaga sin ser `ErrorAplicacion`, lo que generaría un 500 en `api.ts`. Fuera de scope para esta historia; considerar en la historia de resiliencia (épica 7).
- **AC-1: expiración del JWT no vinculada al cierre de sesión** — Los tokens expiran por tiempo fijo (`DURACION_TOKEN_SEGUNDOS`), no cuando el profesor cierra la sesión. El AC-1 exige lo segundo. Requiere invalidación activa de tokens (ej. lista de sesiones cerradas en DynamoDB o campo `sesionActiva` que se verifica en cada request). Deuda arquitectónica candidata a una historia futura en épica 2.

## Deferred from: code review of 1-2-proteccion-contra-fuerza-bruta-en-acceso-de-grupos (2026-07-28)

- **Códigos vacíos no consumen el contador (bypass parcial)** — La validación `CODIGO_REQUERIDO` en `servicio.ts:42-48` ocurre antes de `incrementarIntentosFallidos`, por lo que un atacante puede enviar códigos vacíos indefinidamente sin agotar el rate limit. Gap de diseño preexistente; la spec no define comportamiento para este caso.
- **TTL puede mantener bloqueo más de 5 minutos** — El atributo `ttl` en DynamoDB puede tardar hasta 48h en eliminarse después de expirar. Durante ese período, un ítem expirado lógicamente aún existe y puede afectar el comportamiento del contador. Comportamiento conocido de AWS DynamoDB; no addressable sin arquitectura alternativa (DAX, ElastiCache).

## Deferred from: cierre de historia 1-3-autenticacion-del-profesor-y-token-de-dominio-con-profesorid (2026-07-28)

Historia cerrada como `done` sin archivo de story. El núcleo técnico (token con `profesorId`, `crearTokenProfesor`, `validarProfesorDesdeEvento`) está implementado en `compartido/seguridad.ts`. El scope de aislamiento fue completado en 1-4.

- **Login por código estático, no por correo + contraseña** — La spec define autenticación con correo y contraseña (`CREDENCIALES_INVALIDAS`). La implementación usa un código estático (`CLAVE_ACCESO_PROFESOR`) con error `CODIGO_PROFESOR_INVALIDO`. Decisión pragmática para el entorno educativo. Alinear si se migra a multi-profesor real.
- **`profesorId` fijo desde env var, no desde Secrets Manager** — `PROFESOR_ID` viene de `process.env`; la spec pedía que el `profesorId` se derivara de Secrets Manager. Suficiente para mono-profesor en contexto educativo. Revisar si se implementa Cognito.
- **Mecanismo conmutable Cognito ↔ JWT interno no implementado** — La spec requería un feature flag para alternar entre Cognito y el fallback JWT. Bloqueado: la cuenta educativa no tiene Cognito disponible (NFR-012 fallback activo). Deferred hasta que el entorno lo permita.

## Deferred from: code review of 1-4-aislamiento-de-sesiones-por-profesor-resolucion-deuda-tecnica-ad-3 (2026-07-28)

- **Paginación DynamoDB no implementada en `listarSesiones`** — `QueryCommand` en `repositorio.ts` no itera sobre `LastEvaluatedKey`. Un profesor con muchas sesiones recibiría resultados silenciosamente truncados (límite 1MB de DynamoDB). Problema pre-existente; también afectaba el `ScanCommand` anterior.
- **AC-2 para acción "cerrar sesión" sin cobertura** — El spec AC-2 menciona "cerrar sesión" como acción protegida, pero esa acción no existe aún en `AccionSesion`. Cuando historia 2-3 la implemente, debe pasar por `ejecutarAccionSesion` (que ya tiene `verificarPropiedadSesion`).
- **Colisión GSI1PK sesiones/códigos** — `GSI1PK = PROFESOR#{…}` (sesiones) y `GSI1PK = CODIGO#{…}` (códigos de acceso) comparten el mismo índice global. El `.filter(item => item.tipo === "SESION")` en `listarSesiones` mitiga el riesgo pero es un smell arquitectónico. Pre-existente.
- **Modelo mono-profesor: aislamiento ilusorio con clave compartida** — `CLAVE_ACCESO_PROFESOR` es una única contraseña; cualquiera que la conozca obtiene el mismo `profesorId`. La identidad aislada se vuelve inútil si múltiples profesores comparten la misma clave. Solucionable solo con autenticación Cognito real.

## Deferred from: code review of 1-5-autenticacion-del-administrador (2026-07-29)

- **Credenciales por defecto en source control** — `template.yaml` incluye `Default: admin123` y `Default: admin-principal` en texto plano. Patrón pre-existente heredado de ProfesorId/ClaveAccesoProfesor. `NoEcho: true` oculta los valores en outputs de CloudFormation pero no en el repositorio. Aceptable en entorno educativo; revisar antes de migrar a producción real.
- **Race condition en rate limiting de acceso** — `obtenerContador` y `incrementarIntentosFallidos` no son atómicas. Bajo carga concurrente alta, múltiples requests desde la misma IP podrían pasar el check inicial simultáneamente. El ADD de DynamoDB es atómico, pero la lectura previa no está en la misma transacción. Riesgo bajo en carga educativa; mitigación perfecta requeriría condición de escritura condicional.
- **Sesiones pre-migración inaccesibles si `profesorId` ausente** — `verificarPropiedadSesion` en `profesor/servicio.ts:177-189` compara `String(sesion.profesorId || "")` contra el token; sin el campo DynamoDB lanza ACCESO_DENEGADO. Deferred: no hay datos en producción; riesgo hipotético. Si se despliegan datos previos, correr `scripts/migrarProfesorId.ts` antes del deploy.
- **IP "desconocida" como bucket compartido de rate limiting** — `sourceIp || "desconocida"` comparte un único bucket de rate limit cuando la IP no está disponible. En producción via Lambda HTTP API siempre se provee; riesgo solo en SAM local o proxies mal configurados.
- **Código vacío no incrementa el contador de rate limiting** — `CODIGO_REQUERIDO` se lanza antes de `incrementarIntentosFallidos`. Ya documentado en deferred-work.md sección 1-2; se mantiene aquí por completitud.
- **`fase_anterior` desde `"f1_bienvenida"` retrocede a `"configuracion"`** — Comportamiento nuevo introducido al agregar `"configuracion"` como índice 0 en `FASES_ORDEN`. Antes lanzaba `PRIMERA_FASE`. Puede ser intencional o no; decidir en historia 2-3 cuando se implemente el control de flujo completo. [`compartido/maquinaEstados.ts:1`, `profesor/servicio.ts:524`]

## Deferred from: code review of 2-1-crear-sesion-de-juego-con-grupos-y-codigos-de-acceso (2026-07-28)

- **Estado `finalizado`/cierre de sesión ausente de `FASES_ORDEN`** — `maquinaEstados.ts` no incluye un estado terminal (`finalizado`, `sesion_cerrada`). Llamar `siguiente_fase` desde `"reflexion"` lanza `ULTIMA_FASE`. Deuda pre-existente documentada en sprint-status.yaml; historias 2-3 y 6-4 deben añadir el estado terminal y su transición.
