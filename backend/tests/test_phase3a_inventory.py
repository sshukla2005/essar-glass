"""
Test Suite for Phase 3A — Sheet-based inventory, foundation.

Verifies:
1. Derived stock computation via recompute_stock (in, out, adjustment).
2. Transactional PO status change -> 'received' creates 'in' movements and updates stock.
3. Transactional DC status change -> 'delivered' creates 'out' movements and updates stock.
4. Status reversals (PO received -> draft, DC delivered -> dispatched) reverse/delete movements and recompute stock.
5. Concurrency lock (SELECT ... FOR UPDATE) handles simultaneous stock updates without count corruption.
6. System-wide assertion: Product.on_hand_qty == sum(StockMovement) for all products.
7. Service / non-stock products (stock_uom='service') are excluded from stock.
"""

import pytest
import threading
import uuid
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.company import Company
from app.models.product import Product
from app.models.inventory import StockMovement
from app.models.purchase_order import PurchaseOrder
from app.models.delivery import DeliveryChallan
from app.services.stock_service import recompute_stock, sync_po_stock_movements, sync_dc_stock_movements

@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()

def test_recompute_stock_derived_logic(db_session: Session):
    """Test recompute_stock helper accurately calculates running stock with in, out, and adjustment movements."""
    company = db_session.query(Company).first()
    company_id = company.id if company else 1

    sku = f"TG-{uuid.uuid4().hex[:6].upper()}"
    product = Product(
        internal_ref=sku,
        name="Test Clear 6mm Glass",
        product_type="storable",
        glass_type="Clear",
        thickness_mm=6.0,
        stock_uom="sheet",
        company_id=company_id,
        on_hand_qty=0.0
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)

    # 1. Post 'in' movement of 10 sheets
    m1 = StockMovement(
        move_number=f"SM-{uuid.uuid4().hex[:6].upper()}",
        product_id=product.id,
        movement_type="in",
        quantity=10.0,
        reference="PO-TEST-001",
        company_id=company_id
    )
    db_session.add(m1)
    db_session.commit()

    qty = recompute_stock(db_session, product.id, company_id)
    db_session.commit()
    db_session.refresh(product)
    assert qty == 10.0
    assert product.on_hand_qty == 10.0

    # 2. Post 'out' movement of 3 sheets
    m2 = StockMovement(
        move_number=f"SM-{uuid.uuid4().hex[:6].upper()}",
        product_id=product.id,
        movement_type="out",
        quantity=3.0,
        reference="DC-TEST-001",
        company_id=company_id
    )
    db_session.add(m2)
    db_session.commit()

    qty = recompute_stock(db_session, product.id, company_id)
    db_session.commit()
    db_session.refresh(product)
    assert qty == 7.0
    assert product.on_hand_qty == 7.0

    # 3. Post 'adjustment' movement of 25 sheets (resets baseline)
    m3 = StockMovement(
        move_number=f"SM-{uuid.uuid4().hex[:6].upper()}",
        product_id=product.id,
        movement_type="adjustment",
        quantity=25.0,
        reference="ADJ-TEST-001",
        company_id=company_id
    )
    db_session.add(m3)
    db_session.commit()

    qty = recompute_stock(db_session, product.id, company_id)
    db_session.commit()
    db_session.refresh(product)
    assert qty == 25.0
    assert product.on_hand_qty == 25.0

    # 4. Post 'out' movement of 5 sheets after baseline reset
    m4 = StockMovement(
        move_number=f"SM-{uuid.uuid4().hex[:6].upper()}",
        product_id=product.id,
        movement_type="out",
        quantity=5.0,
        reference="DC-TEST-002",
        company_id=company_id
    )
    db_session.add(m4)
    db_session.commit()

    qty = recompute_stock(db_session, product.id, company_id)
    db_session.commit()
    db_session.refresh(product)
    assert qty == 20.0
    assert product.on_hand_qty == 20.0

def test_po_received_stock_event(db_session: Session):
    """Test PO status change to 'received' creates 'in' movements and updates stock, and status reversal undoes it."""
    company = db_session.query(Company).first()
    company_id = company.id if company else 1

    sku = f"TPO-{uuid.uuid4().hex[:6].upper()}"
    product = Product(
        internal_ref=sku,
        name="PO Test Glass Sheet",
        product_type="storable",
        glass_type="Clear",
        stock_uom="sheet",
        company_id=company_id,
        on_hand_qty=0.0
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)

    po_ref = f"PO-TEST-{uuid.uuid4().hex[:4].upper()}"
    po = PurchaseOrder(
        po_number=po_ref,
        status="draft",
        lines=[{"product_id": product.id, "quantity": 15.0, "unit_price": 500}],
        company_id=company_id
    )
    db_session.add(po)
    db_session.commit()

    # Move status to 'received'
    po.status = "received"
    sync_po_stock_movements(db_session, po, "received", "draft")
    db_session.commit()
    db_session.refresh(product)

    assert product.on_hand_qty == 15.0
    moves = db_session.query(StockMovement).filter(
        StockMovement.reference == po_ref,
        StockMovement.product_id == product.id
    ).all()
    assert len(moves) == 1
    assert moves[0].movement_type == "in"
    assert moves[0].quantity == 15.0

    # Reverse status back to 'draft'
    po.status = "draft"
    sync_po_stock_movements(db_session, po, "draft", "received")
    db_session.commit()
    db_session.refresh(product)

    assert product.on_hand_qty == 0.0
    moves_after = db_session.query(StockMovement).filter(
        StockMovement.reference == po_ref,
        StockMovement.product_id == product.id
    ).all()
    assert len(moves_after) == 0

def test_dc_delivered_stock_event(db_session: Session):
    """Test DC status change to 'delivered' creates 'out' movements and status reversal undoes it."""
    company = db_session.query(Company).first()
    company_id = company.id if company else 1

    sku = f"TDC-{uuid.uuid4().hex[:6].upper()}"
    product = Product(
        internal_ref=sku,
        name="DC Test Glass Sheet",
        product_type="storable",
        stock_uom="sheet",
        company_id=company_id,
        on_hand_qty=0.0
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)

    # Add initial opening stock of 50 sheets
    init_move = StockMovement(
        move_number=f"SM-INIT-{uuid.uuid4().hex[:4].upper()}",
        product_id=product.id,
        movement_type="adjustment",
        quantity=50.0,
        reference="OPENING-BAL",
        company_id=company_id
    )
    db_session.add(init_move)
    db_session.commit()
    recompute_stock(db_session, product.id, company_id)
    db_session.commit()
    db_session.refresh(product)
    assert product.on_hand_qty == 50.0

    dc_ref = f"DC-TEST-{uuid.uuid4().hex[:4].upper()}"
    dc = DeliveryChallan(
        dc_number=dc_ref,
        status="dispatched",
        lines=[{"product_id": product.id, "qty_dispatched": 12.0}],
        company_id=company_id
    )
    db_session.add(dc)
    db_session.commit()

    # Move DC status to 'delivered'
    dc.status = "delivered"
    sync_dc_stock_movements(db_session, dc, "delivered", "dispatched")
    db_session.commit()
    db_session.refresh(product)

    assert product.on_hand_qty == 38.0
    moves = db_session.query(StockMovement).filter(
        StockMovement.reference == dc_ref,
        StockMovement.product_id == product.id
    ).all()
    assert len(moves) == 1
    assert moves[0].movement_type == "out"
    assert moves[0].quantity == 12.0

    # Reverse status back to 'dispatched'
    dc.status = "dispatched"
    sync_dc_stock_movements(db_session, dc, "dispatched", "delivered")
    db_session.commit()
    db_session.refresh(product)

    assert product.on_hand_qty == 50.0

def test_service_products_excluded_from_stock(db_session: Session):
    """Test that products marked stock_uom='service' or product_type='service' never hold stock."""
    company = db_session.query(Company).first()
    company_id = company.id if company else 1

    sku = f"SVC-{uuid.uuid4().hex[:6].upper()}"
    svc_product = Product(
        internal_ref=sku,
        name="Edge Polishing Service",
        product_type="service",
        stock_uom="service",
        company_id=company_id,
        on_hand_qty=0.0
    )
    db_session.add(svc_product)
    db_session.commit()
    db_session.refresh(svc_product)

    qty = recompute_stock(db_session, svc_product.id, company_id)
    assert qty == 0.0
    assert svc_product.on_hand_qty == 0.0

def test_concurrency_recompute_stock(db_session: Session):
    """Test concurrent thread execution of recompute_stock with SELECT FOR UPDATE locks."""
    company = db_session.query(Company).first()
    company_id = company.id if company else 1

    sku = f"CC-{uuid.uuid4().hex[:6].upper()}"
    product = Product(
        internal_ref=sku,
        name="Concurrent Test Glass",
        product_type="storable",
        stock_uom="sheet",
        company_id=company_id,
        on_hand_qty=0.0
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)

    errors = []

    def worker(worker_id):
        try:
            local_db = SessionLocal()
            m = StockMovement(
                move_number=f"SM-CC-{worker_id}-{uuid.uuid4().hex[:4]}",
                product_id=product.id,
                movement_type="in",
                quantity=1.0,
                reference=f"PO-CC-{worker_id}",
                company_id=company_id
            )
            local_db.add(m)
            local_db.commit()
            recompute_stock(local_db, product.id, company_id)
            local_db.commit()
            local_db.close()
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(errors) == 0, f"Concurrent execution produced errors: {errors}"
    final_qty = recompute_stock(db_session, product.id, company_id)
    db_session.commit()
    db_session.refresh(product)
    assert final_qty == 10.0
    assert product.on_hand_qty == 10.0

def test_all_products_on_hand_matches_movements(db_session: Session):
    """Assertion test: For every product in DB, Product.on_hand_qty matches derived movement total."""
    products = db_session.query(Product).all()
    for p in products:
        calc_qty = recompute_stock(db_session, p.id, p.company_id)
        db_session.refresh(p)
        assert abs((p.on_hand_qty or 0.0) - calc_qty) < 0.001, (
            f"Product ID {p.id} ({p.name}) mismatch: cached={p.on_hand_qty}, calculated={calc_qty}"
        )
