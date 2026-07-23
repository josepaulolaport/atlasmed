-- Seed PF/PJ Cadastro document catalog (idempotent on slug).
INSERT INTO "conformity_requirements" (
  "id",
  "slug",
  "name",
  "description",
  "applies_to_tax_id_type",
  "is_active"
) VALUES
  (
    'creq_identidade',
    'identidade',
    'Identidade',
    'Documento de identidade (RG, CNH ou equivalente).',
    'PF',
    true
  ),
  (
    'creq_crm',
    'crm',
    'CRM',
    'Carteira ou comprovante de registro no Conselho Regional de Medicina.',
    'PF',
    true
  ),
  (
    'creq_comprovante_endereco',
    'comprovante_endereco',
    'Comprovante de Endereço',
    'Pode ser endereço da clínica ou endereço da casa.',
    'PF',
    true
  ),
  (
    'creq_carta_cnpj',
    'carta_cnpj',
    'Carta de CNPJ',
    'Comprovante de inscrição e situação cadastral do CNPJ (Carta/Cartão CNPJ).',
    'PJ',
    true
  ),
  (
    'creq_licenca_sanitaria',
    'licenca_sanitaria',
    'Licença Sanitária',
    'Licença sanitária vigente do estabelecimento.',
    'PJ',
    true
  )
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "applies_to_tax_id_type" = EXCLUDED."applies_to_tax_id_type",
  "is_active" = EXCLUDED."is_active",
  "updated_at" = now();
