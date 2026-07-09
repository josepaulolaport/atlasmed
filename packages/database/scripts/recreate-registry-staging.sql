-- Recreate empty registry_staging tables from current registry schema.
-- Used after promote swap.

CREATE SCHEMA IF NOT EXISTS registry_staging;

DROP TABLE IF EXISTS registry_staging.professional_workload CASCADE;
DROP TABLE IF EXISTS registry_staging.facility_professionals CASCADE;
DROP TABLE IF EXISTS registry_staging.facility_services CASCADE;
DROP TABLE IF EXISTS registry_staging.facility_representatives CASCADE;
DROP TABLE IF EXISTS registry_staging.facility_physical_installations CASCADE;
DROP TABLE IF EXISTS registry_staging.facility_equipment CASCADE;
DROP TABLE IF EXISTS registry_staging.facility_agreements CASCADE;
DROP TABLE IF EXISTS registry_staging.professionals CASCADE;
DROP TABLE IF EXISTS registry_staging.facilities CASCADE;
DROP TABLE IF EXISTS registry_staging.maintainers CASCADE;
DROP TABLE IF EXISTS registry_staging.service_classifications CASCADE;
DROP TABLE IF EXISTS registry_staging.service_specialties CASCADE;
DROP TABLE IF EXISTS registry_staging.professional_councils CASCADE;
DROP TABLE IF EXISTS registry_staging.occupations CASCADE;
DROP TABLE IF EXISTS registry_staging.physical_installations CASCADE;
DROP TABLE IF EXISTS registry_staging.physical_installation_types CASCADE;
DROP TABLE IF EXISTS registry_staging.installation_subtypes CASCADE;
DROP TABLE IF EXISTS registry_staging.facility_types CASCADE;
DROP TABLE IF EXISTS registry_staging.equipment_catalog CASCADE;
DROP TABLE IF EXISTS registry_staging.equipment_categories CASCADE;
DROP TABLE IF EXISTS registry_staging.deactivation_reasons CASCADE;
DROP TABLE IF EXISTS registry_staging.care_types CASCADE;
DROP TABLE IF EXISTS registry_staging.agreement_types CASCADE;
DROP TABLE IF EXISTS registry_staging.municipalities CASCADE;
DROP TABLE IF EXISTS registry_staging.states CASCADE;

CREATE TABLE registry_staging.states (LIKE registry.states INCLUDING ALL);
CREATE TABLE registry_staging.municipalities (LIKE registry.municipalities INCLUDING ALL);
CREATE TABLE registry_staging.agreement_types (LIKE registry.agreement_types INCLUDING ALL);
CREATE TABLE registry_staging.care_types (LIKE registry.care_types INCLUDING ALL);
CREATE TABLE registry_staging.deactivation_reasons (LIKE registry.deactivation_reasons INCLUDING ALL);
CREATE TABLE registry_staging.equipment_categories (LIKE registry.equipment_categories INCLUDING ALL);
CREATE TABLE registry_staging.equipment_catalog (LIKE registry.equipment_catalog INCLUDING ALL);
CREATE TABLE registry_staging.facility_types (LIKE registry.facility_types INCLUDING ALL);
CREATE TABLE registry_staging.installation_subtypes (LIKE registry.installation_subtypes INCLUDING ALL);
CREATE TABLE registry_staging.physical_installation_types (LIKE registry.physical_installation_types INCLUDING ALL);
CREATE TABLE registry_staging.physical_installations (LIKE registry.physical_installations INCLUDING ALL);
CREATE TABLE registry_staging.occupations (LIKE registry.occupations INCLUDING ALL);
CREATE TABLE registry_staging.professional_councils (LIKE registry.professional_councils INCLUDING ALL);
CREATE TABLE registry_staging.service_specialties (LIKE registry.service_specialties INCLUDING ALL);
CREATE TABLE registry_staging.service_classifications (LIKE registry.service_classifications INCLUDING ALL);
CREATE TABLE registry_staging.maintainers (LIKE registry.maintainers INCLUDING ALL);
CREATE TABLE registry_staging.facilities (LIKE registry.facilities INCLUDING ALL);
CREATE TABLE registry_staging.professionals (LIKE registry.professionals INCLUDING ALL);
CREATE TABLE registry_staging.facility_agreements (LIKE registry.facility_agreements INCLUDING ALL);
CREATE TABLE registry_staging.facility_equipment (LIKE registry.facility_equipment INCLUDING ALL);
CREATE TABLE registry_staging.facility_physical_installations (LIKE registry.facility_physical_installations INCLUDING ALL);
CREATE TABLE registry_staging.facility_representatives (LIKE registry.facility_representatives INCLUDING ALL);
CREATE TABLE registry_staging.facility_services (LIKE registry.facility_services INCLUDING ALL);
CREATE TABLE registry_staging.facility_professionals (LIKE registry.facility_professionals INCLUDING ALL);
CREATE TABLE registry_staging.professional_workload (LIKE registry.professional_workload INCLUDING ALL);
