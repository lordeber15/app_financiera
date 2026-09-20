"""Cálculo de presupuestos por categoría y disparo de alertas de umbral.

Cada vez que se registra un gasto, `check_category_budget` recalcula cuánto se
lleva gastado en el mes para esa categoría y, si se cruzó un umbral (80%, 100%,
...) que no se había notificado aún ese mes, envía el evento `budget.threshold`
y deja constancia en `budget_alerts_sent` para no repetirlo.
"""

from datetime import date
from calendar import monthrange

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.budget_alert import BudgetAlertSent
from app.models.category import Category
from app.models.expense import Expense
from app.models.settings import AppSettings
from app.services import webhook


def month_bounds(year: int, month: int) -> tuple[date, date]:
    last_day = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def category_month_total_cents(db: Session, category_id: int, year: int, month: int) -> int:
    start, end = month_bounds(year, month)
    total = db.scalar(
        select(func.coalesce(func.sum(Expense.amount_cents), 0)).where(
            Expense.category_id == category_id,
            Expense.spent_at >= start,
            Expense.spent_at <= end,
        )
    )
    return int(total or 0)


def check_category_budget(db: Session, settings: AppSettings, category: Category, spent_at: date) -> None:
    if not category.monthly_budget_cents or category.monthly_budget_cents <= 0:
        return

    period = f"{spent_at.year:04d}-{spent_at.month:02d}"
    total_cents = category_month_total_cents(db, category.id, spent_at.year, spent_at.month)
    pct = (total_cents / category.monthly_budget_cents) * 100

    for threshold in sorted(settings.threshold_list):
        if pct < threshold:
            continue

        alert = BudgetAlertSent(category_id=category.id, period=period, threshold_pct=threshold)
        db.add(alert)
        try:
            db.commit()
        except IntegrityError:
            # Ya se había enviado esta alerta para este mes y umbral.
            db.rollback()
            continue

        if settings.notify_budget:
            webhook.send_event(
                db,
                settings,
                event="budget.threshold",
                data={
                    "category": {"id": category.id, "name": category.name},
                    "period": period,
                    "threshold_pct": threshold,
                    "spent_cents": total_cents,
                    "budget_cents": category.monthly_budget_cents,
                },
            )
