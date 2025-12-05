import * as UUID from 'uuid';

// Optimized: Larger batches reduce message overhead significantly
// 100K provides good balance between throughput and responsiveness
const BATCH_SIZE = 100_000;

declare const self: Worker;

interface WorkerMessage {
  targetPublic: string;
  workerId: number;
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { targetPublic, workerId } = event.data;

  let checked = 0n;
  let batchCount = 0;

  const checkBatch = () => {
    for (let i = 0; i < BATCH_SIZE; i++) {
      const candidate = UUID.v4();
      const publicFromCandidate = UUID.v5(candidate, candidate);

      checked++;

      if (publicFromCandidate === targetPublic) {
        self.postMessage({ type: 'found', workerId, private: candidate, checked: checked.toString() });
        return;
      }
    }

    batchCount++;

    self.postMessage({ type: 'progress', workerId, checked: checked.toString() });

    // Continue if not stopped - setImmediate pattern for better throughput
    setTimeout(checkBatch, 0);
  };

  checkBatch();
};
