# Agentes financieros MoneyMindV

Implementación de las secciones 15–20 de `../chatgpt.md`.

```text
Angular /assistant → Node /api/assistant → FastAPI 127.0.0.1:8000
                         ↓                     ↓
                    PostgreSQL           5 agentes → Gemini (chat)
```

Node autentica el JWT, comprueba cuenta y plan, obtiene datos mediante consultas fijas por usuario y llama al servicio privado. Python no recibe emails, un selector `user_id` ni credenciales de PostgreSQL. Los agentes usan herramientas de solo lectura sobre datos autorizados. Gemini recibe informes resumidos, no las transacciones crudas ni sus identificadores.

## Inicio local (PowerShell)

Desde la raíz del proyecto, la primera vez:

```powershell
python -m venv ai-service/.venv
ai-service/.venv/Scripts/python.exe -m pip install -r ai-service/requirements.lock
node api/scripts/configure-ai-service.js
```

El entorno `.venv` y las variables privadas ya están preparados en esta instalación. En otra máquina usa Python 3.12 o superior. El script conserva las variables existentes, crea un token compartido y copia la configuración Gemini de `api/.env` a `ai-service/.env` sin imprimir claves. Después, administra el proveedor en `ai-service/.env`.

Puedes iniciar los tres servicios juntos desde la raíz con `./start-dev.ps1`. El comando reutiliza los que ya están disponibles y guarda los registros en `artifacts/`.

Para iniciarlos por separado, abre tres terminales:

```powershell
# Terminal 1, desde la raíz
./ai-service/start.ps1

# Terminal 2
cd api
node server.js

# Terminal 3
cd client
npm.cmd start
```

Ve a **Asistente IA → Análisis de tus finanzas**, elige un agente o los cinco y pulsa **Analizar mis finanzas**. Se guarda una conversación y se consume una consulta mensual. Los avisos aparecen en **Alertas**. Los análisis locales funcionan sin Gemini; las preguntas libres del chat necesitan Gemini.

| Archivo | Variables |
| --- | --- |
| `api/.env` | `AI_SERVICE_URL=http://127.0.0.1:8000`, `AI_SERVICE_TOKEN` (mínimo 32 caracteres) |
| `ai-service/.env` | Mismo `AI_SERVICE_TOKEN`, `GEMINI_API_KEY`, `GEMINI_MODEL` |

No publiques el puerto 8000 ni el token en Angular. Para servicios separados usa una red privada con HTTPS. En producción usa variables de proceso y reinicia al cambiarlas.

## Agentes y herramientas

| Agente | Trabajo |
| --- | --- |
| `habits` | Distribución por categoría/moneda, comparación con los mismos días del mes anterior, ingresos y gastos. |
| `anomalies` | Gastos de los últimos 30 días contra los 90 días anteriores a cada movimiento. Mínimo cinco antecedentes de la misma categoría/moneda; umbral máximo entre dos veces la media y media + tres desviaciones. Señal estadística, no prueba de fraude. |
| `budgets` | Consumo, porcentaje, disponible, exceso y estimación al cierre de cada presupuesto vigente. |
| `projection` | Saldo registrado, ingresos/gastos programados, cuotas pendientes y gasto variable estimado al fin del mes. |
| `recommendations` | Combina los otros cuatro agentes y prioriza acciones de organización. Gemini explica los informes en el chat. |

`app/tools.py` implementa las herramientas controladas; `api/services/agent-context.js` obtiene sus datos mediante consultas parametrizadas por usuario. Cada agente carga solo sus datos necesarios; recomendaciones necesita las cuatro especialidades.

### Cálculos y límites

- Importes con `Decimal`, separados por moneda, sin conversión de divisas.
- Saldo registrado = ingresos menos gastos históricos hasta hoy. No verifica cuentas bancarias ni efectivo inicial no registrado.
- Proyección = saldo registrado + ingresos programados − gastos programados − cuotas pendientes − gasto variable estimado restante. Los gastos ya realizados no se restan dos veces.
- Recurrencias diarias, semanales, quincenales, mensuales, bimestrales, trimestrales, semestrales y anuales, respetando intervalo, finalización y años bisiestos. Se excluyen fechas con transacciones ya vinculadas a la recurrencia.
- Recurrencias atrasadas: se proyectan desde hoy y se advierte la limitación; no se inventan pagos atrasados.
- La estimación variable extrapola el mes, excluyendo vínculos conocidos a recurrencias/cuotas. Pagos manuales o parciales antiguos sin vínculo completo pueden afectar esa estimación.
- Los presupuestos de categorías distintas pueden superponerse y no se suman como gastos. La base de datos impide fechas superpuestas entre presupuestos activos de la misma categoría. Cuotas y recurrencias se consideran compromisos distintos: registrar manualmente el mismo pago en ambas puede sobreestimar gastos programados.
- Límites: 200 movimientos candidatos, 200 presupuestos, 500 cuotas, 200 recurrencias y 500 categorías. Los totales se agregan sobre el historial completo. Si se truncan listas, el informe dice que es parcial y no genera alertas nuevas.
- Cada informe es una fotografía de su fecha. Ejecuta otro después de modificar tus datos. No hay un proceso periódico instalado.

## API

```http
POST /api/assistant/analysis
Authorization: Bearer <JWT del usuario>
Content-Type: application/json

{"agent":"all"}
```

Admite `all`, `habits`, `anomalies`, `budgets`, `projection`, `recommendations`. Rechaza IDs de usuario, SQL o contextos enviados por el navegador. Devuelve conversación, mensajes, consumo, informe estructurado y `alertsCreated`.

El chat conserva `POST /api/assistant/messages` con `{message, conversationId?}`. Ambas operaciones aplican bloqueo por cuenta, límite del plan, máximo de 10 respuestas exitosas/minuto e historial privado. Los fallos revierten consumo y escrituras.

FastAPI: `GET /health` es público; `GET /v1/status`, `POST /v1/analyze` y `POST /v1/chat` requieren el token privado. `/docs` muestra el contrato OpenAPI.

## PostgreSQL y alertas

Se reutilizan `ai_conversations`, `ai_messages.tool_calls`, `ai_usage`, `alerts` y `alert_preferences`; no se necesita otra tabla. Los informes se almacenan en `ai_messages.tool_calls`.

`api/migrations/20261005_agent_alerts.sql` agrega un índice único por usuario/aviso. Ya está aplicado en la base local y puede ejecutarse otra vez sin duplicarlo.

Los avisos respetan `is_enabled`, canal `IN_APP`, `days_before` (3 por defecto) y `threshold` (80% por defecto; admite 0.8 o 80). Conservan estados leídos/descartados y no duplican el mismo aviso. Las alertas existentes conservan el importe y fecha del análisis original.

`metadata.origin=rule`: cuotas y umbrales reales; `analysis`: anomalías y proyecciones estimadas. Solo hallazgos estructurados crean alertas; el texto de Gemini no ejecuta acciones. No se envían correos ni se efectúan pagos.

## Pruebas

```powershell
cd ai-service
./.venv/Scripts/python.exe -m pytest -q

# Con FastAPI iniciado, desde api:
$env:RUN_AI_TESTS='1'
node --env-file=.env --test --test-isolation=none services/agents.integration.test.js
$env:RUN_DB_TESTS='1'
node --env-file=.env --test --test-isolation=none services/assistant.integration.test.js
```

Las integraciones crean cuentas sintéticas en una transacción que se revierte al finalizar y no consumen Gemini.

Referencias: [seguridad FastAPI](https://fastapi.tiangolo.com/tutorial/security/first-steps/) y [campos Pydantic](https://docs.pydantic.dev/latest/concepts/fields/).
