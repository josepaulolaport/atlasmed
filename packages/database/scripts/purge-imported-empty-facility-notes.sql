-- Remove the previous system's empty state, imported as if it were a note.
--
-- The 2026-08-09 bulk load wrote one row per clinic per rep reading
-- "Nenhuma observação registrada!" — the label the old screen showed when a
-- clinic had no notes, captured as data. In this snapshot that is 1,381 of the
-- 1,437 rows in `facility_notes`; the other 56 are real.
--
-- The API already hides them (see IMPORTED_EMPTY_NOTE in
-- drizzle-facility-note.repository.ts), so nothing depends on this running.
-- It exists for when somebody decides the rows should be gone rather than
-- filtered. Deliberately a script and not a migration: a delete cannot be
-- undone by rolling forward, and this is a judgement about data rather than a
-- change to the schema.
--
-- Run it inside the transaction below, read the two counts, and only then
-- COMMIT. Dry run first:
--
--   psql "$DATABASE_URL" -f packages/database/scripts/purge-imported-empty-facility-notes.sql

begin;

-- What is about to go, and what will remain.
select
  count(*) filter (where note = 'Nenhuma observação registrada!') as to_delete,
  count(*) filter (where note <> 'Nenhuma observação registrada!') as kept
from facility_notes;

delete from facility_notes
where note = 'Nenhuma observação registrada!';

select count(*) as remaining from facility_notes;

-- Change to `commit;` once the numbers above are what you expect.
rollback;
