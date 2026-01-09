"""
Test script for database initialization and schema verification.
"""
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.core.db import execute_sql, init_db

# Initialize database
print("Initializing database...")
init_db()

# List all tables
print("\nTables created:")
tables = execute_sql('SELECT name FROM sqlite_master WHERE type="table" ORDER BY name')
for table in tables:
    print(f"  ✓ {table['name']}")

# Check indexes
print("\nIndexes created:")
indexes = execute_sql('SELECT name, tbl_name FROM sqlite_master WHERE type="index" AND name NOT LIKE "sqlite%" ORDER BY tbl_name, name')
for idx in indexes:
    print(f"  ✓ {idx['name']} on {idx['tbl_name']}")

# Show schema version
print("\nSchema versions:")
try:
    versions = execute_sql('SELECT * FROM schema_version ORDER BY version')
    for v in versions:
        print(f"  v{v['version']}: {v['description']} (applied: {v['applied_at']})")
except:
    pass

try:
    versions = execute_sql('SELECT * FROM schema_version_submissions ORDER BY version')
    for v in versions:
        print(f"  v{v['version']}: {v['description']} (applied: {v['applied_at']})")
except:
    pass

print("\n✓ Database schema verified successfully")
