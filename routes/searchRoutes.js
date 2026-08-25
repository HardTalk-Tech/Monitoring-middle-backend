import { Router } from 'express';
import {
  startBatchSearchJob,
  getBatchSearch,
  cancelBatchSearch,
} from '../controllers/searchController.js';
import {
  startSequentialSearchJob,
  getSequentialSearch,
  cancelSequentialSearch,
} from '../controllers/sequentialSearchController.js';
import { exportToExcel } from '../controllers/exportController.js';

const router = Router();

router.get(['/health', '/'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.post('/batch-search', startBatchSearchJob);
router.get('/batch-search/:jobId', getBatchSearch);
router.delete('/batch-search/:jobId', cancelBatchSearch);

router.post('/sequential-search', startSequentialSearchJob);
router.get('/sequential-search/:jobId', getSequentialSearch);
router.delete('/sequential-search/:jobId', cancelSequentialSearch);
router.get('/export/excel', exportToExcel);

export default router;
