-- ============================================================
-- FIX: acquire_brand_lock()/releaseBrandLock() fail with
-- "permission denied for table brand_locks" because 005_execution_engine.sql
-- created brand_locks and enabled RLS but never granted service_role the
-- table-level DML privileges it needs -- RLS bypass (service_role's
-- BYPASSRLS attribute) is a separate privilege layer from table GRANTs,
-- and only the latter was missing. acquire_brand_lock() runs
-- SECURITY INVOKER (the default), so its internal INSERT/UPDATE execute
-- as the calling role (service_role via PostgREST), which had no grant.
-- Mirrors the working precedent in platform.sql:86 for the same
-- service-role-only table pattern. Purely additive; safe to run twice.
-- ============================================================

grant select, insert, update, delete on table brand_locks to service_role;
