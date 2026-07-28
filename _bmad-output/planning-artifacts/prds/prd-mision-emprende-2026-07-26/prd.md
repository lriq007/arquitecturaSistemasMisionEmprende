---
title: "PRD — Misión Emprende UDD"
status: draft
created: 2026-07-26
updated: 2026-07-26
---

# PRD — Misión Emprende UDD

## 1. Visión y Contexto

**Misión Emprende UDD** es una plataforma de juego educativo diseñada para sesiones de clase presencial en la Universidad del Desarrollo. Durante una sesión, un profesor organiza a sus estudiantes en grupos que compiten y colaboran a través de cuatro fases de actividades orientadas al emprendimiento: trabajo en equipo, empatía, creatividad e ideación (pitch).

El sistema debe ser un producto de producción real desplegado en AWS, no un prototipo de laboratorio. Su objetivo académico es demostrar que una arquitectura serverless con Clean Architecture puede sostenerse en producción bajo condiciones de uso real con usuarios simultáneos.

**Problema que resuelve:** Las dinámicas de emprendimiento en clase carecen de una plataforma gamificada, en tiempo real y multi-grupo que opere de forma confiable bajo condiciones de red real y sin intervención manual del profesor para gestionar infraestructura.

**Usuarios principales:**
- **Administrador** — configura temáticas y desafíos disponibles en el sistema.
- **Profesor** — facilita la sesión, controla el avance entre fases, evalúa pitches.
- **Grupo de estudiantes** — participa en las actividades de cada fase a través de un dispositivo compartido.

---

## 2. Invariante Arquitectónica: Clean Architecture

Esta sección no describe cómo implementar la arquitectura — eso corresponde al documento de arquitectura técnica. Describe **qué debe ser verdad** sobre la estructura del sistema sin importar cómo evolucione.

**Clean Architecture es una restricción de diseño no negociable**, no una preferencia. Su propósito en este proyecto es demostrar que un sistema serverless puede mantener reglas de negocio aisladas, testeables de forma independiente y resistentes al cambio de infraestructura.

Las invariantes que el sistema debe cumplir en todo momento:

1. **El núcleo no sabe nada de AWS.** Las reglas de negocio (cuántos tokens entrega una acción, cómo avanza una fase, cómo se calcula el ranking) no importan el SDK de AWS, no conocen DynamoDB, no conocen S3. Si mañana DynamoDB se reemplaza por PostgreSQL, las reglas de negocio no cambian.

2. **Las dependencias siempre apuntan hacia el núcleo.** El adaptador de entrada (capa API) conoce al servicio; el servicio no conoce al adaptador de entrada. El servicio conoce la interfaz del repositorio; el repositorio concreto no conoce al servicio. Esta regla nunca se invierte.

3. **El frontend no toma decisiones.** Ningún cálculo de puntos, validación de reglas de juego, o transición de estado ocurre en el navegador. El frontend renderiza lo que el backend indica. Una modificación del JavaScript del cliente no puede alterar el estado del juego.

4. **Las pruebas del núcleo no necesitan AWS.** Las pruebas de lógica de negocio (`servicio.ts`) se ejecutan sin conexión a DynamoDB, S3 ni ningún servicio AWS. Los repositorios son reemplazados por implementaciones falsas que cumplen la misma interfaz.

5. **La estructura modular es consistente.** Cada módulo de dominio expone exactamente tres adaptadores: `api.ts` (entrada HTTP), `servicio.ts` (casos de uso y reglas), `repositorio.ts` (persistencia). No hay lógica de negocio en `api.ts`; no hay queries DynamoDB en `servicio.ts`.

La arquitectura técnica que produzca el arquitecto debe poder demostrar, módulo a módulo, que estas invariantes se cumplen.

---

## 3. Usuarios y Roles

### 3.1 Administrador

Persona con acceso a un panel de administración o interfaz protegida que puede:
- Crear, editar y eliminar temáticas del sistema.
- Crear, editar y eliminar desafíos asociados a una temática.

El sistema impone que haya siempre exactamente 3 temáticas activas, cada una con exactamente 3 desafíos activos (ver FR-008 y FR-009). El administrador no gestiona sesiones de juego ni interactúa con grupos; es un rol de configuración del catálogo.

### 3.2 Profesor

Persona autenticada individualmente con cuenta propia. Puede:
- Crear y administrar sesiones propias (una sesión pertenece a exactamente un profesor; no hay co-facilitación).
- Seleccionar temática y desafío al crear una sesión.
- Formar grupos de estudiantes al inicio de una sesión.
- Controlar el avance entre fases (transición manual).
- Controlar el temporizador de cada fase.
- Visualizar la rúbrica de evaluación de pitch para guiar a los estudiantes.
- Evaluar el pitch de cada grupo.
- Consultar rankings y resultados en tiempo real y al cierre.

**Escala:** El sistema soporta más de 100 profesores con cuentas activas operando sesiones simultáneas e independientes.

### 3.3 Grupo de Estudiantes

Unidad de participación. El sistema trata al grupo como actor único, no a los estudiantes individualmente. Puede:
- **Definir el nombre del grupo** en el momento de ingreso a la sesión (durante el login con código de acceso).
- Participar en las actividades de cada fase activa.
- Consultar el progreso propio y el ranking actual.
- Evaluar el pitch de otros grupos durante la Fase 4.

**Escala:** Hasta 10 grupos por sesión. La arquitectura soporta N sesiones simultáneas elásticamente (objetivo operacional inicial: 3 sesiones concurrentes reales).

---

## 4. Alcance del Sistema

### Dentro del alcance

- Gestión del catálogo de temáticas y desafíos (admin).
- Gestión completa del ciclo de vida de una sesión: creación, fases, evaluación, cierre.
- Las cuatro fases del juego: Sopa de Letras (Fase 1), Empatía (Fase 2), Creatividad LEGO (Fase 3), Pitch y Evaluación (Fase 4).
- Temporizadores sincronizados por fase, gestionados por el sistema.
- Rankings intermedios tras cada fase y ranking final acumulativo.
- Sistema de evaluación cruzada en Fase 4 (grupos evalúan grupos; profesor evalúa grupos).
- Nombres de grupos definidos por los propios estudiantes al ingresar.
- Carga y almacenamiento de fotografías LEGO (Fase 3) en S3.
- Autenticación de profesores vía Cognito; acceso de grupos vía código + JWT.
- Frontend estático servido por CloudFront + S3.
- Infraestructura como código con AWS SAM; CI/CD automatizado.
- Entornos separados: `dev` y `prod`.
- Observabilidad: logs estructurados, métricas, alarmas.

### Fuera del alcance

- Registro propio de profesores o administradores (cuentas creadas vía Cognito Admin; no hay autoregistro público).
- Identificación individual de estudiantes dentro de un grupo.
- Notificaciones push o correo a participantes.
- Integración con sistemas académicos externos (LMS, notas oficiales).
- App móvil nativa; el frontend es web responsivo.
- Co-facilitación de una sesión desde múltiples cuentas de profesor.

---

## 5. Funcionalidades

### F1 — Autenticación y Gestión de Identidad

**FR-001** El profesor se autentica mediante Amazon Cognito User Pool con correo y contraseña. El token JWT de Cognito es validado por API Gateway (Cognito Authorizer) antes de llegar a cualquier Lambda de profesor.

**FR-002** Al autenticarse, el sistema genera un token de sesión interno firmado (JWT con clave en Secrets Manager) que identifica al profesor dentro del dominio del juego. Este token nunca expone credenciales de Cognito al frontend.

**FR-003** El acceso de grupos se realiza en tres pasos: (1) el grupo ingresa el código alfanumérico de 6 caracteres entregado por el profesor; (2) el grupo define su nombre; (3) el sistema emite un JWT de grupo que identifica `sesionId`, `grupoId` y `nombreGrupo`. El JWT expira al cerrar la sesión.

**FR-004** El sistema impone límite de intentos fallidos de ingreso con código de grupo (máx. 5 intentos por IP por ventana de 5 minutos).

**FR-005** Un profesor solo puede leer y modificar sesiones que le pertenecen. Cualquier intento de acceder a una sesión ajena retorna 403.

**FR-006** El administrador se autentica mediante un mecanismo separado del profesor (Cognito con grupo de usuarios distinto o claim `rol: admin`) para acceder al panel de configuración del catálogo.

---

### F2 — Gestión del Catálogo de Temáticas y Desafíos (Administrador)

**FR-007** El administrador puede crear, editar y eliminar temáticas. Una temática tiene: nombre, descripción corta e imagen representativa.

**FR-008** El sistema impone que haya siempre exactamente 3 temáticas activas. El administrador no puede desactivar una temática si quedarían menos de 3 activas, salvo que simultáneamente active otra.

**FR-009** Cada temática tiene exactamente 3 desafíos activos asociados. Un desafío tiene: nombre, enunciado, y temática a la que pertenece. El administrador puede crear, editar y eliminar desafíos respetando la regla de 3 por temática.

**FR-010** Los cambios en el catálogo (temáticas y desafíos) no afectan sesiones ya creadas. Una sesión almacena una copia de la temática y desafío seleccionados en el momento de su creación.

---

### F3 — Gestión de Sesiones (Profesor)

**FR-011** El profesor puede crear una sesión especificando nombre, temática y desafío (seleccionados del catálogo activo), y número de grupos. El sistema genera los códigos de acceso únicos para cada grupo.

**FR-012** El profesor puede listar sus sesiones activas e históricas con estado, fase actual y número de grupos activos.

**FR-013** El profesor puede ajustar grupos antes de iniciar la primera fase (mientras la sesión está en estado `configuración`).

**FR-014** El profesor puede cerrar una sesión manualmente. Una sesión cerrada impide nuevas acciones de grupos y congela el estado final.

---

### F4 — Máquina de Estados del Juego

La sesión avanza por los siguientes estados en orden estricto:

```
configuración → fase1 → ranking1 → fase2 → ranking2 → fase3 → ranking3 → fase4 → evaluacion → finalizado
```

**FR-015** Solo el profesor puede disparar transiciones entre estados. El backend valida que el estado destino sea el sucesor directo del estado actual; transiciones ilegales retornan error.

**FR-016** La definición canónica de la máquina de estados (estados válidos, transiciones permitidas, actor que las dispara, duración por defecto del temporizador de cada fase) vive en un único módulo compartido del backend. Ningún módulo de fase reproduce esta lógica.

**FR-017** Las acciones de los grupos solo son aceptadas si la sesión está en el estado correspondiente a la actividad del grupo. Fuera del estado correcto, el sistema retorna 409 con mensaje descriptivo.

**FR-018** Cada evento de transición de estado se publica en EventBridge para que componentes asíncronos (ranking, logs de auditoría) reaccionen sin acoplamiento directo.

#### Temporizadores por fase

Los temporizadores son parte del comportamiento de la máquina de estados: se activan al entrar a cada fase y su expiración es una condición que el sistema gestiona.

**FR-019** Al iniciar una fase, el sistema registra `timestampInicio` y `duracionSegundos` en DynamoDB. El frontend calcula el tiempo restante como `duracionSegundos − (ahoraUTC − timestampInicio)` usando el timestamp del servidor como fuente de verdad, no el reloj del cliente.

**FR-020** El temporizador es visible de forma sincronizada en todos los dispositivos participantes mediante polling del estado de sesión.

**FR-021** Los grupos no pueden enviar acciones de la fase cuando el temporizador ha expirado, salvo que el profesor haya habilitado tiempo extra explícitamente.

**FR-022** El profesor puede avanzar de fase antes de que el temporizador expire (override manual), lo que equivale a una transición de estado normal.

**FR-023** El profesor configura la duración del temporizador de cada fase al momento de la transición; el sistema provee un valor por defecto si no se especifica.

---

### F6 — Fase 1: Sopa de Letras (Equipo)

**FR-024** Cada grupo recibe el tablero de sopa de letras y la lista de palabras objetivo correspondientes al desafío de la sesión. El tablero y las palabras son iguales para todos los grupos.

**FR-025** Un grupo puede enviar una palabra encontrada. El backend valida que la palabra pertenezca a la lista objetivo y que no haya sido registrada previamente por el mismo grupo. El registro es idempotente.

**FR-026** Por cada palabra nueva confirmada, el grupo recibe 1 token. La lógica de asignación de tokens vive exclusivamente en la capa de servicio.

**FR-027** El grupo puede consultar su progreso durante la fase: palabras encontradas y tokens acumulados.

**FR-028** El profesor puede ver el progreso de todos los grupos en tiempo real durante la fase.

---

### F7 — Fase 2: Empatía (Bubble Map)

**Definición canónica del Bubble Map (MVP)**

El Bubble Map tiene **seis burbujas principales obligatorias**, predefinidas por el sistema y comunes a todos los desafíos:

| ID persistido | Dimensión | Pregunta presentada al grupo | Ayuda esperada |
|---|---|---|---|
| `emociones` | Emociones | ¿Qué siente? | Emociones, preocupaciones y temores |
| `gustos` | Gustos | ¿Qué le gusta? | Intereses y preferencias |
| `entorno` | Entorno | ¿Cómo es su entorno? | Familia, trabajo y comunidad |
| `necesidades` | Necesidades | ¿Qué necesita? | Necesidades y problemas principales |
| `limitaciones` | Limitaciones | ¿Qué le limita? | Barreras y dificultades |
| `motivaciones` | Motivaciones | ¿Qué le motiva? | Metas, deseos y aspiraciones |

Cada respuesta obligatoria debe contener texto no vacío después de eliminar espacios. Su longitud máxima es de 1.000 caracteres.

El mapa incorpora además **tres aportes complementarios opcionales**:

1. `otros`: hasta cuatro hallazgos adicionales, uno por línea; los primeros dos entregan un punto cada uno.
2. `relato`: relato breve escrito desde la perspectiva de la persona objetivo; entrega un punto.
3. `link`: enlace de apoyo relacionado con el hallazgo; entrega un punto.

La puntuación se calcula con un punto por cada burbuja principal respondida, hasta dos puntos por `otros`, un punto por `relato` y un punto por `link`, con un máximo de **10 puntos**. El grupo solo puede confirmar la compleción cuando las seis burbujas principales están respondidas; por tanto, un mapa completo obtiene entre 6 y 10 puntos, y la recompensa equivale a su puntuación. Los aportes opcionales no impiden completar el mapa.

**FR-029** Cada grupo construye el Bubble Map respondiendo las seis preguntas principales predefinidas sobre el usuario objetivo del desafío y, si lo desea, añade los aportes complementarios definidos anteriormente. La configuración de preguntas diferentes por desafío queda fuera del alcance del MVP.

**FR-030** Las respuestas del bubble map se persisten por grupo. El grupo puede editar sus respuestas mientras la sesión está en `fase2` y el temporizador no ha expirado.

**FR-031** Al completar el Bubble Map (las seis burbujas principales llenas), el grupo recibe entre 6 y 10 tokens conforme a la puntuación definida anteriormente. La entrega es idempotente.

**FR-032** El profesor puede ver el estado de avance del bubble map de cada grupo (completo / en progreso / sin iniciar).

---

### F8 — Fase 3: Creatividad LEGO (Fotografía)

> **Estado de implementación:** El flujo de URL prefirmada y confirmación (FR-033 a FR-037) está pendiente de implementación. En la versión actual el frontend guarda la imagen en `localStorage` y envía únicamente `conFoto: true`; el backend registra ese booleano sin recibir ni almacenar el archivo. Las APIs de URL prefirmada y de confirmación están documentadas como pendientes.

**FR-033** Cada grupo puede subir una fotografía de su construcción LEGO. El flujo consta de 3 pasos explícitos, de los cuales los pasos 1 y 3 pasan por la API propia: (1) el grupo solicita al backend una URL prefirmada de S3 de corta duración (15 minutos); (2) el grupo sube la imagen directamente a S3 usando esa URL, sin pasar por el backend; (3) el grupo confirma al backend que la subida terminó — el sistema verifica la existencia del objeto en S3 y lo asocia al grupo.

**FR-034** Si el objeto S3 no existe al momento de la confirmación, el backend retorna error y el grupo puede reintentar el flujo desde el paso 1.

**FR-035** El procesamiento de la foto (generación de miniatura, validación de tamaño y formato) se realiza de forma asíncrona mediante un mensaje SQS disparado tras la confirmación. El grupo no espera el procesamiento para continuar.

**FR-036** Si el procesamiento falla, el mensaje va a una DLQ (Dead Letter Queue) para revisión manual. El grupo no queda en estado inválido; la foto original se preserva.

**FR-037** Las fotografías LEGO se almacenan en un bucket S3 privado separado del bucket de frontend. Se sirven mediante URLs prefirmadas, nunca con acceso público.

**FR-038** Al confirmar la foto, el grupo recibe tokens. La entrega es idempotente.

---

### F9 — Fase 4: Pitch y Evaluación Cruzada

**FR-039** Durante `fase4`, el profesor controla el turno de presentación: indica qué grupo está presentando en cada momento. Solo un grupo puede estar en turno activo simultáneamente.

**FR-040** Mientras un grupo presenta, los demás grupos y el profesor pueden enviar su evaluación del pitch. La evaluación se habilita cuando el grupo entra en turno y se cierra cuando el profesor cierra el turno.

**FR-041** La evaluación se compone de 4 criterios fijos del sistema: **Equipo, Empatía, Creatividad y Comunicación**. Cada criterio se puntúa en escala de 1 a 4. El puntaje total de una evaluación individual es la suma de los 4 criterios (mínimo 4, máximo 16).

**FR-042** El sistema muestra al evaluador una rúbrica simple que describe qué significa cada nivel (1 a 4) para orientar la votación. Esta rúbrica es visible para grupos y para el profesor durante la evaluación.

**FR-043** Un evaluador (grupo u observador) solo puede enviar una evaluación por grupo presentador. El sistema rechaza evaluaciones duplicadas.

**FR-044** El grupo presentador no puede evaluarse a sí mismo.

**FR-045** El profesor puede evaluar a todos los grupos. La evaluación del profesor tiene un peso de 2× respecto a la evaluación de cada grupo en el cálculo del puntaje de evaluación del pitch.

**FR-046** Al cerrar el turno de un grupo, el backend calcula y persiste el puntaje de evaluación ponderado. El cálculo es idempotente respecto a intentos de recalculación.

**FR-047** El puntaje de evaluación del pitch se convierte en tokens adicionales para el grupo presentador según una escala definida en la configuración del sistema.

---

### F10 — Rankings y Progresión

**FR-048** Al entrar en un estado de ranking (`ranking1`, `ranking2`, `ranking3`), el sistema calcula y publica el ranking de esa fase considerando únicamente los tokens acumulados en la fase correspondiente.

**FR-049** El ranking final (tras `evaluacion`) es **acumulativo de todas las fases**: suma de tokens de Fase 1 + Fase 2 + Fase 3 + tokens obtenidos por el puntaje de evaluación del pitch en Fase 4. No se aplican coeficientes de ponderación entre fases; todos los tokens tienen el mismo valor unitario.

**FR-050** El ranking es visible por todos los participantes (grupos y profesor) en los estados de ranking correspondientes.

**FR-051** El cálculo de rankings es un proceso asíncrono disparado por el evento de transición de estado publicado en EventBridge. El resultado se persiste en DynamoDB y los clientes lo consultan al solicitar el estado de sesión.

---

### F11 — Consulta del Estado de Sesión

**FR-052** Tanto grupos como profesor pueden consultar el estado actual de la sesión (fase activa, tiempo restante, progreso por grupo, ranking si corresponde) en cualquier momento mientras la sesión está abierta.

**FR-053** El frontend consulta el estado periódicamente mediante polling. El intervalo de polling y la estructura de respuesta del estado de sesión están diseñados para minimizar latencia percibida sin saturar la API.

---

### F12 — Operaciones y Ciclo de Vida

**FR-054** El sistema expone un endpoint de salud (`GET /api/salud`) que verifica conectividad con DynamoDB sin tocar datos del juego.

**FR-055** El sistema soporta exactamente dos entornos aislados: `dev` y `prod`. Tablas DynamoDB, buckets S3, User Pools de Cognito, secretos y dominios son completamente independientes por entorno.

**FR-056** La infraestructura se define y despliega con AWS SAM. El pipeline CI/CD se construye completo y documentado como si operara en una cuenta AWS sin restricciones de credenciales. En el entorno educativo actual (AWS Academy), el pipeline no se ejecuta automáticamente dado que las credenciales rotan cada sesión; en su lugar, el mismo flujo de pasos del pipeline se ejecuta manualmente con `sam deploy`. El documento de pipeline queda listo para activación inmediata en una cuenta con credenciales estables (OIDC o IAM de larga duración).

---

## 6. Requisitos No Funcionales

> **Nota de entorno educativo (aplica a NFR-010 y NFR-018):** El sistema opera en AWS Academy Learner Lab. Restricciones conocidas: `iam:CreateRole` devuelve `AccessDenied` — todas las Lambdas usan `LabRole`; las credenciales rotan por sesión de laboratorio — el CI/CD se ejecuta manualmente. Estas son restricciones operacionales del entorno, no decisiones de diseño. La arquitectura técnica debe documentar el diseño intencional (roles por Lambda, pipeline automatizado) junto a la adaptación para el entorno educativo.

### 6.1 Rendimiento y Escala

**NFR-001** El tiempo de respuesta P95 de cualquier endpoint del juego (envío de palabra, bubble map, foto, evaluación) debe ser ≤ 500 ms bajo carga de 10 grupos × 3 sesiones simultáneas.

**NFR-002** Las Lambdas de rutas frecuentes (acceso, estado de sesión, envío de actividades) se configuran con Provisioned Concurrency en producción si los cold starts superan 800 ms en P95.

**NFR-003** DynamoDB se configura en modo On-Demand para absorber picos de demanda sin degradación.

### 6.2 Resiliencia y Tolerancia a Fallos

El énfasis está en **prevención de corrupción de datos**: una entrega duplicada de tokens o un puntaje de evaluación incorrecto durante una sesión de clase es irrecuperable socialmente.

**NFR-004 — Idempotencia (crítico):** Toda operación que entregue tokens, registre progreso o emita un puntaje debe ser idempotente. Se implementa mediante claves de idempotencia y operaciones condicionales de DynamoDB (`ConditionExpression`). Ejecutar la misma acción N veces tiene exactamente el mismo efecto que ejecutarla una vez.

**NFR-005 — DLQ:** Toda Lambda que procese mensajes SQS o eventos EventBridge tiene una Dead Letter Queue configurada. Los mensajes fallidos se retienen 14 días para diagnóstico y reintento manual.

**NFR-006 — Retry con Backoff Exponencial y Jitter:** Las llamadas al SDK AWS desde Lambda usan retry automático con backoff exponencial y jitter (`maxAttempts: 3`). Esto evita tormentas de reintentos sincronizados ante fallas transitorias.

**NFR-007 — Circuit Breaker (aplicado selectivamente):** El patrón se aplica en los puntos donde una falla externa puede bloquear el flujo completo del juego: (1) Lambda Fase 3 → S3 para confirmación de foto; (2) Lambda de autenticación de profesor → Cognito. En estos puntos, un timeout explícito activa un comportamiento de degradación graceful (retornar error claro, no colgarse indefinidamente).

**NFR-008 — Bulkhead:** Las Lambdas de cada módulo tienen `ReservedConcurrentExecutions` configurado de forma que un pico en una fase no consuma toda la concurrencia disponible ni degrade funciones críticas como el acceso de grupos.

**NFR-009 — Diseño para el Caos:** La arquitectura tolera la inyección de fallos en servicios externos sin que el fallo derrumbe toda la sesión. Cada punto de integración con servicios externos tiene: (a) timeout explícito, (b) respuesta de degradación definida, (c) caso de prueba de caos documentado.

### 6.3 Seguridad

**NFR-010 — Mínimo Privilegio IAM:** El diseño establece un rol IAM propio por Lambda con exactamente los permisos necesarios para sus operaciones. La arquitectura técnica debe documentar esos permisos por función. En la cuenta educativa (ver nota de entorno), todas las Lambdas usan `LabRole` (`arn:aws:iam::815812412505:role/LabRole`); el `template.yaml` lo asigna explícitamente a cada función.

**NFR-011 — Sin secretos en código:** Claves de firma JWT y configuración sensible se almacenan en Secrets Manager o SSM Parameter Store. Las Lambdas los obtienen fuera del handler para reutilización en warm invocations.

**NFR-012 — Autenticación de profesor vía Cognito Authorizer:** API Gateway valida el token Cognito antes de ejecutar cualquier Lambda de profesor. No hay validación manual de token Cognito en código de aplicación. La disponibilidad del servicio Cognito en la cuenta educativa está confirmada para consultas (`list-user-pools`); la creación de User Pools debe verificarse antes de iniciar la implementación de este módulo. Si la creación de User Pools resulta no disponible, la autenticación de profesores se implementa con un JWT firmado internamente (clave en Secrets Manager), eliminando el Cognito Authorizer de API Gateway y validando el token en la capa de servicio.

**NFR-013 — CORS restringido:** En producción, `Access-Control-Allow-Origin` permite exclusivamente el dominio de CloudFront. El valor `*` está prohibido en producción.

**NFR-014 — Aislamiento entre profesores:** Toda query DynamoDB en rutas de profesor incluye el `profesorId` derivado del token como condición de filtro obligatoria.

**NFR-015 — Cifrado:** DynamoDB cifrado en reposo (AWS managed key). S3 con SSE-S3. Todo tráfico mediante HTTPS (TLS 1.2+). CloudFront redirige HTTP → HTTPS.

**NFR-016 — PITR:** La tabla DynamoDB de producción tiene Point-in-Time Recovery habilitado.

### 6.4 Infraestructura y Despliegue

**NFR-017** La totalidad de recursos AWS se define en `template.yaml` de AWS SAM. La consola AWS se usa solo para observación.

**NFR-018** El pipeline CI/CD se define completo: type-check TypeScript → pruebas Vitest → empaquetado esbuild → validación SAM → despliegue a `dev` en push a rama principal → despliegue a `prod` con aprobación o merge a rama `release`. En la cuenta educativa (ver nota de entorno), los mismos pasos se ejecutan manualmente y quedan documentados paso a paso para activación en cuenta con credenciales estables.

**NFR-019** Las funciones Lambda tienen límites configurados explícitamente: memoria mínima 256 MB, timeout ≤ 10 segundos para funciones síncronas del juego, timeout máximo 15 minutos para Lambdas de procesamiento asíncrono (fotos, rankings).

### 6.5 Observabilidad

**NFR-020** Todas las Lambdas emiten logs estructurados en JSON a CloudWatch Logs. Cada log incluye: `requestId`, `sesionId`, `grupoId` o `profesorId` (cuando aplica), `duracionMs`, `nivel`.

**NFR-021** Alarmas CloudWatch configuradas para: tasa de errores Lambda > 1% en 5 minutos, P99 de latencia de API Gateway > 2 segundos, DLQ con mensajes > 0, cold starts de Lambdas críticas superando umbral.

**NFR-022** Los logs no exponen tokens de acceso, códigos de grupo ni datos personales de estudiantes.

---

## 7. Restricciones Técnicas Obligatorias

Las siguientes restricciones son imposiciones del ramo de arquitectura y no son negociables. Se listan aquí para que la arquitectura técnica las tome como punto de partida, no como sugerencia.

| Restricción | Detalle |
|---|---|
| **Lenguaje backend** | JavaScript / TypeScript compilado a JS. Prohibido cualquier otro runtime en Lambda. |
| **IaC** | AWS SAM exclusivamente. Prohibidos Terraform, CDK y despliegues manuales en producción. |
| **Clean Architecture** | Las invariantes definidas en la Sección 2 son obligatorias. El arquitecto debe demostrar que el diseño las cumple módulo a módulo. |
| **Frontend "dumb view"** | Cero lógica de negocio en el frontend. El frontend solo renderiza y envía eventos. |
| **CI/CD automatizado** | Pipeline definido completo y documentado. En entorno educativo, ejecución es manual siguiendo los mismos pasos del pipeline. La definición del pipeline queda lista para activación en cuenta con credenciales estables. |
| **Cuenta AWS educativa** | El sistema opera en AWS Academy. Restricciones conocidas: (1) `iam:CreateRole` denegado → todas las Lambdas usan `LabRole`; (2) credenciales rotan por sesión → CI/CD ejecutado manualmente; (3) disponibilidad de Cognito User Pool pendiente de verificación. |
| **Servicios AWS** | Lambda, DynamoDB, API Gateway, S3, SQS, SNS/EventBridge, CloudFront, Cognito, Secrets Manager, CloudWatch. |

---

## 8. Métricas de Éxito

| Métrica | Objetivo | Contramétrica |
|---|---|---|
| Despliegue en AWS | 100% de recursos creados por SAM en `prod` sin recursos manuales | Número de recursos creados desde consola |
| Disponibilidad durante sesión | Sin interrupciones en una sesión completa (~90 min) con carga real | Errores 5xx durante sesión real |
| Integridad de datos | 0 entregas duplicadas de tokens en 1000 acciones | Tasa de violación de idempotencia |
| Latencia del juego | P95 ≤ 500 ms para acciones síncronas | P99 ≤ 1000 ms |
| Cobertura CI/CD | Pipeline definido y documentado; pasos ejecutados manualmente en entorno educativo siguiendo la misma secuencia | Ningún paso del pipeline omitido en despliegues manuales |
| Aislamiento entre profesores | 0 accesos cross-profesor en pruebas de seguridad | — |
| Clean Architecture | El arquitecto produce evidencia (diagrama de dependencias) de que el núcleo no importa AWS SDK | — |

---

## 9. Dependencias y Riesgos

### Dependencias
- Cuenta AWS Academy activa con acceso a `us-east-1`.
- Verificación de que `aws cognito-idp create-user-pool` está disponible en la cuenta (confirmado solo `list-user-pools` hasta ahora).
- URL estable para CloudFront (el dominio `.cloudfront.net` generado por AWS es suficiente para el entorno educativo).
- `LabRole` disponible y con permisos suficientes para operar Lambda, DynamoDB, S3, SQS, EventBridge y API Gateway.

### Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Cold start de Lambda impacta primera acción de cada grupo | Media | Alto | Provisioned Concurrency en Lambdas de acceso y estado de sesión |
| Falla de S3 durante subida de foto LEGO bloquea Fase 3 | Baja | Alto | URL prefirmada + reintentos en cliente + DLQ |
| Evaluaciones duplicadas en Fase 4 ante doble clic | Alta | Medio | Idempotencia DynamoDB + deshabilitación del botón en frontend tras primer envío |
| Temporizador desincronizado entre dispositivos | Media | Medio | Timestamps del servidor como fuente de verdad, no el reloj del cliente |
| Catálogo de desafíos mal configurado antes de una sesión | Baja | Alto | Validación en creación de sesión de que existen 3 temáticas con 3 desafíos cada una |
| Datos de Django pendientes de migración | Media | Bajo | Los datos históricos son independientes del sistema nuevo; migración puede ocurrir post-lanzamiento |
| Cognito User Pool no disponible para creación en cuenta educativa | Media | Alto | Plan B documentado en NFR-012: JWT firmado internamente con clave en Secrets Manager. Verificar antes de iniciar el módulo de autenticación. |
| `LabRole` sin permisos suficientes para algún servicio específico | Baja | Alto | Verificar permisos de LabRole para cada servicio antes de comenzar su implementación. Si hay gaps, documentar y buscar alternativa dentro de la cuenta. |

---

## 10. Glosario de Términos del Dominio

| Término | Definición en este sistema |
|---|---|
| **Token** | Unidad de recompensa del juego. Los grupos los acumulan al completar actividades en cada fase. No tiene relación con los tokens de autenticación JWT. |
| **Sesión** | Instancia de una clase donde un profesor crea grupos, selecciona una temática y un desafío, y guía a los grupos a través de las cuatro fases del juego. |
| **Grupo** | Unidad de participación formada por uno o más estudiantes. El sistema trata al grupo como un único actor; no identifica a los estudiantes individualmente. |
| **Fase** | Etapa del juego con una actividad específica. Las fases de actividad son cuatro: Sopa de Letras, Empatía, Creatividad LEGO y Pitch. Entre fases se intercalan estados de ranking. |
| **Temática** | Categoría del desafío de emprendimiento. Hay exactamente 3 temáticas activas en el sistema en todo momento (ej.: Salud, Sustentabilidad, Educación). Configurable por el administrador. |
| **Desafío** | Enunciado del problema de emprendimiento que los grupos deben resolver durante la sesión. Cada temática tiene exactamente 3 desafíos activos. El profesor selecciona uno al crear la sesión. |
| **Sopa de Letras** | Actividad de la Fase 1. Cada grupo busca palabras en un tablero de letras relacionadas con el desafío seleccionado. Cada palabra encontrada entrega 1 token. |
| **Bubble Map** | Actividad de la Fase 2. Cada grupo construye un mapa visual respondiendo preguntas estructuradas sobre el usuario objetivo del desafío. Completarlo entrega una recompensa de tokens. |
| **Pitch** | Presentación oral del emprendimiento de cada grupo ante los demás durante la Fase 4. El grupo que presenta es evaluado por el resto de grupos y por el profesor. |
| **Evaluación cruzada** | Mecanismo de la Fase 4 en que cada grupo puntúa el pitch de los demás grupos usando una rúbrica de 4 criterios (Equipo, Empatía, Creatividad, Comunicación), escala 1–4 por criterio. |
| **Ranking** | Clasificación de grupos por tokens acumulados, publicada al finalizar cada fase de actividad. El ranking final es acumulativo de todas las fases. |
| **LabRole** | Rol IAM preconfigurado en la cuenta AWS Academy (`arn:aws:iam::815812412505:role/LabRole`). Usado por todas las Lambdas en el entorno educativo a causa de la restricción `iam:CreateRole`. |

---

*Preguntas abiertas: todas resueltas en esta versión. Próximo paso: `bmad-architecture` (arquitectura técnica) usando este PRD como insumo.*
