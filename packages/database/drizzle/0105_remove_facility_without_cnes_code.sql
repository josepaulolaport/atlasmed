-- Removes the one facility that carries no CNES code.
--
-- Spec 0015 makes importing from CNES the only way a facility comes into
-- existence, which means `cnes_code` becomes mandatory. One row predates that
-- rule: it was typed in by hand on 2026-08-09 and the clinic could not be found
-- in the CNES registry when searched.
--
-- What is being removed, recorded here because the delete destroys it:
--
--   facility     HS Clínica de Ortopedia e Cirurgia Plástica
--   CNPJ         23504124000100
--   address      Rua Oscar Freire 2250, Pinheiros, São Paulo/SP, 05409011
--   telephone    (11) 98751-0182
--   vertical     Ortopedia · focus Traumatologia e Ortopedia
--   person       Cida Cida — administrative contact, no council registration
--   note         "Valor comercializado 291,67 - Condição de pagamento: 30/60/90"
--                by Eliana Ferreira <eliana.ferreira@atlasmed.com.br> (REP)
--   assignment   Eliana Ferreira, open since 2026-08-09, never ended
--
-- The rep assignment is ON DELETE RESTRICT on purpose — migration 68464aeb made
-- it so precisely to stop assignment history being deleted as a side effect. It
-- is removed here explicitly rather than by cascade, because for a facility that
-- no longer exists the assignment records coverage of nothing, and leaving it
-- would only block the delete with a constraint error.
--
-- Matched on the CNPJ rather than on `id`: primary keys are not stable across
-- environments, and `DELETE FROM facilities WHERE id = 275` would remove a
-- different clinic anywhere but the database this was written against.
--
-- Idempotent: an environment that never held the row is left alone.

DO $$
DECLARE
  target_id     bigint;
  target_name   text;
  interaction_n integer;
  visit_n       integer;
  order_n       integer;
  document_n    integer;
  assignment_n  integer;
BEGIN
  SELECT id, name INTO target_id, target_name
    FROM facilities
   WHERE legal_document = '23504124000100'
     AND cnes_code IS NULL;

  IF target_id IS NULL THEN
    RAISE NOTICE 'facility 23504124000100 without a cnes_code is not present; nothing to remove';
    RETURN;
  END IF;

  /*
   * Everything ON DELETE RESTRICT that could block this, counted first.
   *
   * Two of them hang off `facility_vertical_profiles`, which cascades from the
   * facility — so they are a second hop and do not appear in a list of what
   * references `facilities` directly. Left to the constraint they abort the
   * migration with a name and no explanation.
   */
  SELECT count(*) INTO interaction_n FROM interactions WHERE facility_id = target_id;
  SELECT count(*) INTO visit_n       FROM visits       WHERE facility_id = target_id;
  SELECT count(*) INTO order_n
    FROM orders
   WHERE facility_vertical_profile_id IN (
           SELECT id FROM facility_vertical_profiles WHERE facility_id = target_id);
  SELECT count(*) INTO document_n
    FROM submission_documents
   WHERE facility_id = target_id
      OR facility_vertical_profile_id IN (
           SELECT id FROM facility_vertical_profiles WHERE facility_id = target_id);

  IF interaction_n > 0 OR visit_n > 0 OR order_n > 0 OR document_n > 0 THEN
    RAISE EXCEPTION
      'facility % (%) carries history this migration will not discard: % interaction(s), '
      '% visit(s), % order(s), % cadastro document(s). Decide what happens to those first.',
      target_id, target_name, interaction_n, visit_n, order_n, document_n;
  END IF;

  /*
   * The rep assignment, explicitly. It is RESTRICT so that assignment history is
   * never lost as a side effect of deleting something else — which is the right
   * default, and the reason this has to be a deliberate statement rather than a
   * cascade.
   */
  DELETE FROM facility_vertical_rep_assignments
   WHERE facility_vertical_profile_id IN (
           SELECT id FROM facility_vertical_profiles WHERE facility_id = target_id);
  GET DIAGNOSTICS assignment_n = ROW_COUNT;

  -- The rest cascades: vertical profile, person link, note, clinical focus,
  -- photos, conformity records, field suggestions, file assets.
  DELETE FROM facilities WHERE id = target_id;

  RAISE NOTICE 'removed facility % (%) and % rep assignment(s) — no CNES code',
    target_id, target_name, assignment_n;
END $$;
