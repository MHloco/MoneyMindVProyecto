# MoneyMindV — Gestión financiera inteligente con IA

**MoneyMindV** es una aplicación web de gestión de finanzas personales que integra inteligencia artificial para ayudar a los usuarios a administrar sus ingresos, gastos, presupuestos y obligaciones financieras.

El proyecto busca ofrecer una visión clara de la situación económica del usuario mediante estadísticas, proyecciones, alertas y un asistente inteligente capaz de responder consultas relacionadas con sus finanzas.

## Funcionalidades principales

- **Dashboard financiero:** visualización de ingresos, gastos, balances y distribución de movimientos.
- **Gestión de transacciones:** registro, clasificación y consulta de ingresos y gastos.
- **Presupuestos:** creación de límites de gasto por categoría y periodo.
- **Obligaciones financieras:** seguimiento de compromisos y fechas de vencimiento.
- **Alertas inteligentes:** notificaciones sobre situaciones financieras relevantes.
- **Calendario financiero:** visualización de movimientos y obligaciones.
- **Asistente con IA:** consultas en lenguaje natural sobre información financiera, hábitos de gasto y recomendaciones.
- **Proyecciones:** estimaciones de la situación financiera futura a partir de los datos registrados.

## Tecnologías utilizadas

| Componente | Tecnologías |
|---|---|
| Frontend | Angular, TypeScript, Angular Material |
| Backend | Node.js, JavaScript |
| Servicio de IA | Python, FastAPI, Gemini API |
| Base de datos | PostgreSQL |
| Caché | Redis |
| Contenedores | Docker, Docker Compose |
| Infraestructura de despliegue | AWS Elastic Beanstalk, Amazon RDS |

## Arquitectura

MoneyMindV está organizado en tres servicios principales:

- **`client/`** — Interfaz de usuario desarrollada con Angular.
- **`api/`** — API encargada de autenticación, operaciones financieras y comunicación con los servicios.
- **`ai-service/`** — Servicio Python que procesa consultas y ejecuta herramientas de análisis financiero.

PostgreSQL almacena la información financiera y Redis proporciona capacidades de caché y soporte para operaciones del backend.

## Inteligencia artificial

El asistente financiero integra Gemini con herramientas desarrolladas en Python para consultar y analizar información del usuario.

Entre sus capacidades previstas e implementadas en el proyecto se encuentran el análisis de hábitos financieros, la detección de anomalías, las proyecciones y la generación de recomendaciones.

La integración con IA utiliza variables de entorno para configurar las credenciales, sin necesidad de incluir claves privadas en el repositorio.

## Instalación y ejecución

### Requisitos

- Node.js y npm
- Python
- PostgreSQL
- Redis

La aplicación requiere configurar las variables de entorno correspondientes a la base de datos, los servicios y la integración con Gemini.

Consulta la [documentación del servicio de IA](ai-service/README.md) para preparar su configuración.

El proyecto también contiene archivos Docker y Docker Compose para la configuración de sus servicios.

### Ejecución local en Windows

Con las dependencias y servicios configurados, ejecuta desde la raíz del proyecto:

```powershell
./start-dev.ps1
```

Este procedimiento requiere que el script exista en la versión descargada del proyecto.

La aplicación Angular utiliza la dirección:

`http://localhost:4200`

Para utilizar el asistente deben estar funcionando el frontend, la API y el servicio de IA.

## Despliegue en AWS

El proyecto incluye una [guía de despliegue](docs/aws-deployment.md) que documenta la preparación del paquete para Elastic Beanstalk, la integración con PostgreSQL en Amazon RDS y la configuración de los servicios.

## Estado del proyecto

Proyecto académico de desarrollo de software, orientado a demostrar la integración de aplicaciones web, servicios backend, bases de datos e inteligencia artificial.

## Autor

Desarrollado por [MHloco](https://github.com/MHloco).
