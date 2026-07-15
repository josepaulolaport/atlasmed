import { wrapActivity } from "../instrumentation/wrap-activity";

import {
  discoverLatestReferenceActivity as discoverLatestReferenceActivityImpl,
  downloadRawFilesActivity as downloadRawFilesActivityImpl,
  parseAndNormalizeActivity as parseAndNormalizeActivityImpl,
} from "./discover-download.activities";

import { extractMonthlyArchiveActivity as extractMonthlyArchiveActivityImpl } from "./extract-archive.activities";
import { preflightExtractedCsvActivity as preflightExtractedCsvActivityImpl } from "./preflight-csv.activities";
import { cleanupPreviousArchiveActivity as cleanupPreviousArchiveActivityImpl } from "./cleanup-previous-archive.activities";

import {
  loadRegistryStagingActivity as loadRegistryStagingActivityImpl,
  validateStagingActivity as validateStagingActivityImpl,
  promoteRegistrySwapActivity as promoteRegistrySwapActivityImpl,
} from "./load-validate-promote.activities";

import {
  reconcileCrmDiffActivity as reconcileCrmDiffActivityImpl,
  reconcileWarehouseDiffActivity as reconcileWarehouseDiffActivityImpl,
  syncCrmMetadataActivity as syncCrmMetadataActivityImpl,
  syncFacilityServicesActivity as syncFacilityServicesActivityImpl,
  finalizeIngestionRunActivity as finalizeIngestionRunActivityImpl,
} from "./reconcile-sync.activities";

export const discoverLatestReferenceActivity = wrapActivity(
  "discoverLatestReference",
  discoverLatestReferenceActivityImpl
);
export const downloadRawFilesActivity = wrapActivity(
  "downloadRawFiles",
  downloadRawFilesActivityImpl
);
export const parseAndNormalizeActivity = wrapActivity(
  "parseAndNormalize",
  parseAndNormalizeActivityImpl
);

export const extractMonthlyArchiveActivity = wrapActivity(
  "extractMonthlyArchive",
  extractMonthlyArchiveActivityImpl
);
export const preflightExtractedCsvActivity = wrapActivity(
  "preflightExtractedCsv",
  preflightExtractedCsvActivityImpl
);
export const cleanupPreviousArchiveActivity = wrapActivity(
  "cleanupPreviousArchive",
  cleanupPreviousArchiveActivityImpl
);

export const loadRegistryStagingActivity = wrapActivity(
  "loadRegistryStaging",
  loadRegistryStagingActivityImpl
);
export const validateStagingActivity = wrapActivity(
  "validateStaging",
  validateStagingActivityImpl
);
export const promoteRegistrySwapActivity = wrapActivity(
  "promoteRegistrySwap",
  promoteRegistrySwapActivityImpl
);

export const reconcileCrmDiffActivity = wrapActivity(
  "reconcileCrmDiff",
  reconcileCrmDiffActivityImpl
);
export const reconcileWarehouseDiffActivity = wrapActivity(
  "reconcileWarehouseDiff",
  reconcileWarehouseDiffActivityImpl
);
export const syncCrmMetadataActivity = wrapActivity(
  "syncCrmMetadata",
  syncCrmMetadataActivityImpl
);
export const syncFacilityServicesActivity = wrapActivity(
  "syncFacilityServices",
  syncFacilityServicesActivityImpl
);
export const finalizeIngestionRunActivity = wrapActivity(
  "finalizeIngestionRun",
  finalizeIngestionRunActivityImpl
);
