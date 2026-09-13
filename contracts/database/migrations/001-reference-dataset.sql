-- Delta applied to a database already created from schema.sql, so it can hold
-- the historical reference set (docs/data-model.md §6).
--
-- schema.sql already carries both changes: this file exists for databases that
-- were created before them. Applying it twice is safe.

-- The terminal outcome the reference set observes. ALTER TYPE ... ADD VALUE
-- cannot run inside a transaction block, so this statement stands alone.
ALTER TYPE outcome_kind_t ADD VALUE IF NOT EXISTS 'bankruptcy';

-- Which external set a snapshot came from. NULL is the product's own data.
ALTER TABLE company_snapshots ADD COLUMN IF NOT EXISTS dataset TEXT;
