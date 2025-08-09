/**
 * playwright-results-parser
 * Main entry point for the Playwright Results Parser library
 */

export const version = "0.1.0";

// Export all types
export type {
  NormalizedTestRun,
  NormalizedTest,
  TestTotals,
  TestError,
  TestAttachment,
  TestAnnotation,
  ShardInfo,
  PlaywrightJsonReport,
  PlaywrightSuite,
  PlaywrightTestCase,
  PlaywrightTestResult,
  PlaywrightTestAttempt,
  PlaywrightSpec,
  PlaywrightAnnotation,
} from "./types/index.js";

// Export parser functions
export { parsePlaywrightJson } from "./parser/parser.js";
export { parsePlaywrightJson as parsePlaywrightResults } from "./parser/parser.js"; // Alias for backward compatibility
export { ValidationError, validatePlaywrightJson } from "./parser/validator.js";
export { normalizeTestRun } from "./parser/normalizer.js";

// Export aggregator functions
export { aggregateShardedRuns, areRunsFromSameExecution } from "./aggregator/shards.js";
export {
  calculateStatistics,
  getFailedTests,
  getFlakyTests,
  getTestsByProject,
  getTestsByFile,
  type TestStatistics,
  type ProjectStatistics,
  type FileStatistics,
  type DurationStatistics,
} from "./aggregator/statistics.js";

// Export filter utilities
export {
  filterTests,
  filterPredicates,
  combinePredicates,
  combinePredicatesOr,
} from "./utils/filters.js";

// Export sort utilities
export {
  sortTests,
  sortComparators,
  compoundSort,
  reverseSort,
} from "./utils/sorters.js";

// Export helper utilities
export {
  groupTests,
  getUniqueValues,
  getUniqueProjects,
  getUniqueFiles,
  calculatePassRate,
  calculateFlakyRate,
  findTestsByPattern,
  getTestSummary,
  allTestsPassed,
  hasFailures,
  hasFlakyTests,
  type TestSummary,
} from "./utils/helpers.js";
