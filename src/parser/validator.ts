/**
 * Zod validation schemas for Playwright JSON report structure
 * Based on @playwright/test/reporter types
 */

import { z } from "zod";

/**
 * Schema for test location information
 */
const LocationSchema = z.object({
  file: z.string(),
  line: z.number(),
  column: z.number(),
});

/**
 * Schema for test error information
 */
const ErrorSchema = z.object({
  message: z.string().optional(),
  stack: z.string().optional(),
  value: z.string().optional(),
});

/**
 * Schema for test attachment
 */
const AttachmentSchema = z.object({
  name: z.string(),
  path: z.string().optional(),
  contentType: z.string(),
  body: z.string().optional(),
});

/**
 * Schema for test annotation
 */
const AnnotationSchema = z.object({
  type: z.string(),
  description: z.string().optional(),
});

/**
 * Interface for test step (recursive)
 */
interface TestStep {
  title: string;
  duration: number;
  error?: z.infer<typeof ErrorSchema>;
  steps?: TestStep[];
}

/**
 * Schema for test step information
 */
const StepSchema: z.ZodType<TestStep> = z.lazy(() =>
  z.object({
    title: z.string(),
    duration: z.number(),
    error: ErrorSchema.optional(),
    steps: z.array(StepSchema).optional(),
  }),
);

/**
 * Schema for test result (single test run attempt)
 */
const TestResultSchema = z.object({
  workerIndex: z.number(),
  status: z.enum(["passed", "failed", "timedOut", "skipped", "interrupted"]).optional(),
  duration: z.number(),
  error: ErrorSchema.optional(),
  errors: z.array(ErrorSchema).optional(),
  stdout: z
    .array(
      z.union([
        z.string(),
        z.object({
          text: z.string().optional(),
          buffer: z.string().optional(),
        }),
      ]),
    )
    .optional(),
  stderr: z
    .array(
      z.union([
        z.string(),
        z.object({
          text: z.string().optional(),
          buffer: z.string().optional(),
        }),
      ]),
    )
    .optional(),
  retry: z.number(),
  startTime: z.string(),
  attachments: z.array(AttachmentSchema).optional(),
  annotations: z.array(AnnotationSchema).optional(),
  steps: z.array(StepSchema).optional(),
  parallelIndex: z.number().optional(),
});

/**
 * Schema for a test (contains multiple results/attempts)
 */
const TestSchema = z.object({
  timeout: z.number(),
  annotations: z.array(AnnotationSchema).optional(),
  expectedStatus: z.enum(["passed", "failed", "timedOut", "skipped"]),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  results: z.array(TestResultSchema),
  status: z.enum(["expected", "unexpected", "flaky", "skipped"]).optional(),
});

/**
 * Schema for test spec (represents a single test)
 */
const SpecSchema = z.object({
  title: z.string(),
  ok: z.boolean(),
  tags: z.array(z.string()).optional(),
  tests: z.array(TestSchema),
  id: z.string().optional(),
  file: z.string().optional(),
  line: z.number().optional(),
  column: z.number().optional(),
  retries: z.number().optional(),
  location: LocationSchema.optional(),
});

/**
 * Interface for test suite (recursive)
 */
interface TestSuite {
  title: string;
  file?: string;
  line?: number;
  column?: number;
  suites?: TestSuite[];
  specs?: z.infer<typeof SpecSchema>[];
  tests?: z.infer<typeof TestSchema>[];
}

/**
 * Schema for test suite (recursive, contains specs and/or other suites)
 */
const SuiteSchema: z.ZodType<TestSuite> = z.lazy(() =>
  z.object({
    title: z.string(),
    file: z.string().optional(),
    line: z.number().optional(),
    column: z.number().optional(),
    suites: z.array(SuiteSchema).optional(),
    specs: z.array(SpecSchema).optional(),
    tests: z.array(TestSchema).optional(),
  }),
);

/**
 * Schema for project configuration
 */
const ProjectSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  testDir: z.string().optional(),
  testIgnore: z.array(z.union([z.string(), z.instanceof(RegExp)])).optional(),
  testMatch: z.array(z.union([z.string(), z.instanceof(RegExp)])).optional(),
  timeout: z.number().optional(),
  metadata: z.any().optional(),
  outputDir: z.string().optional(),
  repeatEach: z.number().optional(),
  retries: z.number().optional(),
  use: z.any().optional(),
});

/**
 * Schema for configuration
 */
const ConfigSchema = z.object({
  configFile: z.string().optional(),
  rootDir: z.string().optional(),
  forbidOnly: z.boolean().optional(),
  fullyParallel: z.boolean().optional(),
  globalSetup: z.union([z.string(), z.null()]).optional(),
  globalTeardown: z.union([z.string(), z.null()]).optional(),
  globalTimeout: z.number().optional(),
  grep: z.any().optional(),
  grepInvert: z.any().optional().nullable(),
  maxFailures: z.number().optional(),
  metadata: z.any().optional(),
  preserveOutput: z.string().optional(),
  reporter: z.any().optional(),
  reportSlowTests: z.any().optional().nullable(),
  quiet: z.boolean().optional(),
  projects: z.array(ProjectSchema).optional(),
  shard: z
    .object({
      current: z.number(),
      total: z.number(),
    })
    .optional()
    .nullable(),
  updateSnapshots: z.string().optional(),
  updateSourceMethod: z.string().optional(),
  version: z.string().optional(),
  workers: z.number().optional(),
  webServer: z.any().optional().nullable(),
});

/**
 * Schema for statistics
 */
const StatsSchema = z.object({
  startTime: z.string(),
  duration: z.number(),
  expected: z.number().optional(),
  unexpected: z.number().optional(),
  flaky: z.number().optional(),
  skipped: z.number().optional(),
});

/**
 * Schema for error details
 */
const ErrorDetailsSchema = z.object({
  message: z.string(),
  location: LocationSchema.optional(),
});

/**
 * Schema for Playwright JSON report
 */
export const PlaywrightJsonSchema = z.object({
  config: ConfigSchema,
  suites: z.array(SuiteSchema),
  errors: z.array(ErrorDetailsSchema).optional(),
  stats: StatsSchema.optional(),
});

/**
 * Type inference from schema
 */
export type PlaywrightJsonReport = z.infer<typeof PlaywrightJsonSchema>;

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly issues?: z.ZodIssue[],
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validate Playwright JSON report
 */
export function validatePlaywrightJson(data: unknown): PlaywrightJsonReport {
  try {
    return PlaywrightJsonSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        `Invalid Playwright JSON report: ${error.issues.map((e: z.ZodIssue) => e.message).join(", ")}`,
        error.issues,
      );
    }
    throw error;
  }
}
