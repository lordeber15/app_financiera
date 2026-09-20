from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_auth
from app.models.category import Category
from app.models.expense import Expense
from app.schemas.report import CategoryTotal, MonthReport
from app.services import budgets

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(require_auth)])


@router.get("/month", response_model=MonthReport)
def month_report(month: str = Query(..., description="YYYY-MM"), db: Session = Depends(get_db)):
    try:
        year_str, month_str = month.split("-")
        year, month_num = int(year_str), int(month_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de mes inválido, usa YYYY-MM")

    start, end = budgets.month_bounds(year, month_num)

    rows = db.execute(
        select(
            Category.id,
            Category.name,
            Category.color,
            Category.icon,
            Category.monthly_budget_cents,
            func.coalesce(func.sum(Expense.amount_cents), 0).label("total"),
        )
        .join(Expense, Expense.category_id == Category.id, isouter=True)
        .where((Expense.spent_at.is_(None)) | ((Expense.spent_at >= start) & (Expense.spent_at <= end)))
        .where(Category.is_active.is_(True))
        .group_by(Category.id)
        .order_by(Category.name)
    ).all()

    by_category = [
        CategoryTotal(
            category_id=r.id,
            name=r.name,
            color=r.color,
            icon=r.icon,
            total_cents=int(r.total or 0),
            budget_cents=r.monthly_budget_cents,
            pct=round((r.total / r.monthly_budget_cents) * 100, 1) if r.monthly_budget_cents else None,
        )
        for r in rows
    ]

    total_cents = sum(c.total_cents for c in by_category)

    return MonthReport(month=month, total_cents=total_cents, by_category=by_category)
