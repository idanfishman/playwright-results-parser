/**
 * Core parser for Playwright JSON reports
 */

import { promises as fs } from "fs";
import type { NormalizedTestRun } from "../types/index.js";
import { validatePlaywrightJson, ValidationError } from "./validator.js";
import { normalizeTestRun } from "./normalizer.js";

/**
 * Parses Playwright JSON reporter output into a normalized structure.
 * Supports multiple input formats including file paths, JSON objects, and Buffers.
 *
 * @param input - File path to JSON report, parsed JSON object, or Buffer containing JSON
 * @returns Promise resolving to normalized test run data with consistent structure
 *
 * @example
 * ```typescript
 * // Parse from file path
 * const results = await parsePlaywrightJson('./test-results.json');
 * console.log(`Total tests: ${results.totals.total}`);
 * console.log(`Failed tests: ${results.totals.failed}`);
 * ```
 *
 * @example
 * ```typescript
 * // Parse from JSON object
 * const jsonData = JSON.parse(fs.readFileSync('./results.json', 'utf-8'));
 * const results = await parsePlaywrightJson(jsonData);
 * ```
 *
 * @example
 * ```typescript
 * // Parse from Buffer
 * const buffer = fs.readFileSync('./results.json');
 * const results = await parsePlaywrightJson(buffer);
 * ```
 *
 * @throws {Error} If input is not a valid file path, JSON object, or Buffer
 * @throws {ValidationError} If JSON structure doesn't match Playwright reporter format
 */
export async function parsePlaywrightJson(
  input: string | object | Buffer,
): Promise<NormalizedTestRun> {
  let jsonData: unknown;

  // Handle different input types
  if (typeof input === "string") {
    // File path - read and parse
    try {
      const fileContent = await fs.readFile(input, "utf-8");
      jsonData = JSON.parse(fileContent);
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") {
        throw new Error(`File not found: ${input}`);
      }
      if (error instanceof SyntaxError) {
        throw new ValidationError(`Invalid JSON in file ${input}: ${error.message}`);
      }
      throw error;
    }
  } else if (Buffer.isBuffer(input)) {
    // Buffer - convert to string and parse
    try {
      const content = input.toString("utf-8");
      jsonData = JSON.parse(content);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ValidationError(`Invalid JSON in buffer: ${error.message}`);
      }
      throw error;
    }
  } else if (typeof input === "object" && input !== null) {
    // Already parsed JSON object
    jsonData = input;
  } else {
    throw new Error("Input must be a file path string, JSON object, or Buffer");
  }

  // Validate JSON structure
  const validatedReport = validatePlaywrightJson(jsonData);

  // Normalize the data
  return normalizeTestRun(validatedReport);
}
