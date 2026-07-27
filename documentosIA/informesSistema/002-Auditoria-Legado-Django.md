# Auditoría del legado Django de Misión Emprende

**Fecha de levantamiento:** 26 de julio de 2026  
**Alcance:** identificación y justificación; esta auditoría no elimina archivos ni modifica el comportamiento del sistema.

## 1. Conclusión ejecutiva

En el repositorio conviven dos arquitecturas:

- La arquitectura objetivo está en `frontend/` y `backend-serverless/`: frontend estático, API Gateway, Lambda, DynamoDB y una futura capa S3/CloudFront.
- La arquitectura anterior está representada por el arranque Django, su configuración, el despliegue Docker/MySQL de la raíz, un respaldo de datos y archivos locales.

El núcleo ejecutable Django está incompleto: `config/settings.py` registra la aplicación `juego`, `config/urls.py` importa `juego.urls` y `config/settings.py` espera estáticos en `juego/static`, pero el directorio `juego/` no existe. Ningún archivo de la implementación serverless importa `manage.py`, `config` ni módulos Django.

Esto permite recomendar la retirada futura del **código y despliegue Django**, pero no autoriza todavía a eliminar `db_backup.json` ni `media/`. Esos dos elementos contienen información que puede ser necesaria para completar o validar la migración.

## 2. Criterio de decisión

Cada elemento se clasifica en una de estas categorías:

| Decisión | Significado |
| --- | --- |
| Retirar después de verificaciones | Pertenece solamente a Django/MySQL y no tiene un consumidor vigente dentro del repositorio. |
| Migrar o archivar antes de retirar | Es legado, pero contiene datos o archivos cuyo valor no ha sido descartado. |
| Conservar | Pertenece a la arquitectura objetivo, a herramientas vigentes o documenta decisiones. |
| Revisar | La evidencia local no basta para decidir sin consultar historia Git, automatizaciones externas o al dueño de los datos. |

Una retirada futura debe superar las cuatro puertas siguientes:

1. No existen imports, rutas, scripts, pipelines ni despliegues internos o externos que consuman el elemento.
2. Su comportamiento está cubierto por serverless o fue declarado formalmente fuera de alcance.
3. Sus datos y archivos fueron migrados, conciliados y respaldados de forma segura.
4. Frontend, TypeScript, pruebas y SAM funcionan sin el elemento.

## 3. Inventario del núcleo Django

### 3.1 Candidatos para retirar después de verificaciones

| Elemento | Función anterior | Evidencia y justificación | Condición previa |
| --- | --- | --- | --- |
| `manage.py` | Punto de entrada administrativo de Django. | Solo carga `config.settings`; no participa en Node.js, SAM ni el frontend estático. La aplicación `juego` requerida ya no está presente. | Confirmar que ningún pipeline externo siga ejecutándolo. |
| `config/__init__.py` | Declara el paquete Python `config`. | Solo tiene sentido junto al proyecto Django y está vacío. | Retirar junto al resto de `config/`, nunca de forma aislada. |
| `config/asgi.py` | Expone la aplicación Django mediante ASGI. | Importa Django y `config.settings`; no existe despliegue ASGI en la arquitectura objetivo. | Confirmar que no exista un servicio externo ASGI. |
| `config/wsgi.py` | Expone la aplicación Django mediante WSGI. | Importa Django y `config.settings`; Lambda usa handlers TypeScript, no WSGI. | Confirmar que no exista un servicio externo Gunicorn/WSGI. |
| `config/settings.py` | Configura Django, MySQL, WhiteNoise, estáticos y archivos locales. | Requiere una aplicación `juego` ausente, apunta a MySQL y contradice la persistencia objetivo DynamoDB/S3. | Verificar que toda configuración vigente esté representada en SAM o en la configuración del frontend. |
| `config/urls.py` | Publica el administrador Django, `juego.urls` y `/media/`. | La API vigente está declarada en `backend-serverless/template.yaml`; `juego.urls` no existe. | Contrastar que las funciones requeridas estén cubiertas o explícitamente fuera de alcance. |
| `requirements.txt` | Dependencias Python del proyecto antiguo. | Django, MySQL, Gunicorn y WhiteNoise no son usados por el backend TypeScript. No hay código funcional del producto que importe pandas, openpyxl, Pillow o numpy. | Confirmar que no se utilizará como base de una herramienta de migración o exportación todavía no incorporada. |
| `Dockerfile` de la raíz | Construye y levanta Django en el puerto 8000. | Instala las dependencias MySQL/Python y ejecuta `manage.py runserver`; no construye SAM ni el frontend S3. | Verificar despliegues externos y documentación operativa. |
| `docker-compose.yml` de la raíz | Levanta MySQL y el servidor Django. | Es una cadena cerrada con el Dockerfile y `manage.py`. DynamoDB local usa el archivo distinto `backend-serverless/docker-compose.yml`, que debe conservarse. | Confirmar que no existan datos sin exportar en volúmenes MySQL externos. |
| `.dockerignore` de la raíz | Excluye archivos durante la construcción del Dockerfile Django. | Su consumidor es el Dockerfile de la raíz. No controla el Docker Compose de DynamoDB ni SAM ejecutados desde `backend-serverless/`. | Retirar solamente junto al Dockerfile de la raíz. |
| `dz` | Lista textual de rutas de la implementación anterior. | No es ejecutable ni es consumido por scripts. Contiene 281 rutas: 279 ya no existen y las dos restantes son `config/settings.py` y `requirements.txt`. Probablemente es un inventario de eliminación, pero no tiene encabezado que confirme su origen. | Incorporar su evidencia a esta auditoría y confirmar su origen en una copia Git completa. |

Estos elementos forman una unidad. Retirar solamente una parte dejaría referencias rotas y haría más confuso el repositorio; una futura limpieza debe tratarlos en un cambio atómico.

### 3.2 Legado que no debe eliminarse todavía

#### `db_backup.json`

Es un fixture de Django válido con **492 registros**:

| Modelo | Registros | Cobertura o riesgo relevante |
| --- | ---: | --- |
| `juego.alumno` | 202 | Contiene nombres, apellidos, RUT, correo, carrera y relaciones con grupos/sesiones. Son datos personales. |
| `juego.grupo` | 36 | Incluye tokens, progreso de fases, pitch, desafío y rutas de fotografías LEGO. |
| `juego.sesion` | 15 | Conserva temporizadores y estados hasta las fases de pitch, evaluación y ranking final. |
| `juego.evaluacion` | 35 | La evaluación completa todavía no está implementada en el backend serverless. |
| `juego.bubblemaprespuesta` | 50 | Parte de Fase 2 ya tiene equivalente serverless, pero falta una conciliación registro a registro. |
| `juego.palabrasopaencontrada` | 122 | Parte de Fase 1 ya tiene equivalente serverless, pero falta una conciliación registro a registro. |
| `juego.desafio` | 2 | Debe contrastarse con las opciones de desafío codificadas en la solución nueva. |
| `juego.tematica` | 1 | Referencia `images/tematicas/salud.png`, disponible bajo la estructura nueva del frontend. |
| `juego.reto` | 3 | No se encontró un módulo serverless equivalente. |
| `juego.retogrupo` | 2 | No se encontró un módulo serverless equivalente. |
| `juego.ruletalegoopcion` | 3 | Fase 3 posee una implementación nueva, pero requiere conciliación. |
| `juego.profesor` | 2 | Contiene identidad y correo del profesor. |
| `juego.usuario` | 2 | Sus contraseñas no coinciden con un formato hash reconocido durante la inspección; no se documentan sus valores. |
| `juego.idadministrador` | 1 | Contiene correo e identidad administrativa. |
| `sessions.session` | 16 | Son blobs de sesión Django; deben revisarse por datos sensibles y normalmente no se migran como sesiones activas. |

El respaldo también referencia:

- `legos/panda.png`, presente en `media/legos/`.
- `legos/zorro2.png`, presente en `media/legos/`.
- `images/tematicas/salud.png`, disponible en `frontend/compartido/recursos/imagenes/tematicas/`.
- `desafios/buho.png`, no encontrado en `media/` ni en el frontend nuevo.

**Decisión:** preservar hasta validar propiedad, necesidad histórica, tratamiento de datos personales, destino de cada modelo y conciliación con DynamoDB. Si finalmente fuera descartable, debe retirarse del repositorio y de su historial operativo mediante un procedimiento de seguridad independiente; copiarlo sin controles a otra ubicación no resuelve la exposición.

#### `media/`

Contiene 21 archivos con 13 contenidos únicos y ocupa aproximadamente 36 MiB. Hay nombres generados por Django que duplican contenido, archivos que también existen en el frontend y archivos sin equivalencia conocida. La duplicación por sí sola no autoriza su eliminación.

**Decisión:** preservar hasta identificar dueño y propósito de cada fotografía, migrar a un bucket S3 cuando corresponda, actualizar las referencias de datos y verificar hashes.

## 4. Archivos compartidos y falsos positivos

### `.gitignore`

Debe conservarse. Contiene reglas generales útiles para Python de las herramientas BMAD, Node.js y artefactos locales, además de reglas heredadas de Django. En una futura limpieza solo corresponde revisar reglas como `staticfiles/`, `media/`, bases SQLite, entornos Python y respaldos Django. No deben retirarse patrones generales sin comprobar su uso.

### Frontend migrado

`frontend/` es parte de la arquitectura objetivo aunque sus archivos provengan de plantillas/estáticos antiguos o mencionen Django en comentarios. En particular:

- `frontend/acceso/registro.html` documenta que reemplaza un bloque condicional Django.
- `frontend/juego/fase1/conocidos.js` documenta lógica que antes era inline.
- `frontend/juego/mapa/mapa-agente.js` todavía describe una configuración entregada por una plantilla Django.

Estos comentarios no convierten los archivos en eliminables. `mapa-agente.js` sí requiere una revisión funcional separada: los HTML estáticos no definen `window.MAPA_HABILIDADES_CONFIG`, por lo que actualmente usa valores por defecto y `rutaContinuar` puede quedar en `#`.

### Elementos que deben conservarse

| Elemento | Motivo |
| --- | --- |
| `backend-serverless/` | Backend objetivo TypeScript/Lambda/DynamoDB y definición SAM. |
| `backend-serverless/docker-compose.yml` | Entorno local de DynamoDB; no pertenece al Compose Django de la raíz. |
| `frontend/` | Frontend estático de la arquitectura objetivo, incluidos recursos migrados. |
| `Documentation/` y `notasConversaciones/` | Evidencia y orientación arquitectónica. |
| `_bmad/`, `_bmad-output/`, `.claude/`, `.agents/`, `.codex/` | Herramientas y artefactos de trabajo, no componentes Django del producto. |
| `.gitattributes` | Metadatos generales de Git, sin acoplamiento a Django. |
| `docs/` | Directorio vacío; no hay evidencia que lo relacione con Django. Su utilidad puede revisarse aparte. |

## 5. Apéndice: inventario individual de `media/`

Los hashes son SHA-256 del contenido observado durante la auditoría.

| Archivo | Bytes | SHA-256 | Relación conocida |
| --- | ---: | --- | --- |
| `media/legos/LEGO-02.jpg` | 84.475 | `90772e7779f1fe25587969c78b161a78d3999cfb9faffc36d83eb435627d540e` | Sin referencia encontrada; revisar dueño. |
| `media/legos/LOL.JPG` | 29.906 | `bba48375c6a49970ccdbd04487a96fedb80f7499d37dbbac403acef547849f98` | Mismo contenido que las tres variantes `LOL_*`. |
| `media/legos/LOL_5d49z93.JPG` | 29.906 | `bba48375c6a49970ccdbd04487a96fedb80f7499d37dbbac403acef547849f98` | Duplicado generado por nombre. |
| `media/legos/LOL_5xkQhHd.JPG` | 29.906 | `bba48375c6a49970ccdbd04487a96fedb80f7499d37dbbac403acef547849f98` | Duplicado generado por nombre. |
| `media/legos/LOL_Z9oUs7x.JPG` | 29.906 | `bba48375c6a49970ccdbd04487a96fedb80f7499d37dbbac403acef547849f98` | Duplicado generado por nombre. |
| `media/legos/Mizip1Edit.png` | 5.704.766 | `1f83be2962249438661b64a48b79b78bd34e4fad0170c8a24ce839908b03fac5` | Copia idéntica presente en recursos del frontend. |
| `media/legos/Mizip2.png` | 920.416 | `3841830e700fa6d1f76a1c8613870903c2244078fc3e0f53610e3918f0bd3adb` | Sin referencia encontrada; revisar dueño. |
| `media/legos/Mizip3.png` | 809.828 | `ed47aed20bb37f89477e2e36abb42370ab55f827b541e681e8aa3b662431c98b` | Copia idéntica presente en recursos del frontend y en `Mizip3_PgMg6KS.png`. |
| `media/legos/Mizip3_PgMg6KS.png` | 809.828 | `ed47aed20bb37f89477e2e36abb42370ab55f827b541e681e8aa3b662431c98b` | Duplicado generado por nombre; también existe en frontend. |
| `media/legos/Mizip4.png` | 735.841 | `9a42d3e7984bf49dfb4ff790273ddbd2cc667cd14bb8026a7f8fbb1c273765fa` | Mismo contenido que `Mizip4_oD23gkE.png`. |
| `media/legos/Mizip4_oD23gkE.png` | 735.841 | `9a42d3e7984bf49dfb4ff790273ddbd2cc667cd14bb8026a7f8fbb1c273765fa` | Duplicado generado por nombre. |
| `media/legos/VICHO.JPG` | 8.650 | `c11f14938725b95de3d400b14915a83ffeb1bfe2864782c4d72b1e4bf147ee87` | Mismo contenido que las dos variantes `VICHO_*`. |
| `media/legos/VICHO_R6Y6mTO.JPG` | 8.650 | `c11f14938725b95de3d400b14915a83ffeb1bfe2864782c4d72b1e4bf147ee87` | Duplicado generado por nombre. |
| `media/legos/VICHO_gi12ndo.JPG` | 8.650 | `c11f14938725b95de3d400b14915a83ffeb1bfe2864782c4d72b1e4bf147ee87` | Duplicado generado por nombre. |
| `media/legos/almirante_cosmo.png` | 2.322.520 | `c7e8a7a8fe0385e47f9200cc80c1eea5f4dd3857fe88e430d0d57e9024db9d01` | Copia idéntica a `frontend/compartido/recursos/imagenes/foto5.png`. |
| `media/legos/imagen_2026-04-01_151510789.png` | 1.419.270 | `3153ea980fab254c2a146cf4bb432ef5cde085be4b0e9bef2eef909c32e26990` | Mismo contenido que el archivo con sufijo `151521623`. |
| `media/legos/imagen_2026-04-01_151521623.png` | 1.419.270 | `3153ea980fab254c2a146cf4bb432ef5cde085be4b0e9bef2eef909c32e26990` | Duplicado por contenido. |
| `media/legos/logo.gif` | 14.050.730 | `e335b0bb66f242ea7687b005f99680a66f79dd05ad9019d662879de3e4f905a4` | Copia idéntica presente en recursos del frontend. |
| `media/legos/panda.png` | 1.979.450 | `492924fab4a14a713e733c3c95eecba2cad57ce3678f731ed6e67f79d7107adf` | Referenciado por `db_backup.json`; preservar o migrar. |
| `media/legos/zorro.png` | 3.758.053 | `47012e0077e570ccc1ca01d4d398942897f169a8c8ea2d48690550b78ff517f2` | Sin referencia encontrada; revisar dueño. |
| `media/legos/zorro2.png` | 2.242.300 | `9c2af32c3fc0503e3bb04ac68b7da445bded42dff7cf41447453eba87c3baf5a` | Referenciado por `db_backup.json`; preservar o migrar. |

## 6. Verificación exigida para una limpieza futura

Antes de retirar el núcleo Django:

1. Ejecutar la auditoría desde un clon con historial Git real y revisar ramas, etiquetas y automatizaciones. En este entorno `.git/` es un marcador vacío, por lo que esa evidencia no estuvo disponible.
2. Revisar despliegues externos para descartar servidores Django, Gunicorn, ASGI/WSGI, contenedores o volúmenes MySQL activos.
3. Definir el destino de cada modelo del respaldo: migrar a DynamoDB, transformar, archivar o descartar con autorización.
4. Migrar a S3 los archivos necesarios y conciliar ruta, tamaño, hash y referencia.
5. Instalar dependencias reproduciblemente con `npm ci`.
6. Ejecutar `npm run tipos`, `npm run pruebas` y validación/construcción SAM. En la inspección actual `npm run tipos` no pudo ejecutarse porque `node_modules` no estaba instalado y `tsc` no estaba disponible.
7. Servir el frontend estático y recorrer ingreso, profesor, sesiones y Fases 1–3, además de comprobar todos los recursos enlazados.
8. Hacer la retirada en un único cambio reversible y repetir todas las verificaciones.

## 7. Resultado de la auditoría

- **Recomendación de futura retirada:** 11 elementos del núcleo y despliegue Django, sujetos a las verificaciones anteriores.
- **No eliminables por ahora:** `db_backup.json` y los 21 archivos de `media/`.
- **Archivo a conservar y depurar selectivamente:** `.gitignore`.
- **Falsos positivos protegidos:** frontend migrado, backend serverless, Docker local de DynamoDB, documentación y herramientas de trabajo.
- **Cambios realizados por esta auditoría:** solamente la creación de este documento.
