/**
 * Normalizes Playwright JSON report into flat structure
 */

import { randomUUID } from "crypto";
import type {
  NormalizedTestRun,
  NormalizedTest,
  TestTotals,
  TestError,
  TestAttachment,
  TestAnnotation,
  ShardInfo,
} from "../types/index.js";
import type { PlaywrightJsonReport } from "./validator.js";

/**
 * Generate a deterministic test ID based on test properties
 */
function generateTestId(
  project: string,
  file: string,
  title: string,
  index: number,
): string {
  return `${project}-${file}-${title}-${index}`.replace(/[^a-zA-Z0-9-]/g, "_");
}

/**
 * Extract test error from Playwright error structure
 */
function extractError(error?: unknown): TestError | undefined {
  if (!error || typeof error !== "object") return undefined;

  const err = error as Record<string, unknown>;
  const location = err.location as Record<string, unknown> | undefined;

  return {
    message: (err.message as string) || "Unknown error",
    stack: err.stack as string | undefined,
    snippet: err.snippet as string | undefined,
    line: location?.line as number | undefined,
    column: location?.column as number | undefined,
  };
}

/**
 * Extract attachments from test attempt
 */
function extractAttachments(attachments?: unknown[]): TestAttachment[] {
  if (!attachments || !Array.isArray(attachments)) return [];

  return attachments.map((att) => {
    const attachment = att as Record<string, unknown>;
    return {
      name: (attachment.name as string) || "attachment",
      path: attachment.path as string | undefined,
      contentType: (attachment.contentType as string) || "application/octet-stream",
      body: attachment.body as string | undefined,
    };
  });
}

/**
 * Extract annotations from test
 */
function extractAnnotations(annotations?: unknown[]): TestAnnotation[] {
  if (!annotations || !Array.isArray(annotations)) return [];

  return annotations.map((ann) => {
    const annotation = ann as Record<string, unknown>;
    return {
      type: (annotation.type as string) || "unknown",
      description: annotation.description as string | undefined,
    };
  });
}

/**
 * Determine test status based on Playwright status
 */
function determineTestStatus(status: string): "passed" | "failed" | "skipped" | "flaky" {
  switch (status) {
    case "expected":
      return "passed";
    case "unexpected":
      return "failed";
    case "flaky":
      return "flaky";
    case "skipped":
      return "skipped";
    default:
      // Fallback for any unknown status
      return "failed";
  }
}

/**
 * Flatten nested suite structure into flat test array
 */
function flattenTests(
  suites: unknown[],
  parentPath: string[] = [],
  project: string = "default",
): NormalizedTest[] {
  const tests: NormalizedTest[] = [];

  for (const suiteRaw of suites) {
    const suite = suiteRaw as Record<string, unknown>;
    const suitePath = [...parentPath, suite.title as string].filter(Boolean);

    // Process nested suites
    if (suite.suites && Array.isArray(suite.suites)) {
      tests.push(...flattenTests(suite.suites, suitePath, project));
    }

    // Process specs (newer format)
    if (suite.specs && Array.isArray(suite.specs)) {
      for (const specRaw of suite.specs) {
        const spec = specRaw as Record<string, unknown>;
        const specTitle = spec.title as string;
        const specPath = [...suitePath];
        
        // Process tests within the spec
        const specTests = (spec.tests as unknown[]) || [];
        for (let testIndex = 0; testIndex < specTests.length; testIndex++) {
          const test = specTests[testIndex] as Record<string, unknown>;
          const fullTitle = [...specPath, specTitle].filter(Boolean).join(" › ");
          const projectName = (test.projectName as string) || 
                              (test.projectId as string) || 
                              project;

          // Get the test results (attempts)
          const results = (test.results as unknown[]) || [];
          if (results.length === 0) continue;

          // Get the last result (most recent attempt)
          const lastResult = results[results.length - 1] as Record<string, unknown>;
          const lastResultErrors = (lastResult.errors as unknown[]) || [];

          tests.push({
            id: generateTestId(
              projectName,
              spec.file as string || suite.file as string || "unknown",
              specTitle,
              testIndex,
            ),
            title: specTitle,
            fullTitle,
            file: (spec.file as string) || (suite.file as string) || "unknown",
            line: (spec.line as number) || (suite.line as number) || 0,
            column: (spec.column as number) || (suite.column as number) || 0,
            project: projectName,
            status: determineTestStatus(test.status as string || "unknown"),
            duration: (lastResult.duration as number) || 0,
            retries: results.length - 1,
            error: extractError(lastResult.error || lastResultErrors[0]),
            attachments: extractAttachments(lastResult.attachments as unknown[]),
            annotations: extractAnnotations(test.annotations as unknown[]),
          });
        }
      }
    }

    // Process tests (older format)
    if (suite.tests && Array.isArray(suite.tests)) {
      for (const testRaw of suite.tests) {
        const test = testRaw as Record<string, unknown>;
        const testTests = (test.tests as unknown[]) || [];
        const testLocation = test.location as Record<string, unknown> | undefined;

        for (const testResultRaw of testTests) {
          const testResult = testResultRaw as Record<string, unknown>;
          const fullTitle = [...suitePath, test.title as string]
            .filter(Boolean)
            .join(" › ");
          const projectName = (testResult.projectName as string) || project;

          // Get the last result (most recent attempt)
          const results = (testResult.results as unknown[]) || [];
          const lastResult = (results[results.length - 1] || {}) as Record<
            string,
            unknown
          >;
          const lastResultErrors = (lastResult.errors as unknown[]) || [];

          tests.push({
            id: generateTestId(
              projectName,
              (suite.file as string) || "unknown",
              test.title as string,
              tests.length,
            ),
            title: test.title as string,
            fullTitle,
            file: (testLocation?.file as string) || (suite.file as string) || "unknown",
            line: (testLocation?.line as number) || (suite.line as number) || 0,
            column: (testLocation?.column as number) || (suite.column as number) || 0,
            project: projectName,
            status: determineTestStatus(testResult.status as string || "unknown"),
            duration: (lastResult.duration as number) || 0,
            retries: (test.retries as number) || 0,
            error: extractError(lastResult.error || lastResultErrors[0]),
            attachments: extractAttachments(lastResult.attachments as unknown[]),
            annotations: extractAnnotations(testResult.annotations as unknown[]),
          });
        }
      }
    }
  }

  return tests;
}

/**
 * Calculate test totals from normalized tests
 */
function calculateTotals(tests: NormalizedTest[]): TestTotals {
  const totals: TestTotals = {
    total: tests.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    flaky: 0,
    duration: 0,
  };

  for (const test of tests) {
    totals.duration += test.duration;

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

  return totals;
}

/**
 * Extract shard information if present
 */
function extractShardInfo(
  report: PlaywrightJsonReport,
  tests: NormalizedTest[],
): ShardInfo[] | undefined {
  if (!report.config.shard) {
    return undefined;
  }

  return [{
    current: report.config.shard.current,
    total: report.config.shard.total,
    duration: report.stats?.duration || 0,
    testCount: tests.length,
  }];
}

/**
 * Extract project names from config
 */
function extractProjects(report: PlaywrightJsonReport): string[] {
  const projects = new Set<string>();

  // Get from config
  if (report.config?.projects) {
    for (const project of report.config.projects) {
      projects.add(project.name);
    }
  }

  // Also scan through all tests to find project names
  function scanSuites(suites: unknown[]): void {
    for (const suiteRaw of suites) {
      const suite = suiteRaw as Record<string, unknown>;
      if (suite.suites && Array.isArray(suite.suites)) scanSuites(suite.suites);
      if (suite.specs && Array.isArray(suite.specs)) {
        for (const specRaw of suite.specs) {
          const spec = specRaw as Record<string, unknown>;
          const specTests = (spec.tests as unknown[]) || [];
          for (const testRaw of specTests) {
            const test = testRaw as Record<string, unknown>;
            const testTests = (test.tests as unknown[]) || [];
            for (const resultRaw of testTests) {
              const result = resultRaw as Record<string, unknown>;
              if (result.projectName) {
                projects.add(result.projectName as string);
              }
            }
          }
        }
      }
      if (suite.tests && Array.isArray(suite.tests)) {
        for (const testRaw of suite.tests) {
          const test = testRaw as Record<string, unknown>;
          const testTests = (test.tests as unknown[]) || [];
          for (const resultRaw of testTests) {
            const result = resultRaw as Record<string, unknown>;
            if (result.projectName) {
              projects.add(result.projectName as string);
            }
          }
        }
      }
    }
  }

  scanSuites(report.suites);

  return Array.from(projects).sort();
}

/**
 * Normalize Playwright JSON report into flat structure
 */
export function normalizeTestRun(report: PlaywrightJsonReport): NormalizedTestRun {
  // Generate run ID
  const runId = randomUUID();

  // Extract timestamps
  const startedAt = report.stats?.startTime || new Date().toISOString();
  const duration = report.stats?.duration || 0;
  // Calculate endTime from startTime and duration
  const endedAt = report.stats?.startTime 
    ? new Date(new Date(report.stats.startTime).getTime() + duration).toISOString()
    : new Date().toISOString();

  // Extract projects
  const projects = extractProjects(report);

  // Flatten all tests
  const tests = flattenTests(report.suites);

  // Calculate totals
  const totals = calculateTotals(tests);

  // Extract shard info
  const shards = extractShardInfo(report, tests);

  return {
    runId,
    startedAt,
    endedAt,
    duration,
    projects,
    shards,
    totals,
    tests,
    metadata: report.config?.metadata,
  };
}
