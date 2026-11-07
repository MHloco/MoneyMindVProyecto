# MoneyMindV en AWS

## Ruta preparada

Para subir un ZIP desde la consola: **Elastic Beanstalk Standard, plataforma Docker sobre Amazon Linux 2023**, con Docker Compose. Elegir Docker, no las plataformas individuales Node.js, Python ni ECS managed Docker.

```text
Navegador --HTTPS--> ALB + certificado ACM
                       |
                  nginx / Angular :80 -> contenedor :8080
                       |
                    /api/*
                       |
                    Node :4000 ----TLS----> RDS PostgreSQL
                       |
                       +----> Redis :6379 (caché interna)
                       |
                       +----> FastAPI :8000 ----HTTPS----> Gemini
```

Angular Material se compila con Angular; no es un servicio adicional. FastAPI utiliza Python. Solo nginx publica un puerto. PostgreSQL está fuera del ciclo de vida de la aplicación; FastAPI, Node y Redis no deben tener puertos públicos.

La configuración inicial fija **una instancia** de aplicación. Redis solo guarda caché y puede perderse sin perder los datos financieros. El limitador de login actual vive en memoria de Node: antes de usar varias instancias, moverlo a Redis compartido y utilizar ElastiCache con TLS. No activar autoescalado sin ese trabajo.

Para una demo de presupuesto mínimo, una instancia Lightsail/EC2 con Compose puede simplificar costos, pero requiere administrar HTTPS, copias y actualizaciones. Para producción con crecimiento, evaluar ECS Fargate/ECR, RDS y ElastiCache, y separar Angular en S3 privado + CloudFront. No hace falta introducir esa complejidad para entregar el primer ZIP.

## Qué contiene el ZIP

- Código fuente y lockfiles; tres Dockerfiles; nginx y Docker Compose.
- Certificados **públicos** de RDS para verificar TLS.
- `deploy/db/001-schema.sql`: estructura completa de la base local PostgreSQL 18, sin propietarios ni permisos locales.
- `deploy/db/002-catalogs.sql`: planes FREE/PRO y categorías de sistema sin propietario.
- Migraciones, documentación, scripts y manifiesto SHA-256 por archivo.

No incluye `.env`, contraseñas, credenciales de administrador, usuarios, movimientos, conversaciones, logs, `node_modules`, `.venv` ni caches. El ZIP no es un respaldo de los datos existentes. Si se desea migrar cuentas y movimientos, hacer una migración de datos privada por separado.

El archivo `docker-compose.yml` está en la raíz del ZIP, sin una carpeta MoneyMindV encima. Los scripts `.platform` conservan permisos Unix de ejecución. Elastic Beanstalk crea su propio `.env`; por eso no se debe agregar el local al paquete.

## Probar los contenedores en Windows

Con Docker Desktop iniciado y contenedores Linux, desde la raíz:

Requiere Docker Compose 2.24.4 o posterior para el reemplazo de puertos `!override` de la prueba local. El Compose principal de AWS no utiliza esa extensión.

```powershell
# Solo una vez; falla deliberadamente si el archivo ya existe.
./ai-service/.venv/Scripts/python.exe deploy/create-local-env.py

docker compose --env-file .env.docker.local -p moneymind-aws-check -f docker-compose.yml -f compose.local.yml up --build -d
docker compose --env-file .env.docker.local -p moneymind-aws-check -f docker-compose.yml -f compose.local.yml ps
Invoke-RestMethod http://localhost:8080/health
node deploy/smoke-local.cjs
```

Abrir `http://localhost:8080`. Se crea una base Docker nueva y un volumen propio; no utiliza la base de desarrollo. Las claves de la prueba se generan al azar y no se imprimen. El chat estará deshabilitado hasta configurar `GEMINI_API_KEY` en `.env.docker.local`; los análisis locales funcionan sin ella. Tras cambiarla, volver a ejecutar `up -d` para recrear el contenedor.

Para detener esta prueba conservando su base:

```powershell
docker compose --env-file .env.docker.local -p moneymind-aws-check -f docker-compose.yml -f compose.local.yml down
```

Los scripts SQL de inicialización solo se ejecutan con un volumen vacío. No usar este mecanismo como sistema de migraciones posteriores ni borrar volúmenes con datos que se quieran conservar.

La prueba HTTP crea dos cuentas sintéticas en esa base aislada y consume una consulta de análisis de una de ellas. No utiliza usuarios reales ni llama al proveedor de correo o Gemini. Los resultados de preparación están en [aws-validation.md](aws-validation.md).

## Preparar AWS

1. Elegir región y presupuesto. Usar la misma región para Beanstalk, RDS, ALB, ACM y secretos. Crear una alerta de presupuesto. Revisar cuotas y permisos del laboratorio si es AWS Academy.
2. Crear RDS **PostgreSQL 18** independiente del entorno Beanstalk, con cifrado, backups automáticos, retención de al menos 7 días y protección contra eliminación. Para producción con necesidad de disponibilidad, elegir Multi-AZ. No asociar su borrado al del entorno de aplicación.
3. Usar una VPC con al menos dos subredes para RDS/ALB. Mantener RDS privado. Su security group admite 5432 únicamente desde el security group de las instancias de aplicación y el acceso administrativo temporal necesario.
4. Crear un entorno web Beanstalk Docker AL2023, **Load balanced / Application Load Balancer**, con mínimo y máximo 1 instancia. Como punto de partida para compilar las tres imágenes en la máquina, usar x86_64 con 2 vCPU y 4 GiB RAM, por ejemplo `t3.medium`, y unos 30 GiB de disco; medir y ajustar. Esto es un punto de partida, no una garantía de capacidad ni de precio.
5. El security group de las instancias permite puerto 80 **solo desde el ALB**. El ALB publica HTTPS 443. Redirigir HTTP 80 a HTTPS. No abrir 4000, 8000, 5432 o 6379 a Internet. Esta topología corresponde a `TRUST_PROXY_HOPS=2` (ALB + nginx).
6. Las instancias necesitan salida HTTPS a los registros de contenedores, npm, PyPI, fuentes de Google y Gemini. En subredes privadas se necesita una ruta de salida, habitualmente NAT; contabilizar ese costo. No basta un endpoint privado de AWS para acceder a Gemini.
7. Crear los roles de servicio y perfil EC2 que pide Beanstalk. Si se usan referencias a Secrets Manager, autorizar al perfil a leer **solo** esos secretos y a descifrar la clave KMS correspondiente.
8. Solicitar en ACM un certificado para el dominio en la región del ALB, validarlo por DNS, asociarlo al listener 443 y apuntar el DNS al entorno/ALB. Configurar `CLIENT_URL` con el origen HTTPS exacto, sin `/api` ni barra final.

Durante la creación se puede desplegar primero la aplicación de ejemplo de Beanstalk para disponer del entorno y sus grupos de seguridad, completar RDS, variables y HTTPS, y luego subir el ZIP MoneyMindV.

## Inicializar RDS, una sola vez

Hacerlo desde una estación o entorno administrativo autorizado que alcance la VPC, con `psql` 18 y los archivos del ZIP. No hacer RDS público para importar. Crear previamente una base vacía `moneymind` y un rol de aplicación `moneymind_app` con contraseña propia. El rol administrativo aplica el esquema; la aplicación no necesita la cuenta maestra.

Ejemplo de restauración (psql solicita la contraseña; no escribirla en el comando):

```bash
psql "host=RDS_ENDPOINT dbname=moneymind user=RDS_ADMIN sslmode=verify-full sslrootcert=api/certs/rds-global-bundle.pem" -W -v ON_ERROR_STOP=1 --single-transaction -f deploy/db/001-schema.sql
psql "host=RDS_ENDPOINT dbname=moneymind user=RDS_ADMIN sslmode=verify-full sslrootcert=api/certs/rds-global-bundle.pem" -W -v ON_ERROR_STOP=1 -f deploy/db/002-catalogs.sql
```

El esquema requiere las extensiones `btree_gist`, `citext` y `pgcrypto`; la cuenta administrativa debe poder crearlas. La plantilla ya incorpora las migraciones de agentes y roles existentes al exportarla. No volver a importar `001-schema.sql` sobre una base existente.

En una sesión administrativa de psql conectada a `moneymind`, dar al rol de aplicación los permisos necesarios:

```sql
GRANT CONNECT ON DATABASE moneymind TO moneymind_app;
GRANT USAGE ON SCHEMA public TO moneymind_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO moneymind_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO moneymind_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO moneymind_app;
```

Las migraciones futuras se ejecutan con el rol propietario/administrador, antes de desplegar código dependiente de ellas. Revisar y conceder permisos para los nuevos objetos. Probar primero en una base de ensayo y tomar un snapshot antes de cambios de esquema.

## Variables de Beanstalk

Usar `deploy/aws.env.example` como inventario. Configurar valores desde Beanstalk; para secretos, preferir referencias a Secrets Manager. La plataforma Docker debe soportar referencias a secretos (versiones publicadas desde el 26 de marzo de 2025). No subir archivos `.env` ni enviar claves por chat.

| Variable | Valor |
| --- | --- |
| `CLIENT_URL` | `https://app.su-dominio.com` |
| `DATABASE_URL` | URI PostgreSQL del rol de aplicación y endpoint RDS; codificar caracteres especiales de usuario/contraseña en la URI |
| `DB_SSL` | `true`; el contenedor ya incluye la CA oficial |
| `JWT_ACCESS_SECRET` | Secreto aleatorio de al menos 32 caracteres |
| `AI_SERVICE_TOKEN` | Otro secreto aleatorio de al menos 32 caracteres; Compose lo comparte solo entre Node y FastAPI |
| `GEMINI_API_KEY` | Clave de Gemini válida; sin ella solo funcionan los análisis locales |
| `GEMINI_MODEL` | Modelo habilitado en su proyecto; configuración actual `gemini-3.5-flash-lite` |
| `REDIS_URL` | `redis://redis:6379` para la instancia inicial; usar `rediss://...` si se migra a ElastiCache con TLS |
| `TRUST_PROXY_HOPS` | `2` con ALB + nginx y acceso directo a instancias bloqueado |
| `EMAIL_USER`, `EMAIL_PASS` | Opcionales, cuenta Gmail y contraseña de aplicación para el newsletter |

No agregar `sslmode`, `sslcert`, `sslkey` o `sslrootcert` a `DATABASE_URL`: pueden sobrescribir la configuración TLS de node-postgres. Se utiliza `DB_SSL=true` y `DB_SSL_CA_FILE` dentro del contenedor. Nunca configurar `rejectUnauthorized=false` para RDS.

Cambiar secretos requiere aplicar la configuración/recrear los contenedores. La configuración de desarrollo que relee `.env` no aplica en producción. Los scripts `.platform` adaptan el escape de dólares que hace Beanstalk en su archivo de entorno para Docker Compose. Preferir secretos aleatorios hexadecimales y contraseñas codificadas en la URI.

## Generar y subir el ZIP

```powershell
./ai-service/.venv/Scripts/python.exe deploy/package-aws.py
```

El script guarda el ZIP y su SHA-256 en `artifacts/aws/`. Usa una lista explícita de archivos, verifica el ZIP, incluye un manifiesto y rechaza patrones de claves y secretos locales conocidos. No comprimir manualmente toda la carpeta de trabajo.

En Beanstalk: entorno → **Upload and deploy** → seleccionar el ZIP → asignar una versión identificable. Se construirán las imágenes Linux desde sus lockfiles. No subir `compose.local.yml` como configuración principal: el archivo raíz que usa AWS es `docker-compose.yml`, sin PostgreSQL en contenedor.

## Comprobaciones después del despliegue

1. Abrir `/health`: debe responder 200 con PostgreSQL y Redis disponibles. `/healthz` solo verifica nginx; no usarlo como prueba completa.
2. Abrir y recargar directamente `/assistant`, `/dashboard` y `/admin/login`; nginx debe devolver Angular en rutas internas.
3. Registrar una cuenta de prueba, iniciar sesión y comprobar categorías y planes. La plantilla no contiene ninguna cuenta ni administrador.
4. Ejecutar un análisis local y enviar una pregunta al chat. `/v1/status` solo indica configuración; una respuesta real verifica también Gemini. Hacer esta prueba una vez para controlar consumo.
5. Verificar que otra cuenta no vea sus movimientos, y que un usuario normal no tenga acceso al panel administrativo.
6. Habilitar una cuenta autorizada como administrador desde el contenedor API: `node scripts/set-superuser.js correo@ejemplo.com`. La cuenta debe existir y estar activa. El comando no cambia su contraseña.
7. Probar el correo si se configura. Los pagos actuales son registros manuales/simulaciones según `docs/pagos-yape.md`; subir a AWS no activa una pasarela ni confirma pagos automáticamente.

Si falla: revisar los eventos y logs de Beanstalk y los logs de Compose. `docker compose logs --tail=100 api agents` permite distinguir fallos de RDS, Redis, token privado y Gemini. No pegar volcados de variables ni credenciales en tickets. Esta configuración usa salud básica de Beanstalk; habilitar salud mejorada requiere preparar los logs `healthd` de nginx antes de cambiar ese modo.

## Actualizaciones, respaldo y costos

Conservar el ZIP anterior y su versión de Beanstalk. Para revertir código, desplegar esa versión; una reversión de aplicación no revierte la base. Mantener migraciones compatibles cuando convivan versiones. Una única instancia puede interrumpir solicitudes durante un despliegue.

RDS guarda los datos persistentes. Verificar backups y probar una restauración en otra instancia antes de depender de ellos. No trasladar PostgreSQL al contenedor de Beanstalk: reemplazar una instancia podría destruir el almacenamiento local.

Beanstalk no tiene recargo propio, pero se cobran EC2, ALB, RDS, discos, IPv4, salida de datos y, si se utilizan, NAT, Secrets Manager, logs y ElastiCache; Gemini factura por separado. No se presupone que la cuenta tenga créditos o capa gratuita. Calcular con región y tamaño reales en [AWS Pricing Calculator](https://calculator.aws/).

Para terminar una demo, revisar también los recursos independientes: borrar el entorno no necesariamente elimina RDS, snapshots, NAT, secretos o volúmenes. Conservar/exportar datos antes de eliminar recursos persistentes.

## Referencias oficiales

- [ZIP y Docker Compose en Beanstalk](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/docker-compose-quickstart.html)
- [Formato del paquete fuente](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/applications-sourcebundle.html)
- [Variables, secretos y proxy de Docker](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/create_deploy_docker.container.console.html)
- [RDS separado de Beanstalk](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/AWSHowTo.RDS.html)
- [TLS y certificados públicos de RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html)
- [Configuración TLS de node-postgres](https://node-postgres.com/features/ssl)
- [Costos de los recursos usados por Beanstalk](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/GettingStarted.html)
