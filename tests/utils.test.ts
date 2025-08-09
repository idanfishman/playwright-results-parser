import { describe, it, expect } from "vitest";
import {
  filterTests,
  filterPredicates,
  combinePredicates,
  combinePredicatesOr,
  sortTests,
  sortComparators,
  compoundSort,
  reverseSort,
  groupTests,
  getUniqueProjects,
  getUniqueFiles,
  calculatePassRate,
  calculateFlakyRate,
  findTestsByPattern,
  getTestSummary,
  allTestsPassed,
  hasFailures,
  hasFlakyTests,
  aggregateShardedRuns,
  areRunsFromSameExecution,
  calculateStatistics,
  type NormalizedTestRun,
  type NormalizedTest,
} from "../src/index.js";
import { normalizeTestRun } from "../src/parser/normalizer.js";
import { validatePlaywrightJson, ValidationError } from "../src/parser/validator.js";

describe("Filter Utilities", () => {
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

  const createTestRun = (tests: NormalizedTest[]): NormalizedTestRun => ({
    runId: "test-run-1",
    startedAt: "2024-01-01T10:00:00.000Z",
    endedAt: "2024-01-01T10:10:00.000Z",
    duration: 600000,
    projects: ["chromium"],
    totals: {
      total: tests.length,
      passed: tests.filter((t) => t.status === "passed").length,
      failed: tests.filter((t) => t.status === "failed").length,
      skipped: tests.filter((t) => t.status === "skipped").length,
      flaky: tests.filter((t) => t.status === "flaky").length,
      duration: tests.reduce((sum, t) => sum + (t.duration || 0), 0),
    },
    tests,
  });

  describe("filterTests", () => {
    it("should filter tests by predicate", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", status: "passed" }),
        createTest({ id: "2", status: "failed" }),
        createTest({ id: "3", status: "passed" }),
      ];

      const run = createTestRun(tests);
      const filtered = filterTests(run, (test) => test.status === "passed");

      expect(filtered.tests).toHaveLength(2);
      expect(filtered.totals.total).toBe(2);
      expect(filtered.totals.passed).toBe(2);
      expect(filtered.totals.failed).toBe(0);
    });

    it("should recalculate totals after filtering", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", status: "passed", duration: 100 }),
        createTest({ id: "2", status: "failed", duration: 200 }),
        createTest({ id: "3", status: "skipped", duration: 0 }),
        createTest({ id: "4", status: "flaky", duration: 150 }),
      ];

      const run = createTestRun(tests);
      const filtered = filterTests(run, (test) => test.status !== "skipped");

      expect(filtered.totals.total).toBe(3);
      expect(filtered.totals.duration).toBe(450);
      expect(filtered.totals.skipped).toBe(0);
    });
  });

  describe("filterPredicates", () => {
    it("should filter failed tests", () => {
      const test1 = createTest({ status: "failed" });
      const test2 = createTest({ status: "passed" });

      expect(filterPredicates.failed(test1)).toBe(true);
      expect(filterPredicates.failed(test2)).toBe(false);
    });

    it("should filter flaky tests", () => {
      const test1 = createTest({ status: "flaky" });
      const test2 = createTest({ status: "passed", retries: 2 });
      const test3 = createTest({ status: "passed", retries: 0 });

      expect(filterPredicates.flaky(test1)).toBe(true);
      expect(filterPredicates.flaky(test2)).toBe(true);
      expect(filterPredicates.flaky(test3)).toBe(false);
    });

    it("should filter slow tests", () => {
      const test1 = createTest({ duration: 500 });
      const test2 = createTest({ duration: 100 });

      const slowPredicate = filterPredicates.slow(300);
      expect(slowPredicate(test1)).toBe(true);
      expect(slowPredicate(test2)).toBe(false);
    });

    it("should filter by title pattern", () => {
      const test1 = createTest({ title: "login test" });
      const test2 = createTest({ title: "logout test" });
      const test3 = createTest({ title: "home page" });

      const loginPredicate = filterPredicates.byTitle("login");
      expect(loginPredicate(test1)).toBe(true);
      expect(loginPredicate(test2)).toBe(false);

      const regexPredicate = filterPredicates.byTitle(/log(in|out)/);
      expect(regexPredicate(test1)).toBe(true);
      expect(regexPredicate(test2)).toBe(true);
      expect(regexPredicate(test3)).toBe(false);
    });

    it("should filter tests with errors", () => {
      const test1 = createTest({ error: { message: "Error" } });
      const test2 = createTest({ error: undefined });

      expect(filterPredicates.withErrors(test1)).toBe(true);
      expect(filterPredicates.withErrors(test2)).toBe(false);
    });

    it("should filter tests with attachments", () => {
      const test1 = createTest({
        attachments: [{ name: "screenshot", contentType: "image/png" }],
      });
      const test2 = createTest({ attachments: [] });
      const test3 = createTest({ attachments: undefined });

      expect(filterPredicates.withAttachments(test1)).toBe(true);
      expect(filterPredicates.withAttachments(test2)).toBe(false);
      expect(filterPredicates.withAttachments(test3)).toBe(false);
    });
  });

  describe("combinePredicates", () => {
    it("should combine predicates with AND logic", () => {
      const test1 = createTest({ status: "failed", duration: 500 });
      const test2 = createTest({ status: "failed", duration: 100 });
      const test3 = createTest({ status: "passed", duration: 500 });

      const combined = combinePredicates(
        filterPredicates.failed,
        filterPredicates.slow(300),
      );

      expect(combined(test1)).toBe(true);
      expect(combined(test2)).toBe(false);
      expect(combined(test3)).toBe(false);
    });

    it("should combine predicates with OR logic", () => {
      const test1 = createTest({ status: "failed" });
      const test2 = createTest({ status: "skipped" });
      const test3 = createTest({ status: "passed" });

      const combined = combinePredicatesOr(
        filterPredicates.failed,
        filterPredicates.skipped,
      );

      expect(combined(test1)).toBe(true);
      expect(combined(test2)).toBe(true);
      expect(combined(test3)).toBe(false);
    });
  });
});

describe("Sort Utilities", () => {
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

  const createTestRun = (tests: NormalizedTest[]): NormalizedTestRun => ({
    runId: "test-run-1",
    startedAt: "2024-01-01T10:00:00.000Z",
    endedAt: "2024-01-01T10:10:00.000Z",
    duration: 600000,
    projects: ["chromium"],
    totals: {
      total: tests.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      flaky: 0,
      duration: 0,
    },
    tests,
  });

  describe("sortTests", () => {
    it("should sort tests by duration descending", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", duration: 200 }),
        createTest({ id: "2", duration: 500 }),
        createTest({ id: "3", duration: 100 }),
      ];

      const run = createTestRun(tests);
      const sorted = sortTests(run, sortComparators.byDurationDesc);

      expect(sorted.tests[0]!.duration).toBe(500);
      expect(sorted.tests[1]!.duration).toBe(200);
      expect(sorted.tests[2]!.duration).toBe(100);
    });

    it("should sort tests by status", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", status: "passed" }),
        createTest({ id: "2", status: "failed" }),
        createTest({ id: "3", status: "skipped" }),
        createTest({ id: "4", status: "flaky" }),
      ];

      const run = createTestRun(tests);
      const sorted = sortTests(run, sortComparators.byStatus);

      expect(sorted.tests[0]!.status).toBe("failed");
      expect(sorted.tests[1]!.status).toBe("flaky");
      expect(sorted.tests[2]!.status).toBe("passed");
      expect(sorted.tests[3]!.status).toBe("skipped");
    });

    it("should sort tests by title alphabetically", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", title: "zebra" }),
        createTest({ id: "2", title: "apple" }),
        createTest({ id: "3", title: "banana" }),
      ];

      const run = createTestRun(tests);
      const sorted = sortTests(run, sortComparators.byTitle);

      expect(sorted.tests[0]!.title).toBe("apple");
      expect(sorted.tests[1]!.title).toBe("banana");
      expect(sorted.tests[2]!.title).toBe("zebra");
    });

    it("should sort by location", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", file: "b.ts", line: 10, column: 5 }),
        createTest({ id: "2", file: "a.ts", line: 20, column: 3 }),
        createTest({ id: "3", file: "b.ts", line: 5, column: 10 }),
        createTest({ id: "4", file: "b.ts", line: 10, column: 3 }),
      ];

      const run = createTestRun(tests);
      const sorted = sortTests(run, sortComparators.byLocation);

      expect(sorted.tests[0]!.file).toBe("a.ts");
      expect(sorted.tests[1]!.line).toBe(5);
      expect(sorted.tests[2]!.column).toBe(3);
      expect(sorted.tests[3]!.column).toBe(5);
    });
  });

  describe("compoundSort", () => {
    it("should sort by multiple criteria", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", status: "passed", duration: 200 }),
        createTest({ id: "2", status: "failed", duration: 100 }),
        createTest({ id: "3", status: "passed", duration: 100 }),
        createTest({ id: "4", status: "failed", duration: 200 }),
      ];

      const run = createTestRun(tests);
      const sorted = sortTests(
        run,
        compoundSort(sortComparators.byStatus, sortComparators.byDurationDesc),
      );

      expect(sorted.tests[0]!.status).toBe("failed");
      expect(sorted.tests[0]!.duration).toBe(200);
      expect(sorted.tests[1]!.status).toBe("failed");
      expect(sorted.tests[1]!.duration).toBe(100);
      expect(sorted.tests[2]!.status).toBe("passed");
      expect(sorted.tests[2]!.duration).toBe(200);
    });
  });

  describe("reverseSort", () => {
    it("should reverse sort order", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", title: "apple" }),
        createTest({ id: "2", title: "zebra" }),
        createTest({ id: "3", title: "banana" }),
      ];

      const run = createTestRun(tests);
      const sorted = sortTests(run, reverseSort(sortComparators.byTitle));

      expect(sorted.tests[0]!.title).toBe("zebra");
      expect(sorted.tests[1]!.title).toBe("banana");
      expect(sorted.tests[2]!.title).toBe("apple");
    });
  });
});

describe("Helper Utilities", () => {
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
      duration: tests.reduce((sum, t) => sum + (t.duration || 0), 0),
    },
    tests,
  });

  describe("groupTests", () => {
    it("should group tests by project", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", project: "chromium" }),
        createTest({ id: "2", project: "firefox" }),
        createTest({ id: "3", project: "chromium" }),
      ];

      const groups = groupTests(tests, (test) => test.project);

      expect(Object.keys(groups)).toHaveLength(2);
      expect(groups["chromium"]).toHaveLength(2);
      expect(groups["firefox"]).toHaveLength(1);
    });

    it("should group tests by status", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", status: "passed" }),
        createTest({ id: "2", status: "failed" }),
        createTest({ id: "3", status: "passed" }),
        createTest({ id: "4", status: "failed" }),
      ];

      const groups = groupTests(tests, (test) => test.status);

      expect(groups["passed"]).toHaveLength(2);
      expect(groups["failed"]).toHaveLength(2);
    });
  });

  describe("getUniqueProjects", () => {
    it("should return unique project names", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", project: "chromium" }),
        createTest({ id: "2", project: "firefox" }),
        createTest({ id: "3", project: "chromium" }),
        createTest({ id: "4", project: "webkit" }),
      ];

      const run = createTestRun(tests);
      const projects = getUniqueProjects(run);

      expect(projects).toHaveLength(3);
      expect(projects).toContain("chromium");
      expect(projects).toContain("firefox");
      expect(projects).toContain("webkit");
    });
  });

  describe("getUniqueFiles", () => {
    it("should return unique file paths", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", file: "auth.spec.ts" }),
        createTest({ id: "2", file: "home.spec.ts" }),
        createTest({ id: "3", file: "auth.spec.ts" }),
      ];

      const run = createTestRun(tests);
      const files = getUniqueFiles(run);

      expect(files).toHaveLength(2);
      expect(files).toContain("auth.spec.ts");
      expect(files).toContain("home.spec.ts");
    });
  });

  describe("calculatePassRate", () => {
    it("should calculate pass rate correctly", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", status: "passed" }),
        createTest({ id: "2", status: "passed" }),
        createTest({ id: "3", status: "failed" }),
        createTest({ id: "4", status: "skipped" }),
      ];

      const run = createTestRun(tests);
      const passRate = calculatePassRate(run);

      expect(passRate).toBe(50);
    });

    it("should return 0% pass rate for zero tests", () => {
      const run = createTestRun([]);
      const passRate = calculatePassRate(run);

      expect(passRate).toBe(0);
    });
  });

  describe("calculateFlakyRate", () => {
    it("should calculate flaky rate correctly", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", status: "passed" }),
        createTest({ id: "2", status: "flaky" }),
        createTest({ id: "3", status: "failed" }),
        createTest({ id: "4", status: "flaky" }),
      ];

      const run = createTestRun(tests);
      const flakyRate = calculateFlakyRate(run);

      expect(flakyRate).toBe(50);
    });
  });

  describe("findTestsByPattern", () => {
    it("should find tests by string pattern", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", title: "login test", fullTitle: "auth > login test" }),
        createTest({ id: "2", title: "home test", fullTitle: "pages > home test" }),
        createTest({ id: "3", title: "logout test", fullTitle: "auth > logout test" }),
      ];

      const run = createTestRun(tests);
      const found = findTestsByPattern(run, "login");

      expect(found).toHaveLength(1);
      expect(found[0]!.title).toBe("login test");
    });

    it("should find tests by regex pattern", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", title: "login test" }),
        createTest({ id: "2", title: "logout test" }),
        createTest({ id: "3", title: "home test" }),
      ];

      const run = createTestRun(tests);
      const found = findTestsByPattern(run, /log(in|out)/);

      expect(found).toHaveLength(2);
    });
  });

  describe("getTestSummary", () => {
    it("should return complete test summary", () => {
      const tests: NormalizedTest[] = [
        createTest({ id: "1", status: "passed" }),
        createTest({ id: "2", status: "failed" }),
        createTest({ id: "3", status: "skipped" }),
        createTest({ id: "4", status: "flaky" }),
      ];

      const run = createTestRun(tests);
      const summary = getTestSummary(run);

      expect(summary.total).toBe(4);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.skipped).toBe(1);
      expect(summary.flaky).toBe(1);
      expect(summary.passRate).toBe(25);
      expect(summary.flakyRate).toBe(25);
    });
  });

  describe("test status checks", () => {
    it("should check if all tests passed", () => {
      const allPassed = createTestRun([
        createTest({ id: "1", status: "passed" }),
        createTest({ id: "2", status: "passed" }),
      ]);

      const withFailures = createTestRun([
        createTest({ id: "1", status: "passed" }),
        createTest({ id: "2", status: "failed" }),
      ]);

      expect(allTestsPassed(allPassed)).toBe(true);
      expect(allTestsPassed(withFailures)).toBe(false);
    });

    it("should check for failures", () => {
      const withFailures = createTestRun([
        createTest({ id: "1", status: "passed" }),
        createTest({ id: "2", status: "failed" }),
      ]);

      const noFailures = createTestRun([
        createTest({ id: "1", status: "passed" }),
        createTest({ id: "2", status: "skipped" }),
      ]);

      expect(hasFailures(withFailures)).toBe(true);
      expect(hasFailures(noFailures)).toBe(false);
    });

    it("should check for flaky tests", () => {
      const withFlaky = createTestRun([
        createTest({ id: "1", status: "passed" }),
        createTest({ id: "2", status: "flaky" }),
      ]);

      const noFlaky = createTestRun([
        createTest({ id: "1", status: "passed" }),
        createTest({ id: "2", status: "failed" }),
      ]);

      expect(hasFlakyTests(withFlaky)).toBe(true);
      expect(hasFlakyTests(noFlaky)).toBe(false);
    });
  });
});

describe("Integration Tests", () => {
  describe("Complex Normalizer Scenarios", () => {
    it("should normalize complex nested structure with projects in specs", () => {
      const report = {
        config: {
          projects: [{ name: "chromium" }],
        },
        suites: [
          {
            title: "Root Suite",
            suites: [
              {
                title: "Nested Suite",
                specs: [
                  {
                    title: "Test Spec",
                    ok: true,
                    tests: [
                      {
                        timeout: 30000,
                        expectedStatus: "passed",
                        projectName: "firefox",
                        results: [
                          {
                            workerIndex: 0,
                            duration: 100,
                            retry: 0,
                            startTime: "2024-01-01T00:00:00.000Z",
                          },
                        ],
                        status: "expected",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const validated = validatePlaywrightJson(report);
      const normalized = normalizeTestRun(validated);
      expect(normalized.tests).toHaveLength(1);
      expect(normalized.tests[0].project).toBe("firefox");
    });

    it("should normalize old format with nested test.tests structure", () => {
      const report = {
        config: {},
        suites: [
          {
            title: "Suite",
            suites: [],
            specs: [
              {
                title: "Old Format Test",
                ok: true,
                file: "test.spec.ts",
                line: 10,
                column: 5,
                tests: [
                  {
                    timeout: 30000,
                    expectedStatus: "passed",
                    projectName: "webkit",
                    results: [
                      {
                        workerIndex: 0,
                        duration: 200,
                        retry: 0,
                        startTime: "2024-01-01T00:00:00.000Z",
                      },
                    ],
                    status: "expected",
                  },
                ],
              },
            ],
          },
        ],
      };

      const validated = validatePlaywrightJson(report);
      const normalized = normalizeTestRun(validated);
      expect(normalized.tests).toHaveLength(1);
      expect(normalized.tests[0].project).toBe("webkit");
      expect(normalized.tests[0].file).toBe("test.spec.ts");
    });
  });

  describe("Statistics Single Test Scenarios", () => {
    it("should calculate correct percentiles for single test", () => {
      const run: NormalizedTestRun = {
        runId: "test",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        duration: 100,
        projects: ["test"],
        totals: {
          total: 1,
          passed: 1,
          failed: 0,
          skipped: 0,
          flaky: 0,
          duration: 100,
        },
        tests: [
          {
            id: "test-1",
            title: "Single Test",
            fullTitle: "Suite > Single Test",
            file: "test.spec.ts",
            line: 1,
            column: 1,
            project: "test",
            status: "passed",
            duration: 100,
            retries: 0,
          },
        ],
      };

      const stats = calculateStatistics(run);
      expect(stats.duration.median).toBe(100);
      expect(stats.duration.p95).toBe(100);
      expect(stats.duration.min).toBe(100);
      expect(stats.duration.max).toBe(100);
    });
  });

  describe("Shard Validation Advanced", () => {
    it("should validate shards with undefined total in first shard", () => {
      const run1: NormalizedTestRun = {
        runId: "run-1",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        duration: 1000,
        projects: ["chromium"],
        shards: [
          {
            current: 1,
            total: undefined as unknown as number,
            duration: 1000,
            testCount: 5,
          },
        ],
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
        shards: [{ current: 2, total: 2, duration: 1000, testCount: 5 }],
      };

      expect(areRunsFromSameExecution([run1, run2])).toBe(false);
    });

    it("should aggregate run without metadata or shard info", () => {
      const run: NormalizedTestRun = {
        runId: "simple-run",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        duration: 500,
        projects: ["default"],
        totals: {
          total: 2,
          passed: 2,
          failed: 0,
          skipped: 0,
          flaky: 0,
          duration: 500,
        },
        tests: [
          {
            id: "test-1",
            title: "Test 1",
            fullTitle: "Test 1",
            file: "test.spec.ts",
            line: 1,
            column: 1,
            project: "default",
            status: "passed",
            duration: 250,
            retries: 0,
          },
          {
            id: "test-2",
            title: "Test 2",
            fullTitle: "Test 2",
            file: "test.spec.ts",
            line: 2,
            column: 1,
            project: "default",
            status: "passed",
            duration: 250,
            retries: 0,
          },
        ],
      };

      const aggregated = aggregateShardedRuns([run]);
      expect(aggregated.shards).toBeUndefined();
      expect(aggregated.metadata).toBeUndefined();
      expect(aggregated.tests).toHaveLength(2);
    });
  });

  describe("Filter Status Validation", () => {
    it("should filter and recalculate totals for skipped tests", () => {
      const testRun: NormalizedTestRun = {
        runId: "test",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        duration: 0,
        projects: ["test"],
        totals: {
          total: 2,
          passed: 1,
          failed: 0,
          skipped: 1,
          flaky: 0,
          duration: 100,
        },
        tests: [
          {
            id: "test-1",
            title: "Passed Test",
            fullTitle: "Passed Test",
            file: "test.spec.ts",
            line: 1,
            column: 1,
            project: "test",
            status: "passed",
            duration: 100,
            retries: 0,
          },
          {
            id: "test-2",
            title: "Skipped Test",
            fullTitle: "Skipped Test",
            file: "test.spec.ts",
            line: 2,
            column: 1,
            project: "test",
            status: "skipped",
            duration: 0,
            retries: 0,
          },
        ],
      };

      const filtered = filterTests(testRun, filterPredicates.skipped);
      expect(filtered.tests).toHaveLength(1);
      expect(filtered.tests[0].status).toBe("skipped");
      expect(filtered.totals.skipped).toBe(1);
      expect(filtered.totals.total).toBe(1);
    });

    it("should filter and recalculate totals for flaky tests", () => {
      const testRun: NormalizedTestRun = {
        runId: "test",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        duration: 0,
        projects: ["test"],
        totals: {
          total: 2,
          passed: 1,
          failed: 0,
          skipped: 0,
          flaky: 1,
          duration: 200,
        },
        tests: [
          {
            id: "test-1",
            title: "Passed Test",
            fullTitle: "Passed Test",
            file: "test.spec.ts",
            line: 1,
            column: 1,
            project: "test",
            status: "passed",
            duration: 100,
            retries: 0,
          },
          {
            id: "test-2",
            title: "Flaky Test",
            fullTitle: "Flaky Test",
            file: "test.spec.ts",
            line: 2,
            column: 1,
            project: "test",
            status: "flaky",
            duration: 100,
            retries: 1,
          },
        ],
      };

      const filtered = filterTests(testRun, filterPredicates.flaky);
      expect(filtered.tests).toHaveLength(1);
      expect(filtered.tests[0].status).toBe("flaky");
      expect(filtered.totals.flaky).toBe(1);
      expect(filtered.totals.total).toBe(1);
    });
  });

  describe("ValidationError Constructor", () => {
    it("should create ValidationError without issues parameter", () => {
      const error = new ValidationError("Test error without issues");
      expect(error.message).toBe("Test error without issues");
      expect(error.name).toBe("ValidationError");
      expect(error.issues).toBeUndefined();
    });
  });
});
