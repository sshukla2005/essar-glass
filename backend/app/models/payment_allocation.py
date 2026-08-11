from sqlalchemy import Column, Integer, Float, ForeignKey, UniqueConstraint
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin


class PaymentAllocation(Base, TimestampMixin, SoftDeleteMixin):
    """Maps a portion of a Payment to a specific Invoice.

    A payment can be split across multiple invoices. The invariant is:
        sum(allocations.amount) <= payment.amount   — always

    The remainder (payment.amount - sum(allocations)) is the customer's
    on-account (unapplied) credit.

    This model intentionally omits created_by / assigned_to_user_id so that
    apply_scope_filter skips it (visibility inherits from the parent Payment).
    """
    __tablename__ = "payment_allocations"

    id         = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id", ondelete="RESTRICT"),
                        nullable=False, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"),
                        nullable=False, index=True)
    amount     = Column(Float, nullable=False)  # must be > 0
    company_id = Column(Integer, ForeignKey("companies.id"),
                        nullable=True, index=True)

    # One allocation row per (payment, invoice) pair when active.
    # To change the amount, update the existing row — don't add a second.
    __table_args__ = (
        UniqueConstraint(
            "payment_id", "invoice_id",
            name="uq_allocation_payment_invoice_active",
        ),
    )
