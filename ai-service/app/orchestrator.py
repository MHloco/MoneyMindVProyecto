from time import perf_counter

from .agents import habits, anomalies, budgets, recommendations
from .schemas import AnalysisRequest, AnalysisResponse
from .tools import FinancialTools

REGISTRY = {'habits': habits.run, 'anomalies': anomalies.run, 'budgets': budgets.run,
            'projection': lambda tools: tools.get_financial_projection()}
LABELS = {'habits': 'HÁBITOS', 'anomalies': 'ANOMALÍAS', 'budgets': 'PRESUPUESTOS',
          'projection': 'PROYECCIÓN', 'recommendations': 'RECOMENDACIONES'}


def describe(result):
    lines = [LABELS[result.agent], result.summary]
    if result.agent == 'habits':
        for row in result.metrics['categories'][:10]:
            change = f"Cambio: {row['change_percent']}%." if row['change_percent'] is not None else 'Sin base previa comparable.'
            lines.append(f"• {row['category']}: {row['spent']} {row['currency']}. {change}")
    elif result.agent == 'budgets':
        for row in result.metrics['budgets'][:10]:
            lines.append(f"• {row['name']}: gastado {row['spent']} de {row['amount']} {row['currency']}; restante {row['remaining']}; estimación al cierre {row['estimated_period_spend']}.")
    elif result.agent == 'projection':
        for row in result.metrics['currencies']:
            lines.append(f"• {row['currency']}: saldo registrado {row['recorded_balance']}; ingresos programados {row['scheduled_income']}; gastos programados {row['scheduled_expense']}; cuotas pendientes {row['pending_obligations']}; gasto variable estimado {row['estimated_variable_expense']}.")
    for finding in result.findings[:10]:
        origin = 'Regla' if finding.origin == 'rule' else 'Análisis'
        lines.append(f'• {origin}: {finding.message}')
    if len(result.findings) > 10:
        lines.append('Se muestran los primeros 10 avisos. Consulta Alertas para ver los avisos guardados según tus preferencias.')
    lines += result.limitations
    return '\n'.join(lines)


def analyze(request: AnalysisRequest) -> AnalysisResponse:
    started = perf_counter()
    tools = FinancialTools(request.context)
    selected = set(request.agents)
    required = set(REGISTRY) if 'recommendations' in selected else selected
    results = [agent(tools) for name, agent in REGISTRY.items() if name in required]
    if 'recommendations' in selected:
        results.append(recommendations.run(results))
    for result in results:
        if request.context.truncated:
            result.limitations.append('Análisis parcial: se alcanzó el límite de datos en ' + ', '.join(request.context.truncated) + '.')
    return AnalysisResponse(as_of=request.context.today, results=results,
        content='\n\n'.join(describe(r) for r in results),
        latencyMs=round((perf_counter() - started) * 1000))
