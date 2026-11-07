# MoneyMindV

## Desplegar en AWS

La [guía de despliegue](docs/aws-deployment.md) describe el ZIP para Elastic Beanstalk Docker, PostgreSQL en RDS, variables, HTTPS y pruebas locales. Genera el paquete sin secretos con `./ai-service/.venv/Scripts/python.exe deploy/package-aws.py`; se guarda en `artifacts/aws/`.

## Iniciar el entorno local

Con PostgreSQL y Redis disponibles y las dependencias instaladas, ejecuta desde la raíz:

```powershell
./start-dev.ps1
```

Inicia el servicio de agentes Python, la API y Angular en segundo plano; reutiliza los servicios que ya responden. Abre http://localhost:4200. Los registros quedan en `artifacts/`. Ejecuta el comando cada vez que reinicies el equipo; no instala servicios de Windows.

La preparación inicial y la configuración privada de Gemini están en [ai-service/README.md](ai-service/README.md). El chat necesita los tres procesos en funcionamiento; iniciar solo Angular y Node deja el asistente sin conexión.

## Presupuestos

Cada categoría admite un único presupuesto activo para fechas que se crucen, incluyendo los días de inicio y fin. Para objetivos distintos en las mismas fechas, utiliza categorías distintas. El formulario indica qué presupuesto entra en conflicto antes de guardar.
