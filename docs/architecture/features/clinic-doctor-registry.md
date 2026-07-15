# Feature: Facility, Professional, and Registry Ingestion

## Current State

Atlasmed has early clinic and doctor domain support, including clinic records, doctor records, facility-professional associations, and external registry ingestion workflows.

## Current Data Concepts

- Facility (Pessoa Jurídica / CNPJ or Pessoa Física / CPF — discriminated by `taxIdType` enum).
- Doctor (professional).
- Doctor-clinic association.
- Facility services (`facility_services`) — healthcare services offered by a facility, sourced from CNES `rlEstabServClass` and synced each ingestion cycle.
- Ingestion run.
- Ingestion suggestion.

### Facility types

A facility is typed by its tax registration:

| `taxIdType` | Tax ID | Meaning |
|---|---|---|
| `PJ` | CNPJ | Pessoa Jurídica — legal entity (clinic, hospital, lab) |
| `PF` | CPF | Pessoa Física — individual practitioner operating as a service point |

The type is derived from the CNES registry at ingestion time and backfilled on existing rows from whichever tax ID column is populated.

### Facility services

`facility_services` stores the service/specialty codes associated with a facility (CNES table `rlEstabServClass`). Columns: `serviceCode`, `classificationCode`, `sourceProvider`. Populated and kept in sync by the `syncFacilityServicesActivity` step in the CNES monthly ingestion workflow. Services are returned on `GET /facilities/:id` but not on the list endpoint.

## Registry Ingestion Suggestions

Current suggestion types include:

- Facility removal.
- Facility reactivation.
- Doctor-clinic association removal.

## Target Direction

This domain should evolve into the healthcare CRM foundation. It should support profile quality, relationship history, territory-aware access, visits, notes, follow-ups, data provenance, and governed workflows for accepting or rejecting external data changes.

## Open Questions

- Which external registries are authoritative per market?
- Which fields are user-editable versus registry-controlled?
- What data needs approval before becoming visible to field teams?
- How should clinic/doctor data be tenant-scoped when multiple customers share public registry sources?
