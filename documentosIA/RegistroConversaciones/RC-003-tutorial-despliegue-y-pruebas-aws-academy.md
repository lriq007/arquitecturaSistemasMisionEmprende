# Tutorial de despliegue y pruebas en AWS Academy

**Proyecto:** Misión Emprende UDD  
**Arquitectura:** AWS SAM, API Gateway, Lambda y DynamoDB  
**Fecha de revisión:** 29 de julio de 2026  
**Objetivo:** desplegar en AWS Academy lo que funciona actualmente y comprobar el flujo principal desde la API y el frontend.

---

## 1. Estado verificado del proyecto

El backend serverless se encuentra en `backend-serverless/` y no necesita ejecutar
el backend Django legado.

La verificación realizada sobre el estado actual produjo:

```text
Test Files  6 passed
Tests       42 passed
```

También se comprobó que TypeScript compila y que esbuild puede empaquetar las siete
funciones:

1. Acceso de grupos.
2. Profesor.
3. Administrador.
4. Consulta de sesiones.
5. Fase 1.
6. Fase 2.
7. Fase 3.

Por lo tanto, el flujo mínimo demostrable es:

```text
Profesor inicia sesión
        ↓
Crea una sesión y sus grupos
        ↓
Un grupo ingresa con su código
        ↓
El profesor controla el avance
        ↓
El grupo consulta y realiza actividades de las fases 1, 2 y 3
```

La infraestructura que crea AWS SAM es:

```text
Frontend HTML/CSS/JavaScript
              ↓
      API Gateway HTTP API
              ↓
       Funciones AWS Lambda
              ↓
          DynamoDB
```

---

## 2. Requisitos

En el computador desde el cual se realizará el despliegue se necesita:

- Git.
- Node.js 22 o superior.
- npm.
- AWS CLI.
- AWS SAM CLI.
- `jq` es opcional, pero facilita la lectura de las respuestas JSON.
- Python 3, si se quiere servir el frontend localmente.

Comprobar las versiones:

```bash
git --version
node --version
npm --version
aws --version
sam --version
jq --version
python3 --version
```

La instalación oficial de AWS SAM CLI está documentada en:

<https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html>

---

## 3. Iniciar el laboratorio de AWS Academy

1. Entrar a AWS Academy.
2. Abrir **Learner Lab**.
3. Presionar **Start Lab**.
4. Esperar hasta que el indicador del laboratorio esté verde.
5. Abrir **AWS Console**.
6. Abrir **AWS Details** y buscar la sección de credenciales para AWS CLI.

Las credenciales temporales incluyen:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_SESSION_TOKEN
```

Configurarlas en la terminal actual:

```bash
export AWS_ACCESS_KEY_ID="REEMPLAZAR"
export AWS_SECRET_ACCESS_KEY="REEMPLAZAR"
export AWS_SESSION_TOKEN="REEMPLAZAR"
export AWS_DEFAULT_REGION="us-east-1"
```

No se deben guardar estas credenciales en Git ni incorporarlas a archivos del
proyecto.

Comprobar la identidad:

```bash
aws sts get-caller-identity
```

La respuesta debe mostrar el ID de la cuenta temporal de AWS Academy y un ARN de
sesión asumida. Si aparece `ExpiredToken`, se debe reiniciar o reabrir el laboratorio
y volver a copiar las credenciales.

---

## 4. Hacer portable el rol de AWS Academy

### Problema actual

`backend-serverless/template.yaml` contiene siete referencias a un ID de cuenta
específico:

```yaml
Role: arn:aws:iam::876388743639:role/LabRole
```

Ese ARN solo funciona si `876388743639` coincide con la cuenta actual. Cada alumno o
laboratorio puede recibir una cuenta diferente.

### Corrección

Reemplazar las siete apariciones por:

```yaml
Role: !Sub "arn:${AWS::Partition}:iam::${AWS::AccountId}:role/LabRole"
```

Así CloudFormation utiliza automáticamente la partición y la cuenta donde se crea el
stack.

Comprobar todas las referencias:

```bash
rg -n "Role:" backend-serverless/template.yaml
```

El resultado debería mostrar siete líneas con la expresión portable y ninguna con
el ID `876388743639`.

Documentación de pseudo parámetros de CloudFormation:

<https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html>

> AWS Academy proporciona normalmente un rol preexistente llamado `LabRole`. No se
> intenta crear un rol IAM nuevo, porque las cuentas educativas suelen restringir
> esa operación.

---

## 5. Instalar dependencias y verificar el backend

Desde la raíz del repositorio:

```bash
cd backend-serverless
npm install
npm run verificar
```

`npm run verificar` ejecuta:

1. `tsc --noEmit`: comprueba los tipos.
2. `vitest run`: ejecuta las pruebas.
3. `esbuild`: comprueba que las siete Lambdas puedan empaquetarse.

Resultado esperado:

```text
Test Files  6 passed
Tests       42 passed
```

Las advertencias de esbuild por archivos cercanos a `1.2mb` no representan un error
de compilación.

---

## 6. Construir la aplicación con AWS SAM

Ubicarse en `backend-serverless/`:

```bash
npm run sam:build
```

También se puede ejecutar directamente:

```bash
sam build
```

El resultado se genera en:

```text
backend-serverless/.aws-sam/build/
```

Si el código cambia, se debe ejecutar nuevamente `sam build` antes de desplegar.

---

## 7. Primer despliegue

Desde `backend-serverless/`:

```bash
sam deploy --guided
```

Valores recomendados para la demostración:

```text
Stack Name: mision-emprende-dev
AWS Region: us-east-1
Parameter Entorno: dev
Parameter OrigenCors: *
Parameter ClaveToken: una-clave-aleatoria-de-32-o-mas-caracteres
Parameter ClaveAccesoProfesor: profe123
Parameter ProfesorId: profesor-principal
Parameter ClaveAccesoAdmin: admin123
Parameter AdminId: admin-principal
Confirm changes before deploy: Y
Allow SAM CLI IAM role creation: N
Disable rollback: N
Save arguments to configuration file: Y
```

Consideraciones:

- `OrigenCors=*` es conveniente para una demostración, pero en producción debe
  reemplazarse por el dominio exacto del frontend.
- `profe123` y `admin123` son claves temporales de demostración, no claves aptas para
  producción.
- `ClaveToken` debe ser larga y difícil de adivinar.
- Las claves y credenciales no deben subirse al repositorio.

AWS recomienda el modo guiado en el primer despliegue:

<https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/using-sam-cli-deploy.html>

Para despliegues posteriores:

```bash
sam build
sam deploy
```

---

## 8. Obtener la URL pública

Al finalizar, SAM mostrará outputs semejantes a:

```text
UrlApi      = https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com
NombreTabla = MisionEmprende-dev
ArnTabla    = arn:aws:dynamodb:...
```

También pueden consultarse con:

```bash
aws cloudformation describe-stacks \
  --stack-name mision-emprende-dev \
  --query 'Stacks[0].Outputs' \
  --output table
```

Guardar la URL para las pruebas:

```bash
export API="https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com"
```

No se debe agregar `/dev` al final: el proyecto usa el stage `$default`.

---

## 9. Probar el backend con `curl`

### 9.1 Ingreso del profesor

El campo requerido por la implementación actual se llama `codigo`:

```bash
curl -s -X POST "$API/api/profesor/ingresar" \
  -H "Content-Type: application/json" \
  -d '{"codigo":"profe123"}' | jq .
```

Respuesta esperada:

```json
{
  "ok": true,
  "token": "eyJ...",
  "rol": "profesor",
  "profesorId": "profesor-principal"
}
```

Guardar el token:

```bash
export TOKEN_PROFESOR="PEGAR_TOKEN"
```

### 9.2 Crear una sesión

```bash
curl -s -X POST "$API/api/profesor/sesiones" \
  -H "Authorization: Bearer $TOKEN_PROFESOR" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Demostración AWS Academy",
    "correoProfesor": "profesor@udd.cl",
    "facultad": "Ingeniería",
    "modoCreacion": "recomendado",
    "alumnos": [
      {
        "correo": "ana@udd.cl",
        "rut": "",
        "nombre": "Ana",
        "apellidoPaterno": "García",
        "apellidoMaterno": "",
        "carrera": "Ingeniería"
      },
      {
        "correo": "luis@udd.cl",
        "rut": "",
        "nombre": "Luis",
        "apellidoPaterno": "Pérez",
        "apellidoMaterno": "",
        "carrera": "Ingeniería"
      }
    ]
  }' | jq .
```

De la respuesta se deben guardar:

```text
sesiones[0].sesionId
sesiones[0].grupos[0].codigoAcceso
```

Por ejemplo:

```bash
export SESION_ID="PEGAR_ID"
export CODIGO_GRUPO="PEGAR_CODIGO"
```

### 9.3 Listar las sesiones del profesor

```bash
curl -s "$API/api/profesor/sesiones" \
  -H "Authorization: Bearer $TOKEN_PROFESOR" | jq .
```

### 9.4 Obtener el control de una sesión

```bash
curl -s "$API/api/profesor/sesiones/$SESION_ID" \
  -H "Authorization: Bearer $TOKEN_PROFESOR" | jq .
```

### 9.5 Ingreso del grupo

```bash
curl -s -X POST "$API/api/acceso/ingresar" \
  -H "Content-Type: application/json" \
  -d "{\"codigo\":\"$CODIGO_GRUPO\"}" | jq .
```

Guardar el token:

```bash
export TOKEN_GRUPO="PEGAR_TOKEN"
```

### 9.6 Consultar la sesión del grupo

```bash
curl -s "$API/api/sesiones/actual" \
  -H "Authorization: Bearer $TOKEN_GRUPO" | jq .
```

### 9.7 Avanzar la sesión

La ruta real usa `acciones`, en plural:

```bash
curl -s -X POST \
  "$API/api/profesor/sesiones/$SESION_ID/acciones" \
  -H "Authorization: Bearer $TOKEN_PROFESOR" \
  -H "Content-Type: application/json" \
  -d '{"accion":"siguiente_fase"}' | jq .
```

La sesión se crea en:

```text
configuracion
```

La primera ejecución de `siguiente_fase` la lleva a:

```text
f1_bienvenida
```

Acciones soportadas actualmente:

```text
siguiente_fase
fase_anterior
iniciar_timer
detener_timer
reiniciar_timer
timer_10
```

Ejemplo para iniciar el temporizador:

```bash
curl -s -X POST \
  "$API/api/profesor/sesiones/$SESION_ID/acciones" \
  -H "Authorization: Bearer $TOKEN_PROFESOR" \
  -H "Content-Type: application/json" \
  -d '{"accion":"iniciar_timer"}' | jq .
```

### 9.8 Consultar la Fase 1

Cuando la sesión esté en una etapa válida de la Fase 1:

```bash
curl -s "$API/api/fase1/estado" \
  -H "Authorization: Bearer $TOKEN_GRUPO" | jq .
```

Las fases 2 y 3 ofrecen rutas equivalentes:

```bash
curl -s "$API/api/fase2/estado" \
  -H "Authorization: Bearer $TOKEN_GRUPO" | jq .

curl -s "$API/api/fase3/estado" \
  -H "Authorization: Bearer $TOKEN_GRUPO" | jq .
```

El profesor debe avanzar la máquina de estados antes de usar operaciones que dependan
de una fase concreta.

---

## 10. Probar mediante el frontend

### 10.1 Configurar la URL

El archivo `frontend/compartido/js/api.js` todavía contiene una URL antigua de
GitHub Codespaces:

```javascript
const API_URL = "https://symmetrical-space-funicular-4jrjvqw4x5763j9qq-3000.app.github.dev";
```

Reemplazarla por el output `UrlApi`:

```javascript
const API_URL =
  "https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com";
```

No agregar una barra al final.

### 10.2 Servir los archivos estáticos

Desde la raíz del repositorio:

```bash
python3 -m http.server 5500
```

Abrir:

```text
http://localhost:5500/frontend/
```

No es recomendable abrir los HTML directamente mediante `file://`, porque el
comportamiento del navegador y las rutas relativas puede ser diferente.

### 10.3 Flujo de demostración

1. Abrir el frontend en una ventana normal.
2. Ingresar como profesor con `profe123`.
3. Crear una sesión y cargar estudiantes.
4. Copiar un código de grupo.
5. Abrir una ventana incógnita.
6. Ingresar como grupo con el código.
7. Volver al panel del profesor.
8. Avanzar las etapas.
9. Observar cómo el grupo consulta el estado y realiza las actividades.
10. Probar las fases 1, 2 y 3 disponibles actualmente.

La ventana incógnita evita que el `localStorage` del profesor y del grupo se mezcle.

El template usa CORS con el origen configurado durante el despliegue. Con
`OrigenCors=*`, el frontend servido desde `localhost:5500` puede consumir la API.

Documentación oficial de CORS para HTTP API:

<https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html>

---

## 11. Qué revisar en AWS Console

### CloudFormation

Abrir:

```text
CloudFormation → Stacks → mision-emprende-dev
```

Revisar:

- **Events:** creación o errores de recursos.
- **Resources:** recursos generados por SAM.
- **Outputs:** URL pública y nombre de tabla.
- **Template:** definición de infraestructura como código.

### Lambda

Buscar las funciones creadas por el stack. Deben existir funciones para:

```text
Acceso
Profesor
Admin
Sesiones
Fase1
Fase2
Fase3
```

### API Gateway

Abrir la HTTP API creada por el stack y revisar las rutas `/api/...`.

### DynamoDB

Abrir:

```text
DynamoDB → Tables → MisionEmprende-dev
```

Después de crear una sesión deben existir registros con claves parecidas a:

```text
PK = SESION#<id>
SK = METADATOS

PK = SESION#<id>
SK = GRUPO#<id>
```

El índice `GSI1` permite encontrar grupos mediante su código de acceso.

### CloudWatch

Los errores y mensajes de ejecución de Lambda se almacenan en CloudWatch Logs. Esta
es la primera ubicación que se debe revisar ante un error 500.

También se pueden seguir logs con SAM:

```bash
sam logs \
  --stack-name mision-emprende-dev \
  --tail
```

---

## 12. Solución de problemas

### `ExpiredToken`

Las credenciales del laboratorio expiraron.

Solución:

1. Volver a AWS Academy.
2. Reiniciar o reabrir Learner Lab.
3. Copiar nuevamente las tres variables.
4. Repetir `aws sts get-caller-identity`.

### `Role is invalid` o `Cross-account pass role is not allowed`

El template conserva el ID de otra cuenta.

Solución:

```yaml
Role: !Sub "arn:${AWS::Partition}:iam::${AWS::AccountId}:role/LabRole"
```

Comprobar que las siete funciones estén corregidas.

### `AccessDenied` relacionado con IAM

Comprobar que:

- Se está usando el laboratorio correcto.
- Las credenciales siguen vigentes.
- El rol se llama realmente `LabRole`.
- Durante `sam deploy --guided` no se pidió crear roles nuevos.

### `ROLLBACK_COMPLETE`

Consultar el motivo:

```bash
aws cloudformation describe-stack-events \
  --stack-name mision-emprende-dev \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`].[LogicalResourceId,ResourceStatusReason]' \
  --output table
```

Corregir el error y eliminar el stack fallido desde CloudFormation antes de repetir
el despliegue, si CloudFormation no permite actualizarlo.

### Error CORS en el navegador

Comprobar:

- Que `API_URL` contiene exactamente el output de CloudFormation.
- Que no se agregó `/dev`.
- Que `OrigenCors` se desplegó como `*` para la prueba local.
- Que se ejecutó `sam build` y `sam deploy` después de cambiar el template.

API Gateway solo agrega los encabezados CORS cuando la solicitud del navegador
incluye un encabezado `Origin`.

### `401` o `Token inválido`

Los tokens dejan de ser válidos si cambia `ClaveToken` entre despliegues.

Solución:

1. Borrar el `localStorage` del navegador.
2. Ingresar nuevamente como profesor o grupo.
3. Usar el token recién generado.

### `404 Ruta no encontrada`

Comprobar la ruta exacta. En particular:

```text
Correcto:   /api/profesor/sesiones/<id>/acciones
Incorrecto: /api/profesor/sesiones/<id>/accion
```

### La tabla está vacía

El despliegue no carga automáticamente los códigos locales `ABC123` y `XYZ789`.
Esos datos pertenecen al script para DynamoDB Local.

En AWS se debe:

1. Ingresar como profesor.
2. Crear una sesión.
3. Usar los códigos generados en la respuesta.

---

## 13. Diferencia entre pruebas locales y AWS

### Solo pruebas unitarias

No requieren Docker ni credenciales AWS:

```bash
cd backend-serverless
npm run pruebas
```

### API local completa

Requiere Docker y AWS SAM CLI:

```bash
cd backend-serverless
npm run local:base
npm run local:preparar
cp env.local.example.json env.local.json
npm run construir
npm run local:api
```

La API queda normalmente en:

```text
http://127.0.0.1:3000
```

Los códigos locales precargados son:

```text
ABC123
XYZ789
```

### API desplegada en AWS Academy

No usa DynamoDB Local ni los códigos anteriores. Usa API Gateway, Lambda y la tabla
`MisionEmprende-dev`.

---

## 14. Limpieza del laboratorio

Si se terminó la demostración y se quiere eliminar la infraestructura:

```bash
sam delete --stack-name mision-emprende-dev --region us-east-1
```

Antes de confirmar, verificar que el nombre del stack sea exactamente
`mision-emprende-dev`.

También puede eliminarse desde:

```text
CloudFormation → mision-emprende-dev → Delete
```

Esta operación elimina los recursos administrados por el stack, incluida la tabla
DynamoDB del entorno de demostración y sus datos.

---

## 15. Checklist de demostración

```text
[ ] Learner Lab iniciado
[ ] Credenciales AWS Academy vigentes
[ ] aws sts get-caller-identity responde correctamente
[ ] Las siete referencias a LabRole usan AWS::AccountId
[ ] npm install completado
[ ] npm run verificar: 42 pruebas aprobadas
[ ] sam build completado
[ ] sam deploy completado
[ ] UrlApi guardada en la variable API
[ ] Ingreso de profesor probado
[ ] Sesión y grupo creados
[ ] Ingreso de grupo probado
[ ] Acción siguiente_fase probada
[ ] API_URL del frontend actualizada
[ ] Frontend servido mediante HTTP
[ ] Flujo profesor/grupo probado en dos ventanas
[ ] Recursos revisados en CloudFormation, Lambda, API Gateway y DynamoDB
```

---

## 16. Correcciones respecto de documentación anterior

En ejemplos anteriores del repositorio aparecen dos llamadas que ya no coinciden con
la implementación:

### Ingreso del profesor

Incorrecto:

```json
{"clave":"profe123"}
```

Correcto:

```json
{"codigo":"profe123"}
```

### Acción de una sesión

Incorrecto:

```text
/api/profesor/sesiones/<id>/accion
```

Correcto:

```text
/api/profesor/sesiones/<id>/acciones
```

Estas formas correctas fueron confirmadas en `src/profesor/api.ts`.

