/**
 * Aggregates sharded test results
 */

import type { NormalizedTestRun, ShardInfo, TestTotals } from "../types/index.js";

/**
 * Aggregates multiple sharded test runs into a single unified run.
 * Combines tests from all shards and recalculates totals.
 *
 * @param runs - Array of test runs from different shards
 * @returns Single aggregated test run with all tests
 * @throws {Error} If no test runs are provided
 *
 * @example
 * ```typescript
 * const shard1 = await parsePlaywrightJson('./shard-1.json');
 * const shard2 = await parsePlaywrightJson('./shard-2.json');
 * const combined = aggregateShardedRuns([shard1, shard2]);
 * console.log(`Total tests across shards: ${combined.totals.total}`);
 * ```
 */
export function aggregateShardedRuns(runs: NormalizedTestRun[]): NormalizedTestRun {
  if (runs.length === 0) {
    throw new Error("No test runs provided for aggregation");
  }

  if (runs.length === 1) {
    return runs[0]!;
  }

  // Use the first run as base
  const baseRun = runs[0]!;

  // Collect all tests from all shards
  const allTests = runs.flatMap((run) => run.tests);

  // Collect all unique projects
  const allProjects = new Set<string>();
  runs.forEach((run) => {
    run.projects.forEach((project) => allProjects.add(project));
  });

  // Aggregate shard info
  const shards: ShardInfo[] = [];
  runs.forEach((run) => {
    if (run.shards && run.shards.length > 0) {
      shards.push(...run.shards);
    }
  });

  // Calculate overall duration (max end time - min start time)
  const startTimes = runs.map((run) => new Date(run.startedAt).getTime());
  const endTimes = runs.map((run) => new Date(run.endedAt).getTime());
  const overallStartTime = Math.min(...startTimes);
  const overallEndTime = Math.max(...endTimes);
  const overallDuration = overallEndTime - overallStartTime;

  // Recalculate totals from all tests
  const totals: TestTotals = {
    total: allTests.length,
    passed: allTests.filter((t) => t.status === "passed").length,
    failed: allTests.filter((t) => t.status === "failed").length,
    skipped: allTests.filter((t) => t.status === "skipped").length,
    flaky: allTests.filter((t) => t.status === "flaky").length,
    duration: allTests.reduce((sum, t) => sum + t.duration, 0),
  };

  // Merge metadata from all shards
  const metadata: Record<string, unknown> = {};
  runs.forEach((run) => {
    if (run.metadata) {
      Object.assign(metadata, run.metadata);
    }
  });

  return {
    runId: baseRun.runId,
    startedAt: new Date(overallStartTime).toISOString(),
    endedAt: new Date(overallEndTime).toISOString(),
    duration: overallDuration,
    projects: Array.from(allProjects).sort(),
    shards: shards.length > 0 ? shards : undefined,
    totals,
    tests: allTests,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

/**
 * Checks if test runs are from the same sharded execution.
 * Validates that all runs have consistent shard configuration.
 *
 * @param runs - Array of test runs to validate
 * @returns True if all runs are from the same sharded execution
 *
 * @example
 * ```typescript
 * const runs = [shard1, shard2, shard3];
 * if (areRunsFromSameExecution(runs)) {
 *   const combined = aggregateShardedRuns(runs);
 * } else {
 *   console.error('Runs are from different executions');
 * }
 * ```
 */
export function areRunsFromSameExecution(runs: NormalizedTestRun[]): boolean {
  if (runs.length <= 1) return true;

  // Check if all runs have shard info
  const allHaveShards = runs.every((run) => run.shards && run.shards.length > 0);
  if (!allHaveShards) return false;

  // Check if all runs have the same total shard count
  const firstRunShards = runs[0]?.shards;
  if (!firstRunShards || firstRunShards.length === 0) return false;

  const totalShards = firstRunShards[0]!.total;
  const sameTotalShards = runs.every(
    (run) => run.shards && run.shards[0] && run.shards[0].total === totalShards,
  );

  if (!sameTotalShards) return false;

  // Check if shard numbers are unique and sequential
  const shardNumbers = new Set<number>();
  for (const run of runs) {
    if (run.shards) {
      for (const shard of run.shards) {
        if (shardNumbers.has(shard.current)) {
          return false; // Duplicate shard number
        }
        shardNumbers.add(shard.current);
      }
    }
  }

  return true;
}
