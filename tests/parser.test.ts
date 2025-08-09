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
      const filePath = path.join(__dirname, "fixtures", "simple-pass.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result).toBeDefined();
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].status).toBe("passed");
      expect(result.tests[0].title).toBe("basic test");
      expect(result.totals.passed).toBe(1);
      expect(result.totals.total).toBe(1);
    });

    it("should parse valid JSON from object", async () => {
      const filePath = path.join(__dirname, "fixtures", "simple-pass.json");
      const jsonContent = await fs.readFile(filePath, "utf-8");
      const jsonObject = JSON.parse(jsonContent);
      const result = await parsePlaywrightJson(jsonObject);

      expect(result).toBeDefined();
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].status).toBe("passed");
    });

    it("should parse valid JSON from Buffer", async () => {
      const filePath = path.join(__dirname, "fixtures", "simple-pass.json");
      const buffer = await fs.readFile(filePath);
      const result = await parsePlaywrightJson(buffer);

      expect(result).toBeDefined();
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].status).toBe("passed");
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
      const filePath = path.join(__dirname, "fixtures", "simple-pass.json");
      const result = await parsePlaywrightResults(filePath);
      expect(result).toBeDefined();
      expect(result.tests).toHaveLength(1);
    });
  });

  describe("Test Status Detection", () => {
    it("should correctly identify failed tests", async () => {
      const filePath = path.join(__dirname, "fixtures", "with-failures.json");
      const result = await parsePlaywrightJson(filePath);

      const failedTests = result.tests.filter((t) => t.status === "failed");
      expect(failedTests).toHaveLength(1);
      expect(failedTests[0].error).toBeDefined();
      expect(failedTests[0].error?.message).toContain("Timeout waiting for selector");
      expect(failedTests[0].attachments).toHaveLength(1);
      expect(failedTests[0].attachments![0].contentType).toBe("image/png");
    });

    it("should correctly identify flaky tests", async () => {
      const filePath = path.join(__dirname, "fixtures", "flaky-tests.json");
      const result = await parsePlaywrightJson(filePath);

      const flakyTests = result.tests.filter((t) => t.status === "flaky");
      expect(flakyTests).toHaveLength(1);
      expect(flakyTests[0].retries).toBe(1);
      expect(flakyTests[0].title).toBe("flaky test that passes on retry");
    });

    it("should correctly identify skipped tests", async () => {
      const filePath = path.join(__dirname, "fixtures", "flaky-tests.json");
      const result = await parsePlaywrightJson(filePath);

      const skippedTests = result.tests.filter((t) => t.status === "skipped");
      expect(skippedTests).toHaveLength(1);
      expect(skippedTests[0].annotations).toHaveLength(1);
      expect(skippedTests[0].annotations![0].type).toBe("skip");
    });
  });

  describe("Test Hierarchy", () => {
    it("should preserve test hierarchy in fullTitle", async () => {
      const filePath = path.join(__dirname, "fixtures", "with-failures.json");
      const result = await parsePlaywrightJson(filePath);

      const authTests = result.tests.filter((t) =>
        t.fullTitle.includes("Authentication"),
      );
      expect(authTests.length).toBeGreaterThan(0);
      expect(authTests[0].fullTitle).toContain("Authentication");
    });

    it("should extract file location correctly", async () => {
      const filePath = path.join(__dirname, "fixtures", "simple-pass.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result.tests[0].file).toBe("tests/example.spec.ts");
      expect(result.tests[0].line).toBe(5);
      expect(result.tests[0].column).toBe(1);
    });
  });

  describe("Projects and Metadata", () => {
    it("should extract project names", async () => {
      const filePath = path.join(__dirname, "fixtures", "with-failures.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result.projects).toContain("chromium");
      expect(result.projects).toContain("firefox");
      expect(result.projects).toHaveLength(2);
    });

    it("should handle tests from multiple projects", async () => {
      const filePath = path.join(__dirname, "fixtures", "with-failures.json");
      const result = await parsePlaywrightJson(filePath);

      const chromiumTests = result.tests.filter((t) => t.project === "chromium");
      const firefoxTests = result.tests.filter((t) => t.project === "firefox");

      expect(chromiumTests.length).toBeGreaterThan(0);
      expect(firefoxTests.length).toBeGreaterThan(0);
    });
  });

  describe("Totals Calculation", () => {
    it("should calculate totals correctly", async () => {
      const filePath = path.join(__dirname, "fixtures", "with-failures.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result.totals.total).toBe(3);
      expect(result.totals.passed).toBe(2);
      expect(result.totals.failed).toBe(1);
      expect(result.totals.duration).toBeGreaterThan(0);
    });

    it("should calculate flaky test totals", async () => {
      const filePath = path.join(__dirname, "fixtures", "flaky-tests.json");
      const result = await parsePlaywrightJson(filePath);

      expect(result.totals.flaky).toBe(1);
      expect(result.totals.skipped).toBe(1);
    });
  });
});

describe("Shard Aggregation", () => {
  it("should detect shard information", async () => {
    const filePath = path.join(__dirname, "fixtures", "sharded.json");
    const result = await parsePlaywrightJson(filePath);

    expect(result.shards).toBeDefined();
    expect(result.shards).toHaveLength(1);
    expect(result.shards![0].current).toBe(1);
    expect(result.shards![0].total).toBe(2);
  });

  it("should aggregate multiple sharded runs", async () => {
    const filePath = path.join(__dirname, "fixtures", "sharded.json");
    const shard1 = await parsePlaywrightJson(filePath);

    // Create a second shard with different data
    const shard2: NormalizedTestRun = {
      ...shard1,
      tests: [
        {
          ...shard1.tests[0],
          id: "test-2",
          title: "test from shard 2",
        },
      ],
      shards: [{ current: 2, total: 2, duration: 1000, testCount: 1 }],
    };

    const aggregated = aggregateShardedRuns([shard1, shard2]);

    expect(aggregated.tests).toHaveLength(2);
    expect(aggregated.shards).toHaveLength(2);
    expect(aggregated.totals.total).toBe(2);
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
    const filePath = path.join(__dirname, "fixtures", "with-failures.json");
    const result = await parsePlaywrightJson(filePath);

    const testsWithAnnotations = result.tests.filter(
      (t) => t.annotations && t.annotations.length > 0,
    );
    expect(testsWithAnnotations.length).toBeGreaterThan(0);
    expect(testsWithAnnotations[0].annotations![0].type).toBe("slow");
  });

  it("should handle tests without location info", async () => {
    const data = {
      config: { projects: [{ name: "chromium" }] },
      suites: [
        {
          title: "Suite",
          tests: [
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
    const filePath = path.join(__dirname, "fixtures", "simple-pass.json");
    const result = await parsePlaywrightJson(filePath);

    expect(result.startedAt).toBe("2024-01-01T10:00:00.000Z");
    expect(result.endedAt).toBe("2024-01-01T10:00:01.234Z");
    expect(result.duration).toBe(1234);
  });
});
