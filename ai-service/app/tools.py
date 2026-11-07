"""Read-only financial tools. No SQL, network, user IDs or model-supplied selectors."""
from .schemas import Snapshot


class FinancialTools:
    def __init__(self, snapshot: Snapshot):
        self.snapshot = snapshot

    def get_current_balance(self):
        return self.snapshot.totals

    def get_month_income(self):
        return {row.currency: row.month_income for row in self.snapshot.totals}

    def get_month_expenses(self):
        return {row.currency: row.month_expense for row in self.snapshot.totals}

    def get_spending_distribution(self):
        return self.snapshot.spending

    def get_expense_anomalies(self):
        return self.snapshot.expenses

    def get_active_budgets(self):
        return self.snapshot.budgets

    def get_upcoming_obligations(self):
        return self.snapshot.installments

    def get_recurring_expenses(self):
        # Includes scheduled income so the projection can report both separately.
        return self.snapshot.recurring

    def get_financial_projection(self):
        from .agents.projection import run
        return run(self)
