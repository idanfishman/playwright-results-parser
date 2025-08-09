import { describe, it, expect } from "vitest";
import { version, parsePlaywrightResults } from "../src/index";

describe("Smoke Tests", () => {
  it("should export version", () => {
    expect(version).toBeDefined();
    expect(typeof version).toBe("string");
    expect(version).toBe("0.1.0");
  });

  it("should export parsePlaywrightResults function", () => {
    expect(parsePlaywrightResults).toBeDefined();
    expect(typeof parsePlaywrightResults).toBe("function");
  });

  it("should return basic structure from parsePlaywrightResults", async () => {
    const dummyData = {
      config: { projects: [] },
      suites: [],
    };
    const result = await parsePlaywrightResults(dummyData);
    expect(result).toBeDefined();
    expect(result.totals).toBeDefined();
    expect(result.totals.total).toBe(0);
    expect(result.totals.passed).toBe(0);
    expect(result.totals.failed).toBe(0);
    expect(result.totals.skipped).toBe(0);
  });
});
