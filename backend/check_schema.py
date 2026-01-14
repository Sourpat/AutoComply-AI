"""Check cases table schema."""
import sys
sys.path.insert(0, "C:\\Users\\soura\\Documents\\Projects\\Projects\\AutoComply-AI-fresh\\backend")

from src.core.db import execute_sql

# Get schema
result = execute_sql('PRAGMA table_info(cases)', {})
print("Cases Table Schema:")
print("=" * 60)
for col in result:
    nullable = 'NULL' if not col['notnull'] else 'NOT NULL'
    default = f"DEFAULT {col['dflt_value']}" if col['dflt_value'] else ''
    print(f"{col['name']:20} {col['type']:15} {nullable:10} {default}")

# Get sample record
print("\n\nSample Record:")
print("=" * 60)
sample = execute_sql('SELECT * FROM cases LIMIT 1', {})
if sample:
    for key, value in sample[0].items():
        print(f"{key:20} = {value}")
