-- Replace partial unique index with a proper UNIQUE CONSTRAINT
-- (PostgREST on_conflict requires a UNIQUE CONSTRAINT, not just an index)
DROP INDEX IF EXISTS contacts_client_facebook_page_id_key;

ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_client_facebook_page_id_key,
  ADD CONSTRAINT contacts_client_facebook_page_id_key UNIQUE (client_id, facebook_page_id);
