#!/usr/bin/env node

/**
 * Example demonstrating shard aggregation
 * 
 * This example shows how to:
 * - Parse multiple sharded test results
 * - Check if runs are from the same execution
 * - Aggregate sharded runs into a single report
 * - Calculate combined statistics
 */

import {
  parsePlaywrightJson,
  aggregateShardedRuns,
  areRunsFromSameExecution,
  calculateStatistics
} from 'playwright-results-parser';
import { promises as fs } from 'fs';
import path from 'path';

async function main() {
  console.log('🔄 Shard Aggregation Example\n');

  // Find all shard result files
  const resultsDir = './test-results';
  const shardFiles = [];
  
  try {
    const files = await fs.readdir(resultsDir);
    for (const file of files) {
      if (file.match(/shard-\d+\.json$/)) {
        shardFiles.push(path.join(resultsDir, file));
      }
    }
  } catch (error) {
    console.log('No shard files found, using example data...\n');
    // Use example shard files if they exist
    shardFiles.push('./shard-1.json', './shard-2.json', './shard-3.json');
  }

  if (shardFiles.length === 0) {
    console.log('No shard files found. Please run sharded tests first.');
    console.log('Example: npx playwright test --shard=1/3');
    return;
  }

  console.log(`Found ${shardFiles.length} shard files:`);
  shardFiles.forEach(file => console.log(`  - ${file}`));
  console.log('');

  // Parse all shard files
  const shardRuns = [];
  for (const file of shardFiles) {
    try {
      console.log(`Parsing ${path.basename(file)}...`);
      const run = await parsePlaywrightJson(file);
      shardRuns.push(run);
      
      // Display shard info
      if (run.shards && run.shards.length > 0) {
        const shard = run.shards[0];
        console.log(`  Shard ${shard.current}/${shard.total}`);
        console.log(`  Tests: ${run.tests.length}`);
        console.log(`  Duration: ${(shard.duration / 1000).toFixed(2)}s`);
      }
    } catch (error) {
      console.log(`  ⚠️  Failed to parse ${file}: ${error.message}`);
    }
  }
  console.log('');

  if (shardRuns.length === 0) {
    console.log('No valid shard files could be parsed.');
    return;
  }

  // Check if all shards are from the same execution
  console.log('Validating shards...');
  if (areRunsFromSameExecution(shardRuns)) {
    console.log('✅ All shards are from the same test execution\n');
  } else {
    console.log('⚠️  Warning: Shards appear to be from different executions');
    console.log('   Results may not be accurate when combined\n');
  }

  // Aggregate sharded runs
  console.log('Aggregating shards...');
  const aggregatedRun = aggregateShardedRuns(shardRuns);
  console.log('✅ Shards aggregated successfully\n');

  // Display aggregated results
  console.log('📊 Aggregated Test Results:');
  console.log(`  Total Tests: ${aggregatedRun.tests.length}`);
  console.log(`  Projects: ${aggregatedRun.projects.join(', ')}`);
  console.log(`  Total Duration: ${(aggregatedRun.duration / 1000).toFixed(2)}s`);
  console.log('');

  // Calculate statistics on aggregated data
  const stats = calculateStatistics(aggregatedRun);
  
  console.log('Statistics:');
  console.log(`  ✅ Passed: ${stats.passed} (${(stats.passed / stats.total * 100).toFixed(2)}%)`);
  console.log(`  ❌ Failed: ${stats.failed} (${(stats.failed / stats.total * 100).toFixed(2)}%)`);
  console.log(`  ⚠️  Flaky: ${stats.flaky}`);
  console.log(`  ⏭️  Skipped: ${stats.skipped}`);
  console.log('');

  console.log('Duration Analysis:');
  console.log(`  Average: ${stats.duration.average.toFixed(0)}ms`);
  console.log(`  Median: ${stats.duration.median.toFixed(0)}ms`);
  console.log(`  P95: ${stats.duration.p95.toFixed(0)}ms`);
  console.log('');

  // Per-shard breakdown
  if (aggregatedRun.shards && aggregatedRun.shards.length > 0) {
    console.log('Shard Breakdown:');
    aggregatedRun.shards.forEach(shard => {
      console.log(`  Shard ${shard.current}/${shard.total}:`);
      console.log(`    Tests: ${shard.testCount}`);
      console.log(`    Duration: ${(shard.duration / 1000).toFixed(2)}s`);
    });
    console.log('');
  }

  // Find imbalanced shards
  if (aggregatedRun.shards && aggregatedRun.shards.length > 1) {
    const durations = aggregatedRun.shards.map(s => s.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    
    const imbalance = ((maxDuration - minDuration) / avgDuration * 100).toFixed(2);
    console.log('Shard Balance Analysis:');
    console.log(`  Fastest shard: ${(minDuration / 1000).toFixed(2)}s`);
    console.log(`  Slowest shard: ${(maxDuration / 1000).toFixed(2)}s`);
    console.log(`  Imbalance: ${imbalance}%`);
    
    if (parseFloat(imbalance) > 20) {
      console.log('  ⚠️  Consider rebalancing test distribution across shards');
    } else {
      console.log('  ✅ Shards are well balanced');
    }
    console.log('');
  }

  // Export aggregated results
  const outputFile = './aggregated-results.json';
  console.log(`💾 Saving aggregated results to ${outputFile}...`);
  await fs.writeFile(
    outputFile,
    JSON.stringify(aggregatedRun, null, 2),
    'utf-8'
  );
  console.log('✅ Aggregated results saved successfully!');
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});