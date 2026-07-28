---
stepsCompleted: ["step-01", "step-02", "step-03", "step-04"]
inputDocuments:
  - "_bmad-output/planning-artifacts/prds/prd-mision-emprende-2026-07-26/prd.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-PROYECTO-INGENIERIA-DE-SOFTWARE-BMAD-2026-07-26/ARCHITECTURE-SPINE.md"
---

# Misión Emprende UDD - Epic Breakdown

## Overview

Este documento proporciona la descomposición completa de épicas e historias para Misión Emprende UDD, descomponiendo los requisitos del PRD y la Arquitectura en historias implementables.

## Requirements Inventory

### Functional Requirements

FR-001: El profesor se autentica mediante Amazon Cognito User Pool con correo y contraseña. El token JWT de Cognito es validado por API Gateway antes de llegar a cualquier Lambda de profesor.
FR-002: Al autenticarse, el sistema genera un token de sesión interno firmado (JWT con clave en Secrets Manager) que identifica al profesor dentro del dominio del juego.
FR-003: El acceso de grupos se realiza en tres pasos: (1) ingresar código alfanumérico de 6 caracteres; (2) definir nombre del grupo; (3) el sistema emite un JWT de grupo con sesionId, grupoId y nombreGrupo.
FR-004: El sistema impone límite de intentos fallidos de ingreso con código de grupo (máx. 5 intentos por IP por ventana de 5 minutos).
FR-005: Un profesor solo puede leer y modificar sesiones que le pertenecen. Cualquier intento de acceder a una sesión ajena retorna 403.
FR-006: El administrador se autentica mediante un mecanismo separado del profesor para acceder al panel de configuración del catálogo.
FR-007: El administrador puede crear, editar y eliminar temáticas. Una temática tiene: nombre, descripción corta e imagen representativa.
FR-008: El sistema impone que haya siempre exactamente 3 temáticas activas. No se puede desactivar una temática si quedarían menos de 3 activas.
FR-009: Cada temática tiene exactamente 3 desafíos activos asociados. Un desafío tiene: nombre, enunciado, y temática. El administrador puede crear, editar y eliminar desafíos.
FR-010: Los cambios en el catálogo no afectan sesiones ya creadas. Una sesión almacena una copia de la temática y desafío seleccionados.
FR-011: El profesor puede crear una sesión especificando nombre, temática, desafío y número de grupos. El sistema genera códigos de acceso únicos para cada grupo.
FR-012: El profesor puede listar sus sesiones activas e históricas con estado, fase actual y número de grupos activos.
FR-013: El profesor puede ajustar grupos antes de iniciar la primera fase (mientras la sesión está en estado `configuración`).
FR-014: El profesor puede cerrar una sesión manualmente. Una sesión cerrada impide nuevas acciones y congela el estado final.
FR-015: Solo el profesor puede disparar transiciones entre estados. El backend valida que el estado destino sea el sucesor directo del estado actual.
FR-016: La definición canónica de la máquina de estados vive en un único módulo compartido. Ningún módulo de fase reproduce esta lógica.
FR-017: Las acciones de los grupos solo son aceptadas si la sesión está en el estado correspondiente. Fuera del estado correcto, retorna 409 con mensaje descriptivo.
FR-018: Cada evento de transición de estado se publica en EventBridge para que componentes asíncronos reaccionen sin acoplamiento directo. (DIFERIDO por AD-4)
FR-019: Al iniciar una fase, el sistema registra timestampInicio y duracionSegundos en DynamoDB. El frontend calcula el tiempo restante usando el timestamp del servidor.
FR-020: El temporizador es visible de forma sincronizada en todos los dispositivos mediante polling del estado de sesión.
FR-021: Los grupos no pueden enviar acciones de la fase cuando el temporizador ha expirado, salvo que el profesor haya habilitado tiempo extra.
FR-022: El profesor puede avanzar de fase antes de que el temporizador expire (override manual).
FR-023: El profesor configura la duración del temporizador de cada fase al momento de la transición; el sistema provee un valor por defecto si no se especifica.
FR-024: Cada grupo recibe el tablero de sopa de letras y la lista de palabras objetivo del desafío de la sesión. El tablero y las palabras son iguales para todos los grupos.
FR-025: Un grupo puede enviar una palabra encontrada. El backend valida que la palabra pertenezca a la lista objetivo y que no haya sido registrada previamente. El registro es idempotente.
FR-026: Por cada palabra nueva confirmada, el grupo recibe 1 token. La lógica de asignación vive exclusivamente en la capa de servicio.
FR-027: El grupo puede consultar su progreso durante la fase: palabras encontradas y tokens acumulados.
FR-028: El profesor puede ver el progreso de todos los grupos en tiempo real durante la fase.
FR-029: Cada grupo construye un bubble map respondiendo preguntas estructuradas sobre el usuario objetivo del desafío.
FR-030: Las respuestas del bubble map se persisten por grupo. El grupo puede editar sus respuestas mientras la sesión está en fase2 y el temporizador no ha expirado.
FR-031: Al completar el bubble map (todas las burbujas obligatorias llenas), el grupo recibe una recompensa de tokens. La entrega es idempotente.
FR-032: El profesor puede ver el estado de avance del bubble map de cada grupo (completo / en progreso / sin iniciar).
FR-033: Cada grupo puede subir una fotografía de su construcción LEGO en 3 pasos: (1) solicitar URL prefirmada S3; (2) subir imagen directamente a S3; (3) confirmar al backend que la subida terminó.
FR-034: Si el objeto S3 no existe al momento de la confirmación, el backend retorna error y el grupo puede reintentar desde el paso 1.
FR-035: El procesamiento de la foto (miniatura, validación) se realiza de forma asíncrona mediante SQS. El grupo no espera el procesamiento para continuar.
FR-036: Si el procesamiento falla, el mensaje va a una DLQ. El grupo no queda en estado inválido; la foto original se preserva.
FR-037: Las fotografías LEGO se almacenan en un bucket S3 privado separado del bucket de frontend, servidas mediante URLs prefirmadas.
FR-038: Al confirmar la foto, el grupo recibe tokens. La entrega es idempotente.
FR-039: Durante fase4, el profesor controla el turno de presentación. Solo un grupo puede estar en turno activo simultáneamente.
FR-040: Mientras un grupo presenta, los demás grupos y el profesor pueden enviar su evaluación del pitch. La evaluación se habilita/cierra según el turno.
FR-041: La evaluación se compone de 4 criterios fijos: Equipo, Empatía, Creatividad y Comunicación. Escala 1–4 por criterio. Puntaje total: suma de los 4 (mínimo 4, máximo 16).
FR-042: El sistema muestra una rúbrica simple que describe qué significa cada nivel (1 a 4) durante la evaluación.
FR-043: Un evaluador solo puede enviar una evaluación por grupo presentador. El sistema rechaza evaluaciones duplicadas.
FR-044: El grupo presentador no puede evaluarse a sí mismo.
FR-045: El profesor puede evaluar a todos los grupos. La evaluación del profesor tiene un peso de 2× respecto a la evaluación de cada grupo.
FR-046: Al cerrar el turno de un grupo, el backend calcula y persiste el puntaje de evaluación ponderado. El cálculo es idempotente.
FR-047: El puntaje de evaluación del pitch se convierte en tokens adicionales para el grupo presentador según una escala del sistema.
FR-048: Al entrar en un estado de ranking, el sistema calcula y publica el ranking de esa fase considerando únicamente los tokens acumulados en la fase correspondiente.
FR-049: El ranking final (tras evaluacion) es acumulativo de todas las fases: suma de tokens de Fase 1 + Fase 2 + Fase 3 + tokens de evaluación de Fase 4.
FR-050: El ranking es visible por todos los participantes en los estados de ranking correspondientes.
FR-051: El cálculo de rankings es un proceso síncrono (AD-4) expuesto en endpoints /api/faseN/ranking dentro de cada módulo de fase.
FR-052: Tanto grupos como profesor pueden consultar el estado actual de la sesión (fase activa, tiempo restante, progreso por grupo, ranking si corresponde) en cualquier momento.
FR-053: El frontend consulta el estado periódicamente mediante polling. El intervalo y la estructura de respuesta están diseñados para minimizar latencia sin saturar la API.
FR-054: El sistema expone un endpoint de salud (GET /api/salud) que verifica conectividad con DynamoDB sin tocar datos del juego.
FR-055: El sistema soporta exactamente dos entornos aislados: dev y prod. DynamoDB, S3, Cognito, secretos y dominios son completamente independientes por entorno.
FR-056: La infraestructura se define y despliega con AWS SAM. El pipeline CI/CD se define completo y documentado; en el entorno educativo, los pasos se ejecutan manualmente.

### NonFunctional Requirements

NFR-001: El tiempo de respuesta P95 de cualquier endpoint del juego debe ser ≤ 500 ms bajo carga de 10 grupos × 3 sesiones simultáneas.
NFR-002: Las Lambdas de rutas frecuentes se configuran con Provisioned Concurrency en producción si los cold starts superan 800 ms en P95.
NFR-003: DynamoDB se configura en modo On-Demand para absorber picos de demanda sin degradación.
NFR-004 (crítico): Toda operación que entregue tokens, registre progreso o emita un puntaje debe ser idempotente. Se implementa mediante ConditionExpression de DynamoDB.
NFR-005: Toda Lambda que procese mensajes SQS o eventos EventBridge tiene una Dead Letter Queue configurada. Los mensajes fallidos se retienen 14 días.
NFR-006: Las llamadas al SDK AWS desde Lambda usan retry automático con backoff exponencial y jitter (maxAttempts: 3).
NFR-007: Circuit Breaker aplicado en: Lambda Fase 3 → S3 para confirmación de foto; Lambda de autenticación de profesor → Cognito.
NFR-008: Las Lambdas de cada módulo tienen ReservedConcurrentExecutions configurado para evitar que un pico en una fase consuma toda la concurrencia disponible.
NFR-009: La arquitectura tolera la inyección de fallos en servicios externos. Cada punto de integración tiene: timeout explícito, respuesta de degradación, y caso de prueba de caos documentado.
NFR-010: Mínimo privilegio IAM por Lambda (diseño). En cuenta educativa, todas las Lambdas usan LabRole explícitamente en template.yaml.
NFR-011: Sin secretos en código. Claves JWT en Secrets Manager o SSM. Las Lambdas los obtienen fuera del handler para reutilización en warm invocations.
NFR-012: Autenticación de profesor vía Cognito Authorizer. Si Cognito no está disponible en la cuenta educativa, usar JWT firmado internamente con clave en Secrets Manager.
NFR-013: CORS restringido en producción. Access-Control-Allow-Origin permite exclusivamente el dominio de CloudFront. El valor * está prohibido en producción.
NFR-014: Toda query DynamoDB en rutas de profesor incluye el profesorId derivado del token como condición de filtro obligatoria.
NFR-015: DynamoDB cifrado en reposo (AWS managed key). S3 con SSE-S3. Todo tráfico mediante HTTPS (TLS 1.2+). CloudFront redirige HTTP → HTTPS.
NFR-016: La tabla DynamoDB de producción tiene Point-in-Time Recovery habilitado.
NFR-017: La totalidad de recursos AWS se define en template.yaml de AWS SAM. La consola AWS se usa solo para observación.
NFR-018: Pipeline CI/CD definido completo: type-check → pruebas Vitest → empaquetado esbuild → validación SAM → despliegue dev → despliegue prod con aprobación.
NFR-019: Funciones Lambda con límites explícitos: memoria mínima 256 MB, timeout ≤ 10 s para síncronas, timeout máximo 15 min para asíncronas.
NFR-020: Todas las Lambdas emiten logs estructurados en JSON a CloudWatch Logs con: requestId, sesionId, grupoId o profesorId, duracionMs, nivel.
NFR-021: Alarmas CloudWatch configuradas para: tasa de errores Lambda > 1% en 5 min, P99 latencia API Gateway > 2 s, DLQ con mensajes > 0, cold starts superando umbral.
NFR-022: Los logs no exponen tokens de acceso, códigos de grupo ni datos personales de estudiantes.

### Additional Requirements

Requisitos técnicos adicionales extraídos de la Arquitectura (ARCHITECTURE-SPINE.md):

- **AD-1 — Sin importaciones cruzadas entre repositorios:** Ningún módulo importa el `repositorio.ts` de otro módulo. Datos compartidos entre fases se acceden mediante contratos explícitos definidos en `compartido/contratos/`.
- **AD-2 — Máquina de estados en compartido/:** Crear `compartido/maquinaEstados.ts` con `FASES_ORDEN`, `TIEMPOS_POR_FASE` y constantes de fase. Ningún módulo usa strings literales de fase.
- **AD-3 — profesorId en el token (deuda técnica):** El token de profesor debe incluir `profesorId` estable. FR-005 no está implementado hasta que el token lleve identidad. Requiere historia de deuda técnica explícita.
- **AD-4 — Rankings sincrónicos:** El cálculo de ranking se ejecuta síncronamente en endpoints `/api/faseN/ranking` dentro de cada módulo. EventBridge y rankings async quedan diferidos.
- **AD-5 — Dirección de dependencias hacia el núcleo:** `api.ts` → `servicio.ts` → interfaz repositorio. La flecha nunca se invierte.
- **AD-6 — Tabla DynamoDB única con GSI:** Una tabla por entorno (`MisionEmprende-{env}`), claves `PK` + `SK`, GSI1 (`GSI1PK`, `GSI1SK`). Prefijos solo en `repositorio.ts`.
- **AD-7 — Autenticación exclusivamente vía helpers compartidos:** Grupos: `contextoDesdeEvento(event)`. Profesores: `validarProfesorDesdeEvento(event)`.
- **Infraestructura diferida a implementar antes del despliegue:**
  - Bucket S3 y permisos SAM para fotos LEGO (FR-033..FR-037) — no está en template.yaml actual.
  - CloudFront + S3 frontend — no está en template.yaml actual.
  - PITR en producción — template.yaml actual tiene `PointInTimeRecoveryEnabled: false`.
- **Módulos planificados pero no implementados:** `fase4/` (Pitch y Evaluación Cruzada), `catalogo/` (Gestión de temáticas y desafíos), mecanismo de autenticación admin.
- **Deuda técnica en fase3:** El flujo de URL prefirmada y confirmación (FR-033..FR-037) está pendiente; el frontend actual guarda la imagen en localStorage y envía únicamente `conFoto: true`.
- **Stack fijo:** Node.js 22.x Lambda runtime, TypeScript 7.0.2, AWS SAM, @aws-sdk/lib-dynamodb 3.1085.0, esbuild 0.28.1, Vitest 4.1.10.
- **Entorno educativo AWS Academy:** LabRole (`arn:aws:iam::815812412505:role/LabRole`) — iam:CreateRole denegado. Credenciales rotan por sesión. Disponibilidad de Cognito User Pool pendiente de verificación.

### UX Design Requirements

No se encontraron documentos de diseño UX en los artefactos de planificación. No aplica para este proyecto en su estado actual.

### FR Coverage Map

FR-001: Épica 1 — Autenticación profesor vía Cognito (o JWT interno)
FR-002: Épica 1 — Token de sesión interno firmado del profesor
FR-003: Épica 1 — Acceso de grupos con código + nombre + JWT de grupo
FR-004: Épica 1 — Rate limiting: máx. 5 intentos por IP en 5 minutos
FR-005: Épica 1 — Aislamiento por profesor (deuda técnica AD-3: profesorId en token)
FR-006: Épica 1 — Autenticación de administrador separada del profesor
FR-007: Épica 3 — CRUD de temáticas (nombre, descripción, imagen)
FR-008: Épica 3 — Regla de negocio: siempre exactamente 3 temáticas activas
FR-009: Épica 3 — CRUD de desafíos con regla de 3 por temática
FR-010: Épica 3 — Snapshot de temática/desafío en creación de sesión (cambios no afectan sesiones existentes)
FR-011: Épica 2 — Crear sesión (nombre, temática, desafío, número de grupos, códigos únicos)
FR-012: Épica 2 — Listar sesiones del profesor (activas e históricas)
FR-013: Épica 2 — Ajustar grupos antes de iniciar primera fase
FR-014: Épica 2 — Cerrar sesión manualmente (congela estado final)
FR-015: Épica 2 — Transiciones de estado: solo el profesor, sucesor directo obligatorio
FR-016: Épica 2 — Máquina de estados canónica en compartido/maquinaEstados.ts (AD-2)
FR-017: Épica 2 — Validación de fase activa: grupos reciben 409 si están fuera de su fase
FR-018: Épica 2 — EventBridge por transición de estado — DIFERIDO (AD-4)
FR-019: Épica 2 — Temporizador: timestampInicio + duracionSegundos en DynamoDB, cálculo en frontend
FR-020: Épica 2 — Temporizador sincronizado en todos los dispositivos vía polling
FR-021: Épica 2 — Bloqueo de acciones del grupo cuando temporizador ha expirado
FR-022: Épica 2 — Override manual del profesor para avanzar antes de que expire el temporizador
FR-023: Épica 2 — Configuración de duración del temporizador por fase (con valor por defecto)
FR-024: Épica 4 — Tablero de sopa de letras y lista de palabras objetivo por sesión (igual para todos los grupos)
FR-025: Épica 4 — Envío de palabra encontrada: validación y registro idempotente
FR-026: Épica 4 — 1 token por palabra nueva confirmada (lógica exclusiva en servicio.ts)
FR-027: Épica 4 — Consulta de progreso del grupo: palabras encontradas y tokens acumulados
FR-028: Épica 4 — Vista del profesor: progreso de todos los grupos en tiempo real (Fase 1)
FR-029: Épica 4 — Bubble map: preguntas estructuradas por grupo sobre el usuario objetivo
FR-030: Épica 4 — Persistencia y edición de respuestas del bubble map mientras fase2 activa y timer vigente
FR-031: Épica 4 — Recompensa de tokens al completar el bubble map (idempotente)
FR-032: Épica 4 — Vista del profesor: estado de avance del bubble map por grupo (completo/en progreso/sin iniciar)
FR-033: Épica 5 — Flujo 3 pasos LEGO: solicitar URL prefirmada S3, subida directa, confirmación al backend
FR-034: Épica 5 — Error si objeto S3 no existe en confirmación; grupo puede reintentar desde paso 1
FR-035: Épica 5 — Procesamiento asíncrono de foto (miniatura, validación) vía SQS; grupo no espera
FR-036: Épica 5 — Fallos de procesamiento van a DLQ; grupo no queda en estado inválido
FR-037: Épica 5 — Bucket S3 privado para fotos LEGO; servidas con URLs prefirmadas, nunca públicas
FR-038: Épica 5 — Tokens al confirmar foto LEGO (idempotente)
FR-039: Épica 6 — Control de turno de presentación por el profesor; un grupo activo simultáneamente
FR-040: Épica 6 — Habilitación/cierre de evaluación según turno activo del grupo presentador
FR-041: Épica 6 — 4 criterios de evaluación fijos (Equipo, Empatía, Creatividad, Comunicación), escala 1–4
FR-042: Épica 6 — Rúbrica visible para grupos y profesor durante la evaluación
FR-043: Épica 6 — Un evaluador, una evaluación por grupo presentador (rechazo de duplicados)
FR-044: Épica 6 — El grupo presentador no puede evaluarse a sí mismo
FR-045: Épica 6 — Evaluación del profesor con peso 2× en el cálculo ponderado
FR-046: Épica 6 — Cálculo y persistencia de puntaje ponderado al cerrar turno (idempotente)
FR-047: Épica 6 — Conversión de puntaje de evaluación a tokens adicionales para el grupo presentador
FR-048: Épica 6 — Ranking por fase: tokens acumulados en esa fase al entrar en estado ranking
FR-049: Épica 6 — Ranking final acumulativo: suma de tokens de Fase 1 + 2 + 3 + tokens de evaluación Fase 4
FR-050: Épica 6 — Ranking visible por todos los participantes en los estados de ranking correspondientes
FR-051: Épica 6 — Cálculo de ranking síncrono en endpoints /api/faseN/ranking (AD-4)
FR-052: Épica 2 — Consulta del estado de sesión por grupo y profesor (fase, timer, progreso, ranking)
FR-053: Épica 2 — Polling del frontend: intervalo y estructura de respuesta optimizados
FR-054: Épica 2 — Endpoint de salud GET /api/salud (verifica DynamoDB sin tocar datos del juego)
FR-055: Épica 7 — Entornos dev y prod completamente aislados (DynamoDB, S3, Cognito, secretos, dominios)
FR-056: Épica 7 — Infraestructura SAM completa + pipeline CI/CD documentado (ejecutable manualmente en educativo)

## Epic List

### Épica 1: Identidad y Acceso Seguro del Sistema
Todos los actores (profesor, grupos, administrador) se autentican con identidad propia. El profesor gestiona exclusivamente sus sesiones (aislamiento real resolviendo la deuda técnica AD-3). Los grupos acceden con código seguro y protección contra fuerza bruta. El administrador accede al panel de configuración del catálogo.
**FRs cubiertos:** FR-001, FR-002, FR-003, FR-004, FR-005, FR-006

### Épica 2: Orquestación de Sesión y Control del Juego
El profesor puede crear y gestionar el ciclo de vida completo de una sesión: configurar grupos, disparar transiciones entre fases con la máquina de estados canónica unificada (AD-2), configurar temporizadores sincronizados en todos los dispositivos, y cerrar sesiones. Grupos y profesor consultan el estado de sesión en tiempo real mediante polling eficiente.
**FRs cubiertos:** FR-011, FR-012, FR-013, FR-014, FR-015, FR-016, FR-017, FR-019, FR-020, FR-021, FR-022, FR-023, FR-052, FR-053, FR-054
**Nota:** FR-018 (EventBridge async) — DIFERIDO por decisión AD-4.

### Épica 3: Catálogo de Temáticas y Desafíos
El administrador puede gestionar el catálogo de temáticas (regla de negocio: siempre exactamente 3 activas) y desafíos (exactamente 3 activos por temática) que configuran el contenido educativo de las sesiones. Los cambios en el catálogo no afectan sesiones ya creadas.
**FRs cubiertos:** FR-007, FR-008, FR-009, FR-010

### Épica 4: Fase 1 — Sopa de Letras y Fase 2 — Empatía
Los grupos participan en la Sopa de Letras (buscan palabras, reciben 1 token por palabra confirmada) y en el Bubble Map de Empatía (responden preguntas estructuradas, reciben recompensa al completar todas las burbujas obligatorias). El profesor visualiza el progreso de todos los grupos en tiempo real durante cada fase.
**FRs cubiertos:** FR-024, FR-025, FR-026, FR-027, FR-028, FR-029, FR-030, FR-031, FR-032

### Épica 5: Fase 3 — Creatividad LEGO (Flujo Completo S3)
Los grupos suben fotografías LEGO con el flujo completo seguro de S3: solicitar URL prefirmada → subir directamente a S3 → confirmar al backend (que verifica existencia del objeto). El sistema procesa imágenes de forma asíncrona vía SQS sin bloquear al grupo, con manejo robusto de fallos (DLQ). Las fotos se sirven exclusivamente mediante URLs prefirmadas desde bucket privado.
**FRs cubiertos:** FR-033, FR-034, FR-035, FR-036, FR-037, FR-038
**Deuda técnica:** El flujo actual solo persiste `conFoto: true`. Esta épica implementa el flujo real completo.

### Épica 6: Fase 4 — Pitch, Evaluación Cruzada y Ranking Final
El profesor controla los turnos de presentación de cada grupo. Los grupos y el profesor evalúan los pitches con la rúbrica de 4 criterios (escala 1–4), con peso 2× para la evaluación del profesor. El sistema calcula puntajes ponderados y el ranking final acumulativo de todas las fases (tokens Fase 1 + 2 + 3 + tokens de evaluación de Fase 4).
**FRs cubiertos:** FR-039, FR-040, FR-041, FR-042, FR-043, FR-044, FR-045, FR-046, FR-047, FR-048, FR-049, FR-050, FR-051

### Épica 7: Sistema Listo para Producción
El sistema opera una sesión completa de ~90 minutos en AWS sin interrupciones, con infraestructura completa definida como código (CloudFront + S3 frontend, bucket S3 LEGO, PITR habilitado en producción, SAM completo), entornos `dev` y `prod` completamente aislados, seguridad hardened (CORS restringido, cifrado, sin secretos en código), logs estructurados en JSON a CloudWatch con alarmas configuradas, y pipeline CI/CD documentado y ejecutable paso a paso en entorno educativo.
**FRs cubiertos:** FR-055, FR-056
**NFRs cubiertos:** NFR-001 a NFR-022

## Épica 1: Identidad y Acceso Seguro del Sistema

Todos los actores (profesor, grupos, administrador) se autentican con identidad propia. El profesor gestiona exclusivamente sus sesiones (aislamiento real resolviendo la deuda técnica AD-3). Los grupos acceden con código seguro y protección contra fuerza bruta. El administrador accede al panel de configuración del catálogo.

### Historia 1.1: Acceso de Grupos — Código de Sesión, Nombre y JWT de Grupo

Como grupo de estudiantes,
quiero ingresar el código alfanumérico de 6 caracteres entregado por el profesor, definir el nombre de mi grupo y recibir un JWT firmado que identifique a mi grupo en la sesión,
para que mi grupo pueda participar en las actividades del juego con una identidad segura y verificada.

**Criterios de Aceptación:**

**Dado** que existe una sesión activa con un grupo configurado con ese código
**Cuando** el grupo ingresa el código correcto y proporciona un nombre de grupo
**Entonces** el sistema emite un JWT firmado que contiene `sesionId`, `grupoId` y `nombreGrupo`
**Y** el JWT expira cuando la sesión es cerrada

**Dado** que el grupo envía el mismo código de acceso una segunda vez
**Cuando** el grupo ya había sido registrado con ese código
**Entonces** el sistema emite un nuevo JWT para el grupo existente sin crear un grupo duplicado (login idempotente)

**Dado** que el código de acceso no corresponde a ningún grupo en sesiones activas
**Cuando** el grupo intenta autenticarse con ese código
**Entonces** el sistema retorna 400 con `{ ok: false, codigo: "CODIGO_INVALIDO", error: "Código de acceso no encontrado" }`

**Dado** que cualquier `api.ts` de grupos recibe una petición autenticada
**Cuando** se llama a `contextoDesdeEvento(event)` desde `compartido/seguridad.ts`
**Entonces** extrae `sesionId`, `grupoId` y `nombreGrupo` del token sin parsear el JWT manualmente en `api.ts`

---

### Historia 1.2: Protección contra Fuerza Bruta en Acceso de Grupos

Como el administrador del sistema,
quiero limitar los intentos fallidos de ingreso con código de grupo a un máximo de 5 por IP en una ventana de 5 minutos,
para que las sesiones estén protegidas contra ataques de fuerza bruta sobre los códigos de acceso.

**Criterios de Aceptación:**

**Dado** que una IP ha realizado 4 intentos fallidos en los últimos 5 minutos
**Cuando** esa IP realiza un 5° intento fallido
**Entonces** el sistema retorna 429 con `{ ok: false, codigo: "LIMITE_INTENTOS_EXCEDIDO", error: "Demasiados intentos. Espere 5 minutos." }`
**Y** los intentos posteriores de esa IP son bloqueados hasta que la ventana de 5 minutos expire

**Dado** que una IP ha alcanzado el límite y la ventana de 5 minutos expiró
**Cuando** esa IP realiza un nuevo intento de acceso
**Entonces** el contador se resetea y la petición se procesa con normalidad

**Dado** que una IP hizo 3 intentos fallidos seguidos de un acceso exitoso
**Cuando** esa IP realiza otro intento posterior al éxito
**Entonces** el contador no acumula los intentos previos al login exitoso

---

### Historia 1.3: Autenticación del Profesor y Token de Dominio con profesorId

Como profesor,
quiero autenticarme con mi correo y contraseña, y recibir un token de dominio que incluya mi `profesorId` único y estable,
para que el sistema pueda identificarme individualmente y gestionar exclusivamente mis propias sesiones.

**Criterios de Aceptación:**

**Dado** que Cognito User Pool está disponible en la cuenta educativa
**Cuando** un profesor se autentica con correo y contraseña válidos vía Cognito
**Entonces** API Gateway valida el JWT de Cognito antes de que el handler Lambda se ejecute
**Y** el sistema genera un JWT de dominio firmado con la clave en Secrets Manager que incluye `profesorId` estable y único
**Y** el token de dominio nunca expone credenciales de Cognito al frontend

**Dado** que Cognito User Pool no está disponible en la cuenta educativa (fallback NFR-012)
**Cuando** un profesor se autentica contra el endpoint de auth interno
**Entonces** el sistema valida credenciales y emite un JWT de dominio con `profesorId` desde Secrets Manager
**Y** el mecanismo es conmutable (Cognito ↔ JWT interno) sin cambios en ningún otro módulo

**Dado** que un profesor proporciona credenciales inválidas
**Cuando** intenta autenticarse
**Entonces** el sistema retorna 401 con `{ ok: false, codigo: "CREDENCIALES_INVALIDAS", error: "Correo o contraseña incorrectos" }` sin revelar qué campo es incorrecto

**Dado** que cualquier ruta de profesor recibe una petición
**Cuando** se llama a `validarProfesorDesdeEvento(event)` desde `compartido/seguridad.ts`
**Entonces** extrae `profesorId` del token sin parsear el JWT manualmente en `api.ts`

---

### Historia 1.4: Aislamiento de Sesiones por Profesor — Resolución Deuda Técnica AD-3

Como profesor,
quiero que cada petición a mis sesiones sea filtrada por mi `profesorId` a nivel de la consulta DynamoDB,
para que no pueda leer ni modificar sesiones de otros profesores, incluso con un token válido.

**Criterios de Aceptación:**

**Dado** que el Profesor A está autenticado con su `profesorId` en el token
**Cuando** solicita listar sus sesiones
**Entonces** la query DynamoDB usa `GSI1PK = PROFESOR#{profesorId}` como condición obligatoria de filtro
**Y** ninguna sesión de otro profesor aparece en el resultado

**Dado** que el Profesor A construye una petición apuntando a una `sesionId` que pertenece al Profesor B
**Cuando** realiza cualquier acción sobre esa sesión (leer estado, avanzar fase, cerrar sesión)
**Entonces** el sistema verifica la propiedad usando `profesorId` del token contra el dueño almacenado en DynamoDB
**Y** retorna 403 con `{ ok: false, codigo: "ACCESO_DENEGADO", error: "No tienes acceso a esta sesión" }` si la propiedad no coincide

**Dado** cualquier endpoint de profesor en `api.ts`
**Cuando** llega una petición autenticada
**Entonces** `profesorId` se obtiene siempre del token validado, nunca del body o query string (NFR-014)

---

### Historia 1.5: Autenticación del Administrador

Como administrador,
quiero autenticarme con un mecanismo separado del profesor para acceder al panel de configuración del catálogo,
para que el rol de administrador esté limpiamente separado del acceso de profesores y la gestión del catálogo esté apropiadamente restringida.

**Criterios de Aceptación:**

**Dado** que el sistema tiene un endpoint de autenticación para administradores
**Cuando** un usuario con credenciales admin (grupo Cognito admin o claim `rol: admin`) se autentica
**Entonces** el sistema emite un token de dominio con `rol: admin` que otorga acceso a las rutas de gestión del catálogo
**Y** el token de admin no otorga acceso a las rutas de sesiones de profesores

**Dado** un token de profesor (sin `rol: admin`)
**Cuando** se usa para acceder a una ruta de catálogo restringida a admin
**Entonces** el sistema retorna 403 con `{ ok: false, codigo: "ACCESO_DENEGADO", error: "Se requiere rol de administrador" }`

**Dado** un token de admin
**Cuando** se usa para acceder a rutas de gestión de sesiones del profesor
**Entonces** el sistema retorna 403 (el admin no gestiona sesiones, solo el catálogo)

---

## Épica 2: Orquestación de Sesión y Control del Juego

El profesor puede crear y gestionar el ciclo de vida completo de una sesión: configurar grupos, disparar transiciones entre fases con la máquina de estados canónica unificada (AD-2), configurar temporizadores sincronizados en todos los dispositivos, y cerrar sesiones. Grupos y profesor consultan el estado de sesión en tiempo real mediante polling eficiente.

### Historia 2.1: Crear Sesión de Juego con Grupos y Códigos de Acceso

Como profesor,
quiero crear una sesión especificando nombre, temática, desafío y número de grupos, y que el sistema genere automáticamente códigos de acceso únicos por grupo,
para que pueda preparar una sesión de clase lista para que los grupos ingresen.

**Criterios de Aceptación:**

**Dado** que el profesor está autenticado y selecciona una temática y desafío válidos del catálogo activo
**Cuando** crea una sesión con nombre, temática, desafío y número de grupos (1–10)
**Entonces** el sistema crea la sesión en estado `configuracion` (definido en `compartido/maquinaEstados.ts`)
**Y** genera N códigos de acceso alfanuméricos de 6 caracteres únicos en el sistema, uno por grupo
**Y** almacena una copia snapshot de la temática y el desafío seleccionados en la sesión
**Y** retorna la sesión creada con sus códigos de acceso

**Dado** que `compartido/maquinaEstados.ts` existe en el proyecto
**Cuando** cualquier módulo necesita validar el estado de una sesión o hacer una transición
**Entonces** importa las constantes de `FASES_ORDEN`, `TIEMPOS_POR_FASE`, y los strings de fase desde ese módulo sin usar strings literales propios

**Dado** que el profesor intenta crear una sesión con un número de grupos fuera del rango permitido (< 1 o > 10)
**Cuando** envía la petición de creación
**Entonces** el sistema retorna 400 con `{ ok: false, codigo: "GRUPOS_INVALIDOS", error: "El número de grupos debe ser entre 1 y 10" }`

---

### Historia 2.2: Listado y Ajuste de Grupos en Sesiones del Profesor

Como profesor,
quiero listar mis sesiones activas e históricas y ajustar los grupos de una sesión antes de iniciar la primera fase,
para que pueda gestionar el estado de mis clases y adaptarme si el número de participantes cambia antes de comenzar.

**Criterios de Aceptación:**

**Dado** que el profesor está autenticado
**Cuando** solicita el listado de sus sesiones
**Entonces** recibe solo las sesiones que le pertenecen (filtradas por su `profesorId`), con estado actual, fase activa y número de grupos activos de cada una

**Dado** que una sesión está en estado `configuracion`
**Cuando** el profesor ajusta el número de grupos (agrega o elimina)
**Entonces** el sistema actualiza los grupos y genera nuevos códigos de acceso para los grupos nuevos
**Y** no invalida los códigos de acceso de grupos que ya existen y no cambiaron

**Dado** que una sesión ya inició su primera fase (estado diferente de `configuracion`)
**Cuando** el profesor intenta ajustar los grupos
**Entonces** el sistema retorna 409 con `{ ok: false, codigo: "SESION_EN_CURSO", error: "No se pueden ajustar grupos una vez iniciada la sesión" }`

---

### Historia 2.3: Transiciones de Estado del Juego y Cierre de Sesión

Como profesor,
quiero avanzar la sesión entre fases en el orden establecido y cerrarla manualmente cuando termine,
para que el flujo del juego esté bajo mi control y los grupos solo puedan actuar en la fase que corresponde.

**Criterios de Aceptación:**

**Dado** que la sesión está en un estado que tiene un sucesor definido en `maquinaEstados.ts`
**Cuando** el profesor dispara la transición al estado siguiente
**Entonces** el sistema valida que el estado destino es el sucesor directo del estado actual
**Y** actualiza el estado de la sesión en DynamoDB atómicamente
**Y** retorna el nuevo estado de la sesión

**Dado** que el profesor intenta hacer una transición a un estado no-sucesor
**Cuando** envía la petición de transición
**Entonces** el sistema retorna 409 con `{ ok: false, codigo: "TRANSICION_INVALIDA", error: "La transición solicitada no está permitida desde el estado actual" }`

**Dado** que el profesor cierra la sesión manualmente
**Cuando** envía la petición de cierre
**Entonces** el sistema pone la sesión en estado `finalizado`
**Y** cualquier acción posterior de grupos sobre esa sesión retorna 409 con `{ ok: false, codigo: "SESION_CERRADA", error: "La sesión ha finalizado" }`

**Dado** que un grupo intenta enviar una acción de Fase 1 mientras la sesión está en `fase2`
**Cuando** el backend procesa la petición
**Entonces** retorna 409 con `{ ok: false, codigo: "FASE_INCORRECTA", error: "Esta acción no está disponible en la fase actual" }` sin ejecutar la acción

---

### Historia 2.4: Temporizadores Sincronizados por Fase

Como profesor,
quiero configurar la duración del temporizador al iniciar cada fase y que todos los dispositivos lo vean sincronizado,
para que los grupos tengan el mismo tiempo disponible sin depender del reloj de sus propios dispositivos.

**Criterios de Aceptación:**

**Dado** que el profesor dispara la transición a una fase de actividad
**Cuando** especifica una duración en segundos (o acepta el valor por defecto de `TIEMPOS_POR_FASE`)
**Entonces** el sistema registra `timestampInicio` (UTC del servidor) y `duracionSegundos` en DynamoDB junto con el nuevo estado
**Y** retorna ambos valores en la respuesta para que el frontend calcule el tiempo restante como `duracionSegundos − (ahoraUTC − timestampInicio)`

**Dado** que el temporizador de una fase ha expirado (`ahoraUTC > timestampInicio + duracionSegundos`)
**Cuando** un grupo intenta enviar una acción de esa fase
**Entonces** el backend verifica la expiración y retorna 409 con `{ ok: false, codigo: "TIEMPO_EXPIRADO", error: "El tiempo de la fase ha terminado" }`

**Dado** que el temporizador aún no ha expirado
**Cuando** el profesor avanza de fase manualmente (override)
**Entonces** el sistema procesa la transición normalmente como cualquier otra transición de estado

---

### Historia 2.5: Consulta del Estado de Sesión y Endpoint de Salud

Como grupo de estudiantes o profesor,
quiero consultar el estado actual de la sesión para ver la fase activa, el temporizador, el progreso y el ranking cuando corresponda,
para que todos los participantes estén sincronizados durante la sesión sin necesidad de recarga manual.

**Criterios de Aceptación:**

**Dado** que un grupo autenticado consulta el estado de su sesión
**Cuando** realiza `GET /api/sesiones/{sesionId}/estado`
**Entonces** recibe: estado actual, `timestampInicio`, `duracionSegundos`, progreso de su grupo en la fase activa, y ranking si el estado es un estado de ranking
**Y** la respuesta incluye todos los datos necesarios para que el frontend no realice llamadas adicionales por ciclo de polling

**Dado** que el profesor consulta el estado de una sesión suya
**Cuando** realiza la misma consulta con su token de profesor
**Entonces** recibe el estado completo incluyendo progreso de todos los grupos, no solo el propio

**Dado** que el sistema recibe `GET /api/salud`
**Cuando** se verifica la conectividad
**Entonces** retorna 200 con `{ ok: true, estado: "saludable" }` si DynamoDB responde correctamente
**Y** retorna 503 con `{ ok: false, error: "DynamoDB no responde" }` si falla la conexión
**Y** la verificación no lee ni escribe datos del juego

---

## Épica 3: Catálogo de Temáticas y Desafíos

El administrador puede gestionar el catálogo de temáticas (regla de negocio: siempre exactamente 3 activas) y desafíos (exactamente 3 activos por temática) que configuran el contenido educativo de las sesiones. Los cambios en el catálogo no afectan sesiones ya creadas.

### Historia 3.1: Gestión de Temáticas con Regla de 3 Activas

Como administrador,
quiero crear, editar y eliminar temáticas del sistema, con la garantía de que siempre haya exactamente 3 temáticas activas disponibles,
para que los profesores siempre tengan opciones de contenido válidas al crear una sesión.

**Criterios de Aceptación:**

**Dado** que el administrador está autenticado con `rol: admin`
**Cuando** crea una temática con nombre, descripción corta e imagen representativa
**Entonces** la temática queda registrada en el catálogo y puede activarse
**Y** el administrador puede editar nombre, descripción e imagen de cualquier temática existente

**Dado** que actualmente hay exactamente 3 temáticas activas
**Cuando** el administrador intenta desactivar una temática sin activar otra simultáneamente
**Entonces** el sistema retorna 409 con `{ ok: false, codigo: "MINIMO_TEMATICAS", error: "El sistema debe tener siempre al menos 3 temáticas activas" }`

**Dado** que hay menos de 3 temáticas activas (estado transitorio durante configuración inicial)
**Cuando** el administrador activa una temática que lo lleva a 3 activas
**Entonces** la operación se completa sin restricción

**Dado** que el administrador intenta eliminar una temática activa sin reemplazarla
**Cuando** quedarían menos de 3 temáticas activas como resultado
**Entonces** el sistema retorna 409 con el mismo error de mínimo de temáticas

---

### Historia 3.2: Gestión de Desafíos y Snapshot en Creación de Sesión

Como administrador,
quiero crear, editar y eliminar desafíos asociados a cada temática, respetando la regla de exactamente 3 desafíos activos por temática,
para que cada temática siempre tenga un conjunto completo de desafíos disponibles para que el profesor elija al crear una sesión.

**Criterios de Aceptación:**

**Dado** que el administrador está autenticado con `rol: admin`
**Cuando** crea un desafío con nombre, enunciado y temática asociada
**Entonces** el desafío queda registrado y asociado a esa temática

**Dado** que una temática ya tiene 3 desafíos activos
**Cuando** el administrador intenta agregar un cuarto desafío activo a esa temática
**Entonces** el sistema retorna 409 con `{ ok: false, codigo: "MAXIMO_DESAFIOS", error: "Una temática no puede tener más de 3 desafíos activos" }`

**Dado** que el administrador edita el enunciado de un desafío existente
**Cuando** ese desafío ya está siendo utilizado en sesiones activas o históricas
**Entonces** el cambio aplica solo al catálogo
**Y** las sesiones existentes conservan el snapshot original del desafío que tenían al momento de su creación

**Dado** que un profesor crea una nueva sesión seleccionando una temática y un desafío
**Cuando** la sesión es creada exitosamente
**Entonces** el sistema almacena una copia completa (snapshot) de la temática y el desafío seleccionados dentro de la sesión
**Y** cualquier modificación posterior al catálogo no altera los datos de esa sesión

---

## Épica 4: Fase 1 — Sopa de Letras y Fase 2 — Empatía

Los grupos participan en la Sopa de Letras (buscan palabras, reciben 1 token por palabra confirmada) y en el Bubble Map de Empatía (responden preguntas estructuradas, reciben recompensa al completar todas las burbujas obligatorias). El profesor visualiza el progreso de todos los grupos en tiempo real durante cada fase.

### Historia 4.1: Tablero de Sopa de Letras y Envío de Palabras

Como grupo de estudiantes,
quiero recibir el tablero de sopa de letras con las palabras objetivo de mi sesión y poder enviar las palabras que encuentro,
para que mi grupo acumule tokens por cada palabra correcta que descubra durante la Fase 1.

**Criterios de Aceptación:**

**Dado** que la sesión está en estado `fase1`
**Cuando** el grupo solicita el tablero de sopa de letras
**Entonces** recibe el tablero de letras y la lista de palabras objetivo correspondientes al desafío de la sesión
**Y** el tablero y la lista de palabras son idénticos para todos los grupos de la misma sesión

**Dado** que la sesión está en estado `fase1` y el temporizador no ha expirado
**Cuando** el grupo envía una palabra que pertenece a la lista objetivo y aún no había sido registrada por ese grupo
**Entonces** el sistema registra la palabra como encontrada por ese grupo
**Y** agrega 1 token al grupo (lógica exclusiva en `servicio.ts`, sin acceso al AWS SDK)
**Y** retorna `{ ok: true, tokensAcumulados: N, palabraConfirmada: "PALABRA" }`

**Dado** que el grupo ya había enviado y confirmado esa misma palabra anteriormente
**Cuando** la vuelve a enviar
**Entonces** el sistema retorna la misma respuesta exitosa sin duplicar el token (idempotencia con `ConditionExpression` DynamoDB)

**Dado** que el grupo envía una palabra que no pertenece a la lista objetivo
**Cuando** el backend valida la palabra
**Entonces** retorna 400 con `{ ok: false, codigo: "PALABRA_INVALIDA", error: "La palabra no está en la lista objetivo" }` sin modificar el estado del grupo

---

### Historia 4.2: Progreso del Grupo y Vista del Profesor en Fase 1

Como grupo de estudiantes y como profesor,
quiero consultar el progreso durante la Fase 1 — el grupo ve sus palabras encontradas y tokens, el profesor ve el avance de todos los grupos —
para que cada actor tenga la información que necesita durante la actividad.

**Criterios de Aceptación:**

**Dado** que la sesión está en estado `fase1`
**Cuando** el grupo consulta su progreso
**Entonces** recibe la lista de palabras que ha encontrado hasta ese momento y su total de tokens acumulados

**Dado** que la sesión está en estado `fase1`
**Cuando** el profesor solicita la vista de progreso de todos los grupos
**Entonces** recibe para cada grupo: nombre del grupo, cantidad de palabras encontradas, total de tokens, y porcentaje de avance respecto al total de palabras objetivo

**Dado** que un grupo acaba de confirmar una nueva palabra
**Cuando** el profesor consulta el progreso de los grupos a continuación
**Entonces** el progreso actualizado de ese grupo está reflejado en la respuesta

---

### Historia 4.3: Bubble Map de Empatía — Construcción y Persistencia

Como grupo de estudiantes,
quiero construir el bubble map respondiendo las preguntas estructuradas sobre el usuario objetivo del desafío y poder editar mis respuestas mientras la Fase 2 esté activa,
para que mi grupo pueda desarrollar y refinar su análisis de empatía durante el tiempo disponible.

**Criterios de Aceptación:**

**Dado** que el grupo abre el Bubble Map
**Entonces** el sistema presenta exactamente seis preguntas obligatorias: «¿Qué siente?», «¿Qué le gusta?», «¿Cómo es su entorno?», «¿Qué necesita?», «¿Qué le limita?» y «¿Qué le motiva?»
**Y** presenta como opcionales hasta cuatro hallazgos adicionales, un relato breve y un enlace de apoyo

**Dado** que la sesión está en estado `fase2` y el temporizador no ha expirado
**Cuando** el grupo envía o actualiza la respuesta de una burbuja del bubble map
**Entonces** el sistema persiste la respuesta asociada a ese grupo y esa burbuja
**Y** el grupo puede sobrescribir respuestas previas en cualquier burbuja mientras el tiempo esté vigente

**Dado** que el temporizador de `fase2` ha expirado
**Cuando** el grupo intenta editar una respuesta del bubble map
**Entonces** el sistema retorna 409 con `{ ok: false, codigo: "TIEMPO_EXPIRADO", error: "El tiempo de la fase ha terminado" }`

**Dado** que el grupo completa todas las burbujas obligatorias del bubble map
**Cuando** envía la confirmación de compleción
**Entonces** el sistema registra el bubble map como completo para ese grupo
**Y** calcula un punto por cada una de las seis respuestas obligatorias, hasta dos puntos por hallazgos adicionales, un punto por el relato y un punto por el enlace
**Y** entrega como recompensa el puntaje obtenido, entre 6 y 10 tokens (idempotente: ejecutar N veces produce el mismo resultado)
**Y** retorna `{ ok: true, completo: true, tokensAcumulados: N }`

**Dado** que falta al menos una de las seis respuestas obligatorias
**Cuando** el grupo intenta confirmar la compleción
**Entonces** el sistema no marca el Bubble Map como completo ni entrega tokens
**Y** retorna 400 con `{ ok: false, codigo: "BUBBLE_INCOMPLETO", error: "Completa las seis preguntas obligatorias" }`

---

### Historia 4.4: Vista del Profesor en Fase 2 — Estado del Bubble Map por Grupo

Como profesor,
quiero ver el estado de avance del bubble map de cada grupo durante la Fase 2,
para que pueda saber qué grupos necesitan ayuda o están atrasados durante la actividad de empatía.

**Criterios de Aceptación:**

**Dado** que la sesión está en estado `fase2`
**Cuando** el profesor solicita la vista de progreso del bubble map
**Entonces** recibe para cada grupo su estado: `completo`, `en_progreso`, o `sin_iniciar`
**Y** para los grupos `en_progreso`, recibe el número de burbujas respondidas vs. el total de burbujas obligatorias

**Dado** que un grupo acaba de completar su bubble map
**Cuando** el profesor consulta la vista de progreso a continuación
**Entonces** ese grupo aparece con estado `completo`

---

## Épica 5: Fase 3 — Creatividad LEGO (Flujo Completo S3)

Los grupos suben fotografías LEGO con el flujo completo seguro de S3: solicitar URL prefirmada → subir directamente a S3 → confirmar al backend (que verifica existencia del objeto). El sistema procesa imágenes de forma asíncrona vía SQS sin bloquear al grupo, con manejo robusto de fallos (DLQ). Las fotos se sirven exclusivamente mediante URLs prefirmadas desde bucket privado.

### Historia 5.1: Infraestructura S3 y Endpoint de URL Prefirmada para Fotos LEGO

Como grupo de estudiantes,
quiero solicitar al sistema una URL de subida de corta duración para cargar mi fotografía LEGO directamente a S3 sin pasar por el backend,
para que la carga sea eficiente y el backend no sea un cuello de botella en la transferencia del archivo.

**Criterios de Aceptación:**

**Dado** que el bucket S3 privado para fotos LEGO está definido en `template.yaml` y desplegado como parte de esta historia
**Cuando** el bucket existe en la cuenta
**Entonces** tiene SSE-S3 habilitado, no tiene acceso público, y los objetos solo son accesibles mediante URLs prefirmadas

**Dado** que la sesión está en estado `fase3` y el temporizador no ha expirado
**Cuando** el grupo autenticado solicita `POST /api/fase3/url-foto`
**Entonces** el backend genera una URL prefirmada de S3 con duración de 15 minutos para subir el archivo de imagen
**Y** retorna `{ ok: true, urlSubida: "https://...", objetoKey: "sesiones/{sesionId}/grupos/{grupoId}/foto" }`
**Y** el grupo usa esa URL directamente desde el navegador para subir el archivo sin pasar por el backend

**Dado** que la sesión no está en estado `fase3`
**Cuando** el grupo solicita una URL prefirmada
**Entonces** el sistema retorna 409 con `{ ok: false, codigo: "FASE_INCORRECTA", error: "Esta acción no está disponible en la fase actual" }`

---

### Historia 5.2: Confirmación de Foto y Entrega de Tokens

Como grupo de estudiantes,
quiero confirmar al sistema que terminé de subir mi fotografía LEGO a S3, para que el backend verifique que el archivo existe y me entregue los tokens correspondientes,
para que mi grupo reciba el reconocimiento por completar la actividad de construcción.

**Criterios de Aceptación:**

**Dado** que el grupo ha subido exitosamente su foto a la URL prefirmada
**Cuando** el grupo confirma al backend con `POST /api/fase3/confirmar-foto` enviando el `objetoKey`
**Entonces** el backend verifica la existencia del objeto en S3 (usando el AWS SDK en `repositorio.ts`)
**Y** registra la foto como confirmada para ese grupo
**Y** entrega los tokens al grupo (idempotente con `ConditionExpression` DynamoDB)
**Y** publica un mensaje SQS para el procesamiento asíncrono de la imagen
**Y** retorna `{ ok: true, tokensAcumulados: N }` sin esperar el resultado del procesamiento

**Dado** que el grupo confirma pero el objeto no existe en S3 (subida falló o no ocurrió)
**Cuando** el backend verifica la existencia del objeto
**Entonces** retorna 400 con `{ ok: false, codigo: "FOTO_NO_ENCONTRADA", error: "La fotografía no fue encontrada en el servidor. Por favor intente subir la foto nuevamente." }`
**Y** el grupo puede reintentar el flujo completo desde la solicitud de URL prefirmada

**Dado** que el grupo ya había confirmado exitosamente su foto anteriormente
**Cuando** el backend recibe una segunda confirmación del mismo grupo
**Entonces** retorna la misma respuesta exitosa sin duplicar los tokens (idempotencia)

---

### Historia 5.3: Procesamiento Asíncrono de Fotos LEGO con Manejo de Fallos

Como el administrador del sistema,
quiero procesar las fotografías LEGO de forma asíncrona (miniatura, validación de formato y tamaño) sin bloquear al grupo, y enrutar los fallos a una DLQ para revisión manual,
para que un error de procesamiento no deje al grupo en estado inválido ni pierda la foto original.

**Criterios de Aceptación:**

**Dado** que el backend publicó un mensaje SQS tras la confirmación de foto
**Cuando** la Lambda de procesamiento consume el mensaje
**Entonces** valida el formato y tamaño de la imagen y genera una miniatura almacenada en el mismo bucket S3
**Y** actualiza el registro del grupo con la referencia a la miniatura
**Y** la foto original se preserva independientemente del resultado del procesamiento

**Dado** que el procesamiento de la imagen falla (formato inválido, timeout, error S3)
**Cuando** la Lambda de procesamiento no puede completar la tarea tras los reintentos configurados
**Entonces** el mensaje va a la Dead Letter Queue (DLQ) configurada en `template.yaml`
**Y** el estado del grupo permanece con `foto confirmada` (no inválido)
**Y** el grupo puede continuar participando en la sesión normalmente

**Dado** que la Lambda de procesamiento está definida en `template.yaml`
**Cuando** se despliega el sistema
**Entonces** tiene configurada su DLQ con retención de 14 días
**Y** tiene timeout explícito ≤ 15 minutos
**Y** las URLs de fotos (originales y miniaturas) nunca se exponen públicamente; solo se sirven con URLs prefirmadas de corta duración

---

## Épica 6: Fase 4 — Pitch, Evaluación Cruzada y Ranking Final

El profesor controla los turnos de presentación de cada grupo. Los grupos y el profesor evalúan los pitches con la rúbrica de 4 criterios (escala 1–4), con peso 2× para la evaluación del profesor. El sistema calcula puntajes ponderados y el ranking final acumulativo de todas las fases (tokens Fase 1 + 2 + 3 + tokens de evaluación de Fase 4).

### Historia 6.1: Control de Turno de Presentación por el Profesor

Como profesor,
quiero indicar qué grupo está presentando en cada momento durante la Fase 4 y poder abrir y cerrar el turno de cada grupo,
para que el flujo de presentaciones de pitch esté bajo mi control y los evaluadores sepan cuándo pueden votar.

**Criterios de Aceptación:**

**Dado** que la sesión está en estado `fase4`
**Cuando** el profesor indica que el Grupo X inicia su turno de presentación
**Entonces** el sistema registra al Grupo X como el grupo activo en turno
**Y** habilita el envío de evaluaciones de ese grupo por parte de los demás grupos y el profesor
**Y** solo puede haber un grupo en turno activo simultáneamente

**Dado** que ya hay un grupo en turno activo
**Cuando** el profesor intenta iniciar el turno de otro grupo sin cerrar el anterior
**Entonces** el sistema retorna 409 con `{ ok: false, codigo: "TURNO_ACTIVO", error: "Debe cerrar el turno del grupo actual antes de iniciar otro" }`

**Dado** que el profesor cierra el turno del grupo en presentación
**Cuando** envía la petición de cierre de turno
**Entonces** el sistema deshabilita el envío de nuevas evaluaciones para ese grupo
**Y** dispara el cálculo del puntaje ponderado

---

### Historia 6.2: Evaluación del Pitch con Rúbrica de 4 Criterios

Como grupo de estudiantes o como profesor,
quiero evaluar el pitch del grupo que está presentando usando la rúbrica de 4 criterios (Equipo, Empatía, Creatividad, Comunicación) con escala del 1 al 4,
para que la evaluación sea estructurada, orientada por criterios claros y el sistema pueda calcular un puntaje objetivo.

**Criterios de Aceptación:**

**Dado** que hay un grupo en turno activo en `fase4`
**Cuando** un grupo evaluador (distinto al presentador) consulta la información de evaluación
**Entonces** recibe la rúbrica con los 4 criterios y la descripción de cada nivel (1 a 4) para orientar la votación

**Dado** que hay un grupo en turno activo y el evaluador es un grupo distinto al presentador
**Cuando** el grupo envía su evaluación con puntajes válidos (1–4) para los 4 criterios
**Entonces** el sistema registra la evaluación (suma total entre 4 y 16)
**Y** retorna `{ ok: true, evaluacionRegistrada: true }`

**Dado** que el grupo presentador intenta evaluarse a sí mismo
**Cuando** envía una evaluación mientras está en turno activo
**Entonces** el sistema retorna 403 con `{ ok: false, codigo: "AUTOEVALUACION_PROHIBIDA", error: "Un grupo no puede evaluarse a sí mismo" }`

**Dado** que un evaluador ya envió su evaluación de un grupo presentador
**Cuando** intenta enviar una segunda evaluación del mismo grupo presentador
**Entonces** el sistema retorna 409 con `{ ok: false, codigo: "EVALUACION_DUPLICADA", error: "Ya enviaste tu evaluación para este grupo" }`

**Dado** que un evaluador envía puntajes fuera del rango válido (< 1 o > 4 en cualquier criterio)
**Cuando** el backend valida la petición
**Entonces** retorna 400 con `{ ok: false, codigo: "PUNTAJE_INVALIDO", error: "Cada criterio debe tener un puntaje entre 1 y 4" }`

---

### Historia 6.3: Cálculo de Puntaje Ponderado al Cerrar el Turno

Como profesor,
quiero calcular y persistir el puntaje de evaluación ponderado de cada grupo presentador al cerrar su turno, con peso 2× para la evaluación del profesor,
para que el resultado final del pitch sea objetivo, consistente y no manipulable por ningún actor.

**Criterios de Aceptación:**

**Dado** que el profesor cierra el turno de un grupo
**Cuando** el backend calcula el puntaje de evaluación
**Entonces** aplica la fórmula: `(suma evaluaciones de grupos + 2 × evaluación del profesor) / (N_grupos_evaluadores + 2)` donde N es el número de grupos que enviaron evaluación
**Y** persiste el puntaje calculado en DynamoDB asociado al grupo presentador
**Y** la operación es idempotente: recalcular con los mismos datos produce el mismo puntaje

**Dado** que el profesor no envió evaluación de un grupo antes de cerrar su turno
**Cuando** el backend calcula el puntaje
**Entonces** calcula el promedio solo con las evaluaciones de grupos recibidas
**Y** registra que la evaluación del profesor está ausente

**Dado** que el puntaje de evaluación ha sido calculado para un grupo
**Cuando** se convierte a tokens adicionales según la escala configurada en el sistema
**Entonces** los tokens adicionales se suman al acumulado total del grupo para el ranking final
**Y** la conversión es idempotente (no duplica tokens si se ejecuta más de una vez)

---

### Historia 6.4: Rankings por Fase y Ranking Final Acumulativo

Como grupo de estudiantes y como profesor,
quiero ver el ranking de cada fase durante los estados de ranking intermedios y el ranking final acumulativo al terminar la Fase 4,
para que todos los participantes puedan seguir la competencia a lo largo de la sesión y conocer el resultado final.

**Criterios de Aceptación:**

**Dado** que la sesión está en un estado de ranking (`ranking1`, `ranking2`, `ranking3`)
**Cuando** cualquier participante (grupo o profesor) solicita el ranking
**Entonces** recibe el ranking de esa fase específica con los tokens acumulados en esa fase únicamente
**Y** los grupos están ordenados de mayor a menor por tokens de esa fase

**Dado** que la sesión está en estado `evaluacion` o `finalizado`
**Cuando** cualquier participante solicita el ranking final
**Entonces** recibe el ranking acumulativo: suma de tokens Fase 1 + Fase 2 + Fase 3 + tokens de evaluación Fase 4
**Y** los grupos están ordenados de mayor a menor por total acumulado
**Y** no se aplican coeficientes de ponderación entre fases; cada token tiene el mismo valor unitario

**Dado** que se solicita un ranking
**Cuando** el backend lo calcula
**Entonces** el cálculo se ejecuta síncronamente en el endpoint `/api/faseN/ranking` del módulo correspondiente (AD-4)
**Y** el resultado se persiste en DynamoDB para que consultas posteriores lo lean sin recalcular

---

### Historia 6.5: Conversión de Puntaje de Evaluación a Tokens

Como grupo de estudiantes,
quiero que el puntaje que recibí en la evaluación de mi pitch se convierta en tokens adicionales para mi grupo,
para que el esfuerzo en la presentación se refleje en mi posición en el ranking final.

**Criterios de Aceptación:**

**Dado** que el turno de un grupo ha sido cerrado y su puntaje de evaluación calculado
**Cuando** el sistema convierte el puntaje en tokens
**Entonces** aplica la escala de conversión configurada en el sistema
**Y** los tokens adicionales se suman al acumulado total del grupo

**Dado** que la conversión de puntaje a tokens ya fue ejecutada para un grupo
**Cuando** se ejecuta nuevamente (reintento o llamada duplicada)
**Entonces** el resultado es idéntico sin duplicar los tokens (idempotencia con `ConditionExpression` DynamoDB)

---

## Épica 7: Sistema Listo para Producción

El sistema opera una sesión completa de ~90 minutos en AWS sin interrupciones, con infraestructura completa definida como código (CloudFront + S3 frontend, bucket S3 LEGO, PITR habilitado en producción, SAM completo), entornos `dev` y `prod` completamente aislados, seguridad hardened (CORS restringido, cifrado, sin secretos en código), logs estructurados en JSON a CloudWatch con alarmas configuradas, y pipeline CI/CD documentado y ejecutable paso a paso en entorno educativo.

### Historia 7.1: Infraestructura SAM Completa — CloudFront, S3 Frontend y PITR

Como profesor y grupos de estudiantes,
quiero que el sistema esté completamente definido como código en `template.yaml` — incluyendo distribución CloudFront, bucket S3 del frontend, PITR en producción y entornos aislados —
para que el sistema sea desplegable de forma reproducible y el frontend sea accesible con un dominio estable.

**Criterios de Aceptación:**

**Dado** que `template.yaml` es el único mecanismo de creación de recursos AWS
**Cuando** se ejecuta `sam deploy --config-env dev` o `sam deploy --config-env prod`
**Entonces** se crean todos los recursos sin intervención manual en la consola AWS: bucket S3 frontend con CloudFront como CDN, distribución CloudFront que redirige HTTP → HTTPS, tabla DynamoDB `MisionEmprende-{env}` con GSI1 configurado, y todos los buckets S3 con SSE-S3 y acceso público bloqueado
**Y** los recursos de entorno `dev` y `prod` son completamente independientes (tablas, buckets, secretos y dominios distintos)

**Dado** que el entorno es `prod`
**Cuando** la tabla DynamoDB se crea o actualiza
**Entonces** `PointInTimeRecoveryEnabled: true` está configurado explícitamente en `template.yaml`

**Dado** que el entorno es `dev`
**Cuando** la tabla DynamoDB se crea
**Entonces** `PointInTimeRecoveryEnabled: false` (ahorro de costos) pero la estructura de tabla es idéntica a `prod`

---

### Historia 7.2: Seguridad Hardened — CORS, Secretos y Concurrencia Reservada

Como el administrador del sistema,
quiero que la configuración de seguridad esté endurecida — CORS restringido al dominio CloudFront, sin secretos en código, y concurrencia reservada por Lambda —
para que el sistema cumpla los requisitos de seguridad y resiliencia en producción real.

**Criterios de Aceptación:**

**Dado** que el sistema está desplegado en entorno `prod`
**Cuando** API Gateway recibe una petición con `Origin` diferente al dominio CloudFront
**Entonces** `Access-Control-Allow-Origin` contiene exclusivamente el dominio CloudFront, nunca `*`

**Dado** que cualquier Lambda necesita la clave de firma JWT o configuración sensible
**Cuando** la Lambda se inicializa (fuera del handler, para reutilización en warm invocations)
**Entonces** obtiene el secreto desde Secrets Manager o SSM Parameter Store
**Y** ninguna variable de entorno ni código fuente contiene claves, contraseñas o secretos en texto plano

**Dado** que `template.yaml` define todas las funciones Lambda
**Cuando** se despliega el sistema
**Entonces** cada función tiene `ReservedConcurrentExecutions` configurado explícitamente
**Y** todas las Lambdas asignan `LabRole` explícitamente como `Role` en `template.yaml`
**Y** las funciones síncronas del juego tienen `Timeout ≤ 10` y `MemorySize ≥ 256`

---

### Historia 7.3: Observabilidad — Logs Estructurados y Alarmas CloudWatch

Como el equipo de operaciones,
quiero que todas las Lambdas emitan logs estructurados en JSON con contexto relevante y que haya alarmas activas para condiciones críticas,
para que cualquier problema durante una sesión de clase sea detectable y diagnosticable rápidamente.

**Criterios de Aceptación:**

**Dado** que cualquier Lambda procesa una petición
**Cuando** emite un log a CloudWatch Logs
**Entonces** el log es JSON válido que incluye al menos: `requestId`, `nivel` (`info`/`warn`/`error`), `duracionMs`, y cuando aplica: `sesionId`, `grupoId` o `profesorId`
**Y** el log nunca incluye tokens de acceso, códigos de grupo ni datos personales de estudiantes

**Dado** que el sistema está desplegado en producción
**Cuando** se configura CloudWatch
**Entonces** existen alarmas activas para: tasa de errores Lambda > 1% en ventana de 5 minutos, latencia P99 de API Gateway > 2 segundos, DLQ con mensajes > 0, y cold starts de Lambdas críticas superando 800 ms en P95

**Dado** que una alarma se dispara
**Cuando** el sistema detecta la condición de error
**Entonces** la alarma queda en estado `ALARM` visible en CloudWatch

---

### Historia 7.4: Pipeline CI/CD Documentado y Ejecutable Manualmente

Como desarrollador,
quiero que el pipeline CI/CD completo esté definido y documentado paso a paso, con los mismos pasos ejecutables manualmente en el entorno educativo,
para que el proceso de despliegue sea reproducible, auditable y listo para activación automática en una cuenta con credenciales estables.

**Criterios de Aceptación:**

**Dado** que el pipeline CI/CD está definido en un archivo de configuración del repositorio
**Cuando** se ejecuta el pipeline completo
**Entonces** los pasos son en orden: (1) `tsc --noEmit` — verificación de tipos TypeScript; (2) `npm run pruebas` — suite Vitest; (3) empaquetado esbuild; (4) `sam validate`; (5) `sam deploy --config-env dev`; (6) `sam deploy --config-env prod` con aprobación manual
**Y** un fallo en cualquier paso detiene el pipeline sin ejecutar los pasos siguientes

**Dado** que el entorno educativo no permite ejecución automática del pipeline
**Cuando** un desarrollador despliega manualmente
**Entonces** existe un documento de pasos manuales que replica exactamente la misma secuencia del pipeline
**Y** cada paso está documentado con el comando exacto y qué verificar antes de continuar al siguiente

**Dado** que el pipeline se ejecuta para despliegue a `prod`
**Cuando** todas las verificaciones pasan y hay aprobación
**Entonces** el despliegue actualiza solo los recursos que cambiaron (SAM change sets)
**Y** ningún paso del proceso requiere acceso manual a la consola AWS

---

### Historia 7.5: Resiliencia y Pruebas de Caos en Puntos de Integración

Como el administrador del sistema,
quiero que cada punto de integración con servicios externos (S3 y Cognito) tenga retry con backoff exponencial, un circuit breaker activo y un caso de prueba de caos documentado que valide la respuesta de degradación,
para que un fallo temporal o total en un servicio externo no deje a los grupos en estado inválido ni interrumpa la sesión de clase en curso.

**Criterios de Aceptación:**

**Dado** que cualquier Lambda llama al SDK AWS (DynamoDB, S3, SQS, Secrets Manager)
**Cuando** una llamada falla con un error transitorio
**Entonces** el cliente SDK reintenta automáticamente con backoff exponencial y jitter (`maxAttempts: 3`) configurado en la instancia del cliente, no en cada llamada
**Y** el número máximo de intentos y la estrategia de backoff están documentados en el módulo `compartido/baseDatos.ts` y en los repositorios de S3

**Dado** que la Lambda de Fase 3 llama a S3 para verificar existencia de objeto (confirmación de foto)
**Cuando** S3 no responde dentro del timeout configurado (`timeoutMs` explícito en el cliente S3)
**Entonces** la Lambda retorna 503 con `{ ok: false, codigo: "SERVICIO_NO_DISPONIBLE", error: "El servicio de almacenamiento no está disponible. Intente más tarde." }`
**Y** el grupo no queda con estado inconsistente (la foto se considera no confirmada y puede reintentar el flujo completo)
**Y** el circuit breaker registra el fallo y reduce la ventana de reintentos en fallos consecutivos

**Dado** que la Lambda de autenticación de profesor llama a Cognito para validar credenciales
**Cuando** Cognito no responde dentro del timeout configurado
**Entonces** la Lambda retorna 503 con `{ ok: false, codigo: "AUTENTICACION_NO_DISPONIBLE", error: "El servicio de autenticación no está disponible. Intente más tarde." }`
**Y** el circuit breaker no permite intentos adicionales a Cognito durante la ventana de recuperación configurada

**Dado** que existe un documento de casos de prueba de caos en el repositorio (`docs/pruebas-caos.md`)
**Cuando** se ejecutan las pruebas de caos manualmente antes de un despliegue a producción
**Entonces** el documento describe para cada punto de integración (S3 confirmación de foto, Cognito autenticación): el método de inyección de fallo (mock del SDK, timeout forzado o bloqueo de red), la respuesta de degradación esperada (código HTTP y body), y el paso de verificación que confirma que el grupo puede seguir operando

**Dado** que el sistema es educativo y no cuenta con AWS Fault Injection Simulator
**Cuando** se realiza la prueba de caos de S3
**Entonces** se acepta simular el fallo inyectando un repositorio falso que lanza un error de timeout en el test de integración del módulo `fase3`
**Y** el test verifica que `servicio.ts` captura el error y devuelve la respuesta de degradación correcta sin exponer el error interno al cliente

**NFRs cubiertos:** NFR-006, NFR-007, NFR-009

---

### Historia 7.6: Prueba de Carga con k6 o Artillery

Como el equipo de desarrollo,
quiero ejecutar un escenario de carga automatizado que simule 10 grupos activos en 3 sesiones simultáneas (30 usuarios virtuales) contra los endpoints críticos del juego,
para que podamos verificar que el P95 de latencia es ≤ 500 ms y que DynamoDB en modo On-Demand absorbe el pico sin degradación, antes del primer despliegue a producción.

**Criterios de Aceptación:**

**Dado** que el sistema está desplegado en el entorno `dev` con datos de sesión precargados (3 sesiones con 10 grupos cada una)
**Cuando** se ejecuta el script de carga (`pruebas-carga/escenario-sesion-completa.js` en k6 o `pruebas-carga/escenario-sesion-completa.yml` en Artillery)
**Entonces** el escenario ejecuta en paralelo los siguientes flujos de usuario virtual durante 5 minutos sostenidos:
- Grupo: POST `/api/acceso/ingresar` (autenticación)
- Grupo en fase1: POST `/api/fase1/palabra` (enviar palabra encontrada)
- Grupo: GET `/api/sesiones/{sesionId}/estado` (polling de estado, cada 3 segundos)
- Profesor: GET `/api/fase1/progreso` (vista de progreso)

**Dado** que el escenario de carga terminó su ejecución
**Cuando** se analizan los resultados
**Entonces** el P95 de latencia de respuesta de todos los endpoints críticos es ≤ 500 ms
**Y** la tasa de errores HTTP (4xx inesperados + 5xx) es < 1%
**Y** ninguna Lambda de fase activa alcanza su límite de `ReservedConcurrentExecutions` (medible en CloudWatch `ConcurrentExecutions`)

**Dado** que el sistema usa DynamoDB en modo On-Demand
**Cuando** se ejecuta el escenario de carga de 30 usuarios virtuales simultáneos
**Entonces** no se observan errores `ProvisionedThroughputExceededException` en los logs de CloudWatch
**Y** la latencia P99 de DynamoDB (métrica `SuccessfulRequestLatency` en CloudWatch) permanece por debajo de 20 ms durante todo el escenario

**Dado** que alguna Lambda crítica (fase1, acceso) registra cold starts durante la prueba
**Cuando** el P95 de cold start supera 800 ms
**Entonces** la historia documenta la necesidad de habilitar Provisioned Concurrency para esa función en `template.yaml` (con el número de instancias mínimas calculado a partir de los resultados)
**Y** se crea una tarea de seguimiento antes del despliegue a `prod`

**Dado** que el script de carga está en el repositorio en `pruebas-carga/`
**Cuando** un desarrollador quiere replicar la prueba
**Entonces** el README del directorio documenta: cómo instalar k6 (o Artillery), cómo precargar los datos de sesión de prueba, el comando exacto de ejecución, y cómo interpretar el reporte de resultados

**NFRs cubiertos:** NFR-001, NFR-002, NFR-003, NFR-008
