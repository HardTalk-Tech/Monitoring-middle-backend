import {
  UNIT_HTTP_TIMEOUT_MS,
  UNIT_JOB_ATTEMPTS,
  UNIT_JOB_BACKOFF_MS,
} from '../config/scraping.js';
import { searchKeywords } from './pythonService.js';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isAbortError(err) {
  return (
    err?.name === 'CanceledError' ||
    err?.name === 'AbortError' ||
    err?.code === 'ERR_CANCELED' ||
    err?.code === 'ABORT_ERR'
  );
}

export function pythonBody(keyword, shared) {
  return {
    keywords: [keyword],
    x: shared.platformFlags.x,
    tiktok: shared.platformFlags.tiktok,
    youtube: shared.platformFlags.youtube,
    newssites: shared.platformFlags.newssites,
    facebook: shared.platformFlags.facebook,
    instargram: shared.platformFlags.instargram,
    linkedin: shared.platformFlags.linkedin,
    reddit: shared.platformFlags.reddit,
    days_back: shared.days_back,
    sri_lanka_only: shared.sri_lanka_only,
    enable_filter: shared.enable_filter,
    summarize_content: shared.summarize_content,
    gemini_model: shared.gemini_model,
    fallback_gemini_model: shared.fallback_gemini_model,
  };
}

export function recordResult(job, batch, entry) {
  batch.results.push({
    ...entry,
    finishedAt: new Date().toISOString(),
  });
  job.done += 1;
  if (entry.status === 'ok') job.ok += 1;
  else job.error += 1;
}

export function markRemainingCancelled(job, batch, fromIndex) {
  for (let i = fromIndex; i < batch.keywords.length; i += 1) {
    recordResult(job, batch, {
      id: `b${batch.batchNumber - 1}-k${i}`,
      keyword: batch.keywords[i],
      status: 'error',
      data: { error: true, message: 'cancelled' },
    });
  }
}

export async function scrapeKeyword(job, batch, index, shared, logPrefix = 'batch') {
  const keyword = batch.keywords[index];
  const unitId = `b${batch.batchNumber - 1}-k${index}`;
  let lastErr = null;

  for (let attempt = 1; attempt <= UNIT_JOB_ATTEMPTS; attempt += 1) {
    if (job.cancelled) {
      recordResult(job, batch, {
        id: unitId,
        keyword,
        status: 'error',
        data: { error: true, message: 'cancelled' },
      });
      return;
    }

    try {
      const data = await searchKeywords(pythonBody(keyword, shared), {
        timeout: UNIT_HTTP_TIMEOUT_MS,
        signal: job.abort.signal,
      });
      recordResult(job, batch, {
        id: unitId,
        keyword,
        status: 'ok',
        data,
      });
      console.log(
        `[${logPrefix}] job=${job.id} ${unitId} keyword=${keyword} ok attempt=${attempt}`
      );
      return;
    } catch (err) {
      if (job.cancelled || isAbortError(err)) {
        recordResult(job, batch, {
          id: unitId,
          keyword,
          status: 'error',
          data: { error: true, message: 'cancelled' },
        });
        return;
      }

      lastErr = err;
      console.warn(
        `[${logPrefix}] job=${job.id} ${unitId} keyword=${keyword} fail attempt=${attempt}/${UNIT_JOB_ATTEMPTS}: ${err.message}`
      );
      if (attempt < UNIT_JOB_ATTEMPTS) {
        await sleep(UNIT_JOB_BACKOFF_MS * attempt);
      }
    }
  }

  recordResult(job, batch, {
    id: unitId,
    keyword,
    status: 'error',
    data: {
      error: true,
      message: lastErr?.response?.data || lastErr?.message || 'unknown error',
    },
  });
}
