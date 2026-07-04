import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.deps import get_current_user
from app.utils.helpers import apply_company_filter, paginate, get_next_code


def make_crud_router(
    prefix: str,
    tag: str,
    model,
    create_schema,
    update_schema,
    response_schema,
    code_prefix: str = None,
    code_field: str  = None,
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
        status:       Optional[str] = Query(None),
        db:    Session = Depends(get_db),
        user         = Depends(get_current_user),
    ):
        q = db.query(model)
        q = apply_company_filter(q, model, user)

        if is_active is not None:
            active_bool = is_active.lower() == 'true'
            if hasattr(model, 'is_active'):
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

        if status is not None and hasattr(model, 'status'):
            q = q.filter(model.status == status)

        if search and hasattr(model, "name"):
            q = q.filter(model.name.ilike(f"%{search}%"))

        # Sort customers alphabetically by name, everything else by id desc
        if hasattr(model, 'name') and model.__tablename__ == 'customers':
            return paginate(q.order_by(model.name.asc()), page, page_size)
        return paginate(q.order_by(model.id.desc()), page, page_size)

    @router.get("/dropdown")
    def dropdown(
        db:   Session = Depends(get_db),
        user        = Depends(get_current_user),
    ):
        q = db.query(model)
        q = apply_company_filter(q, model, user)
        if hasattr(model, "is_active"):
            q = q.filter(model.is_active == True)
        return q.order_by(model.id).all()

    @router.get("/{item_id}")
    def get_item(
        item_id: int,
        db:      Session = Depends(get_db),
        user           = Depends(get_current_user),
    ):
        item = db.query(model).filter(model.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Not found")
        return item

    @router.post("/", status_code=201)
    def create_item(
        data: create_schema,
        db:   Session = Depends(get_db),
        user        = Depends(get_current_user),
    ):
        obj_data = data.model_dump()

        # Auto-set company_id
        if not obj_data.get("company_id") and user.company_id:
            obj_data["company_id"] = user.company_id

        # Auto-generate code
        if code_prefix and code_field:
            obj_data[code_field] = get_next_code(
                db, model, code_field, code_prefix
            )

        # Parse JSON string fields → proper objects
        for json_field in ['groups', 'lines', 'processes', 'permissions']:
            if json_field in obj_data and isinstance(obj_data[json_field], str):
                try:
                    obj_data[json_field] = json.loads(obj_data[json_field])
                except Exception:
                    pass

        # Strip base64 artwork from lines/groups before saving
        # Too large for DB — strip it, store filename only
        if 'lines' in obj_data and isinstance(obj_data['lines'], list):
            for line in obj_data['lines']:
                if isinstance(line, dict) and line.get('artwork_file'):
                    line['artwork_file'] = None

        if 'groups' in obj_data and isinstance(obj_data['groups'], list):
            for group in obj_data['groups']:
                if isinstance(group, dict) and group.get('artwork_file'):
                    group['artwork_file'] = None

        # Remove fields that don't exist in model
        # Prevents TypeError: 'xyz' is an invalid keyword argument
        from app.models.user import User as UserModel
        if model is UserModel and 'password' in obj_data and obj_data['password']:
            from app.services.auth_service import hash_password
            obj_data['password'] = hash_password(obj_data['password'])

        valid_columns = {c.key for c in model.__table__.columns}
        obj_data = {k: v for k, v in obj_data.items()
                    if k in valid_columns}

        item = model(**obj_data)
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @router.put("/{item_id}")
    def update_item(
        item_id: int,
        data:    update_schema,
        db:      Session = Depends(get_db),
        user           = Depends(get_current_user),
    ):
        item = db.query(model).filter(model.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Not found")

        update_data = data.model_dump(exclude_unset=True)

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

        # Only update valid model columns
        from app.models.user import User as UserModel
        if model is UserModel and 'password' in update_data and update_data['password']:
            from app.services.auth_service import hash_password
            update_data['password'] = hash_password(update_data['password'])

        valid_columns = {c.key for c in model.__table__.columns}
        for k, v in update_data.items():
            if k in valid_columns:
                setattr(item, k, v)

        db.commit()
        db.refresh(item)
        return item

    @router.patch("/{item_id}/status")
    def change_status(
        item_id: int,
        data:    dict,
        db:      Session = Depends(get_db),
        user           = Depends(get_current_user),
    ):
        item = db.query(model).filter(model.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Not found")
        if hasattr(item, "status"):
            item.status = data.get("status")
        db.commit()
        db.refresh(item)
        return item

    @router.patch("/{item_id}/archive")
    def archive_item(
        item_id: int,
        db:      Session = Depends(get_db),
        user           = Depends(get_current_user),
    ):
        item = db.query(model).filter(model.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Not found")
        if hasattr(item, "is_active"):
            item.is_active = False
        db.commit()
        return {"message": "Archived successfully"}

    @router.delete("/{item_id}")
    def delete_item(
        item_id: int,
        db:      Session = Depends(get_db),
        user           = Depends(get_current_user),
    ):
        item = db.query(model).filter(model.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Not found")
        db.delete(item)
        db.commit()
        return {"message": "Deleted"}

    return router