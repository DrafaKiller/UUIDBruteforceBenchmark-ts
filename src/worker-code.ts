// This file exports the worker code as a string for use in compiled executables
// The actual worker logic is in worker.ts for development (with syntax highlighting)

import workerSource from './worker.ts' with { type: 'text' };

export function createWorker(): Worker {
  const blob = new Blob([workerSource], { type: 'application/typescript' });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);
  return worker;
}
