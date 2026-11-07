from datetime import date
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

AgentName = Literal['habits', 'anomalies', 'budgets', 'projection', 'recommendations']
Money = Annotated[Decimal, Field(allow_inf_nan=False, max_digits=20, decimal_places=2)]
PositiveMoney = Annotated[Money, Field(ge=0)]
Currency = Annotated[str, Field(pattern=r'^[A-Z]{3}$')]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


class Total(StrictModel):
    currency: Currency
    recorded_balance: Money
    month_income: PositiveMoney
    month_expense: PositiveMoney
    variable_expense: PositiveMoney = Decimal('0')
    scheduled_income: PositiveMoney = Decimal('0')
    scheduled_expense: PositiveMoney = Decimal('0')


class Spending(StrictModel):
    category: str
    currency: Currency
    current_amount: PositiveMoney
    previous_amount: PositiveMoney
    movements: int = Field(ge=0)


class Expense(StrictModel):
    id: str
    category: str
    currency: Currency
    amount: PositiveMoney
    transaction_date: date
    baseline_count: int = Field(ge=0)
    baseline_mean: Decimal = Field(ge=0, allow_inf_nan=False)
    baseline_stddev: Decimal = Field(ge=0, allow_inf_nan=False)


class Budget(StrictModel):
    id: str
    name: str
    currency: Currency
    amount: PositiveMoney
    spent: PositiveMoney
    period_start: date
    period_end: date


class Installment(StrictModel):
    id: str
    name: str
    currency: Currency
    due_date: date
    pending_amount: PositiveMoney


class Recurring(StrictModel):
    id: str
    type: Literal['INCOME', 'EXPENSE']
    currency: Currency
    amount: PositiveMoney
    frequency: Literal['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']
    interval_count: int = Field(ge=1, le=32767)
    day_of_month: int | None = Field(default=None, ge=1, le=31)
    start_date: date
    end_date: date | None = None
    next_occurrence_date: date
    recorded_dates: list[date] = Field(default_factory=list, max_length=366)


class Snapshot(StrictModel):
    today: date
    currency: Currency
    totals: list[Total] = Field(default_factory=list, max_length=100)
    spending: list[Spending] = Field(default_factory=list, max_length=501)
    expenses: list[Expense] = Field(default_factory=list, max_length=201)
    budgets: list[Budget] = Field(default_factory=list, max_length=201)
    installments: list[Installment] = Field(default_factory=list, max_length=501)
    recurring: list[Recurring] = Field(default_factory=list, max_length=201)
    truncated: list[str] = Field(default_factory=list)
    budget_threshold: Decimal = Field(default=Decimal('80'), ge=0, le=100, allow_inf_nan=False)


class AnalysisRequest(StrictModel):
    context: Snapshot
    agents: list[AgentName] = Field(default_factory=lambda: ['habits', 'anomalies', 'budgets', 'projection', 'recommendations'], min_length=1, max_length=5)


class Finding(StrictModel):
    key: str
    type: Literal['OBLIGATION_DUE', 'BUDGET_THRESHOLD', 'BUDGET_EXCEEDED', 'UNUSUAL_SPENDING', 'LOW_PROJECTED_BALANCE']
    severity: Literal['INFO', 'WARNING', 'CRITICAL']
    origin: Literal['rule', 'analysis']
    title: str
    message: str
    currency: Currency
    entity_id: str | None = None
    evidence: dict[str, Any] = Field(default_factory=dict)


class AgentResult(StrictModel):
    agent: AgentName
    summary: str
    tools: list[str]
    metrics: dict[str, Any] = Field(default_factory=dict)
    findings: list[Finding] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


class AnalysisResponse(StrictModel):
    as_of: date
    results: list[AgentResult]
    content: str
    model: str = 'moneymind-agents-v1'
    tokensInput: int = 0
    tokensOutput: int = 0
    latencyMs: int = 0


class Turn(StrictModel):
    role: Literal['USER', 'ASSISTANT']
    content: str = Field(max_length=20000)


class ChatRequest(AnalysisRequest):
    message: str = Field(min_length=1, max_length=4000)
    history: list[Turn] = Field(default_factory=list, max_length=20)


class ChatResponse(StrictModel):
    content: str
    model: str
    tokensInput: int
    tokensOutput: int
    latencyMs: int
    analysis: AnalysisResponse
