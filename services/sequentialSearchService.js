import { randomUUID } from 'crypto';
import {
  JOB_TTL_SECONDS,
  buildSharedBody,
  enabledPlatforms,
} from '../config/scraping.js';
import { scrapeKeyword, markRemainingCancelled } from './scrapeUnit.js';
import { mapKeywordRun } from './scrapeMapper.js';
import { saveKeywordRun } from './firestoreSaveService.js';

const jobs = new Map();

function scheduleExpiry(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  if (job.expiryTimer) clearTimeout(job.expiryTimer);
  job.expiryTimer = setTimeout(() => {
    jobs.delete(jobId);
  }, JOB_TTL_SECONDS * 1000);
  job.expiryTimer.unref?.();
}

async function runSequentialQueue(job, shared) {
  const batch = job.batches[0];
  console.log(
    `[sequential] start job=${job.id} keywords=${job.total} queues=1`
  );

  for (let index = 0; index < batch.keywords.length; index += 1) {
    if (job.cancelled) {
      markRemainingCancelled(job, batch, index);
      break;
    }

    const startedAtFallback = new Date().toISOString();
    await scrapeKeyword(job, batch, index, shared, 'sequential');

    const result = batch.results[batch.results.length - 1];
    if (result?.status === 'ok') {
      try {
        const run = mapKeywordRun(result, { startedAtFallback });
        const outcome = await saveKeywordRun(run);
        console.log(
          `[sequential] job=${job.id} keyword=${result.keyword} firestore doc=${outcome.docId ?? 'none'} items=${outcome.saved ?? 0}${outcome.skipped ? ' skipped' : ''}`
        );
      } catch (err) {
        console.error(
          `[sequential] job=${job.id} keyword=${result.keyword} firestore save failed:`,
          err.message
        );
      }
    }
  }

  if (job.status !== 'cancelled') {
    job.status = 'completed';
  }

  console.log(
    `[sequential] done job=${job.id} status=${job.status} ok=${job.ok} error=${job.error}`
  );
}

/**
 * Enqueue all keywords into a single queue and process them one-by-one.
 * Returns immediately.
 */
export function startSequentialSearch(keywords, options) {
  const jobId = randomUUID();
  const platforms = enabledPlatforms(options);
  const shared = buildSharedBody(options);
  const abort = new AbortController();

  const batch = {
    batchNumber: 1,
    indexId: 'queue-1',
    keywords: [...keywords],
    results: [],
  };

  const job = {
    id: jobId,
    status: 'running',
    keywords,
    platforms,
    total: keywords.length,
    done: 0,
    ok: 0,
    error: 0,
    createdAt: new Date().toISOString(),
    batches: [batch],
    abort,
    cancelled: false,
    expiryTimer: null,
  };

  jobs.set(jobId, job);
  scheduleExpiry(jobId);

  runSequentialQueue(job, shared).catch((err) => {
    console.error(`[sequential] job=${jobId} crashed:`, err.message);
    if (job.status !== 'cancelled') job.status = 'error';
  });

  return {
    jobId,
    total: keywords.length,
    queueCount: 1,
    platforms,
    batches: [
      {
        batchNumber: batch.batchNumber,
        indexId: batch.indexId,
        keywords: batch.keywords,
      },
    ],
  };
}

export function getSequentialSearch(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;

  return {
    job_id: jobId,
    status: job.status,
    total: job.total,
    done: job.done,
    ok: job.ok,
    error: job.error,
    pending: Math.max(0, job.total - job.done),
    landed: job.done,
    queue_count: job.batches.length,
    batches: job.batches.map((b) => ({
      batchNumber: b.batchNumber,
      indexId: b.indexId,
      keywords: b.keywords,
      results: b.results,
    })),
  };
}

export function cancelSequentialSearch(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;

  if (job.status === 'cancelled' || job.status === 'completed') {
    return { jobId, status: job.status };
  }

  job.cancelled = true;
  job.status = 'cancelled';
  try {
    job.abort.abort();
  } catch {
    // ignore
  }

  console.log(`[sequential] cancelled jobId=${jobId}`);
  return { jobId, status: 'cancelled' };
}
