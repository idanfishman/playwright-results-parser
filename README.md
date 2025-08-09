<h1 align="center" style="border-bottom: none">
  Playwright Results Parser
</h1>

<div align="center">

[![npm](https://img.shields.io/npm/v/playwright-results-parser?color=bright-green&logo=npm&logoColor=white&label=npm)](https://www.npmjs.com/package/playwright-results-parser) [![codecov](https://img.shields.io/codecov/c/github/idanfishman/playwright-results-parser?color=brightgreen&logo=codecov&logoColor=white&label=coverage)](https://codecov.io/gh/idanfishman/playwright-results-parser) [![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen?logo=node.js&logoColor=white)](https://nodejs.org/) [![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen.svg)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-brightgreen?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A powerful Node.js library for parsing and analyzing Playwright test results. This package provides comprehensive parsing capabilities for Playwright's JSON reporter output, making it easy to extract insights, generate reports, and integrate test results into your CI/CD workflows.

</div>

## Features

- **Comprehensive Parsing**: Parse Playwright JSON test results with full type safety
- **Statistical Analysis**: Calculate pass rates, duration statistics, and test metrics
- **Flexible Filtering**: Filter results by status, tags, projects, and custom predicates
- **Tag Management**: Extract and analyze test tags from various formats
- **Detailed Information**: Access test errors, annotations, retries, and attachments
- **Type-Safe**: Built with TypeScript for excellent IDE support and type safety

## Installation

```bash
npm install playwright-results-parser
```

or

```bash
yarn add playwright-results-parser
```

or

```bash
pnpm add playwright-results-parser
```

## Usage

### Basic Example

```javascript
import { parsePlaywrightResults } from "playwright-results-parser";

// Parse results from a file
const results = await parsePlaywrightResults("path/to/results.json");

// Or parse from JSON data directly
const jsonData = {
  /* your playwright JSON results */
};
const results = await parsePlaywrightResults(jsonData);

// Access parsed data
console.log(`Total tests: ${results.summary.total}`);
console.log(`Passed: ${results.summary.passed}`);
console.log(`Failed: ${results.summary.failed}`);
console.log(`Pass rate: ${(results.summary.passRate * 100).toFixed(2)}%`);
```

### Filtering Results

```javascript
import { parsePlaywrightResults, filterResults } from "playwright-results-parser";

const results = await parsePlaywrightResults("results.json");

// Filter by status
const failedTests = filterResults(results, { status: ["failed", "timedOut"] });

// Filter by tags
const smokeTests = filterResults(results, { tags: ["@smoke"] });

// Filter by project
const chromeTests = filterResults(results, { projects: ["chromium"] });

// Custom filter
const slowTests = filterResults(results, {
  predicate: (test) => test.duration > 5000,
});

// Combine multiple filters
const criticalFailures = filterResults(results, {
  status: ["failed"],
  tags: ["@critical"],
  projects: ["chromium", "firefox"],
});
```

### Working with Test Details

```javascript
import { parsePlaywrightResults } from "playwright-results-parser";

const results = await parsePlaywrightResults("results.json");

// Iterate through all tests
results.tests.forEach((test) => {
  console.log(`Test: ${test.title}`);
  console.log(`  File: ${test.file}:${test.line}`);
  console.log(`  Status: ${test.status}`);
  console.log(`  Duration: ${test.duration}ms`);

  // Access test tags
  if (test.tags.length > 0) {
    console.log(`  Tags: ${test.tags.join(", ")}`);
  }

  // Check for errors
  if (test.errors.length > 0) {
    test.errors.forEach((error) => {
      console.log(`  Error: ${error.message}`);
      if (error.snippet) {
        console.log(`    Snippet: ${error.snippet}`);
      }
    });
  }

  // Access annotations
  test.annotations.forEach((annotation) => {
    console.log(`  ${annotation.type}: ${annotation.description}`);
  });
});
```

### Analyzing Test Suites

```javascript
import { parsePlaywrightResults } from "playwright-results-parser";

const results = await parsePlaywrightResults("results.json");

// Access suite hierarchy
results.suites.forEach((suite) => {
  console.log(`Suite: ${suite.title}`);
  console.log(`  File: ${suite.file}`);
  console.log(`  Total tests: ${suite.tests.length}`);
  console.log(`  Pass rate: ${(suite.stats.passRate * 100).toFixed(2)}%`);

  // Access nested suites
  if (suite.suites.length > 0) {
    console.log(`  Nested suites: ${suite.suites.length}`);
  }
});
```

### Statistical Analysis

```javascript
import { parsePlaywrightResults, getStatistics } from "playwright-results-parser";

const results = await parsePlaywrightResults("results.json");
const stats = getStatistics(results);

console.log("Test Statistics:");
console.log(`  Total: ${stats.total}`);
console.log(`  Passed: ${stats.passed}`);
console.log(`  Failed: ${stats.failed}`);
console.log(`  Flaky: ${stats.flaky}`);
console.log(`  Skipped: ${stats.skipped}`);
console.log(`  Pass Rate: ${(stats.passRate * 100).toFixed(2)}%`);
console.log(`  Average Duration: ${stats.avgDuration.toFixed(2)}ms`);
console.log(`  Total Duration: ${stats.totalDuration}ms`);
```

## API Reference

### Main Functions

#### `parsePlaywrightResults(input)`

Parses Playwright JSON results from a file path or JSON object.

- **Parameters**:
  - `input`: File path (string) or Playwright JSON results object
- **Returns**: `Promise<ParsedResults>`

#### `filterResults(results, options)`

Filters parsed results based on specified criteria.

- **Parameters**:
  - `results`: Parsed results object
  - `options`: Filter options object
    - `status`: Array of test statuses to include
    - `tags`: Array of tags to filter by
    - `projects`: Array of project names to filter by
    - `predicate`: Custom filter function
- **Returns**: `FilteredResults`

#### `getStatistics(results)`

Calculates statistical metrics from test results.

- **Parameters**:
  - `results`: Parsed or filtered results
- **Returns**: `Statistics` object with metrics

### Types

The package exports comprehensive TypeScript types for all data structures:

```typescript
import type {
  ParsedResults,
  TestResult,
  Suite,
  TestStatus,
  Statistics,
  FilterOptions,
  // ... and more
} from "playwright-results-parser";
```

## Showcases

This package serves as the core parsing library for several GitHub Actions:

### [Playwright Results Summary Action](https://github.com/idanfishman/playwright-results-summary-action)

Generate test result summaries directly in your pull requests and workflow runs.

### [Playwright Results Notify Action](https://github.com/idanfishman/playwright-results-notify-action)

Send test results notifications via Slack, email, or other channels.

### [Playwright Prometheus Metrics Action](https://github.com/idanfishman/playwright-prometheus-metrics-action)

Export Playwright test metrics to Prometheus for monitoring and alerting.

## Requirements

- Node.js 18.x or later
- Playwright test results in JSON format (generated using `--reporter=json`)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Created and maintained by [Idan Fishman](https://github.com/idanfishman)

## Support

If you find this package helpful, please consider giving it a star on [GitHub](https://github.com/idanfishman/playwright-results-parser).

For issues, questions, or suggestions, please [open an issue](https://github.com/idanfishman/playwright-results-parser/issues).
