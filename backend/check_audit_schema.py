"""Check audit_events table schema."""
import sys
sys.path.insert(0, "C:\\Users\\soura\\Documents\\Projects\\Projects\\AutoComply-AI-fresh\\backend")

from src.core.db import execute_sql

# Get schema
result = execute_sql('PRAGMA table_info(audit_events)', {})
print("Audit Events Table Schema:")
print("=" * 60)
for col in result:
    print(f"{col['name']:20} {col['type']}")
