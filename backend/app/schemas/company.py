from pydantic import BaseModel
from typing import Optional

# Company fields beyond these are accepted as-is (extra="allow"), like the other
# dynamic schemas. whatsapp_token is write-only: it is accepted here but never
# returned. The generic router returns rows through serialize_row, which removes
# it and adds whatsapp_token_set (see Company.__write_only_columns__).


class CompanyCreate(BaseModel):
    model_config = {"extra": "allow"}
    whatsapp_enabled: bool = False          # create sends every field, so no None here
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_template_quotation: Optional[str] = None
    whatsapp_api_url: Optional[str] = None
    whatsapp_token: Optional[str] = None


class CompanyUpdate(BaseModel):
    model_config = {"extra": "allow"}
    whatsapp_enabled: Optional[bool] = None
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_template_quotation: Optional[str] = None
    whatsapp_api_url: Optional[str] = None
    # Blank or omitted keeps the stored token; only a non-empty value replaces it
    whatsapp_token: Optional[str] = None


class CompanyResponse(BaseModel):
    """Read shape of a company. Never includes whatsapp_token."""
    model_config = {"extra": "allow"}
    whatsapp_enabled: bool = False
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_template_quotation: Optional[str] = None
    whatsapp_api_url: Optional[str] = None
    whatsapp_token_set: bool = False
