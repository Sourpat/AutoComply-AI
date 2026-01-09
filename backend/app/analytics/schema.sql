-- Analytics Saved Views Schema
-- Step 2.12: Saved Analytics Views

-- Saved views for analytics dashboard and console filters
CREATE TABLE IF NOT EXISTS saved_views (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    name TEXT NOT NULL,
    scope TEXT NOT NULL,  -- "analytics" or "console"
    view_json TEXT NOT NULL,  -- JSON string containing filters, columns, layout
    owner TEXT,  -- actor/username who owns this view (NULL = system view)
    is_shared INTEGER DEFAULT 0  -- 1 = shared with all users, 0 = private
);

-- Index for filtering by scope and owner
CREATE INDEX IF NOT EXISTS idx_saved_views_scope ON saved_views(scope);
CREATE INDEX IF NOT EXISTS idx_saved_views_owner ON saved_views(owner);
CREATE INDEX IF NOT EXISTS idx_saved_views_scope_owner ON saved_views(scope, owner);
