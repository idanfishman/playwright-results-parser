import { describe, it, expect } from "vitest";
import {
  calculateStatistics,
  getFailedTests,
  getFlakyTests,
  getTestsByProject,
  getTestsByFile,
  type NormalizedTestRun,
  type NormalizedTest,
} from "../src/index.js";

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

    it("should handle empty test run", () => {
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

    it("should handle all tests skipped", () => {
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

    it("should handle missing duration values", () => {
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

    it("should handle single test", () => {
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
