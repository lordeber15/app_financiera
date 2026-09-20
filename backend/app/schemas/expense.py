from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.category import CategoryOut


class ExpenseBase(BaseModel):
    amount_cents: int = Field(gt=0)
    category_id: int
    description: str | None = Field(default=None, max_length=255)
    spent_at: date


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    amount_cents: int | None = Field(default=None, gt=0)
    category_id: int | None = None
    description: str | None = Field(default=None, max_length=255)
    spent_at: date | None = None


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount_cents: int
    description: str | None
    spent_at: date
    category: CategoryOut


class ExpensePage(BaseModel):
    items: list[ExpenseOut]
    total: int
    page: int
    page_size: int
