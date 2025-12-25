"""Test importing and calling the ops summary endpoint directly."""
import asyncio
from src.api.routes.ops import get_ops_summary
from src.database.connection import get_db

async def test():
    db = next(get_db())
    try:
        result = await get_ops_summary(db)
        print(f"✅ Success! Result: {result}")
    except Exception as e:
        print(f"❌ Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test())
