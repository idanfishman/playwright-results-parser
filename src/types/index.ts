/**
 * Core data models for playwright-results-parser
 */

/**
 * Test run totals summary
 */
export interface TestTotals {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  duration: number;
}

/**
 * Test error information
 */
export interface TestError {
  message: string;
  stack?: string;
  snippet?: string;
  line?: number;
  column?: number;
}

/**
 * Test attachment (screenshots, videos, etc.)
 */
export interface TestAttachment {
  name: string;
  path?: string;
  contentType: string;
  body?: string;
}

/**
 * Test annotation (skip, fixme, etc.)
 */
export interface TestAnnotation {
  type: string;
  description?: string;
}

/**
 * Shard information for distributed test runs
 */
export interface ShardInfo {
  current: number;
  total: number;
  duration: number;
  testCount: number;
}

/**
 * Normalized test data structure
 */
export interface NormalizedTest {
  id: string;
  title: string;
  fullTitle: string;
  file: string;
  line: number;
  column: number;
  project: string;
  status: "passed" | "failed" | "skipped" | "flaky";
  duration: number;
  retries: number;
  error?: TestError;
  attachments?: TestAttachment[];
  annotations?: TestAnnotation[];
}

/**
 * Normalized test run data structure
 */
export interface NormalizedTestRun {
  runId: string;
  startedAt: string;
  endedAt: string;
  duration: number;
  projects: string[];
  shards?: ShardInfo[];
  totals: TestTotals;
  tests: NormalizedTest[];
  metadata?: Record<string, unknown>;
}

/**
 * Playwright JSON reporter suite structure
 */
export interface PlaywrightSuite {
  title: string;
  file?: string;
  line?: number;
  column?: number;
  suites?: PlaywrightSuite[];
  tests?: PlaywrightTestCase[];
  specs?: PlaywrightSpec[];
}

/**
 * Playwright JSON reporter test case structure
 */
export interface PlaywrightTestCase {
  title: string;
  ok: boolean;
  tags: string[];
  tests: PlaywrightTestResult[];
  id: string;
  retries: number;
  location?: {
    file: string;
    line: number;
    column: number;
  };
}

/**
 * Playwright JSON reporter test result structure
 */
export interface PlaywrightTestResult {
  timeout: number;
  annotations: PlaywrightAnnotation[];
  expectedStatus: string;
  projectId?: string;
  projectName: string;
  results: PlaywrightTestAttempt[];
  status: string;
}

/**
 * Playwright JSON reporter test attempt structure
 */
export interface PlaywrightTestAttempt {
  workerIndex: number;
  status: string;
  duration: number;
  error?: {
    message: string;
    stack?: string;
    snippet?: string;
    location?: {
      file: string;
      line: number;
      column: number;
    };
  };
  errors: Array<{
    message: string;
    stack?: string;
    snippet?: string;
    location?: {
      file: string;
      line: number;
      column: number;
    };
  }>;
  stdout: string[];
  stderr: string[];
  retry: number;
  startTime: string;
  attachments: Array<{
    name: string;
    path?: string;
    contentType: string;
    body?: string;
  }>;
}

/**
 * Playwright JSON reporter spec structure
 */
export interface PlaywrightSpec {
  title: string;
  ok: boolean;
  tests: PlaywrightTestCase[];
  id: string;
  file: string;
  line: number;
  column: number;
}

/**
 * Playwright JSON reporter annotation structure
 */
export interface PlaywrightAnnotation {
  type: string;
  description?: string;
}

/**
 * Playwright JSON reporter root structure
 */
export interface PlaywrightJsonReport {
  config: {
    rootDir?: string;
    projects?: Array<{
      id?: string;
      name: string;
    }>;
    metadata?: Record<string, unknown>;
  };
  suites: PlaywrightSuite[];
  stats?: {
    startTime: string;
    endTime?: string;
    duration: number;
    expected: number;
    unexpected: number;
    skipped: number;
    flaky: number;
  };
  shards?: Array<{
    current: number;
    total: number;
  }>;
}
