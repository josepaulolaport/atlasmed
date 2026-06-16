# Feature: Clinic, Doctor, and Registry Ingestion

## Current State

Atlasmed has early clinic and doctor domain support, including clinic records, doctor records, doctor-clinic associations, and external registry ingestion workflows.

## Current Data Concepts

- Clinic.
- Doctor.
- Doctor-clinic association.
- Ingestion run.
- Ingestion suggestion.

## Registry Ingestion Suggestions

Current suggestion types include:

- Clinic removal.
- Clinic reactivation.
- Doctor-clinic association removal.

## Target Direction

This domain should evolve into the healthcare CRM foundation. It should support profile quality, relationship history, territory-aware access, visits, notes, follow-ups, data provenance, and governed workflows for accepting or rejecting external data changes.

## Open Questions

- Which external registries are authoritative per market?
- Which fields are user-editable versus registry-controlled?
- What data needs approval before becoming visible to field teams?
- How should clinic/doctor data be tenant-scoped when multiple customers share public registry sources?
