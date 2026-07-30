# Data Migration ETL Specification

## Purpose

One-time historical import of visits, appointments, reviews, and commissions from Sheets into Postgres. Must be idempotent, dry-runnable, and reconciled before cutover.

## Requirements

### Requirement: Live-export precondition on the Anamnesis schema
The ETL MUST NOT run against the `Anamnesis` sheet's true column set until it has been re-derived from a live production export — the in-code header array (~44 cols) and `COL` index map (48 cols) are known to be out of sync. The ETL MUST fail closed (refuse to run) if the export's column count doesn't match what the migration expects.

#### Scenario: Column drift detected
- GIVEN a live export of `Anamnesis` has a column count different from the migration's expected schema
- WHEN the ETL is invoked
- THEN it MUST abort before writing any rows and report the mismatch

### Requirement: Row-count reconciliation
For each migrated entity (visits, appointments, reviews, commissions, doctors), the ETL MUST report source row count vs. migrated row count. The migration MUST NOT be considered complete while any counts mismatch, excluding rows explicitly excluded by a documented filter.

#### Scenario: Reconciliation report
- GIVEN the ETL has finished a run
- WHEN the reconciliation report is generated
- THEN it MUST list source vs. destination counts per entity, with any mismatch flagged

### Requirement: Referential integrity
Migrated records MUST reference related entities by the new stable PKs (e.g., a migrated visit MUST reference a migrated doctor, not a free-text/duplicated name), with zero orphaned foreign keys.

#### Scenario: Visit references a doctor
- GIVEN a migrated visit named a doctor in the legacy sheet
- WHEN the ETL completes
- THEN that visit's doctor foreign key MUST resolve to an existing `doctors` row

### Requirement: Medicos relational split
The ETL MUST split the legacy denormalized `Medicos` rows (one row per doctor per specialty) into `doctors`, `doctor_specialties`, and `doctor_commission_rates`, deduplicating by stable doctor identity.

#### Scenario: Doctor with 3 specialty rows
- GIVEN a doctor appears as 3 separate rows in `Medicos` (one per specialty)
- WHEN the ETL runs
- THEN exactly one `doctors` row and three `doctor_specialties` rows are created for that doctor

### Requirement: Row-index-to-PK mapping preserved for audit
The ETL MUST retain a mapping from each legacy sheet row (by sheet name + row number) to its new stable PK, for audit/troubleshooting during the rollback window.

#### Scenario: Auditing a migrated record
- GIVEN a support request references a legacy row number
- WHEN staff query the mapping table
- THEN they MUST be able to find the corresponding new-system PK

### Requirement: Idempotent and dry-runnable
Re-running the ETL against the same source data MUST NOT create duplicate records. The ETL MUST support a dry-run mode that reports what would change without writing.

#### Scenario: ETL re-run after a partial failure
- GIVEN the ETL was run once and failed partway
- WHEN it is re-run against the same source
- THEN no already-migrated record MUST be duplicated

#### Scenario: Dry run
- GIVEN the ETL is invoked in dry-run mode
- WHEN it processes the source data
- THEN it MUST report the planned inserts/updates without writing to Postgres
