#!/usr/bin/env node

/**
 * Example demonstrating filtering and sorting capabilities
 * 
 * This example shows how to:
 * - Use pre-built filter predicates
 * - Combine multiple filters
 * - Sort test results
 * - Create custom filters and sorts
 */

import {
  parsePlaywrightJson,
  filterTests,
  filterPredicates,
  combinePredicates,
  combinePredicatesOr,
  sortTests,
  sortComparators,
  compoundSort,
  reverseSort
} from 'playwright-results-parser';

async function main() {
  const testRun = await parsePlaywrightJson('./test-results.json');

  console.log('🔍 Filtering and Sorting Examples\n');

  // Example 1: Filter failed tests
  console.log('1. Failed Tests:');
  const failedRun = filterTests(testRun, filterPredicates.failed);
  console.log(`   Found ${failedRun.tests.length} failed tests\n`);

  // Example 2: Filter slow tests (> 3 seconds)
  console.log('2. Slow Tests (> 3s):');
  const slowRun = filterTests(testRun, filterPredicates.slow(3000));
  console.log(`   Found ${slowRun.tests.length} slow tests\n`);

  // Example 3: Combine filters - failed AND slow
  console.log('3. Failed AND Slow Tests:');
  const failedAndSlow = filterTests(testRun, 
    combinePredicates(
      filterPredicates.failed,
      filterPredicates.slow(3000)
    )
  );
  console.log(`   Found ${failedAndSlow.tests.length} tests that are both failed and slow\n`);

  // Example 4: Combine with OR - failed OR flaky
  console.log('4. Failed OR Flaky Tests:');
  const failedOrFlaky = filterTests(testRun,
    combinePredicatesOr(
      filterPredicates.failed,
      filterPredicates.flaky
    )
  );
  console.log(`   Found ${failedOrFlaky.tests.length} tests that are either failed or flaky\n`);

  // Example 5: Filter by project
  console.log('5. Tests by Project:');
  testRun.projects.forEach(project => {
    const projectTests = filterTests(testRun, filterPredicates.byProject(project));
    console.log(`   ${project}: ${projectTests.tests.length} tests`);
  });
  console.log('');

  // Example 6: Custom filter - tests with errors containing specific text
  console.log('6. Custom Filter - Tests with "timeout" errors:');
  const timeoutTests = filterTests(testRun, test => 
    test.error?.message?.toLowerCase().includes('timeout') ?? false
  );
  console.log(`   Found ${timeoutTests.tests.length} tests with timeout errors\n`);

  // Example 7: Sort by duration (slowest first)
  console.log('7. Top 5 Slowest Tests:');
  const sortedByDuration = sortTests(testRun, sortComparators.byDurationDesc);
  sortedByDuration.tests.slice(0, 5).forEach((test, i) => {
    console.log(`   ${i + 1}. ${(test.duration / 1000).toFixed(2)}s - ${test.title}`);
  });
  console.log('');

  // Example 8: Sort by status then duration
  console.log('8. Tests Sorted by Status, then Duration:');
  const multiSorted = sortTests(testRun,
    compoundSort(
      sortComparators.byStatus,
      sortComparators.byDurationDesc
    )
  );
  
  // Show first test of each status
  let currentStatus = '';
  multiSorted.tests.forEach(test => {
    if (test.status !== currentStatus) {
      currentStatus = test.status;
      console.log(`   ${test.status.toUpperCase()}: ${test.title} (${test.duration}ms)`);
    }
  });
  console.log('');

  // Example 9: Reverse sort (fastest tests first)
  console.log('9. Top 5 Fastest Tests:');
  const fastestFirst = sortTests(testRun, reverseSort(sortComparators.byDurationDesc));
  fastestFirst.tests.slice(0, 5).forEach((test, i) => {
    console.log(`   ${i + 1}. ${test.duration}ms - ${test.title}`);
  });
  console.log('');

  // Example 10: Filter tests with attachments (screenshots, videos)
  console.log('10. Tests with Attachments:');
  const withAttachments = filterTests(testRun, filterPredicates.withAttachments);
  console.log(`   Found ${withAttachments.tests.length} tests with attachments`);
  withAttachments.tests.slice(0, 3).forEach(test => {
    console.log(`   - ${test.title}: ${test.attachments?.length} attachment(s)`);
  });
  console.log('');

  // Example 11: Complex filtering - Failed tests in specific file
  console.log('11. Complex Filter - Failed tests in specific files:');
  const complexFilter = filterTests(testRun,
    combinePredicates(
      filterPredicates.failed,
      test => test.file.includes('.spec.ts')
    )
  );
  console.log(`   Found ${complexFilter.tests.length} failed tests in .spec.ts files\n`);

  // Summary
  console.log('📊 Filter & Sort Summary:');
  console.log(`   Total tests: ${testRun.tests.length}`);
  console.log(`   After filtering and sorting, you can focus on what matters most!`);
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});