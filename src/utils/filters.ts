/**
 * Filter utilities for test runs
 */

import type { NormalizedTestRun, NormalizedTest } from "../types/index.js";

/**
 * Filters tests in a run based on a custom predicate function.
 * Returns a new test run with recalculated totals.
 *
 * @param run - Normalized test run to filter
 * @param predicate - Function that returns true for tests to include
 * @returns New test run containing only tests matching the predicate
 *
 * @example
 * ```typescript
 * // Filter to only failed tests
 * const failedRun = filterTests(testRun, test => test.status === 'failed');
 *
 * // Filter to slow tests (> 5 seconds)
 * const slowRun = filterTests(testRun, test => test.duration > 5000);
 * ```
 */
export function filterTests(
  run: NormalizedTestRun,
  predicate: (test: NormalizedTest) => boolean,
): NormalizedTestRun {
  const filteredTests = run.tests.filter(predicate);

  // Recalculate totals based on filtered tests
  const totals = {
    total: filteredTests.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    flaky: 0,
    duration: 0,
  };

  for (const test of filteredTests) {
    totals.duration += test.duration || 0;
    switch (test.status) {
      case "passed":
        totals.passed++;
        break;
      case "failed":
        totals.failed++;
        break;
      case "skipped":
        totals.skipped++;
        break;
      case "flaky":
        totals.flaky++;
        break;
    }
  }

  return {
    ...run,
    tests: filteredTests,
    totals,
  };
}

/**
 * Common filter predicates
 */
export const filterPredicates = {
  /**
   * Filter for failed tests
   */
  failed: (test: NormalizedTest): boolean => test.status === "failed",

  /**
   * Filter for passed tests
   */
  passed: (test: NormalizedTest): boolean => test.status === "passed",

  /**
   * Filter for skipped tests
   */
  skipped: (test: NormalizedTest): boolean => test.status === "skipped",

  /**
   * Filter for flaky tests
   */
  flaky: (test: NormalizedTest): boolean => test.status === "flaky" || test.retries > 0,

  /**
   * Filter for slow tests (> threshold in ms)
   */
  slow:
    (thresholdMs: number) =>
    (test: NormalizedTest): boolean =>
      test.duration > thresholdMs,

  /**
   * Filter for tests with errors
   */
  withErrors: (test: NormalizedTest): boolean => test.error !== undefined,

  /**
   * Filter for tests with attachments
   */
  withAttachments: (test: NormalizedTest): boolean =>
    test.attachments !== undefined && test.attachments.length > 0,

  /**
   * Filter by project
   */
  byProject:
    (project: string) =>
    (test: NormalizedTest): boolean =>
      test.project === project,

  /**
   * Filter by file
   */
  byFile:
    (filePath: string) =>
    (test: NormalizedTest): boolean =>
      test.file === filePath,

  /**
   * Filter by title pattern
   */
  byTitle:
    (pattern: string | RegExp) =>
    (test: NormalizedTest): boolean => {
      if (typeof pattern === "string") {
        return test.title.includes(pattern);
      }
      return pattern.test(test.title);
    },

  /**
   * Filter by full title pattern
   */
  byFullTitle:
    (pattern: string | RegExp) =>
    (test: NormalizedTest): boolean => {
      if (typeof pattern === "string") {
        return test.fullTitle.includes(pattern);
      }
      return pattern.test(test.fullTitle);
    },
};

/**
 * Combines multiple filter predicates with AND logic.
 * All predicates must return true for a test to be included.
 *
 * @param predicates - Array of predicate functions to combine
 * @returns Combined predicate function
 *
 * @example
 * ```typescript
 * const failedAndSlow = combinePredicates(
 *   filterPredicates.failed,
 *   filterPredicates.slow(5000)
 * );
 * const filtered = filterTests(testRun, failedAndSlow);
 * ```
 */
export function combinePredicates(
  ...predicates: Array<(test: NormalizedTest) => boolean>
): (test: NormalizedTest) => boolean {
  return (test: NormalizedTest): boolean =>
    predicates.every((predicate) => predicate(test));
}

/**
 * Combines multiple filter predicates with OR logic.
 * At least one predicate must return true for a test to be included.
 *
 * @param predicates - Array of predicate functions to combine
 * @returns Combined predicate function
 *
 * @example
 * ```typescript
 * const failedOrFlaky = combinePredicatesOr(
 *   filterPredicates.failed,
 *   filterPredicates.flaky
 * );
 * const filtered = filterTests(testRun, failedOrFlaky);
 * ```
 */
export function combinePredicatesOr(
  ...predicates: Array<(test: NormalizedTest) => boolean>
): (test: NormalizedTest) => boolean {
  return (test: NormalizedTest): boolean =>
    predicates.some((predicate) => predicate(test));
}
