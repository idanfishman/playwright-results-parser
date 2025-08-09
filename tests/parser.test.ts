import { describe, it, expect } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  parsePlaywrightJson,
  parsePlaywrightResults,
  ValidationError,
  validatePlaywrightJson,
  normalizeTestRun,
  aggregateShardedRuns,
  areRunsFromSameExecution,
  type NormalizedTestRun,
} from "../src/index.js";

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

describe("Comprehensive Fixture Coverage", () => {
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
