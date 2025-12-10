from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.autocomply.tenancy.context import TenantContext, get_tenant_context


class TenantWhoAmIResponse(BaseModel):
    tenant_id: str
    note: str


router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("/whoami", response_model=TenantWhoAmIResponse)
async def who_am_i(
    tenant: TenantContext = Depends(get_tenant_context),
) -> TenantWhoAmIResponse:
    """
    Simple diagnostic endpoint to verify that tenant IDs are being
    passed and resolved correctly.
    """
    return TenantWhoAmIResponse(
        tenant_id=tenant.tenant_id,
        note="Derived from x-autocomply-tenant-id header, or 'demo-tenant' fallback.",
    )
