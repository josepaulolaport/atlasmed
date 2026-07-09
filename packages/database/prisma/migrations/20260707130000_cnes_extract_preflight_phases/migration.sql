-- Add CNES hybrid pipeline phases for ZIP extract and CSV preflight.
ALTER TYPE "IngestionRunPhase" ADD VALUE IF NOT EXISTS 'EXTRACTING';
ALTER TYPE "IngestionRunPhase" ADD VALUE IF NOT EXISTS 'PREFLIGHT';
