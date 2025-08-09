#!/usr/bin/env node

/**
 * Basic usage example for playwright-results-parser
 * 
 * This example demonstrates how to:
 * - Parse Playwright JSON reporter output
 * - Calculate statistics
 * - Filter and sort test results
 * - Generate a summary report
 */

import {
  parsePlaywrightJson,
  calculateStatistics,
  getFailedTests,
  getFlakyTests,
  filterTests,
  filterPredicates,
  sortTests,
  sortComparators
} from 'playwright-results-parser';

async function main() {
  try {
    // Parse test results from JSON file
    console.log('📊 Parsing Playwright test results...\n');
    const testRun = await parsePlaywrightJson('./test-results.json');

    // Basic information
    console.log('Test Run Information:');
    console.log(`  Run ID: ${testRun.runId}`);
    console.log(`  Started: ${new Date(testRun.startedAt).toLocaleString()}`);
    console.log(`  Duration: ${(testRun.duration / 1000).toFixed(2)}s`);
    console.log(`  Projects: ${testRun.projects.join(', ')}`);
    console.log('');

    // Calculate statistics
    const stats = calculateStatistics(testRun);
    
    console.log('Overall Statistics:');
    console.log(`  Total Tests: ${stats.total}`);
    console.log(`  ✅ Passed: ${stats.passed} (${(stats.passed / stats.total * 100).toFixed(2)}%)`);
    console.log(`  ❌ Failed: ${stats.failed} (${(stats.failed / stats.total * 100).toFixed(2)}%)`);
    console.log(`  ⚠️  Flaky: ${stats.flaky} (${(stats.flaky / stats.total * 100).toFixed(2)}%)`);
    console.log(`  ⏭️  Skipped: ${stats.skipped}`);
    console.log('');

    console.log('Duration Statistics:');
    console.log(`  Total: ${(stats.duration.total / 1000).toFixed(2)}s`);
    console.log(`  Average: ${stats.duration.average.toFixed(0)}ms`);
    console.log(`  Median: ${stats.duration.median.toFixed(0)}ms`);
    console.log(`  P95: ${stats.duration.p95.toFixed(0)}ms`);
    console.log(`  Min: ${stats.duration.min}ms`);
    console.log(`  Max: ${stats.duration.max}ms`);
    console.log('');

    // Failed tests
    const failedTests = getFailedTests(testRun);
    if (failedTests.length > 0) {
      console.log('❌ Failed Tests:');
      failedTests.forEach(test => {
        console.log(`  - ${test.fullTitle}`);
        if (test.error) {
          console.log(`    Error: ${test.error.message}`);
        }
      });
      console.log('');
    }

    // Flaky tests
    const flakyTests = getFlakyTests(testRun);
    if (flakyTests.length > 0) {
      console.log('⚠️  Flaky Tests:');
      flakyTests.forEach(test => {
        console.log(`  - ${test.fullTitle} (${test.retries} retries)`);
      });
      console.log('');
    }

    // Find slow tests (> 5 seconds)
    const slowTests = filterTests(testRun, filterPredicates.slow(5000));
    if (slowTests.tests.length > 0) {
      console.log('🐢 Slow Tests (> 5s):');
      const sorted = sortTests(slowTests, sortComparators.byDurationDesc);
      sorted.tests.slice(0, 5).forEach(test => {
        console.log(`  - ${(test.duration / 1000).toFixed(2)}s - ${test.fullTitle}`);
      });
      console.log('');
    }

    // Statistics by project
    console.log('Statistics by Project:');
    Object.entries(stats.byProject).forEach(([project, projectStats]) => {
      const passRate = (projectStats.passed / projectStats.total * 100).toFixed(2);
      console.log(`  ${project}:`);
      console.log(`    Tests: ${projectStats.total}`);
      console.log(`    Pass Rate: ${passRate}%`);
      console.log(`    Duration: ${(projectStats.duration / 1000).toFixed(2)}s`);
    });
    console.log('');

    // Summary
    const passRate = (stats.passed / stats.total * 100).toFixed(2);
    if (stats.failed === 0) {
      console.log(`✨ All tests passed! (${passRate}% pass rate)`);
    } else {
      console.log(`📊 Test run completed with ${passRate}% pass rate`);
      console.log(`   ${stats.failed} tests need attention`);
    }

  } catch (error) {
    console.error('Error processing test results:', error.message);
    process.exit(1);
  }
}

// Run the example
main();