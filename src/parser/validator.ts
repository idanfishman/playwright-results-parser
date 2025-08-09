/**
 * Zod validation schemas for Playwright JSON report structure
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
  message: z.string(),
  stack: z.string().optional(),
  snippet: z.string().optional(),
  location: LocationSchema.optional(),
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
 * Schema for test attempt result
 */
const TestAttemptSchema = z.object({
  workerIndex: z.number(),
  status: z.string(),
  duration: z.number(),
  error: ErrorSchema.optional(),
  errors: z.array(ErrorSchema),
  stdout: z.array(z.string()),
  stderr: z.array(z.string()),
  retry: z.number(),
  startTime: z.string(),
  attachments: z.array(AttachmentSchema),
});

/**
 * Schema for test result
 */
const TestResultSchema = z.object({
  timeout: z.number(),
  annotations: z.array(AnnotationSchema),
  expectedStatus: z.string(),
  projectId: z.string().optional(),
  projectName: z.string(),
  results: z.array(TestAttemptSchema),
  status: z.string(),
});

/**
 * Interface for test case to avoid circular reference
 */
interface TestCase {
  title: string;
  ok: boolean;
  tags: string[];
  tests: z.infer<typeof TestResultSchema>[];
  id: string;
  retries: number;
  location?: z.infer<typeof LocationSchema>;
}

/**
 * Schema for test case
 */
const TestCaseSchema: z.ZodType<TestCase> = z.lazy(() =>
  z.object({
    title: z.string(),
    ok: z.boolean(),
    tags: z.array(z.string()),
    tests: z.array(TestResultSchema),
    id: z.string(),
    retries: z.number(),
    location: LocationSchema.optional(),
  }),
);

/**
 * Schema for test spec
 */
const SpecSchema = z.object({
  title: z.string(),
  ok: z.boolean(),
  tests: z.array(TestCaseSchema),
  id: z.string(),
  file: z.string(),
  line: z.number(),
  column: z.number(),
});

/**
 * Interface for test suite to handle recursive reference
 */
interface Suite {
  title: string;
  file?: string;
  line?: number;
  column?: number;
  suites?: Suite[];
  tests?: TestCase[];
  specs?: z.infer<typeof SpecSchema>[];
}

/**
 * Schema for test suite (recursive)
 */
const SuiteSchema: z.ZodType<Suite> = z.lazy(() =>
  z.object({
    title: z.string(),
    file: z.string().optional(),
    line: z.number().optional(),
    column: z.number().optional(),
    suites: z.array(SuiteSchema).optional(),
    tests: z.array(TestCaseSchema).optional(),
    specs: z.array(SpecSchema).optional(),
  }),
);

/**
 * Schema for Playwright JSON report
 */
export const PlaywrightJsonSchema = z.object({
  config: z.object({
    rootDir: z.string().optional(),
    projects: z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string(),
        }),
      )
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  suites: z.array(SuiteSchema),
  stats: z
    .object({
      startTime: z.string(),
      endTime: z.string().optional(),
      duration: z.number(),
      expected: z.number(),
      unexpected: z.number(),
      skipped: z.number(),
      flaky: z.number(),
    })
    .optional(),
  shards: z
    .array(
      z.object({
        current: z.number(),
        total: z.number(),
      }),
    )
    .optional(),
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
