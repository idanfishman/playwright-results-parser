# Changelog

All notable changes to the playwright-results-parser project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0](https://github.com/idanfishman/playwright-results-parser/releases/tag/v1.0.0) - 2025-08-09

### Added

#### Core Parser Features

- **JSON Report Parsing**: Complete parser for Playwright JSON report format with full TypeScript support
- **Validation System**: Zod-based validation for Playwright report structure with custom `ValidationError` class
- **Report Normalization**: Transform raw Playwright reports into standardized `NormalizedTestRun` format
- **Type Definitions**: Comprehensive TypeScript types for all Playwright report entities

#### Aggregation & Analysis

- **Shard Aggregation**: Combine multiple sharded test runs into a single unified report
  - `aggregateShardedRuns()`: Merge sharded results intelligently
  - `areRunsFromSameExecution()`: Verify runs belong to same test execution
- **Statistics Calculation**: Generate detailed statistics from test runs
  - `calculateStatistics()`: Comprehensive test metrics including pass/fail rates
  - `getFailedTests()`: Extract all failed test cases
  - `getFlakyTests()`: Identify flaky tests across runs
  - `getTestsByProject()`: Group tests by Playwright project
  - `getTestsByFile()`: Organize tests by source file
  - Duration statistics with percentiles (p95, median, min, max)

#### Filtering & Sorting

- **Advanced Filtering**: Powerful test filtering system with predicate composition
  - `filterTests()`: Apply single or multiple filter predicates
  - `filterPredicates`: Pre-built filters for common scenarios (status, project, file, duration)
  - `combinePredicates()`: AND logic for multiple filters
  - `combinePredicatesOr()`: OR logic for multiple filters
- **Flexible Sorting**: Comprehensive test sorting utilities
  - `sortTests()`: Sort tests by various criteria
  - `sortComparators`: Pre-built comparators (name, status, duration, file, project)
  - `compoundSort()`: Combine multiple sort criteria
  - `reverseSort()`: Reverse any sort order

#### Helper Utilities

- **Test Grouping**: `groupTests()` - Group tests by any property
- **Unique Value Extraction**:
  - `getUniqueValues()`: Extract unique values using custom extractor
  - `getUniqueProjects()`: Get all unique project names
  - `getUniqueFiles()`: Get all unique file paths
- **Rate Calculations**:
  - `calculatePassRate()`: Calculate test pass percentage
  - `calculateFlakyRate()`: Calculate flaky test percentage
- **Pattern Matching**: `findTestsByPattern()` - Find tests matching regex patterns
- **Summary Generation**: `getTestSummary()` - Generate concise test run summary
- **Quick Checks**:
  - `allTestsPassed()`: Check if all tests passed
  - `hasFailures()`: Check for any test failures
  - `hasFlakyTests()`: Check for flaky tests

#### Data Types & Interfaces

- **Normalized Types**:
  - `NormalizedTestRun`: Standardized test run representation
  - `NormalizedTest`: Individual test case data
  - `TestTotals`: Aggregate test counts
  - `TestError`: Error information with stack traces
  - `TestAttachment`: Test artifacts and attachments
  - `TestAnnotation`: Test metadata and annotations
  - `ShardInfo`: Shard execution details
- **Playwright Types**:
  - `PlaywrightJsonReport`: Complete report structure
  - `PlaywrightSuite`: Test suite information
  - `PlaywrightTestCase`: Individual test case
  - `PlaywrightTestResult`: Test execution result
  - `PlaywrightTestAttempt`: Individual test attempt
  - `PlaywrightSpec`: Test specification
  - `PlaywrightAnnotation`: Test annotations
- **Statistics Types**:
  - `TestStatistics`: Overall test metrics
  - `ProjectStatistics`: Per-project metrics
  - `FileStatistics`: Per-file metrics
  - `DurationStatistics`: Timing analysis
  - `TestSummary`: Concise test run summary

#### Development Setup

- **Build System**: ESBuild configuration for fast compilation
- **Testing Framework**: Vitest for unit and integration tests
- **Code Quality**:
  - ESLint configuration for TypeScript
  - Prettier for code formatting
  - TypeScript strict mode enabled
- **CI/CD Ready**: Pre-publish hooks for build, test, and lint
- **Package Management**: PNPM support with lock file

### Technical Details

- **Zero Runtime Dependencies**: Only uses Zod for validation
- **ES Module Support**: Full ESM compatibility
- **Node.js Compatibility**: Supports Node.js 18.x to 22.x
- **TypeScript**: Full type definitions with strict mode
- **Tree-shakeable**: Modular exports for optimal bundle size
- **Async/Sync Support**: Both async and sync APIs available

### Documentation

- Comprehensive JSDoc comments for all public APIs
- TypeScript type definitions for IDE intellisense
- Usage examples in documentation strings
