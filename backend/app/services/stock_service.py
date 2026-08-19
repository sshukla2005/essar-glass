import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.models.product import Product
from app.models.inventory import StockMovement
from app.models.purchase_order import PurchaseOrder
from app.models.delivery import DeliveryChallan
from app.utils.helpers import get_next_code

logger = logging.getLogger(__name__)

def recompute_stock(db: Session, product_id: int, company_id: Optional[int] = None) -> float:
    """
    Recomputes Product.on_hand_qty strictly from StockMovement records.
    Locks the product row with SELECT ... FOR UPDATE to avoid race conditions.
    """
    if not product_id:
        return 0.0

    query = db.query(Product).filter(Product.id == product_id)
    if company_id is not None:
        query = query.filter(Product.company_id == company_id)

    # Lock product row
    product = query.with_for_update().first()
    if not product:
        # Fallback query without company filter if product not found
        product = db.query(Product).filter(Product.id == product_id).with_for_update().first()
        if not product:
            return 0.0

    # Non-stock / service products never participate in stock
    if product.stock_uom == "service" or product.product_type == "service":
        product.on_hand_qty = 0.0
        product.on_hand_sqm = 0.0
        product.on_hand_sheets = 0.0
        db.flush()
        return 0.0

    # Query all movements for this product
    move_query = db.query(StockMovement).filter(StockMovement.product_id == product_id)
    if product.company_id is not None:
        move_query = move_query.filter(StockMovement.company_id == product.company_id)

    movements = move_query.order_by(StockMovement.id.asc()).all()

    sheet_area_sqm = 0.0
    if product.sheet_width_mm and product.sheet_height_mm:
        sheet_area_sqm = (float(product.sheet_width_mm) / 1000.0) * (float(product.sheet_height_mm) / 1000.0)

    running_sqm = 0.0
    running_sheets = 0.0

    for move in movements:
        mtype = (move.movement_type or "").lower().strip()
        q_sqm = move.quantity_sqm if move.quantity_sqm is not None else float(move.quantity or 0.0)
        q_sheets = move.quantity_sheets

        if q_sheets is None and sheet_area_sqm > 0:
            q_sheets = q_sqm / sheet_area_sqm
        if (q_sqm is None or q_sqm == 0.0) and q_sheets is not None and sheet_area_sqm > 0:
            q_sqm = q_sheets * sheet_area_sqm

        q_sheets_val = float(q_sheets or 0.0)

        if mtype == "in":
            running_sqm += q_sqm
            running_sheets += q_sheets_val
        elif mtype == "out":
            running_sqm -= q_sqm
            running_sheets -= q_sheets_val
        elif mtype == "adjustment":
            running_sqm += q_sqm
            running_sheets += q_sheets_val

    running_sqm = round(running_sqm, 4)
    running_sheets = round(running_sheets, 4)

    product.on_hand_sqm = running_sqm
    product.on_hand_sheets = running_sheets
    product.on_hand_qty = running_sqm
    db.flush()
    return running_sqm

def sync_po_stock_movements(db: Session, po: PurchaseOrder, new_status: str, old_status: Optional[str] = None):
    """
    Handles stock movements when PO status changes.
    When moving to 'received': posts 'in' movements for all PO lines with stock products.
    When moving away from 'received': removes associated PO movements and recomputes stock.
    """
    po_ref = po.po_number or f"PO-{po.id}"

    if new_status == "received":
        # Check if movements already posted for this PO
        existing_count = db.query(StockMovement).filter(
            StockMovement.reference == po_ref,
            StockMovement.company_id == po.company_id
        ).count()
        if existing_count > 0:
            return

        lines = po.lines or []
        for line in lines:
            if not isinstance(line, dict):
                continue
            pid = line.get("product_id")
            if not pid:
                continue

            product = db.query(Product).filter(Product.id == pid).first()
            if not product or product.stock_uom == "service" or product.product_type == "service":
                continue

            qty = float(line.get("quantity") or 1.0)
            if qty <= 0:
                continue

            move_code = get_next_code(db, StockMovement, "move_number", "SM", company_id=po.company_id)
            movement = StockMovement(
                move_number=move_code,
                product_id=pid,
                movement_type="in",
                quantity=qty,
                reference=po_ref,
                remarks=f"Received via PO #{po_ref}",
                date=datetime.utcnow().isoformat(),
                company_id=po.company_id,
            )
            db.add(movement)
            db.flush()
            recompute_stock(db, pid, po.company_id)

    elif old_status == "received" and new_status != "received":
        # Reverse PO movements
        movements = db.query(StockMovement).filter(
            StockMovement.reference == po_ref,
            StockMovement.company_id == po.company_id
        ).all()
        affected_pids = set()
        for move in movements:
            affected_pids.add(move.product_id)
            db.delete(move)
        db.flush()
        for pid in affected_pids:
            if pid:
                recompute_stock(db, pid, po.company_id)

def sync_dc_stock_movements(db: Session, dc: DeliveryChallan, new_status: str, old_status: Optional[str] = None):
    """
    Handles stock movements when DC status changes.
    When moving to 'delivered': posts 'out' movements for all DC lines with stock products.
    When moving away from 'delivered': removes associated DC movements and recomputes stock.
    """
    dc_ref = dc.dc_number or f"DC-{dc.id}"

    if new_status == "delivered":
        # Check if movements already posted for this DC
        existing_count = db.query(StockMovement).filter(
            StockMovement.reference == dc_ref,
            StockMovement.company_id == dc.company_id
        ).count()
        if existing_count > 0:
            return

        lines = dc.lines or []
        for line in lines:
            if not isinstance(line, dict):
                continue
            pid = line.get("product_id")
            if not pid:
                continue

            product = db.query(Product).filter(Product.id == pid).first()
            if not product or product.stock_uom == "service" or product.product_type == "service":
                continue

            qty = float(line.get("qty_dispatched") if line.get("qty_dispatched") is not None else line.get("quantity") or 1.0)
            if qty <= 0:
                continue

            move_code = get_next_code(db, StockMovement, "move_number", "SM", company_id=dc.company_id)
            movement = StockMovement(
                move_number=move_code,
                product_id=pid,
                movement_type="out",
                quantity=qty,
                reference=dc_ref,
                remarks=f"Delivered via DC #{dc_ref}",
                date=datetime.utcnow().isoformat(),
                company_id=dc.company_id,
            )
            db.add(movement)
            db.flush()
            recompute_stock(db, pid, dc.company_id)

    elif old_status == "delivered" and new_status != "delivered":
        # Reverse DC movements
        movements = db.query(StockMovement).filter(
            StockMovement.reference == dc_ref,
            StockMovement.company_id == dc.company_id
        ).all()
        affected_pids = set()
        for move in movements:
            affected_pids.add(move.product_id)
            db.delete(move)
        db.flush()
        for pid in affected_pids:
            if pid:
                recompute_stock(db, pid, dc.company_id)
