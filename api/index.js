import 'dotenv/config';
import express from 'express';
import searchRoutes from '../routes/searchRoutes.js';

const app = express();
app.use(express.json());

app.use('/', searchRoutes);

export default app;
