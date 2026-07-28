---
date: '2026-07-27'
project: 'PROYECTO-INGENIERIA-DE-SOFTWARE-BMAD'
stepsCompleted: ['step-01-document-discovery', 'step-02-prd-analysis', 'step-03-epic-coverage-validation', 'step-04-ux-alignment', 'step-05-epic-quality-review', 'step-06-final-assessment']
files:
  prd: '_bmad-output/planning-artifacts/prds/prd-mision-emprende-2026-07-26/prd.md'
  architecture_spine: '_bmad-output/planning-artifacts/architecture/architecture-PROYECTO-INGENIERIA-DE-SOFTWARE-BMAD-2026-07-26/ARCHITECTURE-SPINE.md'
  architecture_report: '_bmad-output/planning-artifacts/architecture/architecture-PROYECTO-INGENIERIA-DE-SOFTWARE-BMAD-2026-07-26/INFORME-ARQUITECTURA.md'
  epics: '_bmad-output/planning-artifacts/epics.md'
  ux: null
---

# Implementation Readiness Assessment Report

**Date:** 2026-07-27
**Project:** PROYECTO-INGENIERIA-DE-SOFTWARE-BMAD

## Inventario de Documentos

### PRD
- **Carpeta sharded:** `prds/prd-mision-emprende-2026-07-26/prd.md` (32K, 2026-07-26)

### Arquitectura
- **Carpeta sharded:** `architecture/architecture-PROYECTO-INGENIERIA-DE-SOFTWARE-BMAD-2026-07-26/`
  - `ARCHITECTURE-SPINE.md` (12K, 2026-07-27)
  - `INFORME-ARQUITECTURA.md` (17K, 2026-07-27)

### Épicas y Historias
- **Documento completo:** `epics.md` (64K, 2026-07-27)

### UX / Diseño
- ⚠️ No encontrado

---

## Análisis del PRD

### Requisitos Funcionales Extraídos

FR-001: El profesor se autentica mediante Amazon Cognito User Pool con correo y contraseña. El token JWT de Cognito es validado por API Gateway (Cognito Authorizer) antes de llegar a cualquier Lambda de profesor.

FR-002: Al autenticarse, el sistema genera un token de sesión interno firmado (JWT con clave en Secrets Manager) que identifica al profesor dentro del dominio del juego. Este token nunca expone credenciales de Cognito al frontend.

FR-003: El acceso de grupos se realiza en tres pasos: (1) el grupo ingresa el código alfanumérico de 6 caracteres; (2) el grupo define su nombre; (3) el sistema emite un JWT de grupo que identifica sesionId, grupoId y nombreGrupo. El JWT expira al cerrar la sesión.

FR-004: El sistema impone límite de intentos fallidos de ingreso con código de grupo (máx. 5 intentos por IP por ventana de 5 minutos).

FR-005: Un profesor solo puede leer y modificar sesiones que le pertenecen. Cualquier intento de acceder a una sesión ajena retorna 403.

FR-006: El administrador se autentica mediante un mecanismo separado del profesor (Cognito con grupo de usuarios distinto o claim `rol: admin`).

FR-007: El administrador puede crear, editar y eliminar temáticas. Una temática tiene: nombre, descripción corta e imagen representativa.

FR-008: El sistema impone que haya siempre exactamente 3 temáticas activas. No se puede desactivar una temática si quedarían menos de 3 activas, salvo que simultáneamente se active otra.

FR-009: Cada temática tiene exactamente 3 desafíos activos asociados. Un desafío tiene: nombre, enunciado y temática a la que pertenece. El administrador puede crear, editar y eliminar desafíos respetando la regla de 3 por temática.

FR-010: Los cambios en el catálogo (temáticas y desafíos) no afectan sesiones ya creadas. Una sesión almacena una copia de la temática y desafío seleccionados en el momento de su creación.

FR-011: El profesor puede crear una sesión especificando nombre, temática y desafío (del catálogo activo), y número de grupos. El sistema genera los códigos de acceso únicos para cada grupo.

FR-012: El profesor puede listar sus sesiones activas e históricas con estado, fase actual y número de grupos activos.

FR-013: El profesor puede ajustar grupos antes de iniciar la primera fase (mientras la sesión está en estado `configuración`).

FR-014: El profesor puede cerrar una sesión manualmente. Una sesión cerrada impide nuevas acciones de grupos y congela el estado final.

FR-015: Solo el profesor puede disparar transiciones entre estados. El backend valida que el estado destino sea el sucesor directo del estado actual; transiciones ilegales retornan error.

FR-016: La definición canónica de la máquina de estados (estados válidos, transiciones permitidas, actor, duración por defecto del temporizador) vive en un único módulo compartido del backend.

FR-017: Las acciones de los grupos solo son aceptadas si la sesión está en el estado correspondiente a la actividad. Fuera del estado correcto, el sistema retorna 409 con mensaje descriptivo.

FR-018: Cada evento de transición de estado se publica en EventBridge para que componentes asíncronos (ranking, logs de auditoría) reaccionen sin acoplamiento directo.

FR-019: Al iniciar una fase, el sistema registra `timestampInicio` y `duracionSegundos` en DynamoDB. El frontend calcula el tiempo restante como `duracionSegundos − (ahoraUTC − timestampInicio)` usando el timestamp del servidor como fuente de verdad.

FR-020: El temporizador es visible de forma sincronizada en todos los dispositivos participantes mediante polling del estado de sesión.

FR-021: Los grupos no pueden enviar acciones de la fase cuando el temporizador ha expirado, salvo que el profesor haya habilitado tiempo extra explícitamente.

FR-022: El profesor puede avanzar de fase antes de que el temporizador expire (override manual), lo que equivale a una transición de estado normal.

FR-023: El profesor configura la duración del temporizador de cada fase al momento de la transición; el sistema provee un valor por defecto si no se especifica.

FR-024: Cada grupo recibe el tablero de sopa de letras y la lista de palabras objetivo correspondientes al desafío de la sesión. El tablero y las palabras son iguales para todos los grupos.

FR-025: Un grupo puede enviar una palabra encontrada. El backend valida que la palabra pertenezca a la lista objetivo y que no haya sido registrada previamente por el mismo grupo. El registro es idempotente.

FR-026: Por cada palabra nueva confirmada, el grupo recibe 1 token. La lógica de asignación de tokens vive exclusivamente en la capa de servicio.

FR-027: El grupo puede consultar su progreso durante la fase: palabras encontradas y tokens acumulados.

FR-028: El profesor puede ver el progreso de todos los grupos en tiempo real durante la fase.

FR-029: Cada grupo construye un bubble map respondiendo preguntas estructuradas sobre el usuario objetivo del desafío. Las preguntas son parte del desafío configurado o están predefinidas en el sistema.

FR-030: Las respuestas del bubble map se persisten por grupo. El grupo puede editar sus respuestas mientras la sesión está en `fase2` y el temporizador no ha expirado.

FR-031: Al completar el bubble map (todas las burbujas obligatorias llenas), el grupo recibe una recompensa de tokens. La entrega es idempotente.

FR-032: El profesor puede ver el estado de avance del bubble map de cada grupo (completo / en progreso / sin iniciar).

FR-033: Cada grupo puede subir una fotografía de su construcción LEGO. El flujo consta de 3 pasos: (1) el grupo solicita al backend una URL prefirmada de S3 de corta duración (15 minutos); (2) el grupo sube la imagen directamente a S3 usando esa URL; (3) el grupo confirma al backend que la subida terminó — el sistema verifica la existencia del objeto en S3 y lo asocia al grupo. [PENDIENTE DE IMPLEMENTACIÓN]

FR-034: Si el objeto S3 no existe al momento de la confirmación, el backend retorna error y el grupo puede reintentar el flujo desde el paso 1.

FR-035: El procesamiento de la foto (miniatura, validación de tamaño y formato) se realiza de forma asíncrona mediante un mensaje SQS disparado tras la confirmación. El grupo no espera el procesamiento para continuar.

FR-036: Si el procesamiento falla, el mensaje va a una DLQ para revisión manual. El grupo no queda en estado inválido; la foto original se preserva.

FR-037: Las fotografías LEGO se almacenan en un bucket S3 privado separado del bucket de frontend. Se sirven mediante URLs prefirmadas, nunca con acceso público.

FR-038: Al confirmar la foto, el grupo recibe tokens. La entrega es idempotente.

FR-039: Durante `fase4`, el profesor controla el turno de presentación: indica qué grupo está presentando en cada momento. Solo un grupo puede estar en turno activo simultáneamente.

FR-040: Mientras un grupo presenta, los demás grupos y el profesor pueden enviar su evaluación del pitch. La evaluación se habilita cuando el grupo entra en turno y se cierra cuando el profesor cierra el turno.

FR-041: La evaluación se compone de 4 criterios fijos: Equipo, Empatía, Creatividad y Comunicación. Cada criterio se puntúa en escala de 1 a 4. El puntaje total de una evaluación individual es la suma de los 4 criterios (mínimo 4, máximo 16).

FR-042: El sistema muestra al evaluador una rúbrica simple que describe qué significa cada nivel (1 a 4) para orientar la votación. Esta rúbrica es visible para grupos y para el profesor durante la evaluación.

FR-043: Un evaluador (grupo u observador) solo puede enviar una evaluación por grupo presentador. El sistema rechaza evaluaciones duplicadas.

FR-044: El grupo presentador no puede evaluarse a sí mismo.

FR-045: El profesor puede evaluar a todos los grupos. La evaluación del profesor tiene un peso de 2× respecto a la evaluación de cada grupo en el cálculo del puntaje de evaluación del pitch.

FR-046: Al cerrar el turno de un grupo, el backend calcula y persiste el puntaje de evaluación ponderado. El cálculo es idempotente respecto a intentos de recalculación.

FR-047: El puntaje de evaluación del pitch se convierte en tokens adicionales para el grupo presentador según una escala definida en la configuración del sistema.

FR-048: Al entrar en un estado de ranking (`ranking1`, `ranking2`, `ranking3`), el sistema calcula y publica el ranking de esa fase considerando únicamente los tokens acumulados en la fase correspondiente.

FR-049: El ranking final (tras `evaluacion`) es acumulativo de todas las fases: suma de tokens de Fase 1 + Fase 2 + Fase 3 + tokens obtenidos por el puntaje de evaluación del pitch en Fase 4. No se aplican coeficientes de ponderación entre fases.

FR-050: El ranking es visible por todos los participantes (grupos y profesor) en los estados de ranking correspondientes.

FR-051: El cálculo de rankings es un proceso asíncrono disparado por el evento de transición de estado publicado en EventBridge. El resultado se persiste en DynamoDB y los clientes lo consultan al solicitar el estado de sesión.

FR-052: Tanto grupos como profesor pueden consultar el estado actual de la sesión (fase activa, tiempo restante, progreso por grupo, ranking si corresponde) en cualquier momento mientras la sesión está abierta.

FR-053: El frontend consulta el estado periódicamente mediante polling. El intervalo de polling y la estructura de respuesta están diseñados para minimizar latencia percibida sin saturar la API.

FR-054: El sistema expone un endpoint de salud (`GET /api/salud`) que verifica conectividad con DynamoDB sin tocar datos del juego.

FR-055: El sistema soporta exactamente dos entornos aislados: `dev` y `prod`. Tablas DynamoDB, buckets S3, User Pools de Cognito, secretos y dominios son completamente independientes por entorno.

FR-056: La infraestructura se define y despliega con AWS SAM. El pipeline CI/CD se construye completo y documentado. En el entorno educativo actual (AWS Academy), el pipeline se ejecuta manualmente con `sam deploy` siguiendo los mismos pasos del pipeline.

**Total FRs: 56**

---

### Requisitos No Funcionales Extraídos

NFR-001: Tiempo de respuesta P95 de cualquier endpoint del juego ≤ 500 ms bajo carga de 10 grupos × 3 sesiones simultáneas.

NFR-002: Las Lambdas de rutas frecuentes se configuran con Provisioned Concurrency en producción si los cold starts superan 800 ms en P95.

NFR-003: DynamoDB se configura en modo On-Demand para absorber picos de demanda sin degradación.

NFR-004 (Idempotencia — CRÍTICO): Toda operación que entregue tokens, registre progreso o emita un puntaje debe ser idempotente. Se implementa mediante claves de idempotencia y operaciones condicionales de DynamoDB (`ConditionExpression`).

NFR-005: Toda Lambda que procese mensajes SQS o eventos EventBridge tiene una Dead Letter Queue configurada. Los mensajes fallidos se retienen 14 días.

NFR-006: Las llamadas al SDK AWS desde Lambda usan retry automático con backoff exponencial y jitter (`maxAttempts: 3`).

NFR-007 (Circuit Breaker): Aplicado selectivamente en: (1) Lambda Fase 3 → S3 para confirmación de foto; (2) Lambda de autenticación de profesor → Cognito.

NFR-008 (Bulkhead): Las Lambdas de cada módulo tienen `ReservedConcurrentExecutions` configurado para evitar que un pico en una fase consuma toda la concurrencia.

NFR-009 (Diseño para el Caos): La arquitectura tolera inyección de fallos en servicios externos. Cada punto de integración tiene: timeout explícito, respuesta de degradación definida, caso de prueba de caos documentado.

NFR-010 (Mínimo Privilegio IAM): Diseño establece un rol IAM propio por Lambda. En cuenta educativa, todas las Lambdas usan `LabRole`.

NFR-011: Claves de firma JWT y configuración sensible almacenadas en Secrets Manager o SSM Parameter Store. Las Lambdas los obtienen fuera del handler.

NFR-012: Autenticación de profesor vía Cognito Authorizer. Plan B: JWT firmado internamente con clave en Secrets Manager si Cognito User Pool no está disponible.

NFR-013 (CORS): En producción, `Access-Control-Allow-Origin` permite exclusivamente el dominio de CloudFront. El valor `*` está prohibido en producción.

NFR-014 (Aislamiento entre profesores): Toda query DynamoDB en rutas de profesor incluye el `profesorId` derivado del token como condición de filtro obligatoria.

NFR-015 (Cifrado): DynamoDB cifrado en reposo (AWS managed key). S3 con SSE-S3. Todo tráfico mediante HTTPS (TLS 1.2+). CloudFront redirige HTTP → HTTPS.

NFR-016 (PITR): La tabla DynamoDB de producción tiene Point-in-Time Recovery habilitado.

NFR-017: La totalidad de recursos AWS se define en `template.yaml` de AWS SAM. La consola AWS se usa solo para observación.

NFR-018 (CI/CD): Pipeline CI/CD definido completo: type-check TypeScript → pruebas Vitest → empaquetado esbuild → validación SAM → despliegue a `dev` → despliegue a `prod` con aprobación. En entorno educativo, ejecución manual siguiendo los mismos pasos.

NFR-019: Funciones Lambda con límites explícitos: memoria mínima 256 MB, timeout ≤ 10 segundos para funciones síncronas, timeout máximo 15 minutos para Lambdas de procesamiento asíncrono.

NFR-020 (Logs estructurados): Todas las Lambdas emiten logs estructurados en JSON a CloudWatch Logs. Cada log incluye: `requestId`, `sesionId`, `grupoId` o `profesorId`, `duracionMs`, `nivel`.

NFR-021 (Alarmas): CloudWatch alarmas para: tasa de errores Lambda > 1% en 5 minutos, P99 de latencia API Gateway > 2 segundos, DLQ con mensajes > 0, cold starts superando umbral.

NFR-022: Los logs no exponen tokens de acceso, códigos de grupo ni datos personales de estudiantes.

**Total NFRs: 22**

---

### Requisitos Adicionales y Restricciones

**Restricciones técnicas obligatorias:**
- Lenguaje backend: TypeScript/JavaScript. Prohibido cualquier otro runtime en Lambda.
- IaC: AWS SAM exclusivamente. Prohibidos Terraform, CDK y despliegues manuales en producción.
- Clean Architecture: invariantes definidas en Sección 2 del PRD son obligatorias.
- Frontend "dumb view": cero lógica de negocio en el frontend.
- Cuenta AWS Academy: `iam:CreateRole` denegado → todas las Lambdas usan `LabRole`; credenciales rotan por sesión → CI/CD manual.

**Restricciones de escala:**
- Hasta 10 grupos por sesión.
- Más de 100 profesores con cuentas activas.
- Objetivo operacional inicial: 3 sesiones concurrentes reales.

**Nota de implementación Fase 3 (FR-033 a FR-037):**
- El flujo completo de URL prefirmada y confirmación está PENDIENTE de implementación.
- La versión actual guarda la imagen en `localStorage` y envía únicamente `conFoto: true`.

---

### Evaluación de Completitud del PRD

El PRD es **sólido y bien estructurado**. Cubre exhaustivamente todos los flujos funcionales, con requisitos numerados, restricciones técnicas claras y manejo explícito de limitaciones del entorno educativo. Se identifica una brecha pendiente: la implementación real de Fase 3 (FR-033 a FR-037) está documentada como incompleta en el mismo PRD, lo cual es una deuda técnica conocida.

---

## Validación de Cobertura de Épicas

### Mapa de Cobertura de FRs

| FR | Texto resumido | Épica / Historia | Estado |
|----|---------------|-----------------|--------|
| FR-001 | Autenticación profesor vía Cognito | Épica 1 / Historia 1.3 | ✅ Cubierto |
| FR-002 | Token de dominio interno firmado del profesor | Épica 1 / Historia 1.3 | ✅ Cubierto |
| FR-003 | Acceso de grupos: código + nombre + JWT | Épica 1 / Historia 1.1 | ✅ Cubierto |
| FR-004 | Rate limiting: máx. 5 intentos por IP en 5 min | Épica 1 / Historia 1.2 | ✅ Cubierto |
| FR-005 | Aislamiento de sesiones por profesor (403 si accede a ajena) | Épica 1 / Historia 1.4 | ✅ Cubierto |
| FR-006 | Autenticación de administrador separada del profesor | Épica 1 / Historia 1.5 | ✅ Cubierto |
| FR-007 | CRUD de temáticas (nombre, descripción, imagen) | Épica 3 / Historia 3.1 | ✅ Cubierto |
| FR-008 | Regla de negocio: siempre exactamente 3 temáticas activas | Épica 3 / Historia 3.1 | ✅ Cubierto |
| FR-009 | CRUD de desafíos con regla de 3 por temática | Épica 3 / Historia 3.2 | ✅ Cubierto |
| FR-010 | Snapshot temática/desafío en creación de sesión | Épica 3 / Historia 3.2 | ✅ Cubierto |
| FR-011 | Crear sesión (nombre, temática, desafío, grupos, códigos únicos) | Épica 2 / Historia 2.1 | ✅ Cubierto |
| FR-012 | Listar sesiones del profesor (activas e históricas) | Épica 2 / Historia 2.2 | ✅ Cubierto |
| FR-013 | Ajustar grupos antes de iniciar primera fase | Épica 2 / Historia 2.2 | ✅ Cubierto |
| FR-014 | Cerrar sesión manualmente (congela estado final) | Épica 2 / Historia 2.3 | ✅ Cubierto |
| FR-015 | Transiciones de estado: solo profesor, sucesor directo | Épica 2 / Historia 2.3 | ✅ Cubierto |
| FR-016 | Máquina de estados canónica en compartido/maquinaEstados.ts | Épica 2 / Historia 2.1 | ✅ Cubierto |
| FR-017 | Grupos reciben 409 si actúan fuera del estado correcto | Épica 2 / Historia 2.3 | ✅ Cubierto |
| FR-018 | EventBridge por transición de estado | Épica 2 | ⚠️ DIFERIDO (AD-4) |
| FR-019 | Temporizador: timestampInicio + duracionSegundos en DynamoDB | Épica 2 / Historia 2.4 | ✅ Cubierto |
| FR-020 | Temporizador sincronizado en todos los dispositivos vía polling | Épica 2 / Historia 2.4 | ✅ Cubierto |
| FR-021 | Bloqueo de acciones del grupo cuando temporizador expirado | Épica 2 / Historia 2.4 | ✅ Cubierto |
| FR-022 | Override manual del profesor para avanzar antes de expirar | Épica 2 / Historia 2.4 | ✅ Cubierto |
| FR-023 | Configuración de duración del temporizador por fase | Épica 2 / Historia 2.4 | ✅ Cubierto |
| FR-024 | Tablero de sopa de letras y lista de palabras por sesión | Épica 4 / Historia 4.1 | ✅ Cubierto |
| FR-025 | Envío de palabra encontrada: validación e idempotencia | Épica 4 / Historia 4.1 | ✅ Cubierto |
| FR-026 | 1 token por palabra nueva confirmada (en servicio.ts) | Épica 4 / Historia 4.1 | ✅ Cubierto |
| FR-027 | Consulta de progreso del grupo en Fase 1 | Épica 4 / Historia 4.2 | ✅ Cubierto |
| FR-028 | Vista del profesor: progreso de todos los grupos en Fase 1 | Épica 4 / Historia 4.2 | ✅ Cubierto |
| FR-029 | Bubble map: preguntas estructuradas por grupo | Épica 4 / Historia 4.3 | ✅ Cubierto |
| FR-030 | Persistencia y edición de respuestas del bubble map | Épica 4 / Historia 4.3 | ✅ Cubierto |
| FR-031 | Recompensa de tokens al completar bubble map (idempotente) | Épica 4 / Historia 4.3 | ✅ Cubierto |
| FR-032 | Vista del profesor: estado del bubble map por grupo | Épica 4 / Historia 4.4 | ✅ Cubierto |
| FR-033 | Flujo 3 pasos LEGO: URL prefirmada → S3 → confirmación | Épica 5 / Historia 5.1 | ✅ Cubierto |
| FR-034 | Error si objeto S3 no existe en confirmación; reintentar | Épica 5 / Historia 5.2 | ✅ Cubierto |
| FR-035 | Procesamiento asíncrono de foto vía SQS; grupo no espera | Épica 5 / Historia 5.3 | ✅ Cubierto |
| FR-036 | Fallos de procesamiento van a DLQ; grupo no queda inválido | Épica 5 / Historia 5.3 | ✅ Cubierto |
| FR-037 | Bucket S3 privado para fotos LEGO; solo URLs prefirmadas | Épica 5 / Historia 5.1 | ✅ Cubierto |
| FR-038 | Tokens al confirmar foto LEGO (idempotente) | Épica 5 / Historia 5.2 | ✅ Cubierto |
| FR-039 | Control de turno de presentación; un grupo activo simultáneamente | Épica 6 / Historia 6.1 | ✅ Cubierto |
| FR-040 | Habilitación/cierre de evaluación según turno activo | Épica 6 / Historia 6.1 | ✅ Cubierto |
| FR-041 | 4 criterios (Equipo, Empatía, Creatividad, Comunicación), escala 1–4 | Épica 6 / Historia 6.2 | ✅ Cubierto |
| FR-042 | Rúbrica visible para grupos y profesor durante la evaluación | Épica 6 / Historia 6.2 | ✅ Cubierto |
| FR-043 | Un evaluador, una evaluación por grupo presentador | Épica 6 / Historia 6.2 | ✅ Cubierto |
| FR-044 | El grupo presentador no puede evaluarse a sí mismo | Épica 6 / Historia 6.2 | ✅ Cubierto |
| FR-045 | Evaluación del profesor con peso 2× en el cálculo ponderado | Épica 6 / Historia 6.3 | ✅ Cubierto |
| FR-046 | Cálculo y persistencia de puntaje ponderado al cerrar turno | Épica 6 / Historia 6.3 | ✅ Cubierto |
| FR-047 | Conversión de puntaje de evaluación a tokens adicionales | Épica 6 / Historias 6.3 + 6.5 | ✅ Cubierto (duplicado) |
| FR-048 | Ranking por fase: tokens acumulados en esa fase | Épica 6 / Historia 6.4 | ✅ Cubierto |
| FR-049 | Ranking final acumulativo: suma de tokens de todas las fases | Épica 6 / Historia 6.4 | ✅ Cubierto |
| FR-050 | Ranking visible por todos los participantes | Épica 6 / Historia 6.4 | ✅ Cubierto |
| FR-051 | Cálculo de ranking síncrono en /api/faseN/ranking (AD-4) | Épica 6 / Historia 6.4 | ✅ Cubierto (modificado) |
| FR-052 | Consulta del estado de sesión por grupo y profesor | Épica 2 / Historia 2.5 | ✅ Cubierto |
| FR-053 | Polling del frontend optimizado | Épica 2 / Historia 2.5 | ✅ Cubierto |
| FR-054 | Endpoint de salud GET /api/salud | Épica 2 / Historia 2.5 | ✅ Cubierto |
| FR-055 | Entornos dev y prod completamente aislados | Épica 7 / Historia 7.1 | ✅ Cubierto |
| FR-056 | Infraestructura SAM completa + pipeline CI/CD documentado | Épica 7 / Historias 7.1, 7.4 | ✅ Cubierto |

### Hallazgos en Cobertura de NFRs

| NFR | Estado | Detalle |
|-----|--------|---------|
| NFR-001 (P95 ≤ 500ms) | ⚠️ Sin historia de verificación | No existe historia de prueba de carga o rendimiento. Épica 7 la menciona pero sin criterios de aceptación ejecutables. |
| NFR-002 (Provisioned Concurrency) | ⚠️ Confusión terminológica | Historia 7.2 menciona `ReservedConcurrentExecutions` (limita concurrencia) pero NFR-002 requiere `ProvisionedConcurrencyConfig` (pre-warming). Son features distintas de Lambda. |
| NFR-006 (Retry con Backoff y Jitter) | ❌ Sin historia | Ninguna historia tiene criterio de aceptación para el patrón de retry con backoff exponencial y jitter. |
| NFR-007 (Circuit Breaker) | ❌ Sin historia | Ninguna historia tiene criterio de aceptación para Circuit Breaker en Fase3→S3 ni autenticación→Cognito. |
| NFR-009 (Diseño para el Caos) | ❌ Sin historia | "Caso de prueba de caos documentado" requerido por el PRD no tiene historia correspondiente. |
| NFR-003 a NFR-005, NFR-008, NFR-010 a NFR-022 | ✅ | Cubiertos en Épicas 1–7. |

### Brechas de Cobertura Identificadas

#### Brecha 1 — CRÍTICA: NFR-006 y NFR-007 sin historias implementables

**NFR-006** (Retry con Backoff Exponencial y Jitter) y **NFR-007** (Circuit Breaker en Fase3→S3 y autenticación→Cognito) son requisitos no funcionales críticos de resiliencia que no tienen ninguna historia con criterios de aceptación verificables. Están listados en la cobertura de Épica 7 pero no aparecen en ninguna historia individual.

**Impacto:** Sin criterios de aceptación, el implementador podría omitir estos patrones o implementarlos incorrectamente sin que el equipo lo detecte.

**Recomendación:** Agregar criterios de aceptación explícitos a Historia 7.2 o crear una Historia 7.5 dedicada a resiliencia (retry, circuit breaker, timeouts explícitos).

#### Brecha 2 — ALTA: NFR-009 (Diseño para el Caos) sin historia

El PRD requiere explícitamente que "cada punto de integración con servicios externos tiene un caso de prueba de caos documentado." No existe ninguna historia ni criterio de aceptación que satisfaga este requisito.

**Impacto:** Un requisito explícito del PRD quedará sin implementación ni verificación.

**Recomendación:** Agregar Historia 7.5 o criterios de aceptación en Historia 7.3 que incluyan documentación de casos de caos para S3, DynamoDB y Cognito.

#### Brecha 3 — ALTA: NFR-001 sin prueba de rendimiento verificable

El PRD establece P95 ≤ 500ms bajo carga de 10 grupos × 3 sesiones simultáneas. Ninguna historia tiene criterios de aceptación que verifiquen esto con una prueba de carga real.

**Impacto:** Un requisito de rendimiento crítico (el sistema es para sesiones de clase en vivo) no tiene historia de verificación. El sistema podría fallar bajo carga real sin que nadie lo detecte durante desarrollo.

**Recomendación:** Agregar una Historia 7.5 de prueba de carga con criterios ejecutables (artillery, k6, o similar).

#### Brecha 4 — MEDIA: NFR-002 confusión ReservedConcurrentExecutions vs ProvisionedConcurrency

Historia 7.2 cubre `ReservedConcurrentExecutions` que **limita** la concurrencia máxima de una Lambda. NFR-002 requiere `ProvisionedConcurrencyConfig` que **pre-calienta** instancias Lambda para eliminar cold starts. Son configuraciones distintas de Lambda con propósitos opuestos.

**Impacto:** El desarrollador podría implementar solo `ReservedConcurrentExecutions` pensando que cumple NFR-002, dejando los cold starts sin resolver en producción.

**Recomendación:** Actualizar los criterios de aceptación de Historia 7.2 para distinguir explícitamente ambas configuraciones y cuándo aplicar cada una.

#### Brecha 5 — BAJA: Historia 6.5 parcialmente redundante con Historia 6.3

Ambas historias cubren FR-047 (conversión de puntaje de evaluación a tokens). Historia 6.3 incluye criterios de aceptación para la conversión dentro del flujo de cierre de turno; Historia 6.5 repite los mismos criterios desde la perspectiva del grupo.

**Recomendación:** Fusionar Historia 6.5 en Historia 6.3 para evitar ambigüedad sobre cuál historia es el punto de referencia para implementación.

### Estadísticas de Cobertura

| Categoría | Total | Cubiertos | Diferidos/Brechas | Cobertura |
|-----------|-------|-----------|-------------------|-----------|
| FRs | 56 | 55 | 1 (FR-018 diferido explícitamente) | 98.2% |
| NFRs con historia verificable | 22 | 17 | 5 (NFR-001, 002 parcial, 006, 007, 009) | 77.3% |
| **Total requisitos** | **78** | **72** | **6 issues** | **92.3%** |

---

## Evaluación de Alineación UX

### Estado del Documento UX

**No encontrado.** No existe ningún documento de diseño UX (wireframes, user journeys, mockups) en los artefactos de planificación.

### ¿Es la UX implícita en este proyecto?

**Sí.** El sistema tiene un frontend web usuario-final con múltiples pantallas interactivas:
- Pantalla de acceso de grupos (código + nombre)
- Pantalla de acceso del profesor
- Tablero de sopa de letras (Fase 1) — UI de búsqueda de palabras en cuadrícula
- Bubble map de empatía (Fase 2) — UI de formulario estructurado
- Subida de foto LEGO (Fase 3) — flujo de 3 pasos con upload
- Panel de evaluación de pitch con rúbrica (Fase 4)
- Ranking y progreso en tiempo real
- Panel de control del profesor

### Evaluación de Impacto

El PRD y las épicas definen **qué hace el sistema** pero no **cómo lo verá el usuario**. Los criterios de aceptación de las historias están orientados casi exclusivamente al comportamiento de la API backend, no a la experiencia del usuario en pantalla.

**Áreas de riesgo UX sin especificar:**

| Área | Riesgo | Severidad |
|------|--------|-----------|
| Tablero de sopa de letras | ¿Cómo se renderiza la cuadrícula? ¿Cómo selecciona el usuario una palabra (clic, arrastrar)? ¿Hay feedback visual de palabras encontradas? | Media |
| Bubble map de empatía | ¿Cuántas burbujas hay? ¿Cuáles son obligatorias? ¿Cómo se ven las preguntas específicas? | Alta |
| Temporizador sincronizado | ¿Cómo se presenta visualmente? ¿Qué pasa en la UI cuando el tiempo expira? | Media |
| Evaluación de pitch (rúbrica) | ¿Cómo se presenta cada criterio 1–4? ¿Es un slider, radio buttons, estrellas? | Media |
| Flujo de subida de foto LEGO | Feedback al usuario en cada uno de los 3 pasos. ¿Hay barra de progreso de subida? | Alta |
| Vista del profesor (control de turnos Fase 4) | La UI para controlar qué grupo presenta no está definida | Alta |
| Estado de sesión / polling | ¿Hay indicador de carga o reconnect cuando el polling falla? | Baja |

### Alineación UX ↔ Arquitectura

La arquitectura define correctamente el frontend como "dumb view" (solo renderiza). Esta decisión es consistente con el objetivo pedagógico. Sin embargo:

- La arquitectura no especifica cómo se comunica el estado de sesión al frontend de forma que el usuario reciba feedback inmediato sin saturar la API.
- El diseño de la UI del bubble map (número y tipo de burbujas) afecta directamente al esquema de DynamoDB (qué se almacena por burbuja) pero ningún documento lo define.

### Advertencias

> ⚠️ **ADVERTENCIA ALTA:** La ausencia de documentación UX para el bubble map de empatía (Fase 2) es la brecha más crítica. El requisito FR-031 dice "todas las burbujas obligatorias llenas" pero ningún documento define cuántas burbujas hay, cuáles son obligatorias, ni qué preguntas responde cada burbuja. Esto impactará directamente el esquema de datos y los criterios de aceptación de la Historia 4.3.

> ⚠️ **ADVERTENCIA MEDIA:** El flujo de subida de foto LEGO (Épica 5) tiene criterios de aceptación backend bien definidos, pero la experiencia del usuario durante los 3 pasos (especialmente feedback de error y reintento) no está especificada. Esto puede resultar en una UX confusa durante Fase 3.

> ℹ️ **NOTA:** Dado que el frontend es "vanilla JavaScript sin framework" (decisión intencional del PRD), la ausencia de UX formal es un riesgo calculado. El equipo acepta que la UI será funcional antes que estética, lo cual es apropiado para el contexto educativo.

---

## Revisión de Calidad de Épicas

### Validación de Valor para el Usuario

| Épica | Título | Actor Principal | Entrega Valor a Usuario | Evaluación |
|-------|--------|----------------|------------------------|-----------|
| Épica 1 | Identidad y Acceso Seguro | Profesor / Grupos / Admin | ✅ Sí — sin auth nadie puede usar el sistema | ✅ Válida |
| Épica 2 | Orquestación de Sesión | Profesor / Grupos | ✅ Sí — ciclo de vida completo de sesión | ✅ Válida |
| Épica 3 | Catálogo de Temáticas | Administrador | ✅ Sí — configura el contenido educativo | ✅ Válida |
| Épica 4 | Fase 1 + Fase 2 | Grupos / Profesor | ✅ Sí — actividades jugables | ✅ Válida |
| Épica 5 | Fase 3 LEGO | Grupos | ✅ Sí — actividad de creatividad | ✅ Válida |
| Épica 6 | Fase 4 + Rankings | Grupos / Profesor | ✅ Sí — pitch y resultado final | ✅ Válida |
| Épica 7 | Sistema Listo para Producción | Equipo técnico / Operaciones | ⚠️ Parcial — es un hito técnico disfrazado | ⚠️ Revisar |

---

### 🔴 Violaciones Críticas

#### Violación C-1: Épica 7 es un hito técnico, no una épica de valor para el usuario

"Sistema Listo para Producción" agrupa infraestructura SAM completa, seguridad hardened, observabilidad y pipeline CI/CD en una única épica. Por los estándares de *create-epics-and-stories*, "Infrastructure Setup" y "CI/CD Pipeline" son red flags explícitos.

**Evidencia:**
- Historia 7.1: "Como profesor y grupos de estudiantes, quiero que el sistema esté completamente definido como código en `template.yaml`" — el usuario no ve ni interactúa con `template.yaml`.
- Historia 7.2: "Como el sistema en producción" — el actor es el sistema, no un usuario.
- Los criterios de aceptación son verificados por el equipo técnico, no por el usuario.

**Impacto:** En una iteración, si el equipo planifica trabajar en Épica 7, no hay entrega de valor observable para el usuario al final del sprint.

**Recomendación:** 
1. Renombrar la épica para hacerla centrada en el usuario: "El Sistema Opera una Sesión Completa sin Interrupciones" o distribuir sus historias en las épicas de negocio correspondientes.
2. Alternativamente, reconocerla explícitamente como "Épica de Habilitación" (Enabling Epic) — válida en frameworks ágiles escalados pero debe nombrarse así para distinguirla de épicas de valor de negocio.

---

### 🟠 Issues Mayores

#### Issue M-1: Historia 4.3 — Bubble Map sin definición de estructura de burbujas

El AC de la historia dice: "Dado que el grupo completa todas las burbujas obligatorias del bubble map." Sin embargo, ningún documento define:
- ¿Cuántas burbujas hay en el bubble map?
- ¿Cuáles son obligatorias y cuáles opcionales?
- ¿Qué pregunta responde cada burbuja?
- ¿La estructura varía por desafío o es fija del sistema?

**Evidencia directa del AC:**
> "Dado que el grupo completa todas las burbujas obligatorias del bubble map. Cuando envía la confirmación de compleción..."

El AC es incompleto — no hay ningún criterio verificable sobre qué se considera "completo" sin conocer la estructura del mapa.

**Impacto:** El desarrollador definirá arbitrariamente la estructura del bubble map, lo que afectará:
- El esquema DynamoDB (qué se almacena por burbuja)
- La lógica de `servicio.ts` para determinar si el mapa está completo
- La UI del frontend

**Recomendación:** Antes de implementar Historia 4.3, definir en el PRD o en un apéndice de la épica: número de burbujas, preguntas por burbuja, reglas de obligatoriedad. Actualizar el AC de Historia 4.3 para referenciar esa definición.

---

#### Issue M-2: Dependencia de datos Épica 2 → Épica 3

Historia 2.1 (Crear Sesión) requiere que el catálogo tenga temáticas y desafíos activos para poder ser acceptance-tested:
> "el profesor está autenticado y selecciona una temática y desafío válidos del catálogo activo"

Si el equipo implementa Épicas 1 y 2 antes que Épica 3, ninguna historia de Épica 2 puede ser acceptance-tested con datos reales de catálogo — solo con datos precargados manualmente.

**Impacto:** El orden de implementación sugerido implícitamente por la numeración (Épica 1 → 2 → 3) genera una dependencia de datos. El equipo necesita saber que deben implementar Épica 3 (o al menos poblar el catálogo con datos seed) antes de poder validar Épica 2 end-to-end.

**Recomendación:** Agregar una historia de "datos seed / configuración inicial del catálogo" en Épica 2 o una nota explícita en Épica 2 indicando la dependencia de datos con Épica 3.

---

#### Issue M-3: Cuatro historias con actor "Como el sistema" (no usuario)

Las historias con "Como el sistema" como actor son antipatrones de user stories:
- Historia 1.2: "Como el sistema, quiero limitar los intentos fallidos de ingreso..."
- Historia 5.3: "Como el sistema, quiero procesar las fotografías LEGO de forma asíncrona..."
- Historia 6.3: "Como el sistema, quiero calcular y persistir el puntaje de evaluación ponderado..."
- Historia 7.2: "Como el sistema en producción, quiero que la configuración de seguridad..."

**Impacto:** Las user stories deben describir valor desde la perspectiva de un actor humano. Cuando el actor es "el sistema", los criterios de aceptación se vuelven imposibles de demostrar a un stakeholder de negocio y la historia pierde su propósito de comunicación.

**Recomendación:**
- Historia 1.2: "Como administrador/operaciones, quiero proteger el acceso al sistema contra fuerza bruta..."
- Historia 5.3: "Como el equipo de operaciones, quiero que los fallos de procesamiento sean gestionados automáticamente..."
- Historia 6.3: "Como profesor, quiero que el puntaje de evaluación del pitch se calcule automáticamente al cerrar el turno..."
- Historia 7.2: "Como el equipo de seguridad, quiero que la configuración de producción sea hardened..."

---

### 🟡 Concerns Menores

#### Concern m-1: Historia 2.1 AC embebe detalle de implementación

El AC #2 de Historia 2.1 verifica la existencia de un archivo específico:
> "Dado que `compartido/maquinaEstados.ts` existe en el proyecto. Cuando cualquier módulo necesita validar el estado..."

Un AC de user story no debería referenciar nombres de archivos. Esto mezcla nivel de diseño técnico con nivel de aceptación funcional. La verificación de que existe `compartido/maquinaEstados.ts` es una tarea de implementación o revisión de código, no un criterio de aceptación de negocio.

**Recomendación:** Mover este criterio a las notas técnicas de implementación de la historia, no a los ACs. El AC debería verificar el comportamiento: "Dado que el estado actual de la sesión es X, cuando el profesor intenta transicionar a Y, entonces..."

---

#### Concern m-2: Historia 6.4 cubre rankings de TODAS las fases en una sola historia

Una sola historia (Historia 6.4) cubre `ranking1`, `ranking2`, `ranking3` y el ranking final acumulativo. Para que esta historia pueda ser probada end-to-end, se requieren datos de todas las fases anteriores (Épicas 4, 5 y 6).

En la práctica, esto significa que Historia 6.4 solo puede ser acceptance-tested completamente después de que todas las fases estén implementadas — lo que la hace difícil de demostrar incrementalmente.

**Recomendación:** Considerar dividir Historia 6.4 en: (a) rankings intermedios por fase, (b) ranking final acumulativo. Esto permite demostrar el valor parcialmente antes de completar Épica 6.

---

#### Concern m-3: Historia 5.1 es una historia híbrida (infraestructura + funcionalidad)

El primer AC de Historia 5.1 trata de infraestructura S3:
> "Dado que el bucket S3 privado para fotos LEGO está definido en `template.yaml` y desplegado como parte de esta historia..."

El resto de los ACs tratan la funcionalidad de URL prefirmada. Mezclar infra y feature en la misma historia complica la planificación de sprints.

**Recomendación:** Separar el AC de infraestructura en una historia técnica de habilitación o absorberlo en Historia 7.1.

---

### Checklist de Cumplimiento por Épica

| Criterio | Ép.1 | Ép.2 | Ép.3 | Ép.4 | Ép.5 | Ép.6 | Ép.7 |
|----------|------|------|------|------|------|------|------|
| Entrega valor al usuario | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Puede funcionar de forma independiente | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Stories con tamaño apropiado | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ✅ |
| Sin dependencias hacia adelante críticas | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tablas DB creadas cuando se necesitan | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Criterios de aceptación claros y verificables | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| Trazabilidad a FRs mantenida | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Resumen y Recomendaciones

### Estado General de Preparación para Implementación

## 🟡 NECESITA TRABAJO — Proceder con precaución

El proyecto tiene una base de planificación **sólida y bien articulada** (PRD exhaustivo, arquitectura coherente, trazabilidad casi completa de FRs). Sin embargo, existen **brechas específicas** que deben resolverse antes de iniciar las épicas afectadas, especialmente Historia 4.3 (bubble map) y las historias de resiliencia en Épica 7.

Las Épicas 1, 2, 3 pueden iniciarse con ajustes menores. Las Épicas 4–7 requieren resolución de issues identificados antes de su implementación.

---

### Issues Críticos que Requieren Acción Inmediata

| Prioridad | Issue | Épica afectada | Acción requerida |
|-----------|-------|----------------|-----------------|
| 🔴 BLOQUEANTE | Estructura del bubble map sin definir | Épica 4 / Historia 4.3 | Definir número de burbujas, preguntas, reglas de obligatoriedad ANTES de implementar |
| 🟠 ALTA | NFR-006 y NFR-007 sin historias ejecutables | Épica 7 | Agregar criterios de aceptación para retry/backoff y circuit breaker |
| 🟠 ALTA | NFR-009 (caos) sin historia | Épica 7 | Crear historia o ACs para documentar casos de caos por servicio externo |
| 🟠 ALTA | NFR-001 sin historia de prueba de rendimiento | Épica 7 | Agregar historia de prueba de carga con criterios ejecutables |
| 🟠 MEDIA | Confusión ReservedConcurrentExecutions vs ProvisionedConcurrencyConfig | Épica 7 / Historia 7.2 | Actualizar AC para distinguir ambas configuraciones de Lambda |
| 🟡 BAJA | 4 historias con actor "Como el sistema" | Épicas 1, 5, 6, 7 | Renombrar actor a perspectiva humana; mover a notas técnicas si es infrastructure concern |

---

### Pasos Recomendados

1. **INMEDIATO — Definir estructura del bubble map:** Antes de comenzar Historia 4.3, decidir y documentar: (a) número exacto de burbujas/preguntas del bubble map de empatía, (b) cuáles son obligatorias, (c) si varían por desafío o son fijas del sistema. Actualizar el AC de Historia 4.3 con esta definición.

2. **ANTES DE ÉPICA 7 — Agregar Historia 7.5 de resiliencia y caos:** Crear una nueva historia que cubra explícitamente: retry con backoff exponencial y jitter (`maxAttempts: 3`, SDK AWS), circuit breaker en Fase3→S3 y autenticación→Cognito, y documentación de casos de prueba de caos por servicio externo.

3. **ANTES DE ÉPICA 7 — Agregar Historia 7.5 o ACs de prueba de carga:** Definir qué herramienta de load testing usar (artillery, k6, etc.) y qué escenario simular (10 grupos × 3 sesiones). El criterio de aceptación debe ser ejecutable y medible.

4. **ANTES DE ÉPICA 7 — Corregir confusión NFR-002:** Actualizar Historia 7.2 para distinguir entre `ReservedConcurrentExecutions` (bulkhead — NFR-008) y `ProvisionedConcurrencyConfig` (anti-cold-start — NFR-002). Ambas configuraciones son necesarias y sirven propósitos opuestos.

5. **ANTES DE ÉPICA 2 — Agregar nota de dependencia de datos:** Documentar en Épica 2 que las historias 2.1–2.5 requieren catálogo poblado para su acceptance testing. Definir si esto se resuelve con datos seed o implementando Épica 3 primero.

6. **OPCIONAL — Refactorizar Épica 7 como "Enabling Epic":** Reconocer explícitamente Épica 7 como "Épica de Habilitación" (no de valor de negocio directo) en el documento de épicas para alinear con estándares ágiles.

---

### Fortalezas del Plan (lo que está bien)

- **PRD excepcional:** 56 FRs y 22 NFRs completamente definidos, con manejo explícito de restricciones del entorno educativo AWS Academy.
- **Trazabilidad perfecta:** Mapa FR → Épica → Historia está documentado y completo.
- **Decisiones arquitectónicas documentadas:** AD-1 a AD-7 capturan las decisiones técnicas y sus razones, incluyendo los diferimientos conscientes (FR-018 EventBridge).
- **Idempotencia bien cubierta:** NFR-004 aparece en los ACs de 6 historias diferentes, el riesgo de duplicación de tokens está bien mitigado.
- **Deuda técnica reconocida:** La deuda de Fase 3 LEGO está documentada en el PRD, en las épicas y en la arquitectura — no es una sorpresa.
- **Clean Architecture como invariante verificable:** La arquitectura define las 5 invariantes de CA y las épicas las respetan en los ACs.

---

### Nota Final

Este assessment identificó **12 issues** en **5 categorías**:
- 1 Violación crítica de calidad de épica
- 4 Issues mayores de cobertura de NFRs
- 4 Issues mayores de calidad de épicas
- 3 Concerns menores

**La recomendación es:** Resolver los 5 issues bloqueantes (estructura bubble map + 4 NFRs sin historias) antes de iniciar las épicas afectadas. Las Épicas 1, 2 y 3 pueden comenzar en paralelo mientras se resuelven estos items.

---

*Reporte generado: 2026-07-27 | Assessor: Claude Code (BMAD Implementation Readiness) | Proyecto: PROYECTO-INGENIERIA-DE-SOFTWARE-BMAD*
