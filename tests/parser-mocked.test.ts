import { describe, it, expect, vi } from "vitest";
import { promises as fs } from "fs";
import {
  parsePlaywrightJson,
} from "../src/index.js";
import { ValidationError } from "../src/parser/validator.js";

// Mock fs module
vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

describe("Parser File System Error Handling", () => {
  describe("File Reading Errors", () => {
    it("should throw descriptive error for non-existent file", async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockRejectedValueOnce(
        Object.assign(new Error("File not found"), { code: "ENOENT" }),
      );

      await expect(parsePlaywrightJson("/nonexistent.json")).rejects.toThrow(
        "File not found: /nonexistent.json",
      );
    });

    it("should throw ValidationError for malformed JSON in file", async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValueOnce("invalid json{" as unknown as string);

      await expect(parsePlaywrightJson("/invalid.json")).rejects.toThrow(
        ValidationError,
      );
      await expect(parsePlaywrightJson("/invalid.json")).rejects.toThrow(
        "Invalid JSON in file",
      );
    });

    it("should propagate file system errors (e.g., permission denied)", async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      const customError = new Error("Permission denied");
      mockReadFile.mockRejectedValueOnce(customError);

      await expect(parsePlaywrightJson("/protected.json")).rejects.toThrow(
        "Permission denied",
      );
    });

    it("should throw ValidationError for malformed JSON in buffer", async () => {
      const invalidBuffer = Buffer.from("invalid json{");

      await expect(parsePlaywrightJson(invalidBuffer)).rejects.toThrow(ValidationError);
      await expect(parsePlaywrightJson(invalidBuffer)).rejects.toThrow(
        "Invalid JSON in buffer",
      );
    });

    it("should propagate non-syntax errors from buffer parsing", async () => {
      // Create a buffer that will cause a non-SyntaxError
      const buffer = Buffer.from("{}");

      // Mock JSON.parse to throw a non-SyntaxError
      const originalParse = JSON.parse;
      JSON.parse = vi.fn().mockImplementationOnce(() => {
        throw new Error("Custom parse error");
      });

      await expect(parsePlaywrightJson(buffer)).rejects.toThrow("Custom parse error");

      JSON.parse = originalParse;
    });

    it("should reject invalid input types (number, null)", async () => {
      await expect(parsePlaywrightJson(123 as unknown as string)).rejects.toThrow(
        "Input must be a file path string, JSON object, or Buffer",
      );

      await expect(parsePlaywrightJson(null as unknown as string)).rejects.toThrow(
        "Input must be a file path string, JSON object, or Buffer",
      );
    });
  });
});