from pydantic import BaseModel, ConfigDict, Field


class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str = "#6366f1"
    icon: str = "tag"
    monthly_budget_cents: int | None = Field(default=None, ge=0)


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    color: str | None = None
    icon: str | None = None
    monthly_budget_cents: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class CategoryOut(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
