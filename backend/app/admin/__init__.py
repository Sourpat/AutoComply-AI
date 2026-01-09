"""
Admin Module

⚠️ WARNING: Contains destructive admin operations ⚠️

All endpoints require admin role (X-AutoComply-Role: admin).
"""

from .router import router

__all__ = ["router"]
