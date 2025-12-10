from __future__ import annotations

from pydantic import BaseModel
from fastapi import Header


class TenantContext(BaseModel):
    """
    Represents the tenant identity for a request.

    In a real system this could be derived from:
    - Auth tokens
    - API keys
    - mTLS certs
    This first slice just reads x-autocomply-tenant-id from headers.
    """

    tenant_id: str


async def get_tenant_context(
    x_autocomply_tenant_id: str | None = Header(
        default=None,
        alias="x-autocomply-tenant-id",
    )
) -> TenantContext:
    """
    Dependency that resolves TenantContext for the current request.

    If the header is missing, fall back to a default 'demo-tenant'.
    This keeps existing clients working while being explicit about
    multi-tenant design.
    """
    tenant_id = (x_autocomply_tenant_id or "demo-tenant").strip() or "demo-tenant"
    return TenantContext(tenant_id=tenant_id)
