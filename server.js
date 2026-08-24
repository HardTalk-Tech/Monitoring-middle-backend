import 'dotenv/config';
import express from 'express';
import searchRoutes from './routes/searchRoutes.js';
import { PARALLEL_QUEUES } from './config/scraping.js';

const app = express();
app.use(express.json());

app.use('/', searchRoutes);

app.listen(3001, () => {
  console.log('Test backend running on http://localhost:3001');
  console.log(`PARALLEL_QUEUES=${PARALLEL_QUEUES}`);
});
