import * as UUID from 'uuid';
import chalk from 'chalk';
import { createWorker } from './worker-code';

// ============================================
// UUID Bruteforce Benchmark with Multithreading
// ============================================

// Configuration
const WORKER_COUNT = navigator.hardwareConcurrency || 8;
const PROGRESS_INTERVAL_MS = 100;

// Generate a target public UUID to find
const targetPrivate = UUID.v4();
const targetPublic = UUID.v5(targetPrivate, targetPrivate);

// ============================================
// Difficulty Estimation
// ============================================
function printDifficultyEstimate() {
  console.log();
  console.log(chalk.bold.underline('🔐 UUID Bruteforce Benchmark'));
  console.log();

  console.log(chalk.cyan('Target:'));
  console.log('  Private UUID (hidden):', chalk.dim(targetPrivate));
  console.log('  Public UUID (known):  ', chalk.green(targetPublic));
  console.log();

  // UUID v4 has 122 random bits (6 bits are fixed for version/variant)
  const totalCombinations = 2n ** 122n;
  const combinationsStr = totalCombinations.toLocaleString();

  // Estimate speed: roughly 500,000 UUIDs/sec per thread on modern hardware
  const estimatedSpeed = 500000n * BigInt(WORKER_COUNT);
  const estimatedSeconds = totalCombinations / estimatedSpeed;
  const estimatedYears = estimatedSeconds / (60n * 60n * 24n * 365n);

  console.log(chalk.cyan('Difficulty Estimate:'));
  console.log('  Total UUID v4 combinations:', chalk.yellow(`2^122 ≈ 5.3 × 10^36`));
  console.log(
    '  Estimated check speed:     ',
    chalk.yellow(`~${(Number(estimatedSpeed) / 1e6).toFixed(1)}M UUIDs/sec (${WORKER_COUNT} threads)`)
  );
  console.log('  Time to exhaust keyspace:  ', chalk.red(`~${estimatedYears.toLocaleString()} years`));
  console.log();

  console.log(chalk.magenta('Reality Check:'));
  console.log('  Even at 1 trillion checks/sec, it would take ~170 septillion years.');
  console.log('  The universe is only ~13.8 billion years old.');
  console.log('  ', chalk.bold.red('This is cryptographically infeasible!'));
  console.log();

  console.log(chalk.cyan('This benchmark will:'));
  console.log('  - Generate random UUIDs and check if they produce the target public UUID');
  console.log('  - Show progress and speed statistics');
  console.log('  - Press Ctrl+C to stop at any time');
  console.log();
}

// ============================================
// Main Process
// ============================================
async function runBenchmark() {
  printDifficultyEstimate();

  console.log(chalk.bold.green('Starting bruteforce with ' + WORKER_COUNT + ' worker threads...'));
  console.log();

  const workers: Worker[] = [];
  const workerProgress: bigint[] = new Array(WORKER_COUNT).fill(0n);
  let totalChecked = 0n;
  let startTime = Date.now();
  let running = true;
  let found = false;

  // Create and start workers using the worker factory
  for (let i = 0; i < WORKER_COUNT; i++) {
    const worker = createWorker();

    worker.onmessage = (event) => {
      const { type, workerId, checked, private: foundPrivate } = event.data;

      if (type === 'progress') {
        workerProgress[workerId] = BigInt(checked);
      } else if (type === 'found') {
        found = true;
        running = false;
        console.log();
        console.log(chalk.bold.green('🎉 FOUND IT!'));
        console.log('  Private UUID:', chalk.yellow(foundPrivate));
        console.log('  Checked:     ', chalk.cyan(BigInt(checked).toLocaleString()));
        stopAll();
      }
    };

    worker.onerror = (err) => {
      console.error(chalk.red(`Worker ${i} error:`), err);
    };

    worker.postMessage({ targetPublic, workerId: i });
    workers.push(worker);
  }

  // Progress display
  const progressInterval = setInterval(() => {
    if (!running) return;

    totalChecked = workerProgress.reduce((a, b) => a + b, 0n);
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = Number(totalChecked) / elapsed;

    // Calculate progress bar (purely cosmetic since we'll never finish)
    const totalSpace = 2n ** 122n;
    const progressPct = Number((totalChecked * 10000n) / totalSpace) / 100;

    // Clear line and print progress
    process.stdout.write('\r');
    process.stdout.write(
      chalk.blue('⏳ Checked: ') +
        chalk.yellow(totalChecked.toLocaleString().padStart(20)) +
        chalk.blue(' | Speed: ') +
        chalk.green((speed / 1e6).toFixed(2) + 'M/s') +
        chalk.blue(' | Elapsed: ') +
        chalk.cyan(formatDuration(elapsed)) +
        chalk.blue(' | Progress: ') +
        chalk.dim(progressPct.toFixed(10) + '%') +
        '  '
    );
  }, PROGRESS_INTERVAL_MS);

  function stopAll() {
    running = false;
    clearInterval(progressInterval);
    workers.forEach((w) => w.terminate());

    totalChecked = workerProgress.reduce((a, b) => a + b, 0n);
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = Number(totalChecked) / elapsed;

    console.log();
    console.log();
    console.log(chalk.bold.underline('📊 Final Statistics:'));
    console.log('  Total checked:', chalk.yellow(totalChecked.toLocaleString()));
    console.log('  Total time:   ', chalk.cyan(formatDuration(elapsed)));
    console.log('  Avg speed:    ', chalk.green((speed / 1e6).toFixed(2) + 'M UUIDs/sec'));
    if (!found) {
      console.log('  Result:       ', chalk.red('Not found (as expected!)'));
    }
    console.log();

    process.exit(0);
  }

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log();
    console.log(chalk.yellow('\n⚠️  Stopping benchmark...'));
    stopAll();
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return seconds.toFixed(1) + 's';
  if (seconds < 3600) return (seconds / 60).toFixed(1) + 'm';
  if (seconds < 86400) return (seconds / 3600).toFixed(1) + 'h';
  return (seconds / 86400).toFixed(1) + 'd';
}

// Run the benchmark
runBenchmark();
