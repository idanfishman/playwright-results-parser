/**
 * Sort utilities for test runs
 */

import type { NormalizedTestRun, NormalizedTest } from "../types/index.js";

/**
 * Sorts tests in a run using a custom comparison function.
 * Returns a new test run with sorted tests (non-mutating).
 *
 * @param run - Normalized test run to sort
 * @param compareFn - Comparison function for sorting
 * @returns New test run with sorted tests
 *
 * @example
 * ```typescript
 * // Sort by duration (slowest first)
 * const sorted = sortTests(testRun, sortComparators.byDurationDesc);
 *
 * // Custom sort by title length
 * const customSorted = sortTests(testRun, (a, b) =>
 *   a.title.length - b.title.length
 * );
 * ```
 */
export function sortTests(
  run: NormalizedTestRun,
  compareFn: (a: NormalizedTest, b: NormalizedTest) => number,
): NormalizedTestRun {
  // Create a copy of the tests array to avoid mutation
  const sortedTests = [...run.tests].sort(compareFn);

  return {
    ...run,
    tests: sortedTests,
  };
}

/**
 * Common sort comparators
 */
export const sortComparators = {
  /**
   * Sort by duration (slowest first)
   */
  byDurationDesc: (a: NormalizedTest, b: NormalizedTest): number =>
    (b.duration || 0) - (a.duration || 0),

  /**
   * Sort by duration (fastest first)
   */
  byDurationAsc: (a: NormalizedTest, b: NormalizedTest): number =>
    (a.duration || 0) - (b.duration || 0),

  /**
   * Sort by status (failed > flaky > passed > skipped)
   */
  byStatus: (a: NormalizedTest, b: NormalizedTest): number => {
    const statusOrder: Record<string, number> = {
      failed: 0,
      flaky: 1,
      passed: 2,
      skipped: 3,
    };
    return (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4);
  },

  /**
   * Sort by title alphabetically
   */
  byTitle: (a: NormalizedTest, b: NormalizedTest): number =>
    a.title.localeCompare(b.title),

  /**
   * Sort by full title alphabetically
   */
  byFullTitle: (a: NormalizedTest, b: NormalizedTest): number =>
    a.fullTitle.localeCompare(b.fullTitle),

  /**
   * Sort by file path alphabetically
   */
  byFile: (a: NormalizedTest, b: NormalizedTest): number =>
    a.file.localeCompare(b.file),

  /**
   * Sort by project alphabetically
   */
  byProject: (a: NormalizedTest, b: NormalizedTest): number =>
    a.project.localeCompare(b.project),

  /**
   * Sort by number of retries (most retries first)
   */
  byRetries: (a: NormalizedTest, b: NormalizedTest): number => b.retries - a.retries,

  /**
   * Sort by file location (file, then line, then column)
   */
  byLocation: (a: NormalizedTest, b: NormalizedTest): number => {
    const fileCompare = a.file.localeCompare(b.file);
    if (fileCompare !== 0) return fileCompare;

    const lineCompare = a.line - b.line;
    if (lineCompare !== 0) return lineCompare;

    return a.column - b.column;
  },
};

/**
 * Creates a compound comparator that sorts by multiple criteria.
 * Applies comparators in order until a non-zero result is found.
 *
 * @param comparators - Array of comparator functions to apply in order
 * @returns Combined comparator function
 *
 * @example
 * ```typescript
 * // Sort by status, then by duration
 * const multiSort = compoundSort(
 *   sortComparators.byStatus,
 *   sortComparators.byDurationDesc
 * );
 * const sorted = sortTests(testRun, multiSort);
 * ```
 */
export function compoundSort(
  ...comparators: Array<(a: NormalizedTest, b: NormalizedTest) => number>
): (a: NormalizedTest, b: NormalizedTest) => number {
  return (a: NormalizedTest, b: NormalizedTest): number => {
    for (const comparator of comparators) {
      const result = comparator(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };
}

/**
 * Reverses a comparator's sort order.
 *
 * @param comparator - Comparator function to reverse
 * @returns Reversed comparator function
 *
 * @example
 * ```typescript
 * // Sort by duration ascending (fastest first)
 * const fastestFirst = reverseSort(sortComparators.byDurationDesc);
 * const sorted = sortTests(testRun, fastestFirst);
 * ```
 */
export function reverseSort(
  comparator: (a: NormalizedTest, b: NormalizedTest) => number,
): (a: NormalizedTest, b: NormalizedTest) => number {
  return (a: NormalizedTest, b: NormalizedTest): number => -comparator(a, b);
}
