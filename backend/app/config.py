from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    APP_NAME: str = "Essar Glass ERP"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    ALLOWED_ORIGINS: str = "http://localhost:5173"
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 5242880

    # ── Company isolation flags ──────────────────────────────────────────
    # ASSUMPTION 1: Read-only-on-switch applies to ALL roles including
    # Super Admin.  Set to True to allow superadmin to edit cross-company.
    ALLOW_SUPERADMIN_CROSS_EDIT: bool = False

    @property
    def origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    class Config:
        env_file = ".env"

settings = Settings()
