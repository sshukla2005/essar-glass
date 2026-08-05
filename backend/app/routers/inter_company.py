import copy
import re
import random
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.deps import require_superadmin
from app.utils.helpers import get_next_code
from app.models.company import Company
from app.models.vendor import Vendor
from app.models.customer import Customer
from app.models.purchase_order import PurchaseOrder
from app.models.sales_order import SalesOrder
from app.models.workshop import WorkshopOrder
from app.models.product import Product

router = APIRouter(prefix="/inter-company", tags=["Inter-Company"])


class InterCompanyLinkPayload(BaseModel):
    source_company_id: int
    supplier_company_id: int
    source_wo_id: Optional[int] = None
    lines: List[Dict[str, Any]] = []


def _parse_metadata_from_text(desc: str):
    """
    Attempt to extract category, type, and thickness from text description.
    """
    found_category = None
    found_type = None
    found_thickness = None

    desc_lower = (desc or "").lower()

    # Search category
    for cat in ["Xtra Clear", "Clear", "Tinted", "Reflective", "Mirror"]:
        if cat.lower() in desc_lower:
            found_category = cat
            break

    # Search type
    for t in ["Annealed", "Toughened", "Laminated", "DGU"]:
        if t.lower() in desc_lower:
            found_type = t
            break

    # Search thickness
    m = re.search(r"(\d+(?:\.\d+)?)\s*mm", desc_lower)
    if m:
        try:
            val = float(m.group(1))
            if val in [3.5, 4, 5, 6, 8, 10, 12] or val.is_integer():
                found_thickness = int(val) if val.is_integer() else val
        except ValueError:
            pass

    return found_category, found_type, found_thickness


def _resolve_line_metadata(
    l: Dict[str, Any],
    index: int,
    source_wo: Optional[WorkshopOrder],
    source_so: Optional[SalesOrder],
    supplier_company_id: int,
    db: Session,
) -> Dict[str, Any]:
    """
    Extract and resolve full glass metadata (thickness, type, category, product, ceiling dims, etc.)
    for a given line item, using overrides if provided.
    """
    override_type = l.get("override_glass_type")
    override_cat = l.get("override_glass_category")
    override_thick = l.get("override_thickness")
    override_desc = l.get("override_description")

    desc = override_desc or l.get("description") or ""

    # Start with values directly on payload line l (with override priority)
    g_thick = override_thick if override_thick is not None else l.get("glass_thickness")
    g_type = override_type or l.get("glass_type")
    g_cat = override_cat or l.get("glass_category")
    prod_id = l.get("product_id")
    prod_name = override_desc or l.get("product_name") or desc
    w_ceil = (
        l.get("w_ceiling")
        or l.get("ceiling_w_inches")
        or l.get("ceiling_inches")
        or 6
    )
    h_ceil = (
        l.get("h_ceiling")
        or l.get("ceiling_h_inches")
        or l.get("ceiling_inches")
        or 6
    )
    w_ceil_mm = l.get("ceiling_w_custom_mm") or 30
    h_ceil_mm = l.get("ceiling_h_custom_mm") or 30
    cep = bool(l.get("cep"))
    is_toughened = bool(l.get("is_toughened"))
    if g_type:
        if g_type.lower() == "toughened":
            is_toughened = True
        elif override_type and override_type.lower() != "toughened":
            is_toughened = False

    # Try reading from source_so groups/lines if present
    source_match = None
    if source_so:
        if source_so.groups and isinstance(source_so.groups, list):
            if index < len(source_so.groups):
                source_match = source_so.groups[index]
            else:
                for g in source_so.groups:
                    if g.get("description") == desc or g.get("description") == l.get("description"):
                        source_match = g
                        break
        elif source_so.lines and isinstance(source_so.lines, list):
            if index < len(source_so.lines):
                source_match = source_so.lines[index]
            else:
                for sl in source_so.lines:
                    if sl.get("description") == desc or sl.get("description") == l.get("description"):
                        source_match = sl
                        break

    # Try reading from source_wo lines if source_match is still None
    if not source_match and source_wo and source_wo.lines and isinstance(source_wo.lines, list):
        if index < len(source_wo.lines):
            source_match = source_wo.lines[index]
        else:
            for wl in source_wo.lines:
                if wl.get("description") == desc or wl.get("description") == l.get("description"):
                    source_match = wl
                    break

    if source_match:
        if g_thick is None:
            g_thick = source_match.get("glass_thickness")
        if not g_type:
            g_type = source_match.get("glass_type")
        if not g_cat:
            g_cat = source_match.get("glass_category")
        if prod_id is None:
            prod_id = source_match.get("product_id")
        if not prod_name and not override_desc:
            prod_name = source_match.get("product_name") or source_match.get("description")
        if l.get("ceiling_w_inches") is None and l.get("w_ceiling") is None:
            w_ceil = (
                source_match.get("ceiling_w_inches")
                or source_match.get("w_ceiling")
                or source_match.get("ceiling_inches")
                or 6
            )
        if l.get("ceiling_h_inches") is None and l.get("h_ceiling") is None:
            h_ceil = (
                source_match.get("ceiling_h_inches")
                or source_match.get("h_ceiling")
                or source_match.get("ceiling_inches")
                or 6
            )
        if l.get("ceiling_w_custom_mm") is None:
            w_ceil_mm = source_match.get("ceiling_w_custom_mm") or 30
        if l.get("ceiling_h_custom_mm") is None:
            h_ceil_mm = source_match.get("ceiling_h_custom_mm") or 30
        if "cep" not in l:
            cep = bool(source_match.get("cep"))
        if "is_toughened" not in l and not override_type:
            is_toughened = bool(source_match.get("is_toughened"))

    # If category, type, thickness are still missing, attempt string parsing from description
    parsed_cat, parsed_type, parsed_thick = _parse_metadata_from_text(desc)
    if not g_cat and parsed_cat:
        g_cat = parsed_cat
    if not g_type and parsed_type:
        g_type = parsed_type
    if g_thick is None and parsed_thick is not None:
        g_thick = parsed_thick

    # Resolve product master in supplier_company_id
    supplier_product_id = None
    if prod_id:
        source_prod = db.query(Product).filter(Product.id == prod_id).first()
        if source_prod:
            if g_thick is None:
                g_thick = source_prod.thickness_mm
            if not g_type:
                g_type = source_prod.glass_type
            if not g_cat:
                g_cat = source_prod.glass_category
            if not prod_name and not override_desc:
                prod_name = source_prod.name

            # Search in supplier_company
            supp_p = None
            if source_prod.internal_ref:
                supp_p = db.query(Product).filter(
                    Product.company_id == supplier_company_id,
                    Product.internal_ref == source_prod.internal_ref,
                    Product.is_active == True,
                ).first()
            if not supp_p and g_cat and g_type and g_thick is not None:
                supp_p = db.query(Product).filter(
                    Product.company_id == supplier_company_id,
                    func.lower(Product.glass_category) == func.lower(g_cat),
                    func.lower(Product.glass_type) == func.lower(g_type),
                    Product.thickness_mm == g_thick,
                    Product.is_active == True,
                ).first()
            if not supp_p and source_prod.name:
                supp_p = db.query(Product).filter(
                    Product.company_id == supplier_company_id,
                    func.lower(Product.name) == func.lower(source_prod.name),
                    Product.is_active == True,
                ).first()
            if supp_p:
                supplier_product_id = supp_p.id

    if not supplier_product_id and g_cat and g_type and g_thick is not None:
        supp_p = db.query(Product).filter(
            Product.company_id == supplier_company_id,
            func.lower(Product.glass_category) == func.lower(g_cat),
            func.lower(Product.glass_type) == func.lower(g_type),
            Product.thickness_mm == g_thick,
            Product.is_active == True,
        ).first()
        if supp_p:
            supplier_product_id = supp_p.id

    return {
        "description": desc,
        "glass_thickness": g_thick,
        "glass_type": g_type,
        "glass_category": g_cat,
        "product_id": supplier_product_id,
        "product_name": prod_name or desc,
        "ceiling_w_inches": w_ceil,
        "ceiling_h_inches": h_ceil,
        "ceiling_w_custom_mm": w_ceil_mm,
        "ceiling_h_custom_mm": h_ceil_mm,
        "cep": cep,
        "is_toughened": is_toughened,
    }


@router.post("/link", status_code=status.HTTP_201_CREATED)
def create_inter_company_link(
    payload: InterCompanyLinkPayload,
    db: Session = Depends(get_db),
    current_user=Depends(require_superadmin),
):
    """
    Create a PO in source_company and linked SO + WO in supplier_company in ONE atomic transaction.
    Requires superadmin role.
    """
    if payload.source_company_id == payload.supplier_company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source company and supplier company must be different",
        )

    source_company = (
        db.query(Company)
        .filter(Company.id == payload.source_company_id, Company.is_active == True)
        .first()
    )
    if not source_company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source company not found or inactive",
        )

    supplier_company = (
        db.query(Company)
        .filter(Company.id == payload.supplier_company_id, Company.is_active == True)
        .first()
    )
    if not supplier_company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supplier company not found or inactive",
        )

    today_str = datetime.now().strftime("%Y-%m-%d")

    try:
        # 1. Ensure Vendor record exists under source_company for supplier_company
        source_vendor = (
            db.query(Vendor)
            .filter(
                Vendor.company_id == payload.source_company_id,
                func.lower(Vendor.name) == func.lower(supplier_company.name),
                Vendor.is_active == True,
            )
            .first()
        )
        if not source_vendor:
            v_code = get_next_code(
                db, Vendor, "vendor_code", "VEND", company_id=payload.source_company_id
            )
            source_vendor = Vendor(
                company_id=payload.source_company_id,
                vendor_code=v_code,
                name=supplier_company.name,
                phone=supplier_company.phone,
                email=supplier_company.email,
                gstin=supplier_company.gstin,
                address=supplier_company.address,
                is_active=True,
            )
            db.add(source_vendor)
            db.flush()

        # 2. Ensure Customer record exists under supplier_company for source_company
        supplier_customer = (
            db.query(Customer)
            .filter(
                Customer.company_id == payload.supplier_company_id,
                func.lower(Customer.name) == func.lower(source_company.name),
                Customer.is_active == True,
            )
            .first()
        )
        if not supplier_customer:
            c_code = get_next_code(
                db, Customer, "customer_code", "CUST", company_id=payload.supplier_company_id
            )
            supplier_customer = Customer(
                company_id=payload.supplier_company_id,
                customer_code=c_code,
                name=source_company.name,
                phone=source_company.phone,
                email=source_company.email,
                gstin=source_company.gstin,
                address=source_company.address,
                is_active=True,
            )
            db.add(supplier_customer)
            db.flush()

        # 3. Create PURCHASE ORDER in source_company_id
        po_number = get_next_code(
            db, PurchaseOrder, "po_number", "PO", company_id=payload.source_company_id
        )
        po_lines = []
        for l in payload.lines:
            l_po = copy.deepcopy(l)
            for k in ["override_glass_type", "override_glass_category", "override_thickness", "override_description"]:
                l_po.pop(k, None)
            po_lines.append(l_po)

        po_subtotal = 0.0
        for l in po_lines:
            amt = l.get("amount") or l.get("subtotal") or l.get("line_total")
            if amt is None:
                qty = float(l.get("qty") or l.get("quantity") or 1)
                price = float(l.get("unit_price") or l.get("cost_price") or 0)
                amt = qty * price
            po_subtotal += float(amt or 0)

        po = PurchaseOrder(
            company_id=payload.source_company_id,
            po_number=po_number,
            vendor_id=source_vendor.id,
            vendor_reference=supplier_company.name,
            po_date=today_str,
            status="draft",
            lines=po_lines,
            subtotal=po_subtotal,
            tax_amount=0.0,
            total_amount=po_subtotal,
            is_active=True,
        )
        db.add(po)
        db.flush()

        # Look up source WO and linked SO if available
        source_wo = None
        source_so = None
        if payload.source_wo_id:
            source_wo = (
                db.query(WorkshopOrder)
                .filter(WorkshopOrder.id == payload.source_wo_id)
                .first()
            )
            if source_wo and source_wo.so_id:
                source_so = (
                    db.query(SalesOrder)
                    .filter(SalesOrder.id == source_wo.so_id)
                    .first()
                )

        so_groups = []
        so_lines = []
        wo_lines = []

        now_ms = int(datetime.now().timestamp() * 1000)

        for i, l in enumerate(payload.lines):
            meta = _resolve_line_metadata(
                l=l,
                index=i,
                source_wo=source_wo,
                source_so=source_so,
                supplier_company_id=payload.supplier_company_id,
                db=db,
            )

            width_mm = l.get("width_mm") or l.get("act_w_mm")
            height_mm = l.get("height_mm") or l.get("act_h_mm")
            width_inch = l.get("width_inch") or l.get("act_w_in")
            height_inch = l.get("height_inch") or l.get("act_h_in")
            qty = l.get("qty") or l.get("quantity") or 1

            # Build SO Group
            grp = {
                "group_key": now_ms + i * 100 + random.randint(1, 99),
                "glass_thickness": meta["glass_thickness"],
                "glass_type": meta["glass_type"],
                "glass_category": meta["glass_category"],
                "product_id": meta["product_id"],
                "description": meta["description"],
                "ceiling_inches": meta["ceiling_w_inches"],
                "ceiling_w_inches": meta["ceiling_w_inches"],
                "ceiling_h_inches": meta["ceiling_h_inches"],
                "ceiling_w_custom_mm": meta["ceiling_w_custom_mm"],
                "ceiling_h_custom_mm": meta["ceiling_h_custom_mm"],
                "cep": meta["cep"],
                "is_toughened": meta["is_toughened"],
                "base_glass_rate": 0,
                "rate": 0,
                "rate_rft": 0,
                "pricing_method": "per_sqft",
                "discount_pct": 0,
                "tax_rate": 18,
                "artwork_file_data": l.get("artwork_file_data") or l.get("artwork_file"),
                "artwork_master_id": l.get("artwork_id") or l.get("artwork_master_id"),
                "artwork_name": l.get("artwork_name") or l.get("artwork_file_name"),
                "sizes": [
                    {
                        "size_key": now_ms + i * 1000 + random.randint(1, 999),
                        "width_inch": width_inch,
                        "height_inch": height_inch,
                        "quantity": qty,
                        "subtotal": 0,
                        "tax_amount": 0,
                        "line_total": 0,
                        "size_processes": [],
                    }
                ],
                "processes": [],
            }
            so_groups.append(grp)

            # Build SO Line
            l_copy = copy.deepcopy(l)
            for k in ["override_glass_type", "override_glass_category", "override_thickness", "override_description"]:
                l_copy.pop(k, None)
            l_copy.update({
                "description": meta["description"],
                "glass_thickness": meta["glass_thickness"],
                "glass_type": meta["glass_type"],
                "glass_category": meta["glass_category"],
                "product_id": meta["product_id"],
                "product_name": meta["product_name"],
                "ceiling_inches": meta["ceiling_w_inches"],
                "ceiling_w_inches": meta["ceiling_w_inches"],
                "ceiling_h_inches": meta["ceiling_h_inches"],
                "ceiling_w_custom_mm": meta["ceiling_w_custom_mm"],
                "ceiling_h_custom_mm": meta["ceiling_h_custom_mm"],
                "cep": meta["cep"],
                "is_toughened": meta["is_toughened"],
                "unit_price": 0,
                "glass_rate": 0,
                "rate": 0,
                "subtotal": 0,
                "tax_amount": 0,
                "amount": 0,
                "line_total": 0,
                "total": 0,
                "cost_price": 0,
            })
            so_lines.append(l_copy)

            # Build WO Line
            wo_l = copy.deepcopy(l)
            for k in ["override_glass_type", "override_glass_category", "override_thickness", "override_description"]:
                wo_l.pop(k, None)
            wo_l.update({
                "description": meta["description"],
                "glass_thickness": meta["glass_thickness"],
                "glass_type": meta["glass_type"],
                "glass_category": meta["glass_category"],
                "product_id": meta["product_id"],
                "product_name": meta["product_name"],
                "ceiling_w_inches": meta["ceiling_w_inches"],
                "ceiling_h_inches": meta["ceiling_h_inches"],
                "ceiling_w_custom_mm": meta["ceiling_w_custom_mm"],
                "ceiling_h_custom_mm": meta["ceiling_h_custom_mm"],
                "cep": meta["cep"],
                "is_toughened": meta["is_toughened"],
            })
            wo_lines.append(wo_l)

        # 4. Create SALES ORDER in supplier_company_id
        so_number = get_next_code(
            db, SalesOrder, "so_number", "SO", company_id=payload.supplier_company_id
        )

        so = SalesOrder(
            company_id=payload.supplier_company_id,
            so_number=so_number,
            customer_id=supplier_customer.id,
            customer_name=source_company.name,
            order_date=today_str,
            status="draft",
            groups=so_groups,
            lines=so_lines,
            subtotal=0.0,
            tax_amount=0.0,
            total_amount=0.0,
            is_active=True,
        )
        db.add(so)
        db.flush()

        # 5. Create WORKSHOP ORDER in supplier_company_id, linked to the new SO
        wo_number = get_next_code(
            db, WorkshopOrder, "wo_number", "WO", company_id=payload.supplier_company_id
        )

        wo = WorkshopOrder(
            company_id=payload.supplier_company_id,
            wo_number=wo_number,
            so_id=so.id,
            so_number=so.so_number,
            customer_id=supplier_customer.id,
            customer_name=source_company.name,
            order_date=today_str,
            status="draft",
            lines=wo_lines,
            is_active=True,
        )
        db.add(wo)
        db.flush()

        # 6. Store cross-links for traceability
        po.so_id = so.id
        po.linked_ref = {
            "so_id": so.id,
            "so_number": so.so_number,
            "wo_id": wo.id,
            "wo_number": wo.wo_number,
            "supplier_company_id": supplier_company.id,
            "supplier_company_name": supplier_company.name,
            "source_wo_id": payload.source_wo_id,
        }

        so.linked_ref = {
            "po_id": po.id,
            "po_number": po.po_number,
            "wo_id": wo.id,
            "wo_number": wo.wo_number,
            "source_company_id": source_company.id,
            "source_company_name": source_company.name,
            "source_wo_id": payload.source_wo_id,
        }

        wo.linked_ref = {
            "po_id": po.id,
            "po_number": po.po_number,
            "so_id": so.id,
            "so_number": so.so_number,
            "source_company_id": source_company.id,
            "source_company_name": source_company.name,
            "source_wo_id": payload.source_wo_id,
        }

        db.commit()
        db.refresh(po)
        db.refresh(so)
        db.refresh(wo)

        return {
            "po_number": po.po_number,
            "po_id": po.id,
            "so_number": so.so_number,
            "so_id": so.id,
            "wo_number": wo.wo_number,
            "wo_id": wo.id,
            "source_company": source_company.name,
            "supplier_company": supplier_company.name,
        }
    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Inter-company link operation failed: {str(e)}",
        )
