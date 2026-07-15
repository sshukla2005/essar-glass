from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.models.company import Company
from app.services.auth_service import verify_password, create_access_token
from app.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])


# ── Login ─────────────────────────────────────────────────────────────────────
@router.post("/login")
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(
        User.username == form.username,
        User.is_active == True,
    ).first()

    if not user or not verify_password(form.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # At login: home == active == the user's own company
    token = create_access_token(
        user_id=user.id,
        role=user.role,
        company_id=user.company_id,
        home_company_id=user.company_id,
        active_company_id=user.company_id,
    )

    # Fetch company data including logo
    company_data = None
    if user.company_id:
        company = db.query(Company).filter(Company.id == user.company_id).first()
        if company:
            company_data = {
                "id":         company.id,
                "name":       company.name,
                "short_name": company.short_name,
                "color":      company.color,
                "logo":       company.logo,
            }

    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": {
            "id":                user.id,
            "name":              user.name,
            "username":          user.username,
            "role":              user.role,
            "company_id":        user.company_id,
            "home_company_id":   user.company_id,
            "active_company_id": user.company_id,
            "is_read_only":      False,
            "permissions":       user.permissions,
            "company":           company_data,
        },
    }


# ── Me ────────────────────────────────────────────────────────────────────────
@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id":                current_user.id,
        "name":              current_user.name,
        "username":          current_user.username,
        "role":              current_user.role,
        "company_id":        current_user.company_id,
        "home_company_id":   current_user.home_company_id,
        "active_company_id": current_user.active_company_id,
        "is_read_only":      current_user.is_read_only,
        "permissions":       current_user.permissions,
    }


# ── Switch Company ────────────────────────────────────────────────────────────
class SwitchCompanyRequest(BaseModel):
    company_id: int


@router.post("/switch-company")
def switch_company(
    body: SwitchCompanyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Switch the active company without changing the home company.
    Only superadmin users may switch companies.
    Returns a new JWT with updated active_company_id.
    """
    if current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins may switch companies",
        )

    # Switching back to home company
    if body.company_id == current_user.home_company_id:
        new_active = current_user.home_company_id
    else:
        target = db.query(Company).filter(
            Company.id == body.company_id,
            Company.is_active == True,
        ).first()
        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found or inactive",
            )
        new_active = body.company_id

    new_token = create_access_token(
        user_id=current_user.id,
        role=current_user.role,
        company_id=current_user.company_id,        # legacy claim unchanged
        home_company_id=current_user.home_company_id,
        active_company_id=new_active,
    )

    # Fetch active company details for the response
    active_company = db.query(Company).filter(Company.id == new_active).first()
    active_company_data = None
    if active_company:
        active_company_data = {
            "id":         active_company.id,
            "name":       active_company.name,
            "short_name": active_company.short_name,
            "color":      active_company.color,
            "logo":       active_company.logo,
        }

    is_read_only = (new_active != current_user.home_company_id)
    from app.config import settings as cfg
    if cfg.ALLOW_SUPERADMIN_CROSS_EDIT and current_user.role == "superadmin":
        is_read_only = False

    return {
        "access_token":    new_token,
        "token_type":      "bearer",
        "active_company":  active_company_data,
        "is_read_only":    is_read_only,
        "home_company_id": current_user.home_company_id,
        "active_company_id": new_active,
    }
