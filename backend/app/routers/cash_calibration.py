from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_auth
from app.models.cash_calibration_sample import CashCalibrationSample
from app.schemas.cash_calibration_sample import CashCalibrationSampleCreate, CashCalibrationSampleOut

router = APIRouter(
    prefix="/cash-calibration", tags=["cash-calibration"], dependencies=[Depends(require_auth)]
)

MAX_SAMPLES_PER_DENOMINATION = 5


@router.get("/samples", response_model=list[CashCalibrationSampleOut])
def list_samples(db: Session = Depends(get_db)):
    stmt = select(CashCalibrationSample).order_by(CashCalibrationSample.captured_at)
    return db.scalars(stmt).all()


@router.post("/samples", response_model=CashCalibrationSampleOut, status_code=201)
def create_sample(body: CashCalibrationSampleCreate, db: Session = Depends(get_db)):
    sample = CashCalibrationSample(**body.model_dump())
    db.add(sample)
    db.commit()
    db.refresh(sample)

    # FIFO: como máximo MAX_SAMPLES_PER_DENOMINATION muestras por denominación,
    # sin importar desde qué dispositivo se calibró.
    overflow_stmt = (
        select(CashCalibrationSample)
        .where(CashCalibrationSample.denomination_cents == body.denomination_cents)
        .order_by(CashCalibrationSample.captured_at.desc())
        .offset(MAX_SAMPLES_PER_DENOMINATION)
    )
    for old_sample in db.scalars(overflow_stmt).all():
        db.delete(old_sample)
    db.commit()

    return sample


@router.delete("/samples/{denomination_cents}", status_code=204)
def reset_samples(denomination_cents: int, db: Session = Depends(get_db)):
    stmt = select(CashCalibrationSample).where(
        CashCalibrationSample.denomination_cents == denomination_cents
    )
    for sample in db.scalars(stmt).all():
        db.delete(sample)
    db.commit()
