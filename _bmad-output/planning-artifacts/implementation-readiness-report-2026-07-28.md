---
date: '2026-07-28'
project_name: 'PROYECTO-INGENIERIA-DE-SOFTWARE-BMAD'
stepsCompleted: ['step-01-document-discovery', 'step-02-prd-analysis', 'step-03-epic-coverage-validation', 'step-04-ux-alignment', 'step-05-epic-quality-review', 'step-06-final-assessment']
documentsIncluded:
  prd: '_bmad-output/planning-artifacts/prds/prd-mision-emprende-2026-07-26/prd.md'
  architecture_spine: '_bmad-output/planning-artifacts/architecture/architecture-PROYECTO-INGENIERIA-DE-SOFTWARE-BMAD-2026-07-26/ARCHITECTURE-SPINE.md'
  architecture_informe: '_bmad-output/planning-artifacts/architecture/architecture-PROYECTO-INGENIERIA-DE-SOFTWARE-BMAD-2026-07-26/INFORME-ARQUITECTURA.md'
  epics: '_bmad-output/planning-artifacts/epics.md'
  ux: null
---

# Implementation Readiness Assessment Report

**Date:** 2026-07-28
**Project:** PROYECTO-INGENIERIA-DE-SOFTWARE-BMAD

## Inventario de Documentos

### PRD Documents

**Sharded Documents:**
- Carpeta: `prds/prd-mision-emprende-2026-07-26/`
  - `prd.md` (34K, modificado 2026-07-27 22:37)

### Architecture Documents

**Sharded Documents:**
- Carpeta: `architecture/architecture-PROYECTO-INGENIERIA-DE-SOFTWARE-BMAD-2026-07-26/`
  - `ARCHITECTURE-SPINE.md` (12K, 2026-07-27)
  - `INFORME-ARQUITECTURA.md` (17K, 2026-07-27)

### Epics & Stories Documents

**Whole Documents:**
- `epics.md` (71K, modificado 2026-07-28 00:21)

### UX Design Documents

⚠️ **ADVERTENCIA:** No se encontraron documentos de UX/Diseño en `planning-artifacts/`.

---

## PRD Analysis

### Requisitos Funcionales (FRs)

**F1 — Autenticación y Gestión de Identidad**
- FR-001: El profesor se autentica via Amazon Cognito User Pool (correo + contraseña). Token JWT validado por API Gateway (Cognito Authorizer) antes de llegar a cualquier Lambda.
- FR-002: El sistema genera un token de sesión interno firmado (JWT, clave en Secrets Manager) para el profesor. Nunca expone credenciales Cognito al frontend.
- FR-003: Acceso de grupos en 3 pasos: (1) código alfanumérico 6 caracteres; (2) definición del nombre del grupo; (3) el sistema emite JWT con sesionId, grupoId, nombreGrupo. Expira al cerrar sesión.
- FR-004: Límite de intentos fallidos de ingreso con código de grupo: máx. 5 intentos por IP por ventana de 5 minutos.
- FR-005: Un profesor solo puede leer/modificar sus propias sesiones. Acceso a sesión ajena retorna 403.
- FR-006: El administrador se autentica con mecanismo separado al profesor (Cognito grupo distinto o claim `rol: admin`).

**F2 — Gestión del Catálogo (Administrador)**
- FR-007: El administrador puede crear, editar y eliminar temáticas (nombre, descripción corta, imagen).
- FR-008: El sistema impone exactamente 3 temáticas activas. No se puede desactivar sin reemplazar simultáneamente.
- FR-009: Cada temática tiene exactamente 3 desafíos activos (nombre, enunciado, temática). CRUD respetando la regla de 3.
- FR-010: Los cambios en catálogo no afectan sesiones ya creadas. La sesión almacena una copia del momento de su creación.

**F3 — Gestión de Sesiones (Profesor)**
- FR-011: El profesor puede crear una sesión especificando nombre, temática, desafío y número de grupos. El sistema genera códigos de acceso únicos por grupo.
- FR-012: El profesor puede listar sesiones activas e históricas con estado, fase actual y número de grupos activos.
- FR-013: El profesor puede ajustar grupos mientras la sesión está en estado `configuración`.
- FR-014: El profesor puede cerrar una sesión manualmente. Una sesión cerrada impide nuevas acciones y congela el estado final.

**F4 — Máquina de Estados del Juego**
- FR-015: Solo el profesor puede disparar transiciones de estado. El backend valida que el estado destino sea el sucesor directo; transiciones ilegales retornan error.
- FR-016: La definición canónica de la máquina de estados vive en un único módulo compartido del backend. Ningún módulo de fase reproduce esta lógica.
- FR-017: Las acciones de grupos solo son aceptadas si la sesión está en el estado correspondiente. Fuera del estado correcto: 409 con mensaje descriptivo.
- FR-018: Cada evento de transición de estado se publica en EventBridge para componentes asíncronos.
- FR-019: Al iniciar una fase, el sistema registra `timestampInicio` y `duracionSegundos` en DynamoDB. El frontend calcula tiempo restante usando el timestamp del servidor como fuente de verdad.
- FR-020: El temporizador es visible de forma sincronizada en todos los dispositivos mediante polling.
- FR-021: Los grupos no pueden enviar acciones cuando el temporizador ha expirado, salvo que el profesor haya habilitado tiempo extra explícitamente.
- FR-022: El profesor puede avanzar de fase antes de que el temporizador expire (override manual).
- FR-023: El profesor configura la duración del temporizador al momento de la transición; el sistema provee valor por defecto si no se especifica.

**F6 — Fase 1: Sopa de Letras**
- FR-024: Cada grupo recibe el tablero de sopa de letras y lista de palabras objetivo (igual para todos los grupos).
- FR-025: Un grupo puede enviar una palabra encontrada. El backend valida pertenencia a la lista objetivo y que no haya sido registrada previamente. Registro idempotente.
- FR-026: Por cada palabra nueva confirmada, el grupo recibe 1 token. La lógica vive exclusivamente en la capa de servicio.
- FR-027: El grupo puede consultar su progreso durante la fase (palabras encontradas y tokens acumulados).
- FR-028: El profesor puede ver el progreso de todos los grupos en tiempo real.

**F7 — Fase 2: Empatía (Bubble Map)**
- FR-029: Cada grupo construye el Bubble Map respondiendo 6 preguntas principales predefinidas + aportes complementarios opcionales (otros, relato, link).
- FR-030: Las respuestas del bubble map se persisten por grupo. Editables mientras sesión está en `fase2` y temporizador no expirado.
- FR-031: Al completar el Bubble Map (6 burbujas principales llenas), el grupo recibe entre 6 y 10 tokens según puntuación. Idempotente.
- FR-032: El profesor puede ver el estado de avance del bubble map de cada grupo (completo / en progreso / sin iniciar).

**F8 — Fase 3: Creatividad LEGO (Fotografía)**
- FR-033: Cada grupo puede subir una fotografía de su construcción LEGO. Flujo de 3 pasos: (1) solicitud de URL prefirmada S3 (15 min); (2) subida directa a S3; (3) confirmación al backend que verifica la existencia del objeto y lo asocia al grupo.
- FR-034: Si el objeto S3 no existe al momento de la confirmación, el backend retorna error y el grupo puede reintentar desde el paso 1.
- FR-035: El procesamiento de la foto (miniatura, validación) se realiza de forma asíncrona mediante SQS disparado tras confirmación. El grupo no espera el procesamiento.
- FR-036: Si el procesamiento falla, el mensaje va a una DLQ (retención 14 días). El grupo no queda en estado inválido; la foto original se preserva.
- FR-037: Fotografías en bucket S3 privado separado del bucket de frontend. Servidas mediante URLs prefirmadas, nunca con acceso público.
- FR-038: Al confirmar la foto, el grupo recibe tokens. Idempotente.

**F9 — Fase 4: Pitch y Evaluación Cruzada**
- FR-039: Durante `fase4`, el profesor controla el turno de presentación. Solo un grupo puede estar en turno activo simultáneamente.
- FR-040: Mientras un grupo presenta, los demás grupos y el profesor pueden enviar su evaluación. Se habilita cuando el grupo entra en turno; se cierra cuando el profesor cierra el turno.
- FR-041: La evaluación tiene 4 criterios fijos: Equipo, Empatía, Creatividad y Comunicación. Cada criterio escala 1-4. Total individual: 4-16.
- FR-042: El sistema muestra al evaluador una rúbrica simple (qué significa cada nivel 1-4). Visible para grupos y profesor.
- FR-043: Un evaluador solo puede enviar una evaluación por grupo presentador. El sistema rechaza evaluaciones duplicadas.
- FR-044: El grupo presentador no puede evaluarse a sí mismo.
- FR-045: La evaluación del profesor tiene peso 2× respecto a la de cada grupo.
- FR-046: Al cerrar el turno de un grupo, el backend calcula y persiste el puntaje de evaluación ponderado. Idempotente.
- FR-047: El puntaje de evaluación del pitch se convierte en tokens adicionales según una escala de configuración del sistema.

**F10 — Rankings y Progresión**
- FR-048: Al entrar en un estado de ranking (`ranking1`, `ranking2`, `ranking3`), el sistema calcula y publica el ranking de esa fase (solo tokens de la fase correspondiente).
- FR-049: El ranking final (tras `evaluacion`) es acumulativo de todas las fases. Sin ponderación entre fases: todos los tokens tienen el mismo valor.
- FR-050: El ranking es visible por todos los participantes (grupos y profesor) en los estados de ranking correspondientes.
- FR-051: El cálculo de rankings es asíncrono disparado por EventBridge. El resultado se persiste en DynamoDB; los clientes lo consultan al solicitar el estado de sesión.

**F11 — Consulta del Estado de Sesión**
- FR-052: Grupos y profesor pueden consultar el estado actual de la sesión (fase activa, tiempo restante, progreso por grupo, ranking) en cualquier momento.
- FR-053: El frontend consulta el estado periódicamente mediante polling. Intervalo y estructura de respuesta diseñados para minimizar latencia percibida sin saturar la API.

**F12 — Operaciones y Ciclo de Vida**
- FR-054: Endpoint de salud `GET /api/salud` que verifica conectividad con DynamoDB sin tocar datos del juego.
- FR-055: El sistema soporta exactamente dos entornos aislados: `dev` y `prod`. Todos los recursos son completamente independientes por entorno.
- FR-056: Infraestructura definida y desplegada con AWS SAM. Pipeline CI/CD completo y documentado; ejecución manual en entorno educativo (AWS Academy).

**Total FRs: 56**

---

### Requisitos No Funcionales (NFRs)

**Rendimiento y Escala**
- NFR-001: P95 ≤ 500 ms para cualquier endpoint del juego bajo carga de 10 grupos × 3 sesiones simultáneas.
- NFR-002: Provisioned Concurrency en Lambdas de rutas frecuentes si cold starts superan 800 ms en P95.
- NFR-003: DynamoDB en modo On-Demand.

**Resiliencia y Tolerancia a Fallos**
- NFR-004 (crítico): Toda operación que entregue tokens, registre progreso o emita puntaje debe ser idempotente. Implementada con claves de idempotencia y ConditionExpression en DynamoDB.
- NFR-005: DLQ para toda Lambda que procese SQS/EventBridge. Retención de mensajes fallidos por 14 días.
- NFR-006: Retry con Backoff Exponencial y Jitter (maxAttempts: 3) en llamadas al SDK AWS desde Lambda.
- NFR-007: Circuit Breaker en (1) Lambda Fase 3 → S3 para confirmación de foto; (2) Lambda autenticación de profesor → Cognito.
- NFR-008: ReservedConcurrentExecutions por módulo (Bulkhead) para evitar que un pico en una fase agote la concurrencia de funciones críticas.
- NFR-009: Diseño para el caos: cada integración externa tiene (a) timeout explícito, (b) respuesta de degradación definida, (c) caso de prueba de caos documentado.

**Seguridad**
- NFR-010: Mínimo privilegio IAM por Lambda. En cuenta educativa: todas las Lambdas usan LabRole.
- NFR-011: Sin secretos en código. Claves JWT y configuración sensible en Secrets Manager o SSM Parameter Store.
- NFR-012: Autenticación de profesor vía Cognito Authorizer en API Gateway. Fallback documentado: JWT firmado internamente si Cognito User Pool no está disponible en cuenta educativa.
- NFR-013: CORS restringido al dominio CloudFront en producción. Valor `*` prohibido en producción.
- NFR-014: Toda query DynamoDB en rutas de profesor incluye `profesorId` del token como condición de filtro obligatoria.
- NFR-015: DynamoDB cifrado en reposo (AWS managed key). S3 con SSE-S3. Todo tráfico HTTPS (TLS 1.2+). CloudFront redirige HTTP → HTTPS.
- NFR-016: PITR habilitado en tabla DynamoDB de producción.

**Infraestructura y Despliegue**
- NFR-017: Totalidad de recursos AWS definidos en `template.yaml` de AWS SAM. Consola AWS solo para observación.
- NFR-018: Pipeline CI/CD completo: type-check → pruebas Vitest → empaquetado esbuild → validación SAM → despliegue `dev` → despliegue `prod` con aprobación.
- NFR-019: Lambdas: memoria mínima 256 MB; timeout ≤ 10 s (sync); timeout máximo 15 min (async, fotos y rankings).

**Observabilidad**
- NFR-020: Logs estructurados JSON con campos: `requestId`, `sesionId`, `grupoId`/`profesorId`, `duracionMs`, `nivel`.
- NFR-021: Alarmas CloudWatch para: tasa de errores Lambda > 1% en 5 min; P99 latencia API Gateway > 2 s; DLQ con mensajes > 0; cold starts críticos superando umbral.
- NFR-022: Los logs no exponen tokens de acceso, códigos de grupo ni datos personales.

**Total NFRs: 22**

---

### Requisitos Adicionales y Restricciones

**Restricciones técnicas obligatorias (no negociables):**
- Backend: JavaScript/TypeScript compilado. Prohibido cualquier otro runtime en Lambda.
- IaC: AWS SAM exclusivamente. Prohibidos Terraform, CDK y despliegues manuales en producción.
- Clean Architecture: Invariantes de la Sección 2 obligatorias (núcleo sin AWS, dependencias hacia el núcleo, frontend "dumb view", pruebas sin AWS, estructura modular consistente).
- Frontend: Cero lógica de negocio. Solo renderiza y envía eventos.
- CI/CD: Pipeline definido completo y documentado.
- Cuenta AWS Academy: LabRole para todas las Lambdas; credenciales rotan por sesión; Cognito pendiente de verificación.
- Servicios AWS permitidos: Lambda, DynamoDB, API Gateway, S3, SQS, SNS/EventBridge, CloudFront, Cognito, Secrets Manager, CloudWatch.

**Escalas del sistema:**
- Más de 100 profesores con cuentas activas.
- Hasta 10 grupos por sesión.
- Objetivo inicial: 3 sesiones concurrentes reales.

**Estado de implementación parcial (Fase 3):**
- FR-033 a FR-037 pendientes de implementación. La versión actual guarda imagen en localStorage y envía solo `conFoto: true`.

### Evaluación de Completitud del PRD

El PRD está **bien estructurado y completo** para los propósitos de esta evaluación. Cubre:
- Visión, contexto y usuarios claramente definidos.
- Invariantes arquitectónicas como restricciones no negociables.
- 56 FRs numerados y trazables a módulos funcionales.
- 22 NFRs con criterios medibles y explícitos.
- Restricciones del entorno educativo documentadas con alternativas (fallback Cognito, LabRole).
- Riesgos identificados con mitigaciones.
- Glosario de dominio completo.

---

## Epic Coverage Validation

### Coverage Matrix

| FR | Epic Coverage | Historia | Status |
|----|---------------|----------|--------|
| FR-001 | Épica 1 | Historia 1.3 | ✅ Cubierto |
| FR-002 | Épica 1 | Historia 1.3 | ✅ Cubierto |
| FR-003 | Épica 1 | Historia 1.1 | ✅ Cubierto |
| FR-004 | Épica 1 | Historia 1.2 | ✅ Cubierto |
| FR-005 | Épica 1 | Historia 1.4 | ✅ Cubierto |
| FR-006 | Épica 1 | Historia 1.5 | ✅ Cubierto |
| FR-007 | Épica 3 | Historia 3.1 | ✅ Cubierto |
| FR-008 | Épica 3 | Historia 3.1 | ✅ Cubierto |
| FR-009 | Épica 3 | Historia 3.2 | ✅ Cubierto |
| FR-010 | Épica 3 | Historia 3.2 | ✅ Cubierto |
| FR-011 | Épica 2 | Historia 2.1 | ✅ Cubierto |
| FR-012 | Épica 2 | Historia 2.2 | ✅ Cubierto |
| FR-013 | Épica 2 | Historia 2.2 | ✅ Cubierto |
| FR-014 | Épica 2 | Historia 2.3 | ✅ Cubierto |
| FR-015 | Épica 2 | Historia 2.3 | ✅ Cubierto |
| FR-016 | Épica 2 | Historia 2.1 | ✅ Cubierto |
| FR-017 | Épica 2 | Historia 2.3 | ✅ Cubierto |
| FR-018 | Épica 2 | — | ⏸️ DIFERIDO (AD-4) |
| FR-019 | Épica 2 | Historia 2.4 | ✅ Cubierto |
| FR-020 | Épica 2 | Historia 2.4 | ✅ Cubierto |
| FR-021 | Épica 2 | Historia 2.4 | ✅ Cubierto |
| FR-022 | Épica 2 | Historia 2.4 | ✅ Cubierto |
| FR-023 | Épica 2 | Historia 2.4 | ✅ Cubierto |
| FR-024 | Épica 4 | Historia 4.1 | ✅ Cubierto |
| FR-025 | Épica 4 | Historia 4.1 | ✅ Cubierto |
| FR-026 | Épica 4 | Historia 4.1 | ✅ Cubierto |
| FR-027 | Épica 4 | Historia 4.2 | ✅ Cubierto |
| FR-028 | Épica 4 | Historia 4.2 | ✅ Cubierto |
| FR-029 | Épica 4 | Historia 4.3 | ✅ Cubierto |
| FR-030 | Épica 4 | Historia 4.3 | ✅ Cubierto |
| FR-031 | Épica 4 | Historia 4.3 | ✅ Cubierto |
| FR-032 | Épica 4 | Historia 4.4 | ✅ Cubierto |
| FR-033 | Épica 5 | Historia 5.1 | ✅ Cubierto |
| FR-034 | Épica 5 | Historia 5.2 | ✅ Cubierto |
| FR-035 | Épica 5 | Historia 5.3 | ✅ Cubierto |
| FR-036 | Épica 5 | Historia 5.3 | ✅ Cubierto |
| FR-037 | Épica 5 | Historia 5.1/5.3 | ✅ Cubierto |
| FR-038 | Épica 5 | Historia 5.2 | ✅ Cubierto |
| FR-039 | Épica 6 | Historia 6.1 | ✅ Cubierto |
| FR-040 | Épica 6 | Historia 6.1 | ✅ Cubierto |
| FR-041 | Épica 6 | Historia 6.2 | ✅ Cubierto |
| FR-042 | Épica 6 | Historia 6.2 | ✅ Cubierto |
| FR-043 | Épica 6 | Historia 6.2 | ✅ Cubierto |
| FR-044 | Épica 6 | Historia 6.2 | ✅ Cubierto |
| FR-045 | Épica 6 | Historia 6.3 | ✅ Cubierto |
| FR-046 | Épica 6 | Historia 6.3 | ✅ Cubierto |
| FR-047 | Épica 6 | Historia 6.5 | ✅ Cubierto |
| FR-048 | Épica 6 | Historia 6.4 | ✅ Cubierto |
| FR-049 | Épica 6 | Historia 6.4 | ✅ Cubierto |
| FR-050 | Épica 6 | Historia 6.4 | ✅ Cubierto |
| FR-051 | Épica 6 | Historia 6.4 | ✅ Cubierto (modificado AD-4: sync) |
| FR-052 | Épica 2 | Historia 2.5 | ✅ Cubierto |
| FR-053 | Épica 2 | Historia 2.5 | ✅ Cubierto |
| FR-054 | Épica 2 | Historia 2.5 | ✅ Cubierto |
| FR-055 | Épica 7 | Historia 7.1 | ✅ Cubierto |
| FR-056 | Épica 7 | Historia 7.4 | ✅ Cubierto |

### Requisitos Diferidos o Modificados

| FR | Estado | Decisión Arquitectónica |
|----|--------|------------------------|
| FR-018 | ⏸️ DIFERIDO | AD-4: EventBridge async diferido. Rankings calculan síncronamente. |
| FR-051 | ✅ Modificado | AD-4: El PRD definía ranking async vía EventBridge; los epics lo cambian a síncrono en endpoints /api/faseN/ranking. Cambio justificado y documentado. |

### Missing Requirements

No se encontraron FRs del PRD sin cobertura en los epics. Los 56 FRs tienen trazabilidad explícita.

**Nota sobre FR-018:** No está "faltante" — está explícitamente diferido como decisión arquitectónica (AD-4). Su deferral está documentado en la Épica 2 con justificación.

### Coverage Statistics

- **Total PRD FRs:** 56
- **FRs cubiertos en epics:** 55 implementados + 1 diferido (FR-018)
- **Porcentaje de cobertura:** 100% (56/56 con trazabilidad explícita)
- **Total NFRs:** 22
- **NFRs cubiertos:** 22/22 (Épica 7, con desglose en historias 7.2, 7.3, 7.5 y 7.6)

---

## UX Alignment Assessment

### UX Document Status

**No encontrado.** No existe documento de diseño UX/UI en `planning-artifacts/`.

### ¿El proyecto implica UI/UX?

**Sí.** El PRD y la Arquitectura describen explícitamente:
- Frontend web responsivo en Vanilla JavaScript/HTML/CSS.
- Múltiples pantallas: login de grupos, login de profesor, panel de administrador, vistas de fase (Sopa de Letras, Bubble Map, LEGO, Pitch), vistas de ranking, panel del profesor con control de temporizador y progreso.
- Flujos de usuario con timing crítico (temporizador sincronizado, polling de estado).
- El project-context.md establece la estructura de carpetas del frontend: `acceso/`, `juego/fase1/`, `juego/fase2/`, `juego/fase3/`, `juego/mapa/`, `profesor/`.

### ¿Cuál es el impacto de no tener documento UX?

**Bajo** para este proyecto, por razones específicas:
1. El PRD actúa como especificación de UX implícita: cada FR describe qué debe ver/hacer el usuario, qué mensajes de error recibir, qué estados del sistema se exponen.
2. La arquitectura define explícitamente que el frontend es "dumb view" — no toma decisiones. Las pantallas son renderizadoras de estado del backend, sin lógica propia.
3. Los criterios de aceptación de las historias incluyen la respuesta JSON que el frontend debe renderizar, lo que sustituye parcialmente el diseño UX.
4. El contexto es académico — el pulido UX/visual no es el objetivo central del ramo.

### Warnings

⚠️ **ADVERTENCIA (severidad: baja):** No existe documento de diseño UX, pero el sistema implica una interfaz de usuario compleja con múltiples flujos. En un proyecto de producción real, esto sería un gap crítico. En el contexto de este proyecto académico, los FRs y criterios de aceptación de las historias compensan la ausencia del documento UX.

---

## Epic Quality Review

### Metodología

Validación de cada épica e historia contra los principios de BMAD: valor al usuario, independencia entre épicas, ausencia de dependencias hacia adelante, tamaño apropiado de historias, y criterios de aceptación en formato BDD (Given/When/Then) completos y testeables.

---

### Análisis por Épica

#### Épica 1 — Identidad y Acceso Seguro del Sistema

| Criterio | Evaluación |
|----------|-----------|
| Entrega valor al usuario | ✅ Sí — actores pueden autenticarse y acceder al sistema |
| Orientación al usuario (no técnica) | ✅ Sí — "todos los actores se autentican con identidad propia" |
| Independiente (puede funcionar sola) | ✅ Sí — no necesita otras épicas |
| Historias bien dimensionadas | ✅ Sí — 5 historias coherentes |
| ACs en formato BDD | ✅ Sí — Given/When/Then completo en todas |
| Cubre error conditions | ✅ Sí — 401, 403, 429 contemplados |
| Sin dependencias hacia adelante | ✅ Sí |

**Observaciones:** Historia 1.3 cubre el caso de fallback Cognito → JWT interno, incluyendo la conmutabilidad. Historia 1.4 resuelve explícitamente la deuda técnica AD-3 (profesorId en el token). Historia 1.5 tiene una condición importante: el admin no puede acceder a rutas de sesiones de profesor y viceversa — la separación de roles está clara y testeada.

**Resultado: ✅ PASA**

---

#### Épica 2 — Orquestación de Sesión y Control del Juego

| Criterio | Evaluación |
|----------|-----------|
| Entrega valor al usuario | ✅ Sí — el profesor controla el ciclo de vida del juego |
| Orientación al usuario | ✅ Sí |
| Independiente | ⚠️ ADVERTENCIA — ver nota abajo |
| Historias bien dimensionadas | ✅ Sí — 5 historias coherentes |
| ACs en formato BDD | ✅ Sí |
| Cubre error conditions | ✅ Sí — 409 para transiciones inválidas, sesión cerrada, ajuste en curso |

**⚠️ ISSUE MAYOR: Dependencia de implementación implícita con Épica 3**

Historia 2.1 exige "seleccionar una temática y desafío válidos del catálogo activo". Esto significa que, para demostrar/probar la Historia 2.1 en condiciones reales, el catálogo (Épica 3) debe existir. Sin embargo, Épica 3 está ordenada después de Épica 2 en el listado.

**Impacto:** El equipo de desarrollo necesitará sembrar datos del catálogo manualmente (o implementar Épica 3 antes) para poder completar y verificar la Historia 2.1. Esto no está documentado en las historias.

**Recomendación:** Agregar a Historia 2.1 una precondición explícita: "Dado que existen al menos 3 temáticas activas y cada una con al menos 3 desafíos activos en el catálogo" — o bien considerar reordenar la implementación: Épica 3 antes de Épica 2, o incluir una historia de datos semilla en Épica 2.

**Resultado: ✅ PASA con observación (no bloquea implementación)**

---

#### Épica 3 — Catálogo de Temáticas y Desafíos

| Criterio | Evaluación |
|----------|-----------|
| Entrega valor al usuario | ✅ Sí — el administrador puede gestionar el catálogo |
| Orientación al usuario | ✅ Sí |
| Independiente | ✅ Sí — depende de Épica 1 (auth admin) únicamente |
| Historias bien dimensionadas | ✅ Sí — 2 historias coherentes |
| ACs en formato BDD | ✅ Sí |
| Reglas de negocio cubiertas | ✅ Sí — regla de 3 temáticas, regla de 3 desafíos, snapshot en creación de sesión |

**Observación:** Historia 3.2 incluye el comportamiento del snapshot en creación de sesión (FR-010), lo cual estrictamente pertenece al dominio de sesiones (Épica 2). Sin embargo, la lógica está bien documentada y el AC cubre el comportamiento esperado. La doble cobertura (Historia 2.1 + Historia 3.2) no crea contradicción sino refuerzo.

**Resultado: ✅ PASA**

---

#### Épica 4 — Fase 1 (Sopa de Letras) y Fase 2 (Empatía)

| Criterio | Evaluación |
|----------|-----------|
| Entrega valor al usuario | ✅ Sí — los grupos participan en las fases de actividad |
| Orientación al usuario | ✅ Sí |
| Independiente de épicas posteriores | ✅ Sí |
| Épica combinada (dos fases) | ⚠️ Ver nota abajo |
| ACs en formato BDD | ✅ Sí |
| Idempotencia cubierta | ✅ Sí — palabra ya enviada, bubble map ya completo |

**⚠️ Preocupación menor: Épica demasiado amplia**

Esta épica combina Fase 1 y Fase 2 en una sola épica con 4 historias. Si bien las fases son distintas actividades, al combinarlas se crea una épica que no puede demostrarse hasta que ambas fases estén implementadas. Desde una perspectiva de entregables incrementales, separar Fase 1 y Fase 2 en épicas distintas habría permitido despliegues incrementales más granulares.

**Sin embargo**, en el contexto de este proyecto académico con plazos definidos, la agrupación es razonable y no bloquea la implementación.

**Historia 4.3 — Bubble Map (más compleja):** Cubre bien las 6 burbujas obligatorias + opcionales (otros, relato, link), la puntuación (6-10 tokens), y el rechazo de completar sin burbujas llenas. La fórmula de puntuación está implícita en el criterio de aceptación. ✅

**Resultado: ✅ PASA con observación menor**

---

#### Épica 5 — Fase 3: Creatividad LEGO (Flujo Completo S3)

| Criterio | Evaluación |
|----------|-----------|
| Entrega valor al usuario | ✅ Sí — los grupos pueden subir su foto LEGO y recibir tokens |
| Orientación al usuario | ⚠️ El subtítulo "Flujo Completo S3" es técnico, pero el cuerpo está orientado al usuario |
| Independiente | ✅ Sí — depende de Épicas 1 y 2 (auth + sesión en fase3) |
| Historias bien dimensionadas | ✅ Sí — 3 historias coherentes con responsabilidades distintas |
| ACs en formato BDD | ✅ Sí |
| Deuda técnica documentada | ✅ Sí — el texto de la épica menciona explícitamente que el flujo actual es deuda técnica |

**Historia 5.1:** Cubre tanto la infraestructura S3 como el endpoint de URL prefirmada. Combinar la creación del bucket S3 con el endpoint podría ser un problema si el bucket ya existe (no es el caso aquí ya que está en template.yaml como pendiente). ✅

**Historia 5.3:** Cubre el procesamiento asíncrono con DLQ. La AC que acepta simular con repositorio falso en lugar de AWS Fault Injection es pragmática y coherente con el entorno educativo. ✅

**Resultado: ✅ PASA**

---

#### Épica 6 — Fase 4: Pitch, Evaluación Cruzada y Ranking Final

| Criterio | Evaluación |
|----------|-----------|
| Entrega valor al usuario | ✅ Sí — el juego se completa con la evaluación del pitch |
| Orientación al usuario | ✅ Sí |
| Independiente de Épica 7 | ✅ Sí |
| Épica amplia (5 historias de alta complejidad) | ⚠️ Ver nota abajo |
| ACs en formato BDD | ✅ Sí |

**⚠️ Preocupación menor: Épica 6 es la más compleja del sistema**

Esta épica incluye: control de turnos, evaluación con rúbrica, cálculo ponderado, conversión a tokens, rankings intermedios y ranking final. 5 historias con interdependencias internas:
- Historia 6.1 (control de turno) debe existir antes de Historia 6.2 (evaluación)
- Historia 6.3 (cálculo ponderado) depende de que existan evaluaciones (6.1 + 6.2)
- Historia 6.5 (conversión a tokens) depende de 6.3

Estas dependencias son internas a la épica y son apropiadas. No rompen ningún principio ya que son dependencias dentro de la misma épica.

**Solapamiento Historia 6.3 y 6.5:** La Historia 6.3 menciona la conversión de puntaje a tokens en su tercer AC. La Historia 6.5 está dedicada exclusivamente a esa conversión. Hay duplicidad en la cobertura. Recomendación: clarificar que en Historia 6.3 el tercer AC es una precondición/descripción de flujo, y la implementación real vive en Historia 6.5.

**Fórmula de ponderación (Historia 6.3):** La fórmula está explícita: `(suma evaluaciones de grupos + 2 × evaluación del profesor) / (N_grupos_evaluadores + 2)`. ✅ Esto es preciso y testeable.

**Resultado: ✅ PASA con observación menor (solapamiento 6.3 y 6.5)**

---

#### Épica 7 — Sistema Listo para Producción

| Criterio | Evaluación |
|----------|-----------|
| Entrega valor al usuario | 🔴 TÉCNICA — ver nota abajo |
| Orientación al usuario | ❌ Es una épica de infraestructura/operacional |
| Independiente | ✅ Sí — puede hacerse en paralelo con épicas de negocio en muchos casos |
| Historias bien dimensionadas | ✅ Sí |
| ACs en formato BDD | ✅ Sí, con criterios medibles |

**🔴 ISSUE CRÍTICO (académicamente justificado): Épica técnica sin valor de usuario directo**

Según los principios de BMAD, las épicas deben entregar valor al usuario, no ser hitos técnicos. Épica 7 es una épica de infraestructura, seguridad, observabilidad y CI/CD — ninguno de sus outcomes es visible para el profesor o los grupos durante la sesión.

**Sin embargo, existe justificación contextual fuerte:**
1. El objetivo académico del ramo es demostrar que el sistema puede sostenerse en producción. La "producción" es el valor para el evaluador del ramo.
2. Las historias de esta épica son verificables con criterios objetivos (alarmas CloudWatch, templates SAM, resultados de k6).
3. El PRD sección 8 (Métricas de Éxito) incluye explícitamente métricas de infraestructura: "Despliegue en AWS 100% por SAM", "Cobertura CI/CD".

**Veredicto:** Violación de buenas prácticas BMAD en términos estrictos, pero **contextualmente aceptable** dado que el evaluador del ramo es el "usuario" final que valora la producción-readiness como producto en sí mismo.

**Historia 7.6 (Prueba de carga):** Es la historia más operacional. Los criterios son precisos (P95 ≤ 500ms, < 1% de errores), pero la verificación requiere un sistema completamente desplegado y datos semilla. Esta historia debe ser la última en ejecutarse y tiene dependencia implícita con todas las épicas anteriores.

**Resultado: ⚠️ PASA con advertencia (épica técnica justificada por contexto académico)**

---

### Resumen de Hallazgos de Calidad

#### 🔴 Critical Violations

Ninguna violación crítica que bloquee la implementación.

#### 🟠 Major Issues

| # | Épica | Issue | Recomendación |
|---|-------|-------|---------------|
| 1 | Épica 2 / Historia 2.1 | Dependencia implícita con catálogo (Épica 3): no se puede verificar la creación de sesión sin datos de catálogo, pero Épica 3 está ordenada después | Implementar Épica 3 antes de completar Historia 2.1, o documentar que la Historia 2.1 requiere catálogo sembrado manualmente para pruebas |

#### 🟡 Minor Concerns

| # | Épica | Concern |
|---|-------|---------|
| 2 | Épica 4 | Combina dos fases distintas; no impide implementación pero reduce granularidad de entregables |
| 3 | Épica 6 | Solapamiento entre Historia 6.3 (tercer AC menciona conversión a tokens) e Historia 6.5 (dedicada a esa conversión) |
| 4 | Épica 7 | Épica técnica sin valor de usuario directo; justificada por contexto académico pero viola principios BMAD estrictos |

### Compliance Checklist por Épica

| Épica | Valor usuario | Independiente | Sin deps adelante | ACs BDD | Error conditions | FR trazabilidad |
|-------|-------------|---------------|-------------------|---------|-----------------|----------------|
| Épica 1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Épica 2 | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| Épica 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Épica 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Épica 5 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Épica 6 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Épica 7 | 🔴 | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Summary and Recommendations

### Overall Readiness Status

# ✅ READY FOR IMPLEMENTATION

El proyecto está en condiciones de iniciar la implementación. Todos los requisitos funcionales tienen trazabilidad explícita a historias implementables, los criterios de aceptación son verificables, y las decisiones arquitectónicas clave están documentadas con sus justificaciones.

---

### Critical Issues Requiring Immediate Action

**Ninguno.** No hay problemas críticos que bloqueen el inicio de la implementación.

---

### Issues a Tener en Cuenta (No Bloqueantes)

| Prioridad | Issue | Dónde | Acción recomendada |
|-----------|-------|-------|-------------------|
| 🟠 Mayor | Dependencia implícita Épica 2 → Épica 3 | Historia 2.1 | Implementar Épica 3 (Catálogo) **antes** de verificar Historia 2.1. Documentar en el equipo. |
| 🟡 Menor | Solapamiento entre Historia 6.3 y 6.5 | Épica 6 | Clarificar en el sprint: Historia 6.3 define la fórmula; Historia 6.5 implementa la conversión. No duplicar código. |
| 🟡 Menor | Épica 7 es técnica (no de valor de usuario directo) | Épica 7 | Aceptable por contexto académico. Sin acción requerida. |
| 🟡 Info | FR-018 diferido (EventBridge async) | Épica 2 | Documentado como AD-4. No implementar EventBridge hasta nueva decisión. |
| 🟡 Info | FR-051 cambiado de async a síncrono | Épica 6 | El PRD dice async; los epics implementan síncrono (AD-4). El código debe seguir los epics, no el PRD en este punto. |

---

### Recommended Next Steps

1. **Orden de implementación sugerido:** Iniciar con Épica 1 (Auth), luego Épica 3 (Catálogo), luego Épica 2 (Sesiones). Esto resuelve la dependencia de datos que existe entre 2 y 3.

2. **Antes de comenzar Historia 2.1:** Asegurarse de que existan temáticas y desafíos sembrados en la base de datos (o de que Épica 3 ya esté implementada).

3. **Al implementar Épica 6, Historia 6.3 y 6.5:** Asignarlas en el mismo sprint para evitar ambigüedades sobre dónde vive la lógica de conversión de puntaje a tokens.

4. **Épica 7:** Tratarla como un conjunto de tareas transversales — muchas de sus historias (7.1 CloudFront/S3, 7.2 CORS/secretos) deben implementarse en paralelo con las épicas de negocio, no al final.

5. **FR-018 y FR-051:** Asegurarse de que todo el equipo conozca la decisión AD-4. El código nunca debe implementar rankings async vía EventBridge hasta que esta decisión sea revisada.

---

### Final Note

Esta evaluación identificó **1 issue mayor** y **4 issues menores/informativos** a través de 5 categorías de análisis. El sistema tiene una cobertura de requisitos del 100% (56/56 FRs, 22/22 NFRs) con trazabilidad explícita en todos los casos. Los issues identificados son aclaraciones de proceso, no brechas de diseño. El equipo puede proceder con la implementación con confianza.

---

*Reporte generado: 2026-07-28 | Evaluador: Implementation Readiness Agent (BMAD) | Documentos analizados: PRD v2026-07-27, Architecture Spine v2026-07-27, Epics v2026-07-28*
