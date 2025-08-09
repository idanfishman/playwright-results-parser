import { describe, it, expect } from "vitest";
import {
  calculateStatistics,
  getFailedTests,
  getFlakyTests,
  getTestsByProject,
  getTestsByFile,
  aggregateShardedRuns,
  areRunsFromSameExecution,
  filterPredicates,
  sortComparators,
  combinePredicatesOr,
  type NormalizedTestRun,
  type NormalizedTest,
} from "../src/index.js";
import { validatePlaywrightJson, ValidationError } from "../src/parser/validator.js";

describe("Statistics Calculator", () => {
  const createTestRun = (tests: NormalizedTest[]): NormalizedTestRun => ({
    runId: "test-run-1",
    startedAt: "2024-01-01T10:00:00.000Z",
    endedAt: "2024-01-01T10:10:00.000Z",
    duration: 600000,
    projects: ["chromium", "firefox"],
    totals: {
      total: tests.length,
      passed: tests.filter((t) => t.status === "passed").length,
      failed: tests.filter((t) => t.status === "failed").length,
      skipped: tests.filter((t) => t.status === "skipped").length,
      flaky: tests.filter((t) => t.status === "flaky").length,
      duration: tests.reduce((sum, t) => sum + t.duration, 0),
    },
    tests,
  });

  const createTest = (overrides: Partial<NormalizedTest>): NormalizedTest => ({
    id: "test-1",
    title: "test",
    fullTitle: "suite > test",
    file: "test.spec.ts",
    line: 1,
    column: 1,
    project: "chromium",
    status: "passed",
    duration: 100,
    retries: 0,
    ...overrides,
  });

  describe("calculateStatistics", () => {
    it("should calculate basic statistics correctly", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", status: "passed", duration: 100 }),
        createTest({ id: "2", status: "failed", duration: 200 }),
        createTest({ id: "3", status: "skipped", duration: 0 }),
        createTest({ id: "4", status: "flaky", duration: 150 }),
      ];

      const run = createTestRun(tests);
      const stats = calculateStatistics(run);

      expect(stats.total).toBe(4);
      expect(stats.passed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.skipped).toBe(1);
      expect(stats.flaky).toBe(1);
    });

    it("should calculate duration statistics", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", duration: 100 }),
        createTest({ id: "2", duration: 200 }),
        createTest({ id: "3", duration: 300 }),
        createTest({ id: "4", duration: 400 }),
        createTest({ id: "5", duration: 500 }),
      ];

      const run = createTestRun(tests);
      const stats = calculateStatistics(run);

      expect(stats.duration.total).toBe(1500);
      expect(stats.duration.average).toBe(300);
      expect(stats.duration.median).toBe(300);
      expect(stats.duration.min).toBe(100);
      expect(stats.duration.max).toBe(500);
      expect(stats.duration.p95).toBe(500);
    });

    it("should calculate percentiles correctly", () => {
      const tests: NormalizedTest[] = [];
      for (let i = 1; i <= 100; i++) {
        tests.push(createTest({ id: `${i}`, duration: i * 10 }));
      }

      const run = createTestRun(tests);
      const stats = calculateStatistics(run);

      expect(stats.duration.median).toBe(500);
      expect(stats.duration.p95).toBe(950);
    });

    it("should group statistics by project", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", project: "chromium", status: "passed" }),
        createTest({ id: "2", project: "chromium", status: "failed" }),
        createTest({ id: "3", project: "firefox", status: "passed" }),
        createTest({ id: "4", project: "firefox", status: "passed" }),
      ];

      const run = createTestRun(tests);
      const stats = calculateStatistics(run);

      expect(stats.byProject["chromium"]).toBeDefined();
      expect(stats.byProject["chromium"]!.total).toBe(2);
      expect(stats.byProject["chromium"]!.passed).toBe(1);
      expect(stats.byProject["chromium"]!.failed).toBe(1);

      expect(stats.byProject["firefox"]).toBeDefined();
      expect(stats.byProject["firefox"]!.total).toBe(2);
      expect(stats.byProject["firefox"]!.passed).toBe(2);
      expect(stats.byProject["firefox"]!.failed).toBe(0);
    });

    it("should group statistics by file", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", file: "auth.spec.ts", status: "passed" }),
        createTest({ id: "2", file: "auth.spec.ts", status: "failed" }),
        createTest({ id: "3", file: "home.spec.ts", status: "passed" }),
      ];

      const run = createTestRun(tests);
      const stats = calculateStatistics(run);

      expect(stats.byFile["auth.spec.ts"]).toBeDefined();
      expect(stats.byFile["auth.spec.ts"]!.total).toBe(2);
      expect(stats.byFile["auth.spec.ts"]!.passed).toBe(1);
      expect(stats.byFile["auth.spec.ts"]!.failed).toBe(1);

      expect(stats.byFile["home.spec.ts"]).toBeDefined();
      expect(stats.byFile["home.spec.ts"]!.total).toBe(1);
      expect(stats.byFile["home.spec.ts"]!.passed).toBe(1);
    });

    it("should return zero statistics for empty test run", () => {
      const run = createTestRun([]);
      const stats = calculateStatistics(run);

      expect(stats.total).toBe(0);
      expect(stats.passed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.skipped).toBe(0);
      expect(stats.flaky).toBe(0);
      expect(stats.duration.total).toBe(0);
      expect(stats.duration.average).toBe(0);
      expect(stats.duration.median).toBe(0);
      expect(stats.duration.p95).toBe(0);
      expect(stats.duration.min).toBe(0);
      expect(stats.duration.max).toBe(0);
    });

    it("should calculate statistics when all tests are skipped", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", status: "skipped", duration: 0 }),
        createTest({ id: "2", status: "skipped", duration: 0 }),
        createTest({ id: "3", status: "skipped", duration: 0 }),
      ];

      const run = createTestRun(tests);
      const stats = calculateStatistics(run);

      expect(stats.total).toBe(3);
      expect(stats.skipped).toBe(3);
      expect(stats.duration.total).toBe(0);
      expect(stats.duration.average).toBe(0);
    });

    it("should treat undefined durations as zero in calculations", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", duration: undefined as unknown as number }),
        createTest({ id: "2", duration: 100 }),
        createTest({ id: "3", duration: undefined as unknown as number }),
      ];

      const run = createTestRun(tests);
      const stats = calculateStatistics(run);

      expect(stats.duration.total).toBe(100);
      expect(stats.duration.average).toBeCloseTo(33.33, 2);
    });

    it("should calculate percentiles correctly for single test", () => {
      const tests: NormalizedTest[] = [createTest({ id: "1", duration: 250 })];

      const run = createTestRun(tests);
      const stats = calculateStatistics(run);

      expect(stats.duration.median).toBe(250);
      expect(stats.duration.p95).toBe(250);
      expect(stats.duration.min).toBe(250);
      expect(stats.duration.max).toBe(250);
    });
  });

  describe("getFailedTests", () => {
    it("should return only failed tests", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", status: "passed" }),
        createTest({ id: "2", status: "failed", title: "failed test 1" }),
        createTest({ id: "3", status: "skipped" }),
        createTest({ id: "4", status: "failed", title: "failed test 2" }),
        createTest({ id: "5", status: "flaky" }),
      ];

      const run = createTestRun(tests);
      const failedTests = getFailedTests(run);

      expect(failedTests).toHaveLength(2);
      expect(failedTests[0]!.title).toBe("failed test 1");
      expect(failedTests[1]!.title).toBe("failed test 2");
    });

    it("should return empty array when no failed tests", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", status: "passed" }),
        createTest({ id: "2", status: "skipped" }),
      ];

      const run = createTestRun(tests);
      const failedTests = getFailedTests(run);

      expect(failedTests).toHaveLength(0);
    });
  });

  describe("getFlakyTests", () => {
    it("should return tests marked as flaky", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", status: "passed" }),
        createTest({ id: "2", status: "flaky", title: "flaky test 1" }),
        createTest({ id: "3", status: "failed" }),
        createTest({ id: "4", status: "flaky", title: "flaky test 2" }),
      ];

      const run = createTestRun(tests);
      const flakyTests = getFlakyTests(run);

      expect(flakyTests).toHaveLength(2);
      expect(flakyTests[0]!.title).toBe("flaky test 1");
      expect(flakyTests[1]!.title).toBe("flaky test 2");
    });

    it("should return tests with retries > 0", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", status: "passed", retries: 0 }),
        createTest({ id: "2", status: "passed", retries: 1, title: "retried test" }),
        createTest({ id: "3", status: "failed", retries: 0 }),
      ];

      const run = createTestRun(tests);
      const flakyTests = getFlakyTests(run);

      expect(flakyTests).toHaveLength(1);
      expect(flakyTests[0]!.title).toBe("retried test");
    });
  });

  describe("getTestsByProject", () => {
    it("should return tests for specific project", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", project: "chromium", title: "chrome test 1" }),
        createTest({ id: "2", project: "firefox", title: "firefox test" }),
        createTest({ id: "3", project: "chromium", title: "chrome test 2" }),
        createTest({ id: "4", project: "webkit", title: "webkit test" }),
      ];

      const run = createTestRun(tests);
      const chromiumTests = getTestsByProject(run, "chromium");

      expect(chromiumTests).toHaveLength(2);
      expect(chromiumTests[0]!.title).toBe("chrome test 1");
      expect(chromiumTests[1]!.title).toBe("chrome test 2");
    });

    it("should return empty array for non-existent project", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", project: "chromium" }),
        createTest({ id: "2", project: "firefox" }),
      ];

      const run = createTestRun(tests);
      const safariTests = getTestsByProject(run, "safari");

      expect(safariTests).toHaveLength(0);
    });
  });

  describe("getTestsByFile", () => {
    it("should return tests for specific file", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", file: "auth.spec.ts", title: "auth test 1" }),
        createTest({ id: "2", file: "home.spec.ts", title: "home test" }),
        createTest({ id: "3", file: "auth.spec.ts", title: "auth test 2" }),
      ];

      const run = createTestRun(tests);
      const authTests = getTestsByFile(run, "auth.spec.ts");

      expect(authTests).toHaveLength(2);
      expect(authTests[0]!.title).toBe("auth test 1");
      expect(authTests[1]!.title).toBe("auth test 2");
    });

    it("should return empty array for non-existent file", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", file: "auth.spec.ts" }),
        createTest({ id: "2", file: "home.spec.ts" }),
      ];

      const run = createTestRun(tests);
      const profileTests = getTestsByFile(run, "profile.spec.ts");

      expect(profileTests).toHaveLength(0);
    });
  });
});

describe("Shard Aggregation and Edge Cases", () => {
  describe("Validator Integration", () => {
    it("should throw ValidationError with correct format", () => {
      const invalidReport = {
        config: {},
        // missing suites
      };

      try {
        validatePlaywrightJson(invalidReport);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.issues).toBeDefined();
          expect(error.message).toContain("Invalid Playwright JSON report");
        }
      }
    });
  });

  describe("Shard Execution Validation", () => {
    it("should return false when runs lack shard information", () => {
      const run1: NormalizedTestRun = {
        runId: "run-1",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        duration: 1000,
        projects: ["chromium"],
        totals: {
          total: 5,
          passed: 5,
          failed: 0,
          skipped: 0,
          flaky: 0,
          duration: 1000,
        },
        tests: [],
      };

      const run2: NormalizedTestRun = {
        ...run1,
        runId: "run-2",
      };

      expect(areRunsFromSameExecution([run1, run2])).toBe(false);
    });

    it("should return true for empty runs array", () => {
      expect(areRunsFromSameExecution([])).toBe(true);
    });

    it("should return false when shards array is empty", () => {
      const run: NormalizedTestRun = {
        runId: "run-1",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        duration: 1000,
        projects: ["chromium"],
        shards: [],
        totals: {
          total: 5,
          passed: 5,
          failed: 0,
          skipped: 0,
          flaky: 0,
          duration: 1000,
        },
        tests: [],
      };

      expect(areRunsFromSameExecution([run, run])).toBe(false);
    });

    it("should detect mismatched total shard counts", () => {
      const run1: NormalizedTestRun = {
        runId: "run-1",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        duration: 1000,
        projects: ["chromium"],
        shards: [{ current: 1, total: 2, duration: 1000, testCount: 5 }],
        totals: {
          total: 5,
          passed: 5,
          failed: 0,
          skipped: 0,
          flaky: 0,
          duration: 1000,
        },
        tests: [],
      };

      const run2: NormalizedTestRun = {
        ...run1,
        shards: [{ current: 2, total: 3, duration: 1000, testCount: 5 }],
      };

      expect(areRunsFromSameExecution([run1, run2])).toBe(false);
    });

    it("should aggregate metadata from runs", () => {
      const run1: NormalizedTestRun = {
        runId: "run-1",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        duration: 1000,
        projects: ["chromium"],
        totals: {
          total: 1,
          passed: 1,
          failed: 0,
          skipped: 0,
          flaky: 0,
          duration: 1000,
        },
        tests: [],
        metadata: { key1: "value1" },
      };

      const run2: NormalizedTestRun = {
        ...run1,
        metadata: { key2: "value2" },
      };

      const aggregated = aggregateShardedRuns([run1, run2]);
      expect(aggregated.metadata).toEqual({ key1: "value1", key2: "value2" });
    });

    it("should not include metadata when empty", () => {
      const run: NormalizedTestRun = {
        runId: "run-1",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        duration: 1000,
        projects: ["chromium"],
        totals: {
          total: 1,
          passed: 1,
          failed: 0,
          skipped: 0,
          flaky: 0,
          duration: 1000,
        },
        tests: [],
      };

      const aggregated = aggregateShardedRuns([run]);
      expect(aggregated.metadata).toBeUndefined();
    });
  });

  describe("Filter Predicates Advanced", () => {
    const test1: NormalizedTest = {
      id: "test-1",
      title: "Test 1",
      fullTitle: "Suite > Test 1",
      file: "auth.spec.ts",
      line: 1,
      column: 1,
      project: "chromium",
      status: "passed",
      duration: 100,
      retries: 0,
    };

    const test2: NormalizedTest = {
      id: "test-2",
      title: "Test 2",
      fullTitle: "Suite > Test 2",
      file: "home.spec.ts",
      line: 1,
      column: 1,
      project: "firefox",
      status: "passed",
      duration: 200,
      retries: 0,
    };

    it("should filter by project", () => {
      const filter = filterPredicates.byProject("chromium");
      expect(filter(test1)).toBe(true);
      expect(filter(test2)).toBe(false);
    });

    it("should filter by file", () => {
      const filter = filterPredicates.byFile("auth.spec.ts");
      expect(filter(test1)).toBe(true);
      expect(filter(test2)).toBe(false);
    });
  });

  describe("Sort Comparators Edge Cases", () => {
    it("should treat undefined duration as zero when sorting descending", () => {
      const test1: NormalizedTest = {
        id: "test-1",
        title: "Test 1",
        fullTitle: "Test 1",
        file: "test.spec.ts",
        line: 1,
        column: 1,
        project: "chromium",
        status: "passed",
        duration: 100,
        retries: 0,
      };

      const test2: NormalizedTest = {
        id: "test-2",
        title: "Test 2",
        fullTitle: "Test 2",
        file: "test.spec.ts",
        line: 2,
        column: 1,
        project: "chromium",
        status: "passed",
        duration: undefined,
        retries: 0,
      };

      const sorted = [test1, test2].sort(sortComparators.byDurationDesc);
      expect(sorted[0]).toBe(test1); // 100ms
      expect(sorted[1]).toBe(test2); // undefined (treated as 0)
    });

    it("should treat undefined duration as zero when sorting ascending", () => {
      const test1: NormalizedTest = {
        id: "test-1",
        title: "Test 1",
        fullTitle: "Test 1",
        file: "test.spec.ts",
        line: 1,
        column: 1,
        project: "chromium",
        status: "passed",
        duration: undefined,
        retries: 0,
      };

      const test2: NormalizedTest = {
        id: "test-2",
        title: "Test 2",
        fullTitle: "Test 2",
        file: "test.spec.ts",
        line: 2,
        column: 1,
        project: "chromium",
        status: "passed",
        duration: 50,
        retries: 0,
      };

      const sorted = [test2, test1].sort(sortComparators.byDurationAsc);
      expect(sorted[0]).toBe(test1); // undefined (treated as 0)
      expect(sorted[1]).toBe(test2); // 50ms
    });

    it("should place unknown status last when sorting by status", () => {
      const test1: NormalizedTest = {
        id: "test-1",
        title: "Test 1",
        fullTitle: "Test 1",
        file: "test.spec.ts",
        line: 1,
        column: 1,
        project: "chromium",
        status: "unknown" as "passed" | "failed" | "skipped" | "flaky",
        duration: 100,
        retries: 0,
      };

      const test2: NormalizedTest = {
        id: "test-2",
        title: "Test 2",
        fullTitle: "Test 2",
        file: "test.spec.ts",
        line: 2,
        column: 1,
        project: "chromium",
        status: "passed",
        duration: 100,
        retries: 0,
      };

      const sorted = [test1, test2].sort(sortComparators.byStatus);
      expect(sorted[0]).toBe(test2); // passed comes before unknown
      expect(sorted[1]).toBe(test1);
    });
  });

  describe("OR Logic Filter Combination", () => {
    const test1: NormalizedTest = {
      id: "test-1",
      title: "Test",
      fullTitle: "Suite > Test",
      file: "test.spec.ts",
      line: 1,
      column: 1,
      project: "chromium",
      status: "failed",
      duration: 100,
      retries: 0,
    };

    const test2: NormalizedTest = {
      id: "test-2",
      title: "Test",
      fullTitle: "Suite > Test",
      file: "test.spec.ts",
      line: 2,
      column: 1,
      project: "firefox",
      status: "flaky",
      duration: 200,
      retries: 1,
    };

    const test3: NormalizedTest = {
      id: "test-3",
      title: "Test",
      fullTitle: "Suite > Test",
      file: "test.spec.ts",
      line: 3,
      column: 1,
      project: "webkit",
      status: "passed",
      duration: 50,
      retries: 0,
    };

    it("should combine filters with OR logic", () => {
      const combined = combinePredicatesOr(
        filterPredicates.failed,
        filterPredicates.flaky,
      );
      expect(combined(test1)).toBe(true); // failed
      expect(combined(test2)).toBe(true); // flaky
      expect(combined(test3)).toBe(false); // passed
    });

    it("should return false when all filters fail", () => {
      const combined = combinePredicatesOr(
        () => false,
        () => false,
        () => false,
      );
      expect(combined(test1)).toBe(false);
    });

    it("should return true when at least one filter passes", () => {
      const combined = combinePredicatesOr(
        () => false,
        () => true,
        () => false,
      );
      expect(combined(test1)).toBe(true);
    });
  });
});
