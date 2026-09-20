"""Construcción de los resúmenes diario y semanal enviados al webhook."""

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.expense import Expense
from app.models.settings import AppSettings
from app.services import webhook

TOP_EXPENSES_LIMIT = 5


def _build_summary(db: Session, start: date, end: date) -> dict:
    total_cents = int(
        db.scalar(
            select(func.coalesce(func.sum(Expense.amount_cents), 0)).where(
                Expense.spent_at >= start, Expense.spent_at <= end
            )
        )
        or 0
    )

    rows = db.execute(
        select(
            Category.id,
            Category.name,
            Category.monthly_budget_cents,
            func.coalesce(func.sum(Expense.amount_cents), 0).label("total"),
        )
        .join(Expense, Expense.category_id == Category.id, isouter=True)
        .where(Expense.spent_at >= start, Expense.spent_at <= end)
        .group_by(Category.id)
        .order_by(func.sum(Expense.amount_cents).desc())
    ).all()

    by_category = [
        {
            "category_id": r.id,
            "name": r.name,
            "total_cents": int(r.total or 0),
            "budget_cents": r.monthly_budget_cents,
            "pct": round((r.total / r.monthly_budget_cents) * 100, 1) if r.monthly_budget_cents else None,
        }
        for r in rows
        if r.total
    ]

    top_expenses = db.execute(
        select(Expense).where(Expense.spent_at >= start, Expense.spent_at <= end).order_by(
            Expense.amount_cents.desc()
        ).limit(TOP_EXPENSES_LIMIT)
    ).scalars().all()

    return {
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "total_cents": total_cents,
        "by_category": by_category,
        "top_expenses": [
            {
                "id": e.id,
                "amount_cents": e.amount_cents,
                "description": e.description,
                "spent_at": e.spent_at.isoformat(),
                "category_id": e.category_id,
            }
            for e in top_expenses
        ],
    }


def send_daily_summary(db: Session, settings: AppSettings, today: date | None = None) -> None:
    if not settings.summary_daily_enabled:
        return
    day = today or date.today()
    data = _build_summary(db, day, day)
    webhook.send_event(db, settings, event="summary.daily", data=data)


def send_weekly_summary(db: Session, settings: AppSettings, today: date | None = None) -> None:
    if not settings.summary_weekly_enabled:
        return
    day = today or date.today()
    start = day - timedelta(days=6)
    data = _build_summary(db, start, day)
    webhook.send_event(db, settings, event="summary.weekly", data=data)
