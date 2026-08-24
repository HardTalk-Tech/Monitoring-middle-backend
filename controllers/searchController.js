import {
  startBatchSearch,
  getBatchSearch as readBatchSearch,
  cancelBatchSearch as cancelBatchSearchJob,
} from '../services/batchSearchService.js';
import { parseBatchSearchRequest } from '../middleware/searchGuards.js';

/**
 * POST /batch-search — split keywords into PARALLEL_QUEUES queues, return job_id immediately.
 */
export async function startBatchSearchJob(req, res) {
  const parsed = parseBatchSearchRequest(req.body);
  if (parsed.error) {
    return res.status(400).json(parsed);
  }

  try {
    const started = startBatchSearch(parsed.keywords, parsed.options);
    return res.status(202).json({
      job_id: started.jobId,
      status: 'started',
      total: started.total,
      queue_count: started.queueCount,
      platforms: started.platforms,
      batches: started.batches,
    });
  } catch (err) {
    console.error('Failed to start batch search:', err);
    return res.status(500).json({
      error: 'Failed to start batch search',
      details: err.message,
    });
  }
}

/** GET /batch-search/:jobId — progress + grouped results. */
export async function getBatchSearch(req, res) {
  const jobId = req.params.jobId;
  if (!jobId) {
    return res.status(400).json({ error: 'jobId path parameter is required' });
  }

  try {
    const payload = readBatchSearch(jobId);
    if (!payload) {
      return res.status(404).json({ error: 'job not found', job_id: jobId });
    }
    return res.json(payload);
  } catch (err) {
    console.error('getBatchSearch failed:', err);
    return res.status(500).json({
      error: 'Failed to read batch search',
      details: err.message,
      job_id: jobId,
    });
  }
}

/** DELETE /batch-search/:jobId — stop remaining keywords in all queues. */
export async function cancelBatchSearch(req, res) {
  const jobId = req.params.jobId;
  if (!jobId) {
    return res.status(400).json({ error: 'jobId path parameter is required' });
  }

  try {
    const outcome = cancelBatchSearchJob(jobId);
    if (!outcome) {
      return res.status(404).json({ error: 'job not found', job_id: jobId });
    }
    return res.json(outcome);
  } catch (err) {
    console.error('cancelBatchSearch failed:', err);
    return res.status(500).json({
      error: 'Failed to cancel batch search',
      details: err.message,
      job_id: jobId,
    });
  }
}
