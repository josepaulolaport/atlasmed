-- Ortopedia catalogue: competitor products, equivalences, and the ampolas_mes
-- metric (spec 0013 §3, §4.1).
--
-- A DATA migration, not a schema one. Requested deliberately so the catalogue
-- reaches production through the normal deploy path rather than a script someone
-- has to remember to run.
--
-- Source: app.atlasmed-br.com.br /main/brasindice and /main/info_*, read
-- 2026-08-11. Prices are Brasíndice/SIMPRO published values.
--
-- IDEMPOTENT throughout. Every insert is guarded, so re-running is a no-op and a
-- partial failure can be retried. Products are matched on `id_produto_emultec`
-- (the ERP's key) and competitors on (name, manufacturer) — never on our own
-- serial ids, which differ between environments.
--
-- ⚠️ Prices change with each Brasíndice publication. This migration is the FIRST
-- LOAD only; later corrections belong to the admin catalogue screens, not to a
-- new migration per publication.

-- ⚠️ NO-OP ON A DATABASE WITHOUT THE ORTOPEDIA VERTICAL.
--
-- `business_verticals` is seeded by no migration, so a fresh database (CI, a new
-- environment) has none. Without the vertical this catalogue has nowhere to
-- live: the definition and the links would find no home while the 42 competitor
-- products landed anyway, leaving orphans and no metric. Every insert below is
-- therefore guarded on the vertical existing, so a fresh database gets nothing
-- rather than half of something.

-- ── 1. Retire superseded Emultec SKUs ───────────────────────────────────────
-- Deactivated, never deleted: order_items.product_id is NO ACTION and Emultec id
-- 5 carries an INVOICED sale from 2024-10-14. Deleting would destroy financial
-- history to tidy a catalogue. They stay linked to the metric below, because
-- their order history still counts toward the numerator.
UPDATE products SET is_active = false, updated_at = now()
 WHERE id_produto_emultec IN (4, 5, 6) AND is_active;
--> statement-breakpoint

-- ── 2. Our products: registry codes and Brasíndice prices ───────────────────
UPDATE products SET simpro_code = '00308555', brasindice_code = '024847', tiss_code = '0000094527', price = 1840.00, price_17 = 1840.00, price_18 = 1840.00, price_20 = 1840.00, brasindice_updated_at = DATE '2025-07-14', updated_at = now() WHERE id_produto_emultec = 1;--> statement-breakpoint
UPDATE products SET simpro_code = '00308556', brasindice_code = '024848', tiss_code = '0000094529', price = 3175.00, price_17 = 3175.00, price_18 = 3175.00, price_20 = 3175.00, brasindice_updated_at = DATE '2025-07-14', updated_at = now() WHERE id_produto_emultec = 2;--> statement-breakpoint
UPDATE products SET simpro_code = '00312308', brasindice_code = '025122', tiss_code = '0000094528', price = 5150.00, price_17 = 5150.00, price_18 = 5150.00, price_20 = 5150.00, brasindice_updated_at = DATE '2025-07-14', updated_at = now() WHERE id_produto_emultec = 3;--> statement-breakpoint
UPDATE products SET simpro_code = '0359465', brasindice_code = '028063', tiss_code = '0000092106', price = 2900.00, price_17 = 2900.00, price_18 = 2900.00, price_20 = 2900.00, brasindice_updated_at = DATE '2025-07-14', updated_at = now() WHERE id_produto_emultec = 2426;--> statement-breakpoint
UPDATE products SET simpro_code = '0359466', brasindice_code = '028064', tiss_code = '0000092107', price = 4870.00, price_17 = 4870.00, price_18 = 4870.00, price_20 = 4870.00, brasindice_updated_at = DATE '2025-07-14', updated_at = now() WHERE id_produto_emultec = 2427;--> statement-breakpoint
UPDATE products SET simpro_code = '0359467', brasindice_code = '028065', tiss_code = '0000092108', price = 5870.00, price_17 = 5870.00, price_18 = 5870.00, price_20 = 5870.00, brasindice_updated_at = DATE '2025-07-14', updated_at = now() WHERE id_produto_emultec = 2428;--> statement-breakpoint
UPDATE products SET price = 2855.00, price_17 = 2855.00, price_18 = 2855.00, price_20 = 2855.00, brasindice_updated_at = DATE '2025-07-14', updated_at = now() WHERE id_produto_emultec = 2429;--> statement-breakpoint
UPDATE products SET simpro_code = '0359469', brasindice_code = '028067', tiss_code = '0000092110', price = 4650.00, price_17 = 4650.00, price_18 = 4650.00, price_20 = 4650.00, brasindice_updated_at = DATE '2025-07-14', updated_at = now() WHERE id_produto_emultec = 2430;--> statement-breakpoint
UPDATE products SET simpro_code = '0359470', brasindice_code = '028068', tiss_code = '0000092111', price = 5650.00, price_17 = 5650.00, price_18 = 5650.00, price_20 = 5650.00, brasindice_updated_at = DATE '2025-07-14', updated_at = now() WHERE id_produto_emultec = 2431;--> statement-breakpoint

-- ── 3. Competitor products ──────────────────────────────────────────────────
-- Matched on (name, manufacturer): competitors carry no EAN and no Emultec id,
-- and the same brand appears under several manufacturers.
-- metric_units = 1 — the metric is ampolas/mês and these are single pre-filled
-- syringes, so one unit is one ampoule. Not a placeholder.
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'SINGJOINT 24MG / 2ML', 'HANGZHOU', 'CHINA', 8000.00, 8000.00, 8000.00, DATE '2025-05-07', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'SINGJOINT 24MG / 2ML' AND manufacturer = 'HANGZHOU' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'KYERON SYNOZ 2ML', 'CROMA-PHARMA', 'AUSTRIA', 6500.00, 6500.00, 6500.00, DATE '2025-05-07', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'KYERON SYNOZ 2ML' AND manufacturer = 'CROMA-PHARMA' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'SINGJOINT 20MG / 2ML', 'HANGZHOU', 'CHINA', 6000.00, 6000.00, 6000.00, DATE '2025-05-07', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'SINGJOINT 20MG / 2ML' AND manufacturer = 'HANGZHOU' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'HYACLEAN 20MG / 2ML', 'HANGZHOU', 'CHINA', 4000.00, 4000.00, 4000.00, DATE '2025-05-07', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'HYACLEAN 20MG / 2ML' AND manufacturer = 'HANGZHOU' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'HYACLEAN 24MG / 2ML', 'HANGZHOU', 'CHINA', 3400.00, 3400.00, 3400.00, DATE '2025-05-07', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'HYACLEAN 24MG / 2ML' AND manufacturer = 'HANGZHOU' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'BIOVISC ORTHO 20MG / 2ML', 'BIOTECH VISION', 'INDIA', 1807.06, 1807.06, 1807.06, DATE '2025-03-24', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'BIOVISC ORTHO 20MG / 2ML' AND manufacturer = 'BIOTECH VISION' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'SUPRAHYAL DUO', 'MEIJI PHARMA', 'ESPANHA', 1510.32, 1528.74, 1566.96, DATE '2025-05-15', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'SUPRAHYAL DUO' AND manufacturer = 'MEIJI PHARMA' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'KD INTRA-ARTICULAR GEL 1.0% 2ML', 'ALBOMED', 'ALEMANHA', 1550.00, 1550.00, 1550.00, DATE '2024-12-23', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'KD INTRA-ARTICULAR GEL 1.0% 2ML' AND manufacturer = 'ALBOMED' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'NUTRIVISC 42MG / 2ML', 'LEBON', 'BRASIL', 1290.00, 1305.73, 1338.38, DATE '2024-01-31', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'NUTRIVISC 42MG / 2ML' AND manufacturer = 'LEBON' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'OSTEONIL', 'TRB', 'ALEMANHA', 1080.00, 1080.00, 1080.00, DATE '2025-02-05', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'OSTEONIL' AND manufacturer = 'TRB' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'POLIREUMIN', 'FIDIA', 'ITALIA', 606.70, 614.09, 629.44, DATE '2024-06-17', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'POLIREUMIN' AND manufacturer = 'FIDIA' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'EUFLEXXA', 'BIO-TECHNOLOGY', 'ISRAEL', 485.81, 491.74, 504.03, DATE '2025-05-15', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'EUFLEXXA' AND manufacturer = 'BIO-TECHNOLOGY' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'KD INTRA-ARTICULAR GEL 2.2% 2ML', 'ALBOMED', 'ALEMANHA', 3996.00, 3996.00, 3996.00, DATE '2024-12-23', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'KD INTRA-ARTICULAR GEL 2.2% 2ML' AND manufacturer = 'ALBOMED' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'CIENTIFIC SYNOVIAL 40MG - 20MG / 2ML', 'ALLANMAR', 'ARGENTINA', 3204.00, 3392.50, 3769.45, DATE '2024-12-06', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'CIENTIFIC SYNOVIAL 40MG - 20MG / 2ML' AND manufacturer = 'ALLANMAR' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'SYALOSET 2000 1.5% 30MG / 2ML', 'SAVIO', 'ITALIA', 3200.00, 3200.00, 3200.00, DATE '2025-05-07', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'SYALOSET 2000 1.5% 30MG / 2ML' AND manufacturer = 'SAVIO' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'BIOVISC ORTHO PLUS 40MG / 2ML', 'BIOTECH VISION', 'INDIA', 3174.92, 3174.92, 3174.92, DATE '2025-03-24', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'BIOVISC ORTHO PLUS 40MG / 2ML' AND manufacturer = 'BIOTECH VISION' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'KD INTRA-ARTICULAR GEL 1.6% 2ML', 'ALBOMED', 'ALEMANHA', 2780.00, 2780.00, 2780.00, DATE '2024-12-23', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'KD INTRA-ARTICULAR GEL 1.6% 2ML' AND manufacturer = 'ALBOMED' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'RENEHAVIS', 'MDT', 'SUIÇA', 2544.45, 2575.48, 2639.86, DATE '2025-05-15', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'RENEHAVIS' AND manufacturer = 'MDT' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'HYALUBRIX - 30MG / 2ML', 'FIDIA', 'ITALIA', 2500.00, 2500.00, 2500.00, DATE '2024-08-12', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'HYALUBRIX - 30MG / 2ML' AND manufacturer = 'FIDIA' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'SYNOLIS VA 40 / 2ML', 'APTISSEN', 'SUIÇA', 2409.41, 2409.41, 2409.41, DATE '2024-04-02', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'SYNOLIS VA 40 / 2ML' AND manufacturer = 'APTISSEN' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'SYNOVIUM 40MG / 2ML', 'LCA', 'FRANCA', 1750.00, 1750.00, 1750.00, DATE '2024-08-12', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'SYNOVIUM 40MG / 2ML' AND manufacturer = 'LCA' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'OSTEONIL PLUS', 'TRB', 'ALEMANHA', 1704.00, 1704.00, 1704.00, DATE '2025-02-05', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'OSTEONIL PLUS' AND manufacturer = 'TRB' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'SYNVISC 2ML', 'GENZYME', 'EUA', 1171.22, 1185.50, 1215.14, DATE '2025-05-15', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'SYNVISC 2ML' AND manufacturer = 'GENZYME' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'ORTHOVISC 30MG / 2ML', 'ANIKA', 'EUA', 1095.12, 1095.12, 1095.12, DATE '2025-05-07', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'ORTHOVISC 30MG / 2ML' AND manufacturer = 'ANIKA' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'HYAJOINT PLUS 60MG / 3ML', 'SCIVISION', 'TAIWAN', 6000.00, 6000.00, 6000.00, DATE '2025-05-07', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'HYAJOINT PLUS 60MG / 3ML' AND manufacturer = 'SCIVISION' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'BIOVISC ORTHO SINGLE 90MG / 3ML', 'BIOTECH VISION', 'INDIA', 5145.56, 5145.56, 5145.56, DATE '2025-03-24', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'BIOVISC ORTHO SINGLE 90MG / 3ML' AND manufacturer = 'BIOTECH VISION' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'CIENTIFIC SYNOVIAL 60MG - 30MG / 2ML', 'ALLANMAR', 'ARGENTINA', 4322.70, 4577.00, 5085.60, DATE '2024-12-06', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'CIENTIFIC SYNOVIAL 60MG - 30MG / 2ML' AND manufacturer = 'ALLANMAR' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'KD INTRA-ARTICULAR GEL ONE 2.5% 4.8ML', 'ALBOMED', 'ALEMANHA', 4977.00, 4977.00, 4977.00, DATE '2024-12-23', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'KD INTRA-ARTICULAR GEL ONE 2.5% 4.8ML' AND manufacturer = 'ALBOMED' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'HYACLEAN 40MG / 2ML', 'HANGZHOU', 'CHINA', 4800.00, 4800.00, 4800.00, DATE '2025-05-07', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'HYACLEAN 40MG / 2ML' AND manufacturer = 'HANGZHOU' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'SUPRAHYAL ONE', 'MEIJI PHARMA', 'ESPANHA', 4570.31, 4626.04, 4741.70, DATE '2025-05-15', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'SUPRAHYAL ONE' AND manufacturer = 'MEIJI PHARMA' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'KD INTRA-ARTICULAR GEL ONE 2.5% 3ML', 'ALBOMED', 'ALEMANHA', 4524.25, 4524.25, 4524.25, DATE '2024-12-23', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'KD INTRA-ARTICULAR GEL ONE 2.5% 3ML' AND manufacturer = 'ALBOMED' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'HYALONE - 60MG / 4ML', 'FIDIA', 'ITALIA', 4500.00, 4500.00, 4500.00, DATE '2024-08-12', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'HYALONE - 60MG / 4ML' AND manufacturer = 'FIDIA' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'DUROLANE 60MG / 3ML', 'BIOVENTUS', 'EUA', 4235.02, 4286.67, 4393.83, DATE '2025-05-15', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'DUROLANE 60MG / 3ML' AND manufacturer = 'BIOVENTUS' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'SYNOLIS VA 80 / 4ML', 'APTISSEN', 'SUIÇA', 4354.25, 4354.25, 4354.25, DATE '2024-04-02', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'SYNOLIS VA 80 / 4ML' AND manufacturer = 'APTISSEN' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'MONOVISC 22MG / 4ML', 'ANIKA', 'EUA', 4321.20, 4321.20, 4321.20, DATE '2025-05-07', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'MONOVISC 22MG / 4ML' AND manufacturer = 'ANIKA' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'SYNOVIUM 75MG / 3ML', 'LCA', 'FRANCA', 4300.00, 4300.00, 4300.00, DATE '2024-08-12', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'SYNOVIUM 75MG / 3ML' AND manufacturer = 'LCA' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'OPUS 3F 2ML', 'DMC', 'BRASIL', 4004.53, 4004.53, 4004.53, DATE '2024-01-31', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'OPUS 3F 2ML' AND manufacturer = 'DMC' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'SYNVISC ONE 6ML', 'GENZYME', 'EUA', 3452.73, 3494.84, 3582.21, DATE '2025-05-15', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'SYNVISC ONE 6ML' AND manufacturer = 'GENZYME' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'OPUS 2F 2ML', 'DMC', 'BRASIL', 3554.53, 3554.53, 3554.53, DATE '2024-01-31', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'OPUS 2F 2ML' AND manufacturer = 'DMC' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'NUTRIVISC 105MG / 5ML', 'LEBON', 'BRASIL', 3225.00, 3264.33, 3345.94, DATE '2024-01-31', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'NUTRIVISC 105MG / 5ML' AND manufacturer = 'LEBON' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'CURAVISC 20MG / 2ML', 'CURASAN', 'ALEMANHA', 2890.00, 2890.00, 2890.00, DATE '2024-01-31', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'CURAVISC 20MG / 2ML' AND manufacturer = 'CURASAN' AND ownership = 'COMPETITOR');--> statement-breakpoint
INSERT INTO products (name, manufacturer, country_of_origin, price_17, price_18, price_20, brasindice_updated_at, ownership, metric_units, is_active)
SELECT 'OPUS LIGHT', 'DMC', 'BRASIL', 2419.52, 2419.52, 2419.52, DATE '2024-01-31', 'COMPETITOR', 1, true
 WHERE EXISTS (SELECT 1 FROM business_verticals WHERE code = 'ORTOPEDIA')
   AND NOT EXISTS (SELECT 1 FROM products WHERE name = 'OPUS LIGHT' AND manufacturer = 'DMC' AND ownership = 'COMPETITOR');--> statement-breakpoint

-- Every competitor belongs to the Ortopedia vertical.
INSERT INTO product_verticals (product_id, vertical_id)
SELECT p.id, v.id FROM products p CROSS JOIN business_verticals v
 WHERE p.ownership = 'COMPETITOR' AND v.code = 'ORTOPEDIA'
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- ── 4. Equivalences ─────────────────────────────────────────────────────────
-- Populates the rep's competitor picker (spec 0013 §4.1). Directional: our
-- product on the left, the competitor on the right. A product is never its own
-- competitor, so our own row on the Brasíndice page is deliberately absent here.
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 1 AND c.name = 'SINGJOINT 24MG / 2ML' AND c.manufacturer = 'HANGZHOU' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 1 AND c.name = 'KYERON SYNOZ 2ML' AND c.manufacturer = 'CROMA-PHARMA' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 1 AND c.name = 'SINGJOINT 20MG / 2ML' AND c.manufacturer = 'HANGZHOU' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 1 AND c.name = 'HYACLEAN 20MG / 2ML' AND c.manufacturer = 'HANGZHOU' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 1 AND c.name = 'HYACLEAN 24MG / 2ML' AND c.manufacturer = 'HANGZHOU' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 1 AND c.name = 'BIOVISC ORTHO 20MG / 2ML' AND c.manufacturer = 'BIOTECH VISION' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 1 AND c.name = 'SUPRAHYAL DUO' AND c.manufacturer = 'MEIJI PHARMA' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 1 AND c.name = 'KD INTRA-ARTICULAR GEL 1.0% 2ML' AND c.manufacturer = 'ALBOMED' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 1 AND c.name = 'NUTRIVISC 42MG / 2ML' AND c.manufacturer = 'LEBON' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 1 AND c.name = 'OSTEONIL' AND c.manufacturer = 'TRB' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 1 AND c.name = 'POLIREUMIN' AND c.manufacturer = 'FIDIA' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 1 AND c.name = 'EUFLEXXA' AND c.manufacturer = 'BIO-TECHNOLOGY' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 2 AND c.name = 'KD INTRA-ARTICULAR GEL 2.2% 2ML' AND c.manufacturer = 'ALBOMED' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 2 AND c.name = 'CIENTIFIC SYNOVIAL 40MG - 20MG / 2ML' AND c.manufacturer = 'ALLANMAR' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 2 AND c.name = 'SYALOSET 2000 1.5% 30MG / 2ML' AND c.manufacturer = 'SAVIO' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 2 AND c.name = 'BIOVISC ORTHO PLUS 40MG / 2ML' AND c.manufacturer = 'BIOTECH VISION' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 2 AND c.name = 'KD INTRA-ARTICULAR GEL 1.6% 2ML' AND c.manufacturer = 'ALBOMED' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 2 AND c.name = 'RENEHAVIS' AND c.manufacturer = 'MDT' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 2 AND c.name = 'HYALUBRIX - 30MG / 2ML' AND c.manufacturer = 'FIDIA' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 2 AND c.name = 'SYNOLIS VA 40 / 2ML' AND c.manufacturer = 'APTISSEN' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 2 AND c.name = 'SYNOVIUM 40MG / 2ML' AND c.manufacturer = 'LCA' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 2 AND c.name = 'OSTEONIL PLUS' AND c.manufacturer = 'TRB' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 2 AND c.name = 'SYNVISC 2ML' AND c.manufacturer = 'GENZYME' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 2 AND c.name = 'ORTHOVISC 30MG / 2ML' AND c.manufacturer = 'ANIKA' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'HYAJOINT PLUS 60MG / 3ML' AND c.manufacturer = 'SCIVISION' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'BIOVISC ORTHO SINGLE 90MG / 3ML' AND c.manufacturer = 'BIOTECH VISION' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'CIENTIFIC SYNOVIAL 60MG - 30MG / 2ML' AND c.manufacturer = 'ALLANMAR' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'KD INTRA-ARTICULAR GEL ONE 2.5% 4.8ML' AND c.manufacturer = 'ALBOMED' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'HYACLEAN 40MG / 2ML' AND c.manufacturer = 'HANGZHOU' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'SUPRAHYAL ONE' AND c.manufacturer = 'MEIJI PHARMA' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'KD INTRA-ARTICULAR GEL ONE 2.5% 3ML' AND c.manufacturer = 'ALBOMED' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'HYALONE - 60MG / 4ML' AND c.manufacturer = 'FIDIA' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'DUROLANE 60MG / 3ML' AND c.manufacturer = 'BIOVENTUS' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'SYNOLIS VA 80 / 4ML' AND c.manufacturer = 'APTISSEN' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'MONOVISC 22MG / 4ML' AND c.manufacturer = 'ANIKA' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'SYNOVIUM 75MG / 3ML' AND c.manufacturer = 'LCA' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'OPUS 3F 2ML' AND c.manufacturer = 'DMC' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'SYNVISC ONE 6ML' AND c.manufacturer = 'GENZYME' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'OPUS 2F 2ML' AND c.manufacturer = 'DMC' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'NUTRIVISC 105MG / 5ML' AND c.manufacturer = 'LEBON' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'CURAVISC 20MG / 2ML' AND c.manufacturer = 'CURASAN' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO product_equivalences (product_id, competitor_product_id)
SELECT o.id, c.id FROM products o, products c
 WHERE o.id_produto_emultec = 3 AND c.name = 'OPUS LIGHT' AND c.manufacturer = 'DMC' AND c.ownership = 'COMPETITOR'
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- ── 5. The metric, and what counts toward it ────────────────────────────────
INSERT INTO product_potential_definitions (vertical_id, key, label)
SELECT v.id, 'ampolas_mes', 'Ampolas/mês' FROM business_verticals v
 WHERE v.code = 'ORTOPEDIA'
   AND NOT EXISTS (
     SELECT 1 FROM product_potential_definitions d
      WHERE d.vertical_id = v.id AND d.key = 'ampolas_mes' AND d.deleted_at IS NULL
   );--> statement-breakpoint

-- Every OWN product, including the three deactivated SKUs: a retired product
-- still has order history, and omitting it would silently drop those units from
-- the numerator.
INSERT INTO product_potential_links (product_id, definition_id, vertical_id)
SELECT p.id, d.id, d.vertical_id
  FROM products p
  JOIN product_potential_definitions d ON d.key = 'ampolas_mes' AND d.deleted_at IS NULL
  JOIN business_verticals v ON v.id = d.vertical_id AND v.code = 'ORTOPEDIA'
 WHERE p.ownership = 'OWN'
ON CONFLICT DO NOTHING;
