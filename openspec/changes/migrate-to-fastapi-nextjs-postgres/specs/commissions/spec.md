# Commissions Specification

## Purpose

Commission entries per finalized visit and per-doctor/per-category commission rates, normalized off the legacy JSON blob. Access-control specifics (login, tokens, lockout) live in `staff-auth`; this spec covers the commission domain data and computation only.

## Requirements

### Requirement: Commission entry per finalized visit
The system MUST create a commission entry when a visit tied to a commission-eligible doctor and service category is finalized (`atendido`), recording doctor, category, amount/basis, and visit reference.

#### Scenario: Commission-eligible visit closes
- GIVEN doctor D is commission-eligible for category "cirugía"
- WHEN a visit in that category transitions to `atendido`
- THEN a commission entry MUST be created referencing that visit

### Requirement: Per-doctor category rate table
The system MUST store a normalized, queryable rate table (doctor × category → percentage), replacing the legacy per-doctor JSON blob of categories, with exactly one commission-doctor record per stable doctor ID even when the doctor practices multiple specialties.

#### Scenario: Doctor with multiple specialties
- GIVEN a doctor practices two specialties
- WHEN their commission rates are queried
- THEN exactly one commission-doctor record is returned, not one per specialty

### Requirement: JSON-blob item migration to child table
Historical commission entries stored as a JSON items-blob MUST be normalized into a child table (one row per item) during ETL, preserving each item's amount, category, and visit linkage.

#### Scenario: Legacy JSON blob migrated
- GIVEN a legacy commission row has a JSON array of 3 items
- WHEN the ETL runs
- THEN 3 child-table rows exist, each traceable back to the original commission record

### Requirement: Default category fallback
If a doctor has no configured category list, the system MUST fall back to the platform's default category catalog.

#### Scenario: Doctor without custom categories
- GIVEN a commission-eligible doctor has no custom category configuration
- WHEN their commission options are requested
- THEN the default category catalog is returned

### Requirement: Commission eligibility flag
Only doctors explicitly flagged commission-eligible and active MUST appear in commission listings and rate lookups.

#### Scenario: Inactive doctor excluded
- GIVEN a doctor was flagged commission-eligible but is now marked inactive
- WHEN the commission-doctor list is requested
- THEN that doctor MUST NOT appear in the list
