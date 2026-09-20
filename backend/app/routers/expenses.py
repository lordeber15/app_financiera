from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import SessionLocal, get_db
from app.core.security import require_auth
from app.core.settings_store import get_or_create_settings
from app.models.category import Category
from app.models.expense import Expense
from app.schemas.expense import ExpenseCreate, ExpenseOut, ExpensePage, ExpenseUpdate
from app.services import budgets, webhook

router = APIRouter(prefix="/expenses", tags=["expenses"], dependencies=[Depends(require_auth)])


def _month_range(month: str) -> tuple[date, date]:
    year_str, month_str = month.split("-")
    year, month_num = int(year_str), int(month_str)
    start, end = budgets.month_bounds(year, month_num)
    return start, end


# --- Tareas en segundo plano -------------------------------------------------
# Importante: BackgroundTasks corre DESPUÉS de que la dependencia `get_db` ya
# cerró la sesión de la request (el cleanup de una dependencia con `yield`
# ocurre antes de que la respuesta se envíe, y las background tasks corren
# después de enviarla). Por eso cada tarea abre su PROPIA sesión y no reutiliza
# la `db` de la request.


def _notify_expense_created(expense_id: int) -> None:
    db = SessionLocal()
    try:
        expense = db.get(Expense, expense_id)
        if not expense:
            return
        settings = get_or_create_settings(db)
        if not settings.notify_expense:
            return
        category = expense.category
        month_total = budgets.category_month_total_cents(
            db, category.id, expense.spent_at.year, expense.spent_at.month
        )
        pct = (
            round((month_total / category.monthly_budget_cents) * 100, 1)
            if category.monthly_budget_cents
            else None
        )
        webhook.send_event(
            db,
            settings,
            "expense.created",
            {
                "id": expense.id,
                "amount_cents": expense.amount_cents,
                "category": {"id": category.id, "name": category.name},
                "description": expense.description,
                "spent_at": expense.spent_at.isoformat(),
                "category_month_total_cents": month_total,
                "category_budget_cents": category.monthly_budget_cents,
                "category_pct": pct,
            },
        )
    finally:
        db.close()


def _check_budget_after_expense(category_id: int, spent_at: date) -> None:
    db = SessionLocal()
    try:
        category = db.get(Category, category_id)
        if not category:
            return
        settings = get_or_create_settings(db)
        budgets.check_category_budget(db, settings, category, spent_at)
    finally:
        db.close()


@router.get("", response_model=ExpensePage)
def list_expenses(
    month: str | None = Query(default=None, description="YYYY-MM"),
    category_id: int | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    stmt = select(Expense)
    count_stmt = select(func.count()).select_from(Expense)

    if month:
        try:
            start, end = _month_range(month)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de mes inválido, usa YYYY-MM")
        stmt = stmt.where(Expense.spent_at >= start, Expense.spent_at <= end)
        count_stmt = count_stmt.where(Expense.spent_at >= start, Expense.spent_at <= end)

    if category_id:
        stmt = stmt.where(Expense.category_id == category_id)
        count_stmt = count_stmt.where(Expense.category_id == category_id)

    total = db.scalar(count_stmt) or 0
    stmt = stmt.order_by(Expense.spent_at.desc(), Expense.id.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    items = db.scalars(stmt).all()

    return ExpensePage(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=ExpenseOut, status_code=201)
def create_expense(body: ExpenseCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    category = db.get(Category, body.category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    expense = Expense(**body.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)

    background_tasks.add_task(_notify_expense_created, expense.id)
    background_tasks.add_task(_check_budget_after_expense, category.id, expense.spent_at)

    return expense


@router.patch("/{expense_id}", response_model=ExpenseOut)
def update_expense(expense_id: int, body: ExpenseUpdate, db: Session = Depends(get_db)):
    expense = db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    data = body.model_dump(exclude_unset=True)
    if "category_id" in data:
        category = db.get(Category, data["category_id"])
        if not category:
            raise HTTPException(status_code=404, detail="Categoría no encontrada")

    for field, value in data.items():
        setattr(expense, field, value)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=204)
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    db.delete(expense)
    db.commit()
