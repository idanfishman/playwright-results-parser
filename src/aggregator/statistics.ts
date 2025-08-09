/**
 * Statistics calculation for test runs
 */

import type { NormalizedTestRun, NormalizedTest } from "../types/index.js";

/**
 * Project-level statistics
 */
export interface ProjectStatistics {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  duration: number;
}

/**
 * File-level statistics
 */
export interface FileStatistics {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  duration: number;
}

/**
 * Test duration statistics
 */
export interface DurationStatistics {
  total: number;
  average: number;
  median: number;
  p95: number;
  min: number;
  max: number;
}

/**
 * Complete test statistics
 */
export interface TestStatistics {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  duration: DurationStatistics;
  byProject: Record<string, ProjectStatistics>;
  byFile: Record<string, FileStatistics>;
}

/**
 * Calculate percentile from sorted array
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0]!;

  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))]!;
}

/**
 * Calculate duration statistics from test array
 */
function calculateDurationStats(tests: NormalizedTest[]): DurationStatistics {
  if (tests.length === 0) {
    return {
      total: 0,
      average: 0,
      median: 0,
      p95: 0,
      min: 0,
      max: 0,
    };
  }

  // Extract durations and calculate total in single pass
  let total = 0;
  let min = Infinity;
  let max = 0;
  const durations: number[] = [];

  for (const test of tests) {
    const duration = test.duration || 0;
    durations.push(duration);
    total += duration;
    min = Math.min(min, duration);
    max = Math.max(max, duration);
  }

  // Handle edge case where all durations are 0
  if (min === Infinity) min = 0;

  // Sort for percentile calculations
  durations.sort((a, b) => a - b);

  return {
    total,
    average: total / tests.length,
    median: calculatePercentile(durations, 50),
    p95: calculatePercentile(durations, 95),
    min,
    max,
  };
}

/**
 * Initialize empty statistics for a group
 */
function initializeGroupStats(): ProjectStatistics | FileStatistics {
  return {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    flaky: 0,
    duration: 0,
  };
}

/**
 * Update group statistics with a test
 */
function updateGroupStats(
  stats: ProjectStatistics | FileStatistics,
  test: NormalizedTest,
): void {
  stats.total++;
  stats.duration += test.duration || 0;

  switch (test.status) {
    case "passed":
      stats.passed++;
      break;
    case "failed":
      stats.failed++;
      break;
    case "skipped":
      stats.skipped++;
      break;
    case "flaky":
      stats.flaky++;
      break;
  }
}

/**
 * Calculates comprehensive statistics for a test run.
 * Provides aggregate metrics including totals, duration statistics, and grouping by project/file.
 *
 * @param run - Normalized test run data from parsePlaywrightJson
 * @returns Complete statistics including counts, percentiles, and grouped metrics
 *
 * @example
 * ```typescript
 * const stats = calculateStatistics(testRun);
 * console.log(`Pass rate: ${(stats.passed / stats.total * 100).toFixed(2)}%`);
 * console.log(`P95 duration: ${stats.duration.p95}ms`);
 * console.log(`Flaky tests: ${stats.flaky}`);
 * ```
 */
export function calculateStatistics(run: NormalizedTestRun): TestStatistics {
  const stats: TestStatistics = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    flaky: 0,
    duration: {
      total: 0,
      average: 0,
      median: 0,
      p95: 0,
      min: 0,
      max: 0,
    },
    byProject: {},
    byFile: {},
  };

  // Handle empty test run
  if (!run.tests || run.tests.length === 0) {
    return stats;
  }

  // Single pass to calculate all statistics
  for (const test of run.tests) {
    // Update totals
    stats.total++;

    switch (test.status) {
      case "passed":
        stats.passed++;
        break;
      case "failed":
        stats.failed++;
        break;
      case "skipped":
        stats.skipped++;
        break;
      case "flaky":
        stats.flaky++;
        break;
    }

    // Update project statistics
    const project = test.project || "default";
    if (!stats.byProject[project]) {
      stats.byProject[project] = initializeGroupStats();
    }
    updateGroupStats(stats.byProject[project]!, test);

    // Update file statistics
    const file = test.file || "unknown";
    if (!stats.byFile[file]) {
      stats.byFile[file] = initializeGroupStats();
    }
    updateGroupStats(stats.byFile[file]!, test);
  }

  // Calculate duration statistics
  stats.duration = calculateDurationStats(run.tests);

  return stats;
}

/**
 * Retrieves all failed tests from a test run.
 *
 * @param run - Normalized test run data
 * @returns Array of tests with 'failed' status
 *
 * @example
 * ```typescript
 * const failedTests = getFailedTests(testRun);
 * failedTests.forEach(test => {
 *   console.log(`Failed: ${test.fullTitle}`);
 *   console.log(`Error: ${test.error?.message}`);
 * });
 * ```
 */
export function getFailedTests(run: NormalizedTestRun): NormalizedTest[] {
  return run.tests.filter((test) => test.status === "failed");
}

/**
 * Retrieves all flaky tests from a test run.
 * Tests are considered flaky if they have status 'flaky' or retries > 0.
 *
 * @param run - Normalized test run data
 * @returns Array of flaky tests
 *
 * @example
 * ```typescript
 * const flakyTests = getFlakyTests(testRun);
 * console.log(`Found ${flakyTests.length} flaky tests`);
 * flakyTests.forEach(test => {
 *   console.log(`Flaky: ${test.title} (${test.retries} retries)`);
 * });
 * ```
 */
export function getFlakyTests(run: NormalizedTestRun): NormalizedTest[] {
  return run.tests.filter(
    (test) => test.status === "flaky" || (test.retries && test.retries > 0),
  );
}

/**
 * Filters tests by project name.
 *
 * @param run - Normalized test run data
 * @param project - Project name to filter by (e.g., 'chromium', 'firefox')
 * @returns Array of tests belonging to the specified project
 *
 * @example
 * ```typescript
 * const chromiumTests = getTestsByProject(testRun, 'chromium');
 * console.log(`Chromium tests: ${chromiumTests.length}`);
 * ```
 */
export function getTestsByProject(
  run: NormalizedTestRun,
  project: string,
): NormalizedTest[] {
  return run.tests.filter((test) => test.project === project);
}

/**
 * Filters tests by file path.
 *
 * @param run - Normalized test run data
 * @param filePath - File path to filter by
 * @returns Array of tests from the specified file
 *
 * @example
 * ```typescript
 * const authTests = getTestsByFile(testRun, 'tests/auth.spec.ts');
 * console.log(`Auth tests: ${authTests.length}`);
 * ```
 */
export function getTestsByFile(
  run: NormalizedTestRun,
  filePath: string,
): NormalizedTest[] {
  return run.tests.filter((test) => test.file === filePath);
}
