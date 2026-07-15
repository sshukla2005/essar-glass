from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(
    user_id: int,
    role: str,
    company_id: int = None,
    home_company_id: int = None,
    active_company_id: int = None,
) -> str:
    """Create a JWT access token.

    home_company_id  — the company the user logged in with (NEVER changes).
    active_company_id — the company currently being viewed (changes on switch).

    Both default to company_id for backward compatibility (login flow).
    """
    expire = datetime.utcnow() + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    # Resolve defaults: if not explicitly supplied, fall back to company_id
    _home   = home_company_id   if home_company_id   is not None else company_id
    _active = active_company_id if active_company_id is not None else company_id

    payload = {
        "sub":               str(user_id),
        "role":              role,
        "company_id":        company_id,        # kept for backward compat
        "home_company_id":   _home,
        "active_company_id": _active,
        "exp":               expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
