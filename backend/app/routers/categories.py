from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_auth
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(
    prefix="/categories", tags=["categories"], dependencies=[Depends(require_auth)]
)


@router.get("", response_model=list[CategoryOut])
def list_categories(include_inactive: bool = False, db: Session = Depends(get_db)):
    stmt = select(Category)
    if not include_inactive:
        stmt = stmt.where(Category.is_active.is_(True))
    stmt = stmt.order_by(Category.name)
    return db.scalars(stmt).all()


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(Category).where(Category.name == body.name))
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe una categoría con ese nombre")
    category = Category(**body.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, body: CategoryUpdate, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    if category.expenses:
        # No borramos físicamente para no perder el historial de gastos asociados.
        category.is_active = False
        db.commit()
        return
    db.delete(category)
    db.commit()
