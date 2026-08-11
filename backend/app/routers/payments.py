"""
Dedicated Payment router with allocation support.

Replaces the generic CRUD entry for /api/v1/payments.
Every write validates allocations, recomputes invoice balances,
and ensures no partial commits.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from pydantic import BaseModel

from app.database import get_db
from app.deps import get_current_user
from app.models.payment import Payment
from app.models.payment_allocation import PaymentAllocation
from app.models.invoice import Invoice
from app.models.customer import Customer
from app.utils.helpers import (
    apply_company_filter, apply_scope_filter,
    paginate, get_next_code, serialize_row,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/payments", tags=["Payments"])

MODULE = "payment_accounts"


# ── Permission helper (same pattern as generic CRUD) ────────────────────
def _require_permissions(user=Depends(get_current_user)):
    if user.role in ("superadmin", "admin"):
        return user
    user_perms = user.permissions or []
    if "all" in user_perms or MODULE in user_perms:
        return user
    raise HTTPException(403, detail=f"Permission denied for module '{MODULE}'")


# ── Schemas ─────────────────────────────────────────────────────────────
class AllocationIn(BaseModel):
    invoice_id: int
    amount: float

class PaymentCreate(BaseModel):
    customer_id: int
    amount: float
    payment_mode: str
    payment_date: Optional[str] = None
    payment_account: Optional[str] = None
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    # Legacy field — kept for backward compat but ignored for allocation logic
    so_id: Optional[int] = None
    allocations: Optional[List[AllocationIn]] = None

    model_config = {"extra": "allow"}

class PaymentUpdate(BaseModel):
    amount: Optional[float] = None
    payment_mode: Optional[str] = None
    payment_date: Optional[str] = None
    payment_account: Optional[str] = None
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    so_id: Optional[int] = None
    allocations: Optional[List[AllocationIn]] = None

    model_config = {"extra": "allow"}


# ── Helpers ─────────────────────────────────────────────────────────────
def _recompute_invoice_balance(db: Session, invoice_id: int):
    """Recompute amount_paid and balance_due for a single invoice from allocations."""
    alloc_sum = (
        db.query(func.sum(PaymentAllocation.amount))
        .join(Payment, PaymentAllocation.payment_id == Payment.id)
        .filter(
            PaymentAllocation.invoice_id == invoice_id,
            PaymentAllocation.is_active == True,
            Payment.is_active == True,
        )
        .scalar()
    ) or 0.0

    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if inv:
        inv.amount_paid = round(float(alloc_sum), 2)
        inv.balance_due = round(float(inv.total_amount or 0) - float(alloc_sum), 2)
        if inv.balance_due <= 0:
            inv.status = "paid"
        elif inv.amount_paid > 0:
            inv.status = "partially_paid"
        else:
            inv.status = "unpaid"


def _validate_and_apply_allocations(
    db: Session,
    payment: Payment,
    allocations: List[AllocationIn],
    company_id: int,
):
    """
    Validate allocations for a payment and persist them.
    Returns the set of invoice_ids touched.
    """
    touched_invoice_ids = set()

    if not allocations:
        return touched_invoice_ids

    seen_invoice_ids = set()
    for alloc in allocations:
        if alloc.invoice_id in seen_invoice_ids:
            inv = db.query(Invoice).filter(Invoice.id == alloc.invoice_id).first()
            inv_ref = inv.invoice_number if inv else f"ID {alloc.invoice_id}"
            raise HTTPException(
                400,
                detail=f"Duplicate allocation for invoice {inv_ref}. Please combine allocations for the same invoice into a single line.",
            )
        seen_invoice_ids.add(alloc.invoice_id)

    total_allocated = 0.0

    for alloc in allocations:
        if alloc.amount <= 0:
            raise HTTPException(
                400,
                detail=f"Allocation amount must be > 0 (invoice_id={alloc.invoice_id})",
            )

        # Verify invoice exists, belongs to same company and same customer
        inv = db.query(Invoice).filter(
            Invoice.id == alloc.invoice_id,
            Invoice.is_active == True,
        ).first()

        if not inv:
            raise HTTPException(
                400,
                detail=f"Invoice {alloc.invoice_id} not found or inactive",
            )

        if inv.company_id != company_id:
            raise HTTPException(
                400,
                detail=f"Invoice {inv.invoice_number} belongs to a different company",
            )

        if inv.customer_id != payment.customer_id:
            raise HTTPException(
                400,
                detail=f"Invoice {inv.invoice_number} belongs to a different customer",
            )

        # Calculate outstanding for this invoice (excluding allocations from THIS payment)
        existing_alloc = (
            db.query(func.sum(PaymentAllocation.amount))
            .filter(
                PaymentAllocation.invoice_id == alloc.invoice_id,
                PaymentAllocation.payment_id != payment.id,
                PaymentAllocation.is_active == True,
            )
            .scalar()
        ) or 0.0

        outstanding = (inv.total_amount or 0) - existing_alloc
        if alloc.amount > outstanding + 0.01:  # small float tolerance
            raise HTTPException(
                400,
                detail=(
                    f"Allocation ₹{alloc.amount:.2f} exceeds outstanding "
                    f"₹{outstanding:.2f} on invoice {inv.invoice_number}"
                ),
            )

        total_allocated += alloc.amount
        touched_invoice_ids.add(alloc.invoice_id)

    if total_allocated > payment.amount + 0.01:
        raise HTTPException(
            400,
            detail=(
                f"Total allocated ₹{total_allocated:.2f} exceeds "
                f"payment amount ₹{payment.amount:.2f}"
            ),
        )

    # Delete existing allocations for this payment
    db.query(PaymentAllocation).filter(
        PaymentAllocation.payment_id == payment.id,
    ).delete(synchronize_session=False)

    # Create new allocations
    for alloc in allocations:
        pa = PaymentAllocation(
            payment_id=payment.id,
            invoice_id=alloc.invoice_id,
            amount=round(alloc.amount, 2),
            company_id=company_id,
            is_active=True,
        )
        db.add(pa)

    db.flush()
    return touched_invoice_ids


# ── LIST ────────────────────────────────────────────────────────────────
@router.get("/")
def list_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    customer_id: Optional[int] = Query(None),
    is_active: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user=Depends(_require_permissions),
):
    from app.models.customer import Customer
    q = db.query(Payment, Customer.name.label("customer_name")).outerjoin(
        Customer, Payment.customer_id == Customer.id
    )
    q = apply_company_filter(q, Payment, user.active_company_id)
    q = apply_scope_filter(q, Payment, user, MODULE)

    if is_active is None:
        q = q.filter(Payment.is_active == True)
    elif is_active.lower() not in ("all", "any"):
        q = q.filter(Payment.is_active == (is_active.lower() in ("true", "1")))

    if customer_id is not None:
        q = q.filter(Payment.customer_id == customer_id)

    return paginate(q.order_by(Payment.id.desc()), page, page_size)


# ── GET single ──────────────────────────────────────────────────────────
@router.get("/{payment_id}")
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    user=Depends(_require_permissions),
):
    q = db.query(Payment).filter(Payment.id == payment_id)
    q = apply_company_filter(q, Payment, user.active_company_id)
    q = apply_scope_filter(q, Payment, user, MODULE)
    payment = q.first()
    if not payment:
        raise HTTPException(404, "Payment not found")

    result = serialize_row(payment)

    # Attach allocations
    allocs = (
        db.query(PaymentAllocation)
        .filter(
            PaymentAllocation.payment_id == payment_id,
            PaymentAllocation.is_active == True,
        )
        .all()
    )
    result["allocations"] = [
        {
            "id": a.id,
            "invoice_id": a.invoice_id,
            "amount": a.amount,
        }
        for a in allocs
    ]

    return result


# ── DROPDOWN ────────────────────────────────────────────────────────────
@router.get("/dropdown")
def dropdown(
    db: Session = Depends(get_db),
    user=Depends(_require_permissions),
):
    q = db.query(Payment)
    q = apply_company_filter(q, Payment, user.active_company_id)
    q = apply_scope_filter(q, Payment, user, MODULE)
    q = q.filter(Payment.is_active == True)
    return [serialize_row(o) for o in q.order_by(Payment.id).all()]


# ── CREATE ──────────────────────────────────────────────────────────────
@router.post("/", status_code=201)
def create_payment(
    data: PaymentCreate,
    db: Session = Depends(get_db),
    user=Depends(_require_permissions),
):
    company_id = user.active_company_id or user.company_id
    if company_id is None:
        raise HTTPException(400, "No active company context")

    # Create the payment
    payment = Payment(
        customer_id=data.customer_id,
        amount=data.amount,
        payment_mode=data.payment_mode,
        payment_date=data.payment_date,
        payment_account=data.payment_account,
        payment_reference=data.payment_reference,
        notes=data.notes,
        so_id=data.so_id,
        company_id=company_id,
        created_by=user.id,
        assigned_to_user_id=user.id,
        is_active=True,
        payment_number=get_next_code(
            db, Payment, "payment_number", "PMT",
            company_id=company_id,
        ),
    )
    db.add(payment)
    db.flush()  # get payment.id before allocations

    # Validate & apply allocations
    touched = set()
    if data.allocations:
        touched = _validate_and_apply_allocations(
            db, payment, data.allocations, company_id,
        )

    # Recompute affected invoices
    for inv_id in touched:
        _recompute_invoice_balance(db, inv_id)

    db.commit()
    db.refresh(payment)

    result = serialize_row(payment)
    allocs = (
        db.query(PaymentAllocation)
        .filter(PaymentAllocation.payment_id == payment.id, PaymentAllocation.is_active == True)
        .all()
    )
    result["allocations"] = [
        {"id": a.id, "invoice_id": a.invoice_id, "amount": a.amount}
        for a in allocs
    ]
    return result


# ── UPDATE ──────────────────────────────────────────────────────────────
@router.put("/{payment_id}")
def update_payment(
    payment_id: int,
    data: PaymentUpdate,
    db: Session = Depends(get_db),
    user=Depends(_require_permissions),
):
    q = db.query(Payment).filter(Payment.id == payment_id)
    q = apply_company_filter(q, Payment, user.active_company_id)
    q = apply_scope_filter(q, Payment, user, MODULE)
    payment = q.first()
    if not payment:
        raise HTTPException(404, "Payment not found")

    company_id = payment.company_id

    # Collect invoice_ids that WERE allocated (before update)
    old_alloc_inv_ids = set(
        row[0]
        for row in db.query(PaymentAllocation.invoice_id)
        .filter(
            PaymentAllocation.payment_id == payment_id,
            PaymentAllocation.is_active == True,
        )
        .all()
    )

    # Update scalar fields
    update_fields = data.model_dump(exclude_unset=True, exclude={"allocations"})
    update_fields.pop("company_id", None)
    update_fields.pop("created_by", None)
    for k, v in update_fields.items():
        if hasattr(payment, k):
            setattr(payment, k, v)

    db.flush()

    # Re-validate allocations if provided
    touched = set()
    if data.allocations is not None:
        touched = _validate_and_apply_allocations(
            db, payment, data.allocations, company_id,
        )

    # Recompute ALL affected invoices (old + new)
    all_affected = old_alloc_inv_ids | touched
    for inv_id in all_affected:
        _recompute_invoice_balance(db, inv_id)

    db.commit()
    db.refresh(payment)

    result = serialize_row(payment)
    allocs = (
        db.query(PaymentAllocation)
        .filter(PaymentAllocation.payment_id == payment.id, PaymentAllocation.is_active == True)
        .all()
    )
    result["allocations"] = [
        {"id": a.id, "invoice_id": a.invoice_id, "amount": a.amount}
        for a in allocs
    ]
    return result


# ── DELETE (soft) ───────────────────────────────────────────────────────
@router.delete("/{payment_id}")
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    user=Depends(_require_permissions),
):
    q = db.query(Payment).filter(Payment.id == payment_id)
    q = apply_company_filter(q, Payment, user.active_company_id)
    q = apply_scope_filter(q, Payment, user, MODULE)
    payment = q.first()
    if not payment:
        raise HTTPException(404, "Payment not found")

    # Collect affected invoices before deleting allocations
    affected_inv_ids = [
        row[0]
        for row in db.query(PaymentAllocation.invoice_id)
        .filter(
            PaymentAllocation.payment_id == payment_id,
            PaymentAllocation.is_active == True,
        )
        .all()
    ]

    # Soft-delete allocations
    db.query(PaymentAllocation).filter(
        PaymentAllocation.payment_id == payment_id,
    ).update({"is_active": False}, synchronize_session=False)

    # Soft-delete payment
    payment.is_active = False

    # Recompute affected invoices
    for inv_id in affected_inv_ids:
        _recompute_invoice_balance(db, inv_id)

    db.commit()
    return {"message": "Payment deleted and allocations reversed"}


# ── STATUS (keep for compatibility with generic frontend) ───────────────
@router.patch("/{payment_id}/status")
def change_status(
    payment_id: int,
    data: dict,
    db: Session = Depends(get_db),
    user=Depends(_require_permissions),
):
    q = db.query(Payment).filter(Payment.id == payment_id)
    q = apply_company_filter(q, Payment, user.active_company_id)
    payment = q.first()
    if not payment:
        raise HTTPException(404, "Payment not found")
    if hasattr(payment, "status"):
        payment.status = data.get("status")
    db.commit()
    db.refresh(payment)
    return serialize_row(payment)


# ── ARCHIVE (keep for compatibility with generic frontend) ──────────────
@router.patch("/{payment_id}/archive")
def archive_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    user=Depends(_require_permissions),
):
    return delete_payment(payment_id, db, user)


# ── Invoice payments (allocations against a specific invoice) ───────────
@router.get("/invoice/{invoice_id}")
def invoice_payments(
    invoice_id: int,
    db: Session = Depends(get_db),
    user=Depends(_require_permissions),
):
    """Get all payment allocations against a specific invoice."""
    # Verify invoice belongs to active company
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if (
        user.active_company_id is not None
        and inv.company_id is not None
        and inv.company_id != user.active_company_id
    ):
        raise HTTPException(404, "Invoice not found")

    allocs = (
        db.query(PaymentAllocation, Payment)
        .join(Payment, PaymentAllocation.payment_id == Payment.id)
        .filter(
            PaymentAllocation.invoice_id == invoice_id,
            PaymentAllocation.is_active == True,
            Payment.is_active == True,
        )
        .order_by(Payment.id.asc())
        .all()
    )

    return {
        "items": [
            {
                "allocation_id": alloc.id,
                "payment_id": pay.id,
                "payment_number": pay.payment_number,
                "payment_date": pay.payment_date,
                "payment_mode": pay.payment_mode,
                "payment_account": pay.payment_account,
                "payment_reference": pay.payment_reference,
                "allocated_amount": alloc.amount,
                "payment_total": pay.amount,
            }
            for alloc, pay in allocs
        ],
        "total": len(allocs),
    }


# ── Customer outstanding invoices ───────────────────────────────────────
@router.get("/customer/{customer_id}/outstanding")
def customer_outstanding(
    customer_id: int,
    db: Session = Depends(get_db),
    user=Depends(_require_permissions),
):
    """Open invoices for a customer, with allocation detail and on-account balance."""
    # Verify customer belongs to active company
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(404, "Customer not found")
    if (
        user.active_company_id is not None
        and cust.company_id is not None
        and cust.company_id != user.active_company_id
    ):
        raise HTTPException(404, "Customer not found")

    # Open invoices (not cancelled, is_active, balance_due > 0)
    inv_q = db.query(Invoice).filter(
        Invoice.customer_id == customer_id,
        Invoice.is_active == True,
        Invoice.status != "cancelled",
    )
    inv_q = apply_company_filter(inv_q, Invoice, user.active_company_id)
    invoices = inv_q.order_by(Invoice.id.asc()).all()

    items = []
    for inv in invoices:
        allocated = (
            db.query(func.sum(PaymentAllocation.amount))
            .filter(
                PaymentAllocation.invoice_id == inv.id,
                PaymentAllocation.is_active == True,
            )
            .scalar()
        ) or 0.0

        outstanding = round((inv.total_amount or 0) - allocated, 2)
        items.append({
            "invoice_id": inv.id,
            "invoice_number": inv.invoice_number,
            "invoice_date": inv.invoice_date,
            "due_date": inv.due_date,
            "total_amount": round(inv.total_amount or 0, 2),
            "allocated": round(allocated, 2),
            "outstanding": outstanding,
            "status": inv.status,
        })

    # On-account balance: payments not fully allocated
    total_payments = (
        db.query(func.sum(Payment.amount))
        .filter(
            Payment.customer_id == customer_id,
            Payment.is_active == True,
        )
    )
    total_payments = apply_company_filter(total_payments, Payment, user.active_company_id)
    total_payments_val = total_payments.scalar() or 0.0

    total_allocated = (
        db.query(func.sum(PaymentAllocation.amount))
        .join(Payment, PaymentAllocation.payment_id == Payment.id)
        .filter(
            Payment.customer_id == customer_id,
            Payment.is_active == True,
            PaymentAllocation.is_active == True,
        )
    )
    total_allocated = apply_company_filter(total_allocated, Payment, user.active_company_id)
    total_allocated_val = total_allocated.scalar() or 0.0

    on_account = round(total_payments_val - total_allocated_val, 2)

    return {
        "items": items,
        "on_account": max(0, on_account),
        "total_payments": round(total_payments_val, 2),
        "total_allocated": round(total_allocated_val, 2),
    }
