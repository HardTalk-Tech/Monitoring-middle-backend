import { randomUUID } from 'crypto';
import {
  PARALLEL_QUEUES,
  JOB_TTL_SECONDS,
  buildSharedBody,
  splitKeywordsIntoQueues,
  enabledPlatforms,
} from '../config/scraping.js';
import { scrapeKeyword, markRemainingCancelled } from './scrapeUnit.js';

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

async function runQueues(job, shared) {
  console.log(
    `[batch] start job=${job.id} keywords=${job.total} queues=${job.batches.length}`
  );

  const maxSteps = Math.max(0, ...job.batches.map((batch) => batch.keywords.length));

  for (let step = 0; step < maxSteps; step += 1) {
    if (job.cancelled) {
      for (const batch of job.batches) {
        if (step < batch.keywords.length) {
          markRemainingCancelled(job, batch, step);
        }
      }
      break;
    }

    const parallelRequests = job.batches
      .filter((batch) => step < batch.keywords.length)
      .map((batch) => scrapeKeyword(job, batch, step, shared, 'batch'));

    await Promise.allSettled(parallelRequests);
  }

  if (job.status !== 'cancelled') {
    job.status = 'completed';
  }

  console.log(
    `[batch] done job=${job.id} status=${job.status} ok=${job.ok} error=${job.error}`
  );
}

/**
 * Start up to PARALLEL_QUEUES parallel Python requests via Promise.allSettled.
 * Returns immediately.
 */
export function startBatchSearch(keywords, options) {
  const jobId = randomUUID();
  const platforms = enabledPlatforms(options);
  const shared = buildSharedBody(options);
  const batches = splitKeywordsIntoQueues(keywords, PARALLEL_QUEUES);
  const abort = new AbortController();

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
    batches: batches.map((batch) => ({
      batchNumber: batch.batchNumber,
      indexId: batch.indexId,
      keywords: [...batch.keywords],
      results: [],
    })),
    abort,
    cancelled: false,
    expiryTimer: null,
  };

  jobs.set(jobId, job);
  scheduleExpiry(jobId);

  runQueues(job, shared).catch((err) => {
    console.error(`[batch] job=${jobId} crashed:`, err.message);
    if (job.status !== 'cancelled') job.status = 'error';
  });

  return {
    jobId,
    total: keywords.length,
    queueCount: batches.length,
    platforms,
    batches: batches.map((batch) => ({
      batchNumber: batch.batchNumber,
      indexId: batch.indexId,
      keywords: batch.keywords,
    })),
  };
}

export function getBatchSearch(jobId) {
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
    batches: job.batches.map((batch) => ({
      batchNumber: batch.batchNumber,
      indexId: batch.indexId,
      keywords: batch.keywords,
      results: batch.results,
    })),
  };
}

export function cancelBatchSearch(jobId) {
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

  console.log(`[batch] cancelled jobId=${jobId}`);
  return { jobId, status: 'cancelled' };
}
