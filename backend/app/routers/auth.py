from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.services.auth_service import verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/login")
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.username == form.username,
        User.is_active == True
    ).first()

    if not user or not verify_password(form.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    token = create_access_token(
        user_id=user.id,
        role=user.role,
        company_id=user.company_id
    )

    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": {
            "id":         user.id,
            "name":       user.name,
            "username":   user.username,
            "role":       user.role,
            "company_id": user.company_id,
            "permissions":user.permissions,
        }
    }

@router.get("/me")
def get_me(current_user=Depends(__import__('app.deps', fromlist=['get_current_user']).get_current_user)):
    return current_user
