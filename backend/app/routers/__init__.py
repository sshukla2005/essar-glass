import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.deps import get_current_user
from app.utils.helpers import apply_company_filter, apply_scope_filter, paginate, get_next_code, serialize_row, stash_extra_fields

logger = logging.getLogger(__name__)


def _require_permissions(allowed: set[str] | None = None, module: str | None = None):
    def _dep(user = Depends(get_current_user)):
        if allowed is not None and user.role not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        if module is not None:
            if user.role in ("superadmin", "admin"):
                return user

            user_perms = user.permissions or []
            if "all" in user_perms or module in user_perms:
                return user

            if not user_perms:
                logger.warning(
                    f"User {user.username} (ID: {user.id}) has empty permissions and was denied access to module {module}"
                )

            raise HTTPException(
                status_code=403,
                detail=f"Permission denied for module '{module}'"
            )
        return user
    return _dep


def _require_roles(allowed: set[str] | None):
    return _require_permissions(allowed=allowed)


def make_crud_router(
    prefix: str,
    tag: str,
    model,
    create_schema,
    update_schema,
    response_schema,
    code_prefix: str = None,
    code_field: str  = None,
    company_scoped: bool = True,
    read_roles: set[str] | None = None,
    write_roles: set[str] | None = None,
    module: str | None = None,
):
    router = APIRouter(prefix=prefix, tags=[tag])


    @router.get("/")
    def list_items(
        page:         int = Query(1,   ge=1),
        page_size:    int = Query(20,  ge=1, le=1000),
        search:       str = Query(""),
        is_active:    Optional[str] = Query(None),
        so_id:        Optional[int] = Query(None),
        quotation_id: Optional[int] = Query(None),
        customer_id:  Optional[int] = Query(None),
        vendor_id:    Optional[int] = Query(None),
        stage_id:     Optional[int] = Query(None),
        crm_lead_id:  Optional[int] = Query(None),
        status:       Optional[str] = Query(None),
        db:    Session = Depends(get_db),
        user         = Depends(_require_permissions(read_roles, module)),
    ):
        # 1. Calculate status counts if model has a status column
        counts = None
        if hasattr(model, 'status'):
            from sqlalchemy import func
            status_q = db.query(model.status, func.count(model.id))
            if company_scoped:
                status_q = apply_company_filter(status_q, model, user.active_company_id)
            status_q = apply_scope_filter(status_q, model, user, module)
            if hasattr(model, 'is_active'):
                status_q = status_q.filter(model.is_active == True)
            if crm_lead_id is not None and hasattr(model, 'crm_lead_id'):
                status_q = status_q.filter(model.crm_lead_id == crm_lead_id)
            if customer_id is not None and hasattr(model, 'customer_id'):
                status_q = status_q.filter(model.customer_id == customer_id)

            grouped = dict(status_q.group_by(model.status).all())
            active_cnt = sum(cnt for st, cnt in grouped.items() if st not in ('converted', 'cancelled'))
            converted_cnt = grouped.get('converted', 0)
            all_cnt = sum(grouped.values())
            counts = {
                "active": active_cnt,
                "converted": converted_cnt,
                "all": all_cnt
            }

        # 2. Build entities for joined query
        entities = [model]
        if hasattr(model, 'customer_id'):
            from app.models.customer import Customer
            entities.append(Customer.name.label("customer_name"))
        if hasattr(model, 'vendor_id'):
            from app.models.vendor import Vendor
            entities.append(Vendor.name.label("vendor_name"))
        if getattr(model, '__tablename__', None) == 'quotations':
            from app.models.sales_order import SalesOrder
            entities.append(SalesOrder.id.label("so_id"))
            entities.append(SalesOrder.so_number.label("so_number"))

        if len(entities) > 1:
            q = db.query(*entities)
            if hasattr(model, 'customer_id'):
                from app.models.customer import Customer
                q = q.outerjoin(Customer, model.customer_id == Customer.id)
            if hasattr(model, 'vendor_id'):
                from app.models.vendor import Vendor
                q = q.outerjoin(Vendor, model.vendor_id == Vendor.id)
            if getattr(model, '__tablename__', None) == 'quotations':
                from app.models.sales_order import SalesOrder
                q = q.outerjoin(SalesOrder, (SalesOrder.quotation_id == model.id) & (SalesOrder.is_active == True))
        else:
            q = db.query(model)

        if company_scoped:
            q = apply_company_filter(q, model, user.active_company_id)
        q = apply_scope_filter(q, model, user, module)

        if hasattr(model, 'is_active'):
            if is_active is None:
                q = q.filter(model.is_active == True)
            elif is_active.lower() in ('all', 'any'):
                pass
            else:
                active_bool = is_active.lower() in ('true', '1')
                q = q.filter(model.is_active == active_bool)

        if so_id is not None and hasattr(model, 'so_id'):
            q = q.filter(model.so_id == so_id)

        if quotation_id is not None and hasattr(model, 'quotation_id'):
            q = q.filter(model.quotation_id == quotation_id)

        if customer_id is not None and hasattr(model, 'customer_id'):
            q = q.filter(model.customer_id == customer_id)

        if vendor_id is not None and hasattr(model, 'vendor_id'):
            q = q.filter(model.vendor_id == vendor_id)

        if stage_id is not None and hasattr(model, 'stage_id'):
            q = q.filter(model.stage_id == stage_id)

        if crm_lead_id is not None and hasattr(model, 'crm_lead_id'):
            q = q.filter(model.crm_lead_id == crm_lead_id)

        if status is not None and hasattr(model, 'status'):
            if status.lower() == 'active':
                q = q.filter(model.status.notin_(['converted', 'cancelled']))
            elif status.lower() in ('all', 'any'):
                pass
            else:
                q = q.filter(model.status == status)

        if search and hasattr(model, "name"):
            q = q.filter(model.name.ilike(f"%{search}%"))

        # Sort customers alphabetically by name, everything else by id desc
        if hasattr(model, 'name') and getattr(model, '__tablename__', None) == 'customers':
            return paginate(q.order_by(model.name.asc()), page, page_size, counts=counts)
        return paginate(q.order_by(model.id.desc()), page, page_size, counts=counts)

    @router.get("/dropdown")
    def dropdown(
        db:   Session = Depends(get_db),
        user        = Depends(_require_permissions(read_roles, module)),
    ):
        q = db.query(model)
        if company_scoped:
            q = apply_company_filter(q, model, user.active_company_id)
        q = apply_scope_filter(q, model, user, module)
        if hasattr(model, "is_active"):
            q = q.filter(model.is_active == True)
        return [serialize_row(o) for o in q.order_by(model.id).all()]

    @router.get("/{item_id}")
    def get_item(
        item_id: int,
        db:      Session = Depends(get_db),
        user           = Depends(_require_permissions(read_roles, module)),
    ):
        q = db.query(model).filter(model.id == item_id)
        if company_scoped:
            q = apply_company_filter(q, model, user.active_company_id)
        q = apply_scope_filter(q, model, user, module)
        item = q.first()
        if not item:
            raise HTTPException(status_code=404, detail="Not found")

        return serialize_row(item)

    @router.post("/", status_code=201)
    def create_item(
        data: create_schema,
        db:   Session = Depends(get_db),
        user        = Depends(_require_permissions(write_roles, module)),
    ):
        obj_data = data.model_dump()

        if company_scoped:
            from app.models.user import User as UserModel
            from app.models.company import Company as CompanyModel

            if model is UserModel and user.role == "superadmin" and obj_data.get("company_id") is not None:
                target_cid = obj_data["company_id"]
                target_company = db.query(CompanyModel).filter(
                    CompanyModel.id == target_cid,
                    CompanyModel.is_active == True
                ).first()
                if not target_company:
                    raise HTTPException(status_code=400, detail=f"Target company {target_cid} does not exist or is inactive")
                resolved_cid = target_cid
            else:
                # ALWAYS override company_id from the token — never trust the body
                resolved_cid = user.active_company_id or user.company_id
                if resolved_cid is None:
                    raise HTTPException(status_code=400, detail="No active company context — cannot create record")
            obj_data["company_id"] = resolved_cid
        else:
            # Shared/global catalogue (e.g. Process Masters)
            obj_data["company_id"] = None

        # Ownership fields assignment (created_by is uneditable, assigned_to_user_id defaults to created_by)
        if hasattr(model, "created_by"):
            obj_data["created_by"] = user.id
        if hasattr(model, "assigned_to_user_id"):
            if not obj_data.get("assigned_to_user_id"):
                obj_data["assigned_to_user_id"] = user.id

        # Auto-generate code (per-company scoped)
        if code_prefix and code_field:
            obj_data[code_field] = get_next_code(
                db, model, code_field, code_prefix,
                company_id=obj_data.get("company_id"),
            )

        # Parse JSON string fields → proper objects
        for json_field in ['groups', 'lines', 'processes', 'permissions']:
            if json_field in obj_data and isinstance(obj_data[json_field], str):
                try:
                    obj_data[json_field] = json.loads(obj_data[json_field])
                except Exception:
                    pass

        # Strip base64 artwork from lines/groups before saving
        if 'lines' in obj_data and isinstance(obj_data['lines'], list):
            for line in obj_data['lines']:
                if isinstance(line, dict) and line.get('artwork_file'):
                    line['artwork_file'] = None

        if 'groups' in obj_data and isinstance(obj_data['groups'], list):
            for group in obj_data['groups']:
                if isinstance(group, dict) and group.get('artwork_file'):
                    group['artwork_file'] = None

        from app.models.user import User as UserModel
        if model is UserModel:
            if obj_data.get("role") == "superadmin" and user.role != "superadmin":
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            if 'password' in obj_data and obj_data['password']:
                from app.services.auth_service import hash_password
                obj_data['password'] = hash_password(obj_data['password'])

        if hasattr(model, "amount_paid"):
            obj_data.pop("amount_paid", None)
        if hasattr(model, "balance_due"):
            obj_data.pop("balance_due", None)
        if hasattr(model, "total_cost"):
            obj_data.pop("total_cost", None)
        if hasattr(model, "profit_amount"):
            obj_data.pop("profit_amount", None)
        if hasattr(model, "profit_percent"):
            obj_data.pop("profit_percent", None)

        obj_data = stash_extra_fields(model, obj_data)

        if getattr(model, "__tablename__", None) == "workshop_orders":
            from datetime import datetime
            now_iso = datetime.utcnow().isoformat()
            lines = obj_data.get("lines")
            if isinstance(lines, list):
                for line in lines:
                    if isinstance(line, dict):
                        qty = float(line.get("qty") or line.get("quantity") or 1)
                        qty_cut = float(line.get("qty_cut") if line.get("qty_cut") is not None else 0)
                        line["qty_cut"] = qty_cut
                        if qty_cut > 0 or line.get("cut_started_at"):
                            if not line.get("cut_started_at"):
                                line["cut_started_at"] = now_iso
                            line["cut_by_user_id"] = user.id
                        if qty > 0 and qty_cut >= qty:
                            if not line.get("cut_completed_at"):
                                line["cut_completed_at"] = now_iso
                        else:
                            line["cut_completed_at"] = None

            desired_status = obj_data.get("status") or "draft"
            if desired_status == "completed":
                if isinstance(lines, list) and len(lines) > 0:
                    all_complete = all(
                        float(l.get("qty_cut") or 0) >= float(l.get("qty") or l.get("quantity") or 1)
                        and float(l.get("qty") or l.get("quantity") or 1) > 0
                        for l in lines if isinstance(l, dict)
                    )
                    if not all_complete:
                        raise HTTPException(status_code=400, detail="Cannot mark workshop order as completed when lines are uncut.")

            if desired_status != "cancelled":
                if isinstance(lines, list) and len(lines) > 0:
                    all_complete = all(
                        float(l.get("qty_cut") or 0) >= float(l.get("qty") or l.get("quantity") or 1)
                        and float(l.get("qty") or l.get("quantity") or 1) > 0
                        for l in lines if isinstance(l, dict)
                    )
                    any_started = any(
                        bool(l.get("cut_started_at")) or float(l.get("qty_cut") or 0) > 0
                        for l in lines if isinstance(l, dict)
                    )
                    if all_complete:
                        obj_data["status"] = "completed"
                    elif any_started:
                        obj_data["status"] = "in_progress"
                    else:
                        obj_data["status"] = "draft"

        item = model(**obj_data)

        if getattr(model, "__tablename__", None) in ("sales_orders", "quotations"):
            from app.utils.helpers import compute_profit_fields
            tot_c, prof_a, prof_p = compute_profit_fields(item)
            item.total_cost = tot_c
            item.profit_amount = prof_a
            item.profit_percent = prof_p

        # Server-computed invoice financials from allocations
        if getattr(model, "__tablename__", None) == "invoices":
            item.amount_paid = 0.0
            item.balance_due = round(float(item.total_amount or 0), 2)

        db.add(item)
        db.commit()
        db.refresh(item)
        return serialize_row(item)

    @router.put("/{item_id}")
    def update_item(
        item_id: int,
        data:    update_schema,
        db:      Session = Depends(get_db),
        user           = Depends(_require_permissions(write_roles, module)),
    ):
        q = db.query(model).filter(model.id == item_id)
        if company_scoped:
            q = apply_company_filter(q, model, user.active_company_id)
        q = apply_scope_filter(q, model, user, module)
        item = q.first()
        if not item:
            raise HTTPException(status_code=404, detail="Not found")

        update_data = data.model_dump(exclude_unset=True)

        # Never allow financial server-computed fields, company_id or created_by to be changed via update
        update_data.pop("company_id", None)
        update_data.pop("created_by", None)
        update_data.pop("amount_paid", None)
        update_data.pop("balance_due", None)
        update_data.pop("total_cost", None)
        update_data.pop("profit_amount", None)
        update_data.pop("profit_percent", None)

        # Parse JSON string fields → proper objects
        for json_field in ['groups', 'lines', 'processes', 'permissions']:
            if json_field in update_data and isinstance(update_data[json_field], str):
                try:
                    update_data[json_field] = json.loads(update_data[json_field])
                except Exception:
                    pass

        # Strip base64 artwork
        if 'lines' in update_data and isinstance(update_data['lines'], list):
            for line in update_data['lines']:
                if isinstance(line, dict) and line.get('artwork_file'):
                    line['artwork_file'] = None

        if 'groups' in update_data and isinstance(update_data['groups'], list):
            for group in update_data['groups']:
                if isinstance(group, dict) and group.get('artwork_file'):
                    group['artwork_file'] = None

        from app.models.user import User as UserModel
        if model is UserModel:
            if update_data.get("role") == "superadmin" and user.role != "superadmin":
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            if item.id == user.id:
                if "role" in update_data and update_data["role"] != user.role:
                    raise HTTPException(status_code=403, detail="Cannot alter your own role")
                if "is_active" in update_data and update_data["is_active"] != user.is_active:
                    raise HTTPException(status_code=403, detail="Cannot alter your own active status")
            if getattr(item, "role", None) == "superadmin" and update_data.get("is_active") == False:
                active_superadmin_count = db.query(UserModel).filter(
                    UserModel.role == "superadmin",
                    UserModel.is_active == True
                ).count()
                if active_superadmin_count <= 1:
                    raise HTTPException(status_code=403, detail="Cannot deactivate the last remaining active superadmin")
            if 'password' in update_data and update_data['password']:
                from app.services.auth_service import hash_password
                update_data['password'] = hash_password(update_data['password'])

        if getattr(model, "__tablename__", None) == "workshop_orders":
            from datetime import datetime
            now_iso = datetime.utcnow().isoformat()
            lines = update_data.get("lines", getattr(item, "lines", None))
            if isinstance(lines, list):
                for line in lines:
                    if isinstance(line, dict):
                        qty = float(line.get("qty") or line.get("quantity") or 1)
                        qty_cut = float(line.get("qty_cut") if line.get("qty_cut") is not None else 0)
                        line["qty_cut"] = qty_cut
                        if qty_cut > 0 or line.get("cut_started_at"):
                            if not line.get("cut_started_at"):
                                line["cut_started_at"] = now_iso
                            line["cut_by_user_id"] = user.id
                        if qty > 0 and qty_cut >= qty:
                            if not line.get("cut_completed_at"):
                                line["cut_completed_at"] = now_iso
                        else:
                            line["cut_completed_at"] = None
                update_data["lines"] = lines

            desired_status = update_data.get("status", item.status or "draft")
            if desired_status == "completed":
                if isinstance(lines, list) and len(lines) > 0:
                    all_complete = all(
                        float(l.get("qty_cut") or 0) >= float(l.get("qty") or l.get("quantity") or 1)
                        and float(l.get("qty") or l.get("quantity") or 1) > 0
                        for l in lines if isinstance(l, dict)
                    )
                    if not all_complete:
                        raise HTTPException(status_code=400, detail="Cannot mark workshop order as completed when lines are uncut.")

            if desired_status != "cancelled":
                if isinstance(lines, list) and len(lines) > 0:
                    all_complete = all(
                        float(l.get("qty_cut") or 0) >= float(l.get("qty") or l.get("quantity") or 1)
                        and float(l.get("qty") or l.get("quantity") or 1) > 0
                        for l in lines if isinstance(l, dict)
                    )
                    any_started = any(
                        bool(l.get("cut_started_at")) or float(l.get("qty_cut") or 0) > 0
                        for l in lines if isinstance(l, dict)
                    )
                    if all_complete:
                        update_data["status"] = "completed"
                    elif any_started:
                        update_data["status"] = "in_progress"
                    else:
                        update_data["status"] = "draft"

        update_data = stash_extra_fields(model, update_data)
        if 'extra_data' in update_data:
            existing = dict(getattr(item, 'extra_data', None) or {})
            existing.update(update_data['extra_data'] or {})
            update_data['extra_data'] = existing
        for k, v in update_data.items():
            setattr(item, k, v)

        if getattr(model, "__tablename__", None) == "invoices":
            from app.models.payment_allocation import PaymentAllocation
            from sqlalchemy import func
            alloc_sum = (
                db.query(func.sum(PaymentAllocation.amount))
                .filter(
                    PaymentAllocation.invoice_id == item.id,
                    PaymentAllocation.is_active == True,
                )
                .scalar()
            ) or 0.0
            item.amount_paid = round(float(alloc_sum), 2)
            item.balance_due = round(float(item.total_amount or 0) - float(alloc_sum), 2)

        if getattr(model, "__tablename__", None) in ("sales_orders", "quotations"):
            from app.utils.helpers import compute_profit_fields
            tot_c, prof_a, prof_p = compute_profit_fields(item)
            item.total_cost = tot_c
            item.profit_amount = prof_a
            item.profit_percent = prof_p

        db.commit()
        db.refresh(item)
        return serialize_row(item)

    @router.patch("/{item_id}/status")
    def change_status(
        item_id: int,
        data:    dict,
        db:      Session = Depends(get_db),
        user           = Depends(_require_permissions(write_roles, module)),
    ):
        q = db.query(model).filter(model.id == item_id)
        if company_scoped:
            q = apply_company_filter(q, model, user.active_company_id)
        q = apply_scope_filter(q, model, user, module)
        item = q.first()
        if not item:
            raise HTTPException(status_code=404, detail="Not found")

        if getattr(model, "__tablename__", None) == "workshop_orders" and data.get("status") == "completed":
            lines = item.lines or []
            all_complete = False
            if isinstance(lines, list) and len(lines) > 0:
                all_complete = all(
                    float(l.get("qty_cut") or 0) >= float(l.get("qty") or l.get("quantity") or 1)
                    and float(l.get("qty") or l.get("quantity") or 1) > 0
                    for l in lines if isinstance(l, dict)
                )
            if not all_complete:
                raise HTTPException(status_code=400, detail="Cannot mark workshop order as completed when lines are uncut.")

        if hasattr(item, "status"):
            item.status = data.get("status")
        db.commit()
        db.refresh(item)
        return serialize_row(item)

    @router.patch("/{item_id}/archive")
    def archive_item(
        item_id: int,
        db:      Session = Depends(get_db),
        user           = Depends(_require_permissions(write_roles, module)),
    ):
        q = db.query(model).filter(model.id == item_id)
        if company_scoped:
            q = apply_company_filter(q, model, user.active_company_id)
        q = apply_scope_filter(q, model, user, module)
        item = q.first()
        if not item:
            raise HTTPException(status_code=404, detail="Not found")

        from app.models.user import User as UserModel
        if model is UserModel:
            if item.id == user.id:
                raise HTTPException(status_code=403, detail="Cannot archive or delete your own account")
            if getattr(item, "role", None) == "superadmin":
                active_superadmin_count = db.query(UserModel).filter(
                    UserModel.role == "superadmin",
                    UserModel.is_active == True
                ).count()
                if active_superadmin_count <= 1:
                    raise HTTPException(status_code=403, detail="Cannot archive or delete the last remaining active superadmin")

        if hasattr(item, "is_active"):
            item.is_active = False
        db.commit()
        return {"message": "Archived successfully"}

    @router.delete("/{item_id}")
    def delete_item(
        item_id: int,
        db:      Session = Depends(get_db),
        user           = Depends(_require_permissions(write_roles, module)),
    ):
        q = db.query(model).filter(model.id == item_id)
        if company_scoped:
            q = apply_company_filter(q, model, user.active_company_id)
        q = apply_scope_filter(q, model, user, module)
        item = q.first()
        if not item:
            raise HTTPException(status_code=404, detail="Not found")

        from app.models.user import User as UserModel
        if model is UserModel:
            if item.id == user.id:
                raise HTTPException(status_code=403, detail="Cannot archive or delete your own account")
            if getattr(item, "role", None) == "superadmin":
                active_superadmin_count = db.query(UserModel).filter(
                    UserModel.role == "superadmin",
                    UserModel.is_active == True
                ).count()
                if active_superadmin_count <= 1:
                    raise HTTPException(status_code=403, detail="Cannot archive or delete the last remaining active superadmin")

        if hasattr(model, "is_active"):
            item.is_active = False
        else:
            db.delete(item)
        db.commit()
        return {"message": "Deleted"}

    return router