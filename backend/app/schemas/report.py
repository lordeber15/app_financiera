from pydantic import BaseModel


class CategoryTotal(BaseModel):
    category_id: int
    name: str
    color: str
    icon: str
    total_cents: int
    budget_cents: int | None
    pct: float | None  # None si no hay presupuesto definido


class MonthReport(BaseModel):
    month: str  # "YYYY-MM"
    total_cents: int
    by_category: list[CategoryTotal]
