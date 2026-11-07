# Asistente IA y agentes financieros

La implementación sigue Angular → Node.js → FastAPI/Python. Node conserva JWT, PostgreSQL, historial y límites del plan. ai-service ejecuta hábitos, anomalías, presupuestos, proyección y recomendaciones según chatgpt.md.

Consulta [la guía de ai-service](../ai-service/README.md) para configuración, herramientas, fórmulas, API, alertas y pruebas.

## Uso

1. Inicia FastAPI con ./ai-service/start.ps1 desde la raíz.
2. Inicia o reinicia Node con node server.js desde api.
3. Abre Asistente IA en Angular, selecciona un agente o los cinco y pulsa Analizar mis finanzas.
4. El informe aparece en el historial y los avisos se guardan en Alertas.
5. Para preguntas libres configura GEMINI_API_KEY y GEMINI_MODEL en ai-service/.env.

Los análisis usan reglas y estadísticas verificables y funcionan sin Gemini. El chat usa Gemini para explicar los informes. Cada operación exitosa consume una consulta del plan; los fallos no consumen consultas.

## Cambios frente al chat anterior

- La conexión activa con Gemini se trasladó a Python. api/services/gemini.services.js se conserva como implementación anterior, pero ya no se usa por defecto.
- node api/scripts/configure-ai-service.js prepara el token privado compartido y copia la configuración de Gemini sin mostrar claves. Después, edita el proveedor en ai-service/.env.
- Se reutilizan ai_conversations, ai_messages y ai_usage. El informe se almacena en ai_messages.tool_calls.
- api/migrations/20261005_agent_alerts.sql agrega un índice para impedir avisos duplicados. Ya se aplicó en la base local.
- Las alertas indican si provienen de reglas financieras o detecciones por análisis.

Se calcula al pulsar analizar o enviar una consulta. No hay un planificador periódico instalado. Los importes estimados y sus limitaciones se identifican en cada informe.
