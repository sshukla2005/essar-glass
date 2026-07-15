from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def _decode_token(token: str) -> dict:
    """Decode a JWT and return its payload dict, or raise 401."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise credentials_exception


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Return the authenticated User ORM object, augmented with:
      .home_company_id   – company from login (immutable)
      .active_company_id – company currently being viewed (changes on switch)
      .is_read_only      – True when active != home (subject to config flag)
    """
    payload = _decode_token(token)

    user_id: int = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(
        User.id == int(user_id),
        User.is_active == True,
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Attach derived fields directly to the ORM instance (not persisted).
    # Fall back to the legacy company_id claim if the new claims are absent
    # (handles tokens issued before this change was deployed).
    legacy_cid = payload.get("company_id") or user.company_id
    home_cid   = payload.get("home_company_id",   legacy_cid)
    active_cid = payload.get("active_company_id", legacy_cid)

    user.home_company_id   = home_cid
    user.active_company_id = active_cid

    # Compute read-only flag
    if home_cid is None or active_cid is None:
        # No company context → not read-only
        user.is_read_only = False
    elif home_cid == active_cid:
        user.is_read_only = False
    else:
        # Switched to a different company
        if settings.ALLOW_SUPERADMIN_CROSS_EDIT and user.role == "superadmin":
            user.is_read_only = False
        else:
            user.is_read_only = True

    return user


def get_company_scope(current_user: User = Depends(get_current_user)) -> int | None:
    """Dependency that yields active_company_id from the current token.
    Use this in any endpoint that needs to scope queries to the active company.
    """
    return current_user.active_company_id


def require_company(current_user: User = Depends(get_current_user)):
    return current_user


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def require_superadmin(current_user: User = Depends(get_current_user)):
    if current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required",
        )
    return current_user
