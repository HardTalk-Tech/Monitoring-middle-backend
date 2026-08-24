import {
  startSequentialSearch,
  getSequentialSearch as readSequentialSearch,
  cancelSequentialSearch as cancelSequentialSearchJob,
} from '../services/sequentialSearchService.js';
import { parseBatchSearchRequest } from '../middleware/searchGuards.js';

/**
 * POST /sequential-search — one queue, one keyword at a time, return job_id immediately.
 */
export async function startSequentialSearchJob(req, res) {
  const parsed = parseBatchSearchRequest(req.body);
  if (parsed.error) {
    return res.status(400).json(parsed);
  }

  try {
    const started = startSequentialSearch(parsed.keywords, parsed.options);
    return res.status(202).json({
      job_id: started.jobId,
      status: 'started',
      total: started.total,
      queue_count: started.queueCount,
      platforms: started.platforms,
      batches: started.batches,
    });
  } catch (err) {
    console.error('Failed to start sequential search:', err);
    return res.status(500).json({
      error: 'Failed to start sequential search',
      details: err.message,
    });
  }
}

/** GET /sequential-search/:jobId — progress + grouped results. */
export async function getSequentialSearch(req, res) {
  const jobId = req.params.jobId;
  if (!jobId) {
    return res.status(400).json({ error: 'jobId path parameter is required' });
  }

  try {
    const payload = readSequentialSearch(jobId);
    if (!payload) {
      return res.status(404).json({ error: 'job not found', job_id: jobId });
    }
    return res.json(payload);
  } catch (err) {
    console.error('getSequentialSearch failed:', err);
    return res.status(500).json({
      error: 'Failed to read sequential search',
      details: err.message,
      job_id: jobId,
    });
  }
}

/** DELETE /sequential-search/:jobId — stop remaining keywords in the queue. */
export async function cancelSequentialSearch(req, res) {
  const jobId = req.params.jobId;
  if (!jobId) {
    return res.status(400).json({ error: 'jobId path parameter is required' });
  }

  try {
    const outcome = cancelSequentialSearchJob(jobId);
    if (!outcome) {
      return res.status(404).json({ error: 'job not found', job_id: jobId });
    }
    return res.json(outcome);
  } catch (err) {
    console.error('cancelSequentialSearch failed:', err);
    return res.status(500).json({
      error: 'Failed to cancel sequential search',
      details: err.message,
      job_id: jobId,
    });
  }
}
