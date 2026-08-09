# Essar Glass ERP Backend

FastAPI + SQLAlchemy + PostgreSQL backend powering multi-company glass processing ERP.

## Database Migrations

Automated table creation (`Base.metadata.create_all`) is disabled by default in production (`AUTO_CREATE_TABLES=False`).

All database schema updates **MUST** be applied using Alembic migrations:

```bash
# Run all pending migrations
venv/bin/alembic upgrade head

# Check current revision status
venv/bin/alembic current
```

> [!IMPORTANT]
> Never run `create_all` in production environments as it bypasses migration tracking and can cause schema drift across environments.
