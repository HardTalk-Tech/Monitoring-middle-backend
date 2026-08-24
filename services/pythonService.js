import axios from 'axios';
import {
  PYTHON_SERVICE_URL,
  ALL_SCRAPING_PATH,
  UNIT_HTTP_TIMEOUT_MS,
} from '../config/scraping.js';

function scrapingUrl() {
  const base = String(PYTHON_SERVICE_URL || '').replace(/\/$/, '');
  if (base.endsWith(ALL_SCRAPING_PATH)) return base;
  return `${base}${ALL_SCRAPING_PATH}`;
}

export async function searchKeywords(payload, { timeout, signal } = {}) {
  const response = await axios.post(scrapingUrl(), payload, {
    timeout: timeout ?? UNIT_HTTP_TIMEOUT_MS,
    signal,
  });
  return response.data;
}
