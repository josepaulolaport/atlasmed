-- Módulo-11 CPF check, in the database.
--
-- Needed because the Desempenho warning reports "CPF inválido" as its own
-- count: only the database can say *which* rows those are, for the count and
-- for a paginated list of them. Application code would have to load every CPF
-- clinic in scope just to count them.
--
-- This is the third implementation of the same rule — the others are
-- `isValidCpfDigits` in the API and its Dart twin in the app, which tells a rep
-- as they type. All three are asserted against one shared fixture
-- (packages/database/fixtures/cpf-checksum-cases.json) so a fix applied to one
-- cannot silently pass while the others stay wrong.
--
-- IMMUTABLE, so a partial index can be built on it if `facilities` outgrows a
-- scan. STRICT is deliberate: NULL in means NULL out, so `NOT is_valid_cpf(x)`
-- does not quietly report a clinic with no CPF at all as having an invalid one.
-- "Missing" and "invalid" are separate counts and must not bleed into
-- each other.

CREATE OR REPLACE FUNCTION is_valid_cpf(raw text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
DECLARE
  digits text;
  total  integer;
  check1 integer;
  check2 integer;
  i      integer;
BEGIN
  digits := regexp_replace(raw, '\D', '', 'g');

  IF length(digits) <> 11 THEN
    RETURN false;
  END IF;

  -- 111.111.111-11 and friends satisfy the arithmetic but are not real CPFs,
  -- and they are what gets typed when someone wants past a required field.
  IF digits ~ '^(.)\1{10}$' THEN
    RETURN false;
  END IF;

  total := 0;
  FOR i IN 1..9 LOOP
    total := total + substr(digits, i, 1)::integer * (11 - i);
  END LOOP;
  check1 := 11 - (total % 11);
  IF check1 >= 10 THEN
    check1 := 0;
  END IF;
  IF check1 <> substr(digits, 10, 1)::integer THEN
    RETURN false;
  END IF;

  total := 0;
  FOR i IN 1..10 LOOP
    total := total + substr(digits, i, 1)::integer * (12 - i);
  END LOOP;
  check2 := 11 - (total % 11);
  IF check2 >= 10 THEN
    check2 := 0;
  END IF;

  RETURN check2 = substr(digits, 11, 1)::integer;
END;
$$;--> statement-breakpoint

COMMENT ON FUNCTION is_valid_cpf(text) IS
  'Módulo-11 CPF check. Mirrors isValidCpfDigits in the API and the app; all three share packages/database/fixtures/cpf-checksum-cases.json.';
