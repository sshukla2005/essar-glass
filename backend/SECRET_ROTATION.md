# Secret Key Rotation Procedure

This document outlines the steps for rotating the JWT `SECRET_KEY` in Essar Glass ERP.

> [!WARNING]
> Rotating the `SECRET_KEY` invalidates all currently active JWT tokens. All users will be immediately logged out and must log in again to receive new authentication tokens.

## Prerequisites
- Administrative access to the server / deployment environment.
- OpenSSL CLI installed.

## Rotation Steps

### 1. Generate a New Cryptographic Key
Run the following command in a terminal to generate a secure 256-bit (64 hex characters) secret key:

```bash
openssl rand -hex 32
```

### 2. Update Environment Variables
Update the `SECRET_KEY` variable in the backend `.env` file or environment settings:

```env
SECRET_KEY=your_new_generated_64_character_hex_key_here
```

### 3. Restart Application Service
Restart the FastAPI backend application server so the new secret key is loaded into memory:

```bash
# Example for systemd service:
sudo systemctl restart essar-glass-backend

# Or if running via Docker:
docker compose restart backend
```

### 4. Verification
Check the backend server logs to verify startup succeeded without key length or validation errors:

```bash
journalctl -u essar-glass-backend -n 50 --no-pager
```
