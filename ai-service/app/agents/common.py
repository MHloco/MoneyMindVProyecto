from decimal import Decimal, ROUND_HALF_UP


def money(value: Decimal) -> str:
    return str(value.quantize(Decimal('.01'), rounding=ROUND_HALF_UP))


def percent(value: Decimal, total: Decimal) -> str | None:
    return money(value / total * 100) if total else None
