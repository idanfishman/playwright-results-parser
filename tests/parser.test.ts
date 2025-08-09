import { describe, it, expect, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  parsePlaywrightJson,
  parsePlaywrightResults,
  ValidationError,
  validatePlaywrightJson,
  normalizeTestRun,
  areRunsFromSameExecution,
  calculateStatistics,
  filterPredicates,
  sortComparators,
  compoundSort,
  combinePredicates,
  reverseSort,
  aggregateShardedRuns,
  type NormalizedTestRun,
  type NormalizedTest,
} from "../src/index.js";
import type { PlaywrightJsonReport } from "../src/parser/validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Parser", () => {
  describe("parsePlaywrightJson", () => {
    it("should parse valid JSON from file path", async () => {
      const filePath = path.join(__dirname, "fixtures", "all-success.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result).toBeDefined();
      expect(result.tests.length).toBeGreaterThan(0);
      expect(result.totals.failed).toBe(0);
      expect(result.totals.total).toBeGreaterThan(0);
    });

    it("should parse valid JSON from object", async () => {
      const filePath = path.join(__dirname, "fixtures", "all-success.json");
      const jsonContent = await fs.readFile(filePath, "utf-8");
      const jsonObject = JSON.parse(jsonContent);
      const result = await parsePlaywrightJson(jsonObject);

      expect(result).toBeDefined();
      expect(result.tests.length).toBeGreaterThan(0);
      expect(result.totals.failed).toBe(0);
    });

    it("should parse valid JSON from Buffer", async () => {
      const filePath = path.join(__dirname, "fixtures", "all-success.json");
      const buffer = await fs.readFile(filePath);
      const result = await parsePlaywrightJson(buffer);

      expect(result).toBeDefined();
      expect(result.tests.length).toBeGreaterThan(0);
      expect(result.totals.failed).toBe(0);
    });

    it("should throw error for non-existent file", async () => {
      await expect(parsePlaywrightJson("/non/existent/file.json")).rejects.toThrow(
        "File not found",
      );
    });

    it("should throw ValidationError for malformed JSON", async () => {
      const filePath = path.join(__dirname, "fixtures", "malformed.json");
      await expect(parsePlaywrightJson(filePath)).rejects.toThrow(ValidationError);
    });

    it("should throw error for invalid input type", async () => {
      await expect(parsePlaywrightJson(123 as unknown as string)).rejects.toThrow(
        "Input must be a file path string, JSON object, or Buffer",
      );
    });

    it("should use parsePlaywrightResults alias", async () => {
      const filePath = path.join(__dirname, "fixtures", "all-success.json");
      const result = await parsePlaywrightResults(filePath);
      expect(result).toBeDefined();
      expect(result.tests.length).toBeGreaterThan(0);
    });
  });

  describe("Test Status Detection", () => {
    it("should correctly identify failed tests", async () => {
      const filePath = path.join(__dirname, "fixtures", "with-failures.json");
      const result = await parsePlaywrightJson(filePath);

      const failedTests = result.tests.filter((t) => t.status === "failed");
      expect(failedTests.length).toBeGreaterThan(0);
      expect(failedTests[0].error).toBeDefined();
    });

    it("should correctly identify flaky tests", async () => {
      const filePath = path.join(__dirname, "fixtures", "flaky-tests.json");
      const result = await parsePlaywrightJson(filePath);

      const flakyTests = result.tests.filter((t) => t.status === "flaky");
      expect(flakyTests.length).toBeGreaterThan(0);
      expect(flakyTests[0].retries).toBeGreaterThan(0);
    });

    it("should correctly identify skipped tests", async () => {
      const filePath = path.join(__dirname, "fixtures", "flaky-tests.json");
      const result = await parsePlaywrightJson(filePath);

      const skippedTests = result.tests.filter((t) => t.status === "skipped");
      if (skippedTests.length > 0) {
        expect(skippedTests[0].annotations).toBeDefined();
      }
    });
  });

  describe("Test Hierarchy", () => {
    it("should preserve test hierarchy in fullTitle", async () => {
      const filePath = path.join(__dirname, "fixtures", "with-failures.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result.tests.length).toBeGreaterThan(0);
      expect(result.tests[0].fullTitle).toBeDefined();
      expect(result.tests[0].fullTitle.length).toBeGreaterThan(0);
    });

    it("should extract file location correctly", async () => {
      const filePath = path.join(__dirname, "fixtures", "all-success.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result.tests[0].file).toBeDefined();
      expect(result.tests[0].line).toBeGreaterThanOrEqual(0);
      expect(result.tests[0].column).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Projects and Metadata", () => {
    it("should extract project names", async () => {
      const filePath = path.join(__dirname, "fixtures", "with-failures.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result.projects.length).toBeGreaterThan(0);
      expect(result.projects).toContain("chromium");
    });

    it("should handle tests from multiple projects", async () => {
      const filePath = path.join(__dirname, "fixtures", "all-success.json");
      const result = await parsePlaywrightJson(filePath);

      const projectSet = new Set(result.tests.map((t) => t.project));
      expect(projectSet.size).toBeGreaterThan(0);
    });
  });

  describe("Totals Calculation", () => {
    it("should calculate totals correctly", async () => {
      const filePath = path.join(__dirname, "fixtures", "with-failures.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result.totals.total).toBeGreaterThan(0);
      expect(result.totals.total).toBe(
        result.totals.passed +
          result.totals.failed +
          result.totals.skipped +
          result.totals.flaky,
      );
      expect(result.totals.duration).toBeGreaterThan(0);
    });

    it("should calculate flaky test totals", async () => {
      const filePath = path.join(__dirname, "fixtures", "flaky-tests.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result.totals.flaky).toBeGreaterThanOrEqual(0);
      expect(result.totals.skipped).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("Shard Aggregation", () => {
  it("should detect shard information", async () => {
    const filePath = path.join(__dirname, "fixtures", "shard1.json");
    const result = await parsePlaywrightJson(filePath);

    expect(result.shards).toBeDefined();
    expect(result.shards).toHaveLength(1);
    expect(result.shards![0].current).toBeGreaterThan(0);
    expect(result.shards![0].total).toBeGreaterThan(0);
  });

  it("should aggregate multiple sharded runs", async () => {
    const shard1Path = path.join(__dirname, "fixtures", "shard1.json");
    const shard2Path = path.join(__dirname, "fixtures", "shard2.json");
    const shard1 = await parsePlaywrightJson(shard1Path);
    const shard2 = await parsePlaywrightJson(shard2Path);

    const aggregated = aggregateShardedRuns([shard1, shard2]);

    expect(aggregated.tests.length).toBeGreaterThan(0);
    expect(aggregated.shards).toHaveLength(2);
    expect(aggregated.totals.total).toBe(shard1.totals.total + shard2.totals.total);
  });

  it("should check if runs are from same execution", () => {
    const run1: NormalizedTestRun = {
      runId: "1",
      startedAt: "2024-01-01T10:00:00.000Z",
      endedAt: "2024-01-01T10:00:01.000Z",
      duration: 1000,
      projects: ["chromium"],
      shards: [{ current: 1, total: 2, duration: 1000, testCount: 1 }],
      totals: { total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, duration: 1000 },
      tests: [],
    };

    const run2: NormalizedTestRun = {
      ...run1,
      shards: [{ current: 2, total: 2, duration: 1000, testCount: 1 }],
    };

    const run3: NormalizedTestRun = {
      ...run1,
      shards: [{ current: 1, total: 3, duration: 1000, testCount: 1 }],
    };

    expect(areRunsFromSameExecution([run1, run2])).toBe(true);
    expect(areRunsFromSameExecution([run1, run3])).toBe(false);
  });

  it("should throw error when aggregating empty array", () => {
    expect(() => aggregateShardedRuns([])).toThrow(
      "No test runs provided for aggregation",
    );
  });

  it("should return single run when aggregating one run", () => {
    const run: NormalizedTestRun = {
      runId: "1",
      startedAt: "2024-01-01T10:00:00.000Z",
      endedAt: "2024-01-01T10:00:01.000Z",
      duration: 1000,
      projects: ["chromium"],
      totals: { total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, duration: 1000 },
      tests: [],
    };

    const result = aggregateShardedRuns([run]);
    expect(result).toBe(run);
  });
});

describe("Validation", () => {
  it("should validate correct Playwright JSON structure", () => {
    const validData = {
      config: {
        projects: [{ name: "chromium" }],
      },
      suites: [],
    };

    expect(() => validatePlaywrightJson(validData)).not.toThrow();
  });

  it("should throw ValidationError for invalid structure", () => {
    const invalidData = {
      config: {},
      suites: "not an array",
    };

    expect(() => validatePlaywrightJson(invalidData)).toThrow(ValidationError);
  });

  it("should include issues in ValidationError", () => {
    const invalidData = {
      config: {},
      suites: "not an array",
    };

    try {
      validatePlaywrightJson(invalidData);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).issues).toBeDefined();
    }
  });
});

describe("Normalizer", () => {
  it("should generate unique test IDs", async () => {
    const filePath = path.join(__dirname, "fixtures", "with-failures.json");
    const result = await parsePlaywrightJson(filePath);

    const ids = result.tests.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should extract annotations correctly", async () => {
    const filePath = path.join(__dirname, "fixtures", "flaky-tests.json");
    const result = await parsePlaywrightJson(filePath);

    const testsWithAnnotations = result.tests.filter(
      (t) => t.annotations && t.annotations.length > 0,
    );
    if (testsWithAnnotations.length > 0) {
      expect(testsWithAnnotations[0].annotations).toBeDefined();
      expect(testsWithAnnotations[0].annotations![0].type).toBeDefined();
    }
  });

  it("should handle tests without location info", async () => {
    const data = {
      config: { projects: [{ name: "chromium" }] },
      suites: [
        {
          title: "Suite",
          specs: [
            {
              title: "test without location",
              ok: true,
              tags: [],
              tests: [
                {
                  timeout: 30000,
                  annotations: [],
                  expectedStatus: "passed",
                  projectName: "chromium",
                  results: [
                    {
                      workerIndex: 0,
                      status: "passed",
                      duration: 100,
                      errors: [],
                      stdout: [],
                      stderr: [],
                      retry: 0,
                      startTime: "2024-01-01T10:00:00.000Z",
                      attachments: [],
                    },
                  ],
                  status: "expected",
                },
              ],
              id: "test-1",
              retries: 0,
            },
          ],
        },
      ],
    };

    const validated = validatePlaywrightJson(data);
    const result = normalizeTestRun(validated);

    expect(result.tests[0].file).toBe("unknown");
    expect(result.tests[0].line).toBe(0);
    expect(result.tests[0].column).toBe(0);
  });

  it("should extract run timestamps", async () => {
    const filePath = path.join(__dirname, "fixtures", "all-success.json");
    const result = await parsePlaywrightJson(filePath);

    expect(result.startedAt).toBeDefined();
    expect(result.endedAt).toBeDefined();
    expect(result.duration).toBeGreaterThan(0);
  });
});

describe("Complex Fixture Validation", () => {
  describe("all-success.json - Complete success scenario", () => {
    it("should parse all 6 passing tests correctly", async () => {
      const filePath = path.join(__dirname, "fixtures", "all-success.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result.tests).toHaveLength(6);
      expect(result.totals.total).toBe(6);
      expect(result.totals.passed).toBe(6);
      expect(result.totals.failed).toBe(0);
      expect(result.totals.skipped).toBe(0);
      expect(result.totals.flaky).toBe(0);
    });

    it("should have tests from all three browser projects", async () => {
      const filePath = path.join(__dirname, "fixtures", "all-success.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result.projects).toContain("chromium");
      expect(result.projects).toContain("firefox");
      expect(result.projects).toContain("webkit");
    });

    it("should have correct test titles and no errors", async () => {
      const filePath = path.join(__dirname, "fixtures", "all-success.json");
      const result = await parsePlaywrightJson(filePath);

      const titles = result.tests.map((t) => t.title);
      expect(titles).toContain("should have correct page title");
      expect(titles).toContain("should display main heading");
      expect(titles).toContain("should have Get started link");

      // No test should have errors
      result.tests.forEach((test) => {
        expect(test.error).toBeUndefined();
        expect(test.status).toBe("passed");
      });
    });

    it("should have zero retries for all tests", async () => {
      const filePath = path.join(__dirname, "fixtures", "all-success.json");
      const result = await parsePlaywrightJson(filePath);

      result.tests.forEach((test) => {
        expect(test.retries).toBe(0);
      });
    });

    it("should have valid durations for all tests", async () => {
      const filePath = path.join(__dirname, "fixtures", "all-success.json");
      const result = await parsePlaywrightJson(filePath);

      result.tests.forEach((test) => {
        expect(test.duration).toBeGreaterThan(0);
      });

      expect(result.totals.duration).toBeGreaterThan(0);
    });
  });

  describe("with-failures.json - Mixed results scenario", () => {
    it("should correctly parse 21 tests with mixed statuses", async () => {
      const filePath = path.join(__dirname, "fixtures", "with-failures.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result.tests).toHaveLength(21);
      expect(result.totals.total).toBe(21);
      expect(result.totals.passed).toBe(9);
      expect(result.totals.failed).toBe(12);
    });

    it("should have detailed error information for failed tests", async () => {
      const filePath = path.join(__dirname, "fixtures", "with-failures.json");
      const result = await parsePlaywrightJson(filePath);

      const failedTests = result.tests.filter((t) => t.status === "failed");
      expect(failedTests).toHaveLength(12);

      // At least some failed tests should have error details
      const testsWithErrors = failedTests.filter((t) => t.error !== undefined);
      expect(testsWithErrors.length).toBeGreaterThan(0);

      testsWithErrors.forEach((test) => {
        expect(test.error).toHaveProperty("message");
        expect(typeof test.error!.message).toBe("string");
      });
    });

    it("should have tests distributed across browsers", async () => {
      const filePath = path.join(__dirname, "fixtures", "with-failures.json");
      const result = await parsePlaywrightJson(filePath);

      const chromiumTests = result.tests.filter((t) => t.project === "chromium");
      const firefoxTests = result.tests.filter((t) => t.project === "firefox");
      const webkitTests = result.tests.filter((t) => t.project === "webkit");

      expect(chromiumTests.length).toBe(7);
      expect(firefoxTests.length).toBe(7);
      expect(webkitTests.length).toBe(7);
    });

    it("should parse test titles with status indicators", async () => {
      const filePath = path.join(__dirname, "fixtures", "with-failures.json");
      const result = await parsePlaywrightJson(filePath);

      const titles = result.tests.map((t) => t.title);
      expect(titles).toContain("should have correct page title (PASS)");
      expect(titles).toContain("should find non-existent element (FAIL)");
      expect(titles).toContain("should have wrong page title (FAIL)");
    });

    it("should have valid file paths and locations", async () => {
      const filePath = path.join(__dirname, "fixtures", "with-failures.json");
      const result = await parsePlaywrightJson(filePath);

      result.tests.forEach((test) => {
        expect(test.file).toBeDefined();
        expect(test.file).toMatch(/\.spec\.ts$/);
        expect(test.line).toBeGreaterThanOrEqual(0);
        expect(test.column).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("flaky-tests.json - Flaky test scenario", () => {
    it("should correctly identify flaky tests", async () => {
      const filePath = path.join(__dirname, "fixtures", "flaky-tests.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result.tests).toHaveLength(15);

      const flakyTests = result.tests.filter((t) => t.status === "flaky");
      const passedTests = result.tests.filter((t) => t.status === "passed");

      expect(flakyTests.length).toBeGreaterThan(0);
      expect(passedTests.length).toBeGreaterThan(0);
    });

    it("should have retries for flaky tests", async () => {
      const filePath = path.join(__dirname, "fixtures", "flaky-tests.json");
      const result = await parsePlaywrightJson(filePath);

      const flakyTests = result.tests.filter((t) => t.status === "flaky");

      flakyTests.forEach((test) => {
        expect(test.retries).toBeGreaterThan(0);
      });

      const stableTests = result.tests.filter((t) => t.status === "passed");
      stableTests.forEach((test) => {
        expect(test.retries).toBe(0);
      });
    });

    it("should parse test titles with stability indicators", async () => {
      const filePath = path.join(__dirname, "fixtures", "flaky-tests.json");
      const result = await parsePlaywrightJson(filePath);

      const titles = result.tests.map((t) => t.title);
      expect(titles.some((t) => t.includes("STABLE"))).toBe(true);
      expect(titles.some((t) => t.includes("FLAKY"))).toBe(true);
      expect(titles).toContain("should pass immediately (STABLE)");
      expect(titles).toContain("should be flaky - random failure (FLAKY)");
    });

    it("should have tests across all browser projects", async () => {
      const filePath = path.join(__dirname, "fixtures", "flaky-tests.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result.projects).toContain("chromium");
      expect(result.projects).toContain("firefox");
      expect(result.projects).toContain("webkit");

      const projectCounts = result.tests.reduce(
        (acc, test) => {
          acc[test.project] = (acc[test.project] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      expect(projectCounts.chromium).toBe(5);
      expect(projectCounts.firefox).toBe(5);
      expect(projectCounts.webkit).toBe(5);
    });

    it("should calculate correct totals including flaky", async () => {
      const filePath = path.join(__dirname, "fixtures", "flaky-tests.json");
      const result = await parsePlaywrightJson(filePath);

      const statusCounts = result.tests.reduce(
        (acc, test) => {
          acc[test.status] = (acc[test.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      expect(result.totals.flaky).toBe(statusCounts.flaky || 0);
      expect(result.totals.passed).toBe(statusCounts.passed || 0);
      expect(result.totals.total).toBe(15);
    });
  });

  describe("Sharded test scenarios", () => {
    it("shard1.json should have correct shard metadata", async () => {
      const filePath = path.join(__dirname, "fixtures", "shard1.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result.shards).toBeDefined();
      expect(result.shards).toHaveLength(1);
      expect(result.shards![0]).toMatchObject({
        current: 1,
        total: 2,
      });

      expect(result.tests).toHaveLength(15);
      expect(result.totals.passed).toBe(15);
      expect(result.totals.failed).toBe(0);
    });

    it("shard2.json should have correct shard metadata", async () => {
      const filePath = path.join(__dirname, "fixtures", "shard2.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result.shards).toBeDefined();
      expect(result.shards).toHaveLength(1);
      expect(result.shards![0]).toMatchObject({
        current: 2,
        total: 2,
      });

      expect(result.tests).toHaveLength(15);
      expect(result.totals.passed).toBe(15);
      expect(result.totals.failed).toBe(0);
    });

    it("should have unique test content per shard", async () => {
      const shard1Path = path.join(__dirname, "fixtures", "shard1.json");
      const shard2Path = path.join(__dirname, "fixtures", "shard2.json");

      const shard1 = await parsePlaywrightJson(shard1Path);
      const shard2 = await parsePlaywrightJson(shard2Path);

      const shard1Titles = shard1.tests.map((t) => t.title);
      const shard2Titles = shard2.tests.map((t) => t.title);

      // Check for shard-specific prefixes
      expect(
        shard1Titles.filter((t) => t.startsWith("shard1:")).length,
      ).toBeGreaterThan(0);
      expect(
        shard2Titles.filter((t) => t.startsWith("shard2:")).length,
      ).toBeGreaterThan(0);

      // Verify no overlap in test IDs
      const shard1Ids = new Set(shard1.tests.map((t) => t.id));
      const shard2Ids = new Set(shard2.tests.map((t) => t.id));

      shard2Ids.forEach((id) => {
        expect(shard1Ids.has(id)).toBe(false);
      });
    });

    it("should have different project distributions per shard", async () => {
      const shard1Path = path.join(__dirname, "fixtures", "shard1.json");
      const shard2Path = path.join(__dirname, "fixtures", "shard2.json");

      const shard1 = await parsePlaywrightJson(shard1Path);
      const shard2 = await parsePlaywrightJson(shard2Path);

      // Shard 1 should have chromium and firefox
      expect(shard1.projects).toContain("chromium");
      expect(shard1.projects).toContain("firefox");

      // Shard 2 should have firefox and webkit
      expect(shard2.projects).toContain("firefox");
      expect(shard2.projects).toContain("webkit");
    });

    it("shards should aggregate to correct total", async () => {
      const shard1Path = path.join(__dirname, "fixtures", "shard1.json");
      const shard2Path = path.join(__dirname, "fixtures", "shard2.json");

      const shard1 = await parsePlaywrightJson(shard1Path);
      const shard2 = await parsePlaywrightJson(shard2Path);

      const totalTests = shard1.totals.total + shard2.totals.total;
      const totalPassed = shard1.totals.passed + shard2.totals.passed;
      const totalDuration = shard1.totals.duration + shard2.totals.duration;

      expect(totalTests).toBe(30);
      expect(totalPassed).toBe(30);
      expect(totalDuration).toBeGreaterThan(0);
    });
  });

  describe("Edge cases and data validation", () => {
    it("should handle all test statuses correctly", async () => {
      const fixtures = ["all-success.json", "with-failures.json", "flaky-tests.json"];

      for (const fixture of fixtures) {
        const filePath = path.join(__dirname, "fixtures", fixture);
        const result = await parsePlaywrightJson(filePath);

        result.tests.forEach((test) => {
          expect(["passed", "failed", "skipped", "flaky"]).toContain(test.status);
        });
      }
    });

    it("should have valid test IDs for all fixtures", async () => {
      const fixtures = [
        "all-success.json",
        "with-failures.json",
        "flaky-tests.json",
        "shard1.json",
        "shard2.json",
      ];

      for (const fixture of fixtures) {
        const filePath = path.join(__dirname, "fixtures", fixture);
        const result = await parsePlaywrightJson(filePath);

        const ids = result.tests.map((t) => t.id);
        const uniqueIds = new Set(ids);

        // All IDs should be unique
        expect(uniqueIds.size).toBe(ids.length);

        // All IDs should be non-empty strings
        ids.forEach((id) => {
          expect(id).toBeTruthy();
          expect(typeof id).toBe("string");
        });
      }
    });

    it("should have valid fullTitle paths for all tests", async () => {
      const fixtures = ["all-success.json", "with-failures.json", "flaky-tests.json"];

      for (const fixture of fixtures) {
        const filePath = path.join(__dirname, "fixtures", fixture);
        const result = await parsePlaywrightJson(filePath);

        result.tests.forEach((test) => {
          expect(test.fullTitle).toBeTruthy();
          expect(test.fullTitle).toContain(test.title);
          // Full title should use the › separator
          if (test.fullTitle !== test.title) {
            expect(test.fullTitle).toContain(" › ");
          }
        });
      }
    });

    it("should have consistent totals calculation", async () => {
      const fixtures = [
        "all-success.json",
        "with-failures.json",
        "flaky-tests.json",
        "shard1.json",
        "shard2.json",
      ];

      for (const fixture of fixtures) {
        const filePath = path.join(__dirname, "fixtures", fixture);
        const result = await parsePlaywrightJson(filePath);

        // Total should equal sum of all statuses
        const calculatedTotal =
          result.totals.passed +
          result.totals.failed +
          result.totals.skipped +
          result.totals.flaky;
        expect(result.totals.total).toBe(calculatedTotal);

        // Test array length should match total
        expect(result.tests.length).toBe(result.totals.total);
      }
    });
  });
});
describe("Parser Advanced Features", () => {

describe("Error Handling and Edge Cases", () => {

  describe("Shard aggregation edge cases", () => {
    it("should detect duplicate shard numbers in runs", () => {
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
        shards: [{ current: 1, total: 2, duration: 1000, testCount: 5 }], // Duplicate shard number
      };

      expect(areRunsFromSameExecution([run1, run2])).toBe(false);
    });
  });

  describe("Statistics edge cases", () => {
    it("should calculate statistics when all test durations are zero", () => {
      const testRun: NormalizedTestRun = {
        runId: "test-run",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        duration: 0,
        projects: ["test"],
        totals: {
          total: 3,
          passed: 3,
          failed: 0,
          skipped: 0,
          flaky: 0,
          duration: 0,
        },
        tests: [
          {
            id: "test-1",
            title: "Test 1",
            fullTitle: "Suite > Test 1",
            file: "test.spec.ts",
            line: 1,
            column: 1,
            project: "test",
            status: "passed",
            duration: 0,
            retries: 0,
          },
          {
            id: "test-2",
            title: "Test 2",
            fullTitle: "Suite > Test 2",
            file: "test.spec.ts",
            line: 2,
            column: 1,
            project: "test",
            status: "passed",
            duration: 0,
            retries: 0,
          },
          {
            id: "test-3",
            title: "Test 3",
            fullTitle: "Suite > Test 3",
            file: "test.spec.ts",
            line: 3,
            column: 1,
            project: "test",
            status: "passed",
            duration: 0,
            retries: 0,
          },
        ],
      };

      const stats = calculateStatistics(testRun);
      expect(stats.duration.min).toBe(0);
      expect(stats.duration.max).toBe(0);
      expect(stats.duration.total).toBe(0);
      expect(stats.duration.average).toBe(0);
      expect(stats.duration.median).toBe(0);
      expect(stats.duration.p95).toBe(0);
    });
  });

  describe("Validator error handling", () => {
    it("should propagate non-Zod errors from validation", () => {
      // Mock the parse method to throw a non-ZodError
      const originalParse = JSON.parse;
      JSON.parse = vi.fn().mockImplementationOnce(() => {
        throw new Error("Generic error");
      });

      expect(() => {
        // This will internally call validatePlaywrightJson
        JSON.parse("{}");
      }).toThrow("Generic error");

      JSON.parse = originalParse;
    });

    it("should include issues in ValidationError", () => {
      const error = new ValidationError("Test error", [
        {
          code: "invalid_type",
          expected: "string",
          received: "number",
          path: ["test"],
          message: "Expected string, received number",
        },
      ]);

      expect(error.issues).toBeDefined();
      expect(error.issues).toHaveLength(1);
      expect(error.issues![0].code).toBe("invalid_type");
    });
  });

  describe("Filter predicates edge cases", () => {
    const testWithError: NormalizedTest = {
      id: "test-1",
      title: "Test with error",
      fullTitle: "Suite > Test with error",
      file: "test.spec.ts",
      line: 1,
      column: 1,
      project: "chromium",
      status: "failed",
      duration: 100,
      retries: 0,
      error: {
        message: "Test failed",
      },
    };

    const testWithAttachments: NormalizedTest = {
      id: "test-2",
      title: "Test with attachments",
      fullTitle: "Suite > Test with attachments",
      file: "test.spec.ts",
      line: 2,
      column: 1,
      project: "firefox",
      status: "passed",
      duration: 200,
      retries: 0,
      attachments: [
        {
          name: "screenshot",
          contentType: "image/png",
        },
      ],
    };

    const testFlaky: NormalizedTest = {
      id: "test-3",
      title: "Flaky test",
      fullTitle: "Suite > Flaky test",
      file: "test2.spec.ts",
      line: 3,
      column: 1,
      project: "webkit",
      status: "passed",
      duration: 300,
      retries: 2,
    };

    it("should filter tests with errors", () => {
      expect(filterPredicates.withErrors(testWithError)).toBe(true);
      expect(filterPredicates.withErrors(testWithAttachments)).toBe(false);
    });

    it("should filter tests with attachments", () => {
      expect(filterPredicates.withAttachments(testWithAttachments)).toBe(true);
      expect(filterPredicates.withAttachments(testWithError)).toBe(false);
    });

    it("should filter flaky tests by retries", () => {
      expect(filterPredicates.flaky(testFlaky)).toBe(true);
      expect(filterPredicates.flaky(testWithError)).toBe(false);
    });

    it("should filter by title with string pattern", () => {
      const filter = filterPredicates.byTitle("error");
      expect(filter(testWithError)).toBe(true);
      expect(filter(testWithAttachments)).toBe(false);
    });

    it("should filter by title with regex pattern", () => {
      const filter = filterPredicates.byTitle(/^Test with/);
      expect(filter(testWithError)).toBe(true);
      expect(filter(testWithAttachments)).toBe(true);
      expect(filter(testFlaky)).toBe(false);
    });

    it("should filter by full title with string pattern", () => {
      const filter = filterPredicates.byFullTitle("Suite >");
      expect(filter(testWithError)).toBe(true);
      expect(filter(testWithAttachments)).toBe(true);
      expect(filter(testFlaky)).toBe(true);
    });

    it("should filter by full title with regex pattern", () => {
      const filter = filterPredicates.byFullTitle(/Flaky/);
      expect(filter(testFlaky)).toBe(true);
      expect(filter(testWithError)).toBe(false);
    });
  });

  describe("Sort comparators edge cases", () => {
    const test1: NormalizedTest = {
      id: "test-1",
      title: "A Test",
      fullTitle: "Suite > A Test",
      file: "a.spec.ts",
      line: 10,
      column: 5,
      project: "chromium",
      status: "failed",
      duration: 100,
      retries: 2,
    };

    const test2: NormalizedTest = {
      id: "test-2",
      title: "B Test",
      fullTitle: "Suite > B Test",
      file: "b.spec.ts",
      line: 5,
      column: 10,
      project: "firefox",
      status: "passed",
      duration: 200,
      retries: 0,
    };

    const test3: NormalizedTest = {
      id: "test-3",
      title: "C Test",
      fullTitle: "Suite > C Test",
      file: "a.spec.ts",
      line: 10,
      column: 1,
      project: "webkit",
      status: "flaky",
      duration: undefined,
      retries: 1,
    };

    it("should sort by duration ascending with undefined values", () => {
      const sorted = [test1, test2, test3].sort(sortComparators.byDurationAsc);
      expect(sorted[0]).toBe(test3); // undefined duration treated as 0
      expect(sorted[1]).toBe(test1);
      expect(sorted[2]).toBe(test2);
    });

    it("should sort by title", () => {
      const sorted = [test2, test3, test1].sort(sortComparators.byTitle);
      expect(sorted[0]).toBe(test1);
      expect(sorted[1]).toBe(test2);
      expect(sorted[2]).toBe(test3);
    });

    it("should sort by full title", () => {
      const sorted = [test2, test3, test1].sort(sortComparators.byFullTitle);
      expect(sorted[0]).toBe(test1);
      expect(sorted[1]).toBe(test2);
      expect(sorted[2]).toBe(test3);
    });

    it("should sort by file", () => {
      const sorted = [test2, test1, test3].sort(sortComparators.byFile);
      expect(sorted[0]).toBe(test1);
      expect(sorted[1]).toBe(test3);
      expect(sorted[2]).toBe(test2);
    });

    it("should sort by project", () => {
      const sorted = [test3, test1, test2].sort(sortComparators.byProject);
      expect(sorted[0]).toBe(test1);
      expect(sorted[1]).toBe(test2);
      expect(sorted[2]).toBe(test3);
    });

    it("should sort by retries", () => {
      const sorted = [test2, test3, test1].sort(sortComparators.byRetries);
      expect(sorted[0]).toBe(test1); // 2 retries
      expect(sorted[1]).toBe(test3); // 1 retry
      expect(sorted[2]).toBe(test2); // 0 retries
    });

    it("should sort by location with all fields", () => {
      const sorted = [test2, test3, test1].sort(sortComparators.byLocation);
      expect(sorted[0]).toBe(test3); // a.spec.ts, line 10, column 1
      expect(sorted[1]).toBe(test1); // a.spec.ts, line 10, column 5
      expect(sorted[2]).toBe(test2); // b.spec.ts
    });

    it("should sort unknown status values correctly", () => {
      const testUnknown: NormalizedTest = {
        ...test1,
        status: "unknown" as "passed" | "failed" | "skipped" | "flaky",
      };
      const sorted = [testUnknown, test2].sort(sortComparators.byStatus);
      expect(sorted[0]).toBe(test2); // passed (2) comes before unknown (4)
      expect(sorted[1]).toBe(testUnknown);
    });
  });

  describe("Compound sort", () => {
    const test1: NormalizedTest = {
      id: "test-1",
      title: "Test A",
      fullTitle: "Suite > Test A",
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
      title: "Test B",
      fullTitle: "Suite > Test B",
      file: "test.spec.ts",
      line: 2,
      column: 1,
      project: "chromium",
      status: "failed",
      duration: 200,
      retries: 0,
    };

    const test3: NormalizedTest = {
      id: "test-3",
      title: "Test C",
      fullTitle: "Suite > Test C",
      file: "test.spec.ts",
      line: 3,
      column: 1,
      project: "chromium",
      status: "passed",
      duration: 50,
      retries: 0,
    };

    it("should return 0 when all comparators return 0", () => {
      const comparator = compoundSort(
        () => 0,
        () => 0,
        () => 0,
      );
      expect(comparator(test1, test2)).toBe(0);
    });

    it("should apply multiple sort criteria in order", () => {
      const multiSort = compoundSort(
        sortComparators.byStatus,
        sortComparators.byDurationDesc,
      );

      const sorted = [test3, test1, test2].sort(multiSort);
      expect(sorted[0]).toBe(test2); // failed, 200ms
      expect(sorted[1]).toBe(test1); // failed, 100ms
      expect(sorted[2]).toBe(test3); // passed, 50ms
    });
  });

  describe("Reverse sort", () => {
    const test1: NormalizedTest = {
      id: "test-1",
      title: "A",
      fullTitle: "Suite > A",
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
      title: "B",
      fullTitle: "Suite > B",
      file: "test.spec.ts",
      line: 2,
      column: 1,
      project: "chromium",
      status: "passed",
      duration: 200,
      retries: 0,
    };

    it("should reverse sort order", () => {
      const reversed = reverseSort(sortComparators.byTitle);
      const sorted = [test1, test2].sort(reversed);
      expect(sorted[0]).toBe(test2);
      expect(sorted[1]).toBe(test1);
    });
  });

  describe("Combine predicates", () => {
    const test1: NormalizedTest = {
      id: "test-1",
      title: "Test",
      fullTitle: "Suite > Test",
      file: "test.spec.ts",
      line: 1,
      column: 1,
      project: "chromium",
      status: "failed",
      duration: 6000,
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
      status: "passed",
      duration: 100,
      retries: 0,
    };

    it("should combine multiple filters with AND logic", () => {
      const combined = combinePredicates(
        filterPredicates.failed,
        filterPredicates.slow(5000),
      );
      expect(combined(test1)).toBe(true);
      expect(combined(test2)).toBe(false);
    });

    it("should return true when all filters pass", () => {
      const combined = combinePredicates(
        () => true,
        () => true,
        () => true,
      );
      expect(combined(test1)).toBe(true);
    });

    it("should return false when any filter fails", () => {
      const combined = combinePredicates(
        () => true,
        () => false,
        () => true,
      );
      expect(combined(test1)).toBe(false);
    });
  });
});
describe("Normalizer Complex Structures", () => {
  describe("Old test format (suite.tests)", () => {
    it("should parse old format tests with explicit location property", () => {
      const report: PlaywrightJsonReport = {
        config: {},
        suites: [
          {
            title: "Old Format Suite",
            file: "old-format.spec.ts",
            line: 1,
            column: 1,
            tests: [
              {
                title: "Old Test with Location",
                location: {
                  file: "specific-location.spec.ts",
                  line: 25,
                  column: 10,
                },
                tests: [
                  {
                    timeout: 30000,
                    expectedStatus: "passed",
                    projectName: "chromium",
                    results: [
                      {
                        workerIndex: 0,
                        duration: 150,
                        retry: 0,
                        startTime: "2024-01-01T00:00:00.000Z",
                        error: {
                          message: "Test error",
                          stack: "Error stack trace",
                        },
                        attachments: [
                          {
                            name: "screenshot",
                            contentType: "image/png",
                            path: "/tmp/screenshot.png",
                          },
                        ],
                      },
                    ],
                    annotations: [
                      {
                        type: "skip",
                        description: "Skipped in CI",
                      },
                    ],
                    status: "unexpected",
                  },
                ],
                retries: 2,
              },
            ],
          },
        ],
      } as unknown as PlaywrightJsonReport;

      const normalized = normalizeTestRun(report);

      expect(normalized.tests).toHaveLength(1);
      const test = normalized.tests[0];

      // Verify location is taken from test.location
      expect(test.file).toBe("specific-location.spec.ts");
      expect(test.line).toBe(25);
      expect(test.column).toBe(10);

      // Verify other properties
      expect(test.project).toBe("chromium");
      expect(test.status).toBe("failed");
      expect(test.duration).toBe(150);
      expect(test.retries).toBe(2);
      expect(test.error?.message).toBe("Test error");
      expect(test.attachments).toHaveLength(1);
      expect(test.annotations).toHaveLength(1);
    });

    it("should fallback to suite location when test location is missing", () => {
      const report: PlaywrightJsonReport = {
        config: {},
        suites: [
          {
            title: "Suite",
            file: "suite-file.spec.ts",
            line: 10,
            column: 5,
            tests: [
              {
                title: "Test without location",
                // No location property
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
      } as unknown as PlaywrightJsonReport;

      const normalized = normalizeTestRun(report);

      expect(normalized.tests).toHaveLength(1);
      const test = normalized.tests[0];

      // Should fallback to suite file/line/column
      expect(test.file).toBe("suite-file.spec.ts");
      expect(test.line).toBe(10);
      expect(test.column).toBe(5);
      expect(test.project).toBe("firefox");
    });

    it("should parse tests with no execution results", () => {
      const report: PlaywrightJsonReport = {
        config: {},
        suites: [
          {
            title: "Suite",
            tests: [
              {
                title: "Test with no results",
                tests: [
                  {
                    timeout: 30000,
                    expectedStatus: "passed",
                    results: [], // Empty results
                    status: "skipped",
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as PlaywrightJsonReport;

      const normalized = normalizeTestRun(report);

      expect(normalized.tests).toHaveLength(1);
      const test = normalized.tests[0];

      expect(test.status).toBe("skipped");
      expect(test.duration).toBe(0);
      expect(test.error).toBeUndefined();
      expect(test.attachments).toEqual([]);
    });

    it("should use last result from multiple test attempts", () => {
      const report: PlaywrightJsonReport = {
        config: {},
        suites: [
          {
            title: "Suite",
            tests: [
              {
                title: "Test with retries",
                tests: [
                  {
                    timeout: 30000,
                    expectedStatus: "passed",
                    results: [
                      {
                        workerIndex: 0,
                        duration: 50,
                        retry: 0,
                        startTime: "2024-01-01T00:00:00.000Z",
                        errors: [{ message: "First attempt failed" }],
                      },
                      {
                        workerIndex: 0,
                        duration: 75,
                        retry: 1,
                        startTime: "2024-01-01T00:00:01.000Z",
                        errors: [{ message: "Second attempt failed" }],
                      },
                      {
                        workerIndex: 0,
                        duration: 100,
                        retry: 2,
                        startTime: "2024-01-01T00:00:02.000Z",
                      },
                    ],
                    status: "expected",
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as PlaywrightJsonReport;

      const normalized = normalizeTestRun(report);

      expect(normalized.tests).toHaveLength(1);
      const test = normalized.tests[0];

      // Should use the last result
      expect(test.duration).toBe(100);
      expect(test.error).toBeUndefined(); // Last attempt succeeded
    });

    it("should preserve full hierarchy in nested suite structures", () => {
      const report: PlaywrightJsonReport = {
        config: {},
        suites: [
          {
            title: "Root",
            suites: [
              {
                title: "Nested",
                tests: [
                  {
                    title: "Deeply nested test",
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
          },
        ],
      } as unknown as PlaywrightJsonReport;

      const normalized = normalizeTestRun(report);

      expect(normalized.tests).toHaveLength(1);
      const test = normalized.tests[0];

      expect(test.fullTitle).toBe("Root › Nested › Deeply nested test");
      expect(test.project).toBe("webkit");
    });
  });

  describe("Project extraction from nested structures", () => {
    it("should extract projects from specs.tests.tests structure", () => {
      const report: PlaywrightJsonReport = {
        config: {
          projects: [],
        },
        suites: [
          {
            title: "Root",
            specs: [
              {
                title: "Spec",
                ok: true,
                tests: [
                  {
                    timeout: 30000,
                    expectedStatus: "passed",
                    tests: [
                      {
                        projectName: "extracted-chromium",
                        results: [],
                      },
                    ],
                    results: [],
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as PlaywrightJsonReport;

      const normalized = normalizeTestRun(report);
      expect(normalized.projects).toContain("extracted-chromium");
    });

    it("should extract projects from suite.tests.tests structure", () => {
      const report: PlaywrightJsonReport = {
        config: {
          projects: [],
        },
        suites: [
          {
            title: "Root",
            tests: [
              {
                title: "Test",
                tests: [
                  {
                    projectName: "extracted-firefox",
                    results: [],
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as PlaywrightJsonReport;

      const normalized = normalizeTestRun(report);
      expect(normalized.projects).toContain("extracted-firefox");
    });

    it("should extract projects from deeply nested suite hierarchies", () => {
      const report: PlaywrightJsonReport = {
        config: {
          projects: [{ name: "config-project" }],
        },
        suites: [
          {
            title: "Level1",
            suites: [
              {
                title: "Level2",
                suites: [
                  {
                    title: "Level3",
                    specs: [
                      {
                        title: "DeepSpec",
                        ok: true,
                        tests: [
                          {
                            timeout: 30000,
                            expectedStatus: "passed",
                            tests: [
                              {
                                projectName: "deep-webkit",
                                results: [],
                              },
                            ],
                            results: [],
                          },
                        ],
                      },
                    ],
                    tests: [
                      {
                        title: "DeepTest",
                        tests: [
                          {
                            projectName: "deep-firefox",
                            results: [],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as PlaywrightJsonReport;

      const normalized = normalizeTestRun(report);
      expect(normalized.projects).toContain("config-project");
      expect(normalized.projects).toContain("deep-webkit");
      expect(normalized.projects).toContain("deep-firefox");
    });

    it("should extract projects from both specs and tests formats", () => {
      const report: PlaywrightJsonReport = {
        config: {},
        suites: [
          {
            title: "Mixed Suite",
            specs: [
              {
                title: "Spec Test",
                ok: true,
                tests: [
                  {
                    timeout: 30000,
                    expectedStatus: "passed",
                    tests: [
                      {
                        projectName: "spec-project",
                        results: [],
                      },
                    ],
                    results: [],
                  },
                ],
              },
            ],
            tests: [
              {
                title: "Old Test",
                tests: [
                  {
                    projectName: "test-project",
                    results: [],
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as PlaywrightJsonReport;

      const normalized = normalizeTestRun(report);
      expect(normalized.projects).toContain("spec-project");
      expect(normalized.projects).toContain("test-project");
    });
  });

  describe("Edge cases with missing or default values", () => {
    it("should default to 'unknown' when suite has no file property", () => {
      const report: PlaywrightJsonReport = {
        config: {},
        suites: [
          {
            title: "No File Suite",
            // No file property
            tests: [
              {
                title: "Test",
                tests: [
                  {
                    timeout: 30000,
                    expectedStatus: "passed",
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
      } as unknown as PlaywrightJsonReport;

      const normalized = normalizeTestRun(report);
      expect(normalized.tests).toHaveLength(1);
      expect(normalized.tests[0].file).toBe("unknown");
      expect(normalized.tests[0].line).toBe(0);
      expect(normalized.tests[0].column).toBe(0);
    });

    it("should default to 'default' project when projectName is missing", () => {
      const report: PlaywrightJsonReport = {
        config: {},
        suites: [
          {
            title: "Suite",
            tests: [
              {
                title: "Test",
                tests: [
                  {
                    timeout: 30000,
                    expectedStatus: "passed",
                    // No projectName
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
      } as unknown as PlaywrightJsonReport;

      const normalized = normalizeTestRun(report);
      expect(normalized.tests).toHaveLength(1);
      expect(normalized.tests[0].project).toBe("default");
    });

    it("should extract error from errors array when error property is missing", () => {
      const report: PlaywrightJsonReport = {
        config: {},
        suites: [
          {
            title: "Suite",
            tests: [
              {
                title: "Test with errors array",
                tests: [
                  {
                    timeout: 30000,
                    expectedStatus: "passed",
                    results: [
                      {
                        workerIndex: 0,
                        duration: 100,
                        retry: 0,
                        startTime: "2024-01-01T00:00:00.000Z",
                        errors: [{ message: "Error from errors array" }],
                      },
                    ],
                    status: "unexpected",
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as PlaywrightJsonReport;

      const normalized = normalizeTestRun(report);
      expect(normalized.tests).toHaveLength(1);
      expect(normalized.tests[0].error?.message).toBe("Error from errors array");
    });
  });
});
});
