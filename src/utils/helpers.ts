/**
 * Helper utilities for test data manipulation
 */

import type { NormalizedTest, NormalizedTestRun } from "../types/index.js";

/**
 * Groups tests by a key extraction function.
 *
 * @param tests - Array of tests to group
 * @param keyFn - Function to extract grouping key from each test
 * @returns Object with keys as group identifiers and values as test arrays
 *
 * @example
 * ```typescript
 * const byStatus = groupTests(testRun.tests, test => test.status);
 * console.log(`Failed tests: ${byStatus.failed?.length || 0}`);
 *
 * const byProject = groupTests(testRun.tests, test => test.project);
 * ```
 */
export function groupTests<K extends string | number | symbol>(
  tests: NormalizedTest[],
  keyFn: (test: NormalizedTest) => K,
): Record<K, NormalizedTest[]> {
  const groups: Record<K, NormalizedTest[]> = {} as Record<K, NormalizedTest[]>;

  for (const test of tests) {
    const key = keyFn(test);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key]!.push(test);
  }

  return groups;
}

/**
 * Extracts unique values from tests using an extraction function.
 *
 * @param tests - Array of tests to process
 * @param extractFn - Function to extract value from each test
 * @returns Array of unique values
 *
 * @example
 * ```typescript
 * const uniqueProjects = getUniqueValues(tests, test => test.project);
 * const uniqueFiles = getUniqueValues(tests, test => test.file);
 * ```
 */
export function getUniqueValues<T>(
  tests: NormalizedTest[],
  extractFn: (test: NormalizedTest) => T,
): T[] {
  const uniqueSet = new Set<T>();
  for (const test of tests) {
    uniqueSet.add(extractFn(test));
  }
  return Array.from(uniqueSet);
}

/**
 * Get all unique projects from a test run
 */
export function getUniqueProjects(run: NormalizedTestRun): string[] {
  return getUniqueValues(run.tests, (test) => test.project);
}

/**
 * Get all unique files from a test run
 */
export function getUniqueFiles(run: NormalizedTestRun): string[] {
  return getUniqueValues(run.tests, (test) => test.file);
}

/**
 * Calculates the test pass rate as a percentage.
 *
 * @param run - Normalized test run data
 * @returns Pass rate percentage (0-100)
 *
 * @example
 * ```typescript
 * const passRate = calculatePassRate(testRun);
 * console.log(`Pass rate: ${passRate.toFixed(2)}%`);
 * ```
 */
export function calculatePassRate(run: NormalizedTestRun): number {
  if (run.totals.total === 0) return 0;
  return (run.totals.passed / run.totals.total) * 100;
}

/**
 * Calculates the flaky test rate as a percentage.
 *
 * @param run - Normalized test run data
 * @returns Flaky rate percentage (0-100)
 *
 * @example
 * ```typescript
 * const flakyRate = calculateFlakyRate(testRun);
 * console.log(`Flaky rate: ${flakyRate.toFixed(2)}%`);
 * ```
 */
export function calculateFlakyRate(run: NormalizedTestRun): number {
  if (run.totals.total === 0) return 0;
  return (run.totals.flaky / run.totals.total) * 100;
}

/**
 * Finds tests matching a pattern in their title or full title.
 *
 * @param run - Normalized test run data
 * @param pattern - String or RegExp pattern to match
 * @returns Array of matching tests
 *
 * @example
 * ```typescript
 * const loginTests = findTestsByPattern(testRun, 'login');
 * const authTests = findTestsByPattern(testRun, /auth|login/i);
 * ```
 */
export function findTestsByPattern(
  run: NormalizedTestRun,
  pattern: string | RegExp,
): NormalizedTest[] {
  const regex = typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;

  return run.tests.filter(
    (test) => regex.test(test.title) || regex.test(test.fullTitle),
  );
}

/**
 * Get test summary counts
 */
export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  passRate: number;
  flakyRate: number;
}

/**
 * Gets a comprehensive summary of test results.
 *
 * @param run - Normalized test run data
 * @returns Summary object with counts and rates
 *
 * @example
 * ```typescript
 * const summary = getTestSummary(testRun);
 * console.log(`Total: ${summary.total}, Passed: ${summary.passed}`);
 * console.log(`Pass rate: ${summary.passRate.toFixed(2)}%`);
 * ```
 */
export function getTestSummary(run: NormalizedTestRun): TestSummary {
  return {
    total: run.totals.total,
    passed: run.totals.passed,
    failed: run.totals.failed,
    skipped: run.totals.skipped,
    flaky: run.totals.flaky,
    passRate: calculatePassRate(run),
    flakyRate: calculateFlakyRate(run),
  };
}

/**
 * Check if all tests passed
 */
export function allTestsPassed(run: NormalizedTestRun): boolean {
  return run.totals.failed === 0 && run.totals.total > 0;
}

/**
 * Check if any tests failed
 */
export function hasFailures(run: NormalizedTestRun): boolean {
  return run.totals.failed > 0;
}

/**
 * Check if any tests are flaky
 */
export function hasFlakyTests(run: NormalizedTestRun): boolean {
  return run.totals.flaky > 0;
}
