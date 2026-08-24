/**
 * Request validation for scrape-triggering routes.
 */

import {
  PLATFORM_FLAGS,
  MAX_KEYWORDS,
  MAX_KEYWORD_LENGTH,
} from '../config/scraping.js';

/**
 * Normalize + validate batch search body (flat keywords).
 * Contract: { keywords: [...], x?, tiktok?, ..., days_back?, summarize_content?,
 * gemini_model?, fallback_gemini_model? }
 */
export function parseBatchSearchRequest(body = {}) {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body must be a JSON object' };
  }

  const { keywords: rawKeywords, batches: _ignoredBatches, ...rest } = body;

  if (!Array.isArray(rawKeywords) || rawKeywords.length === 0) {
    return { error: 'keywords must be a non-empty array' };
  }

  if (rawKeywords.length > MAX_KEYWORDS) {
    return {
      error: `keywords exceeds max of ${MAX_KEYWORDS}`,
      max_keywords: MAX_KEYWORDS,
    };
  }

  const seen = new Set();
  const keywords = [];
  for (const item of rawKeywords) {
    if (typeof item !== 'string') {
      return { error: 'each keyword must be a string' };
    }
    const keyword = item.trim();
    if (!keyword) {
      return { error: 'keywords must not contain empty strings' };
    }
    if (keyword.length > MAX_KEYWORD_LENGTH) {
      return {
        error: `keyword exceeds max length of ${MAX_KEYWORD_LENGTH}`,
        keyword,
      };
    }
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
  }

  if (keywords.length === 0) {
    return { error: 'keywords must be a non-empty array after deduplication' };
  }

  for (const platform of PLATFORM_FLAGS) {
    if (platform in rest && typeof rest[platform] !== 'boolean') {
      return {
        error: `${platform} must be a boolean (true/false), got ${typeof rest[platform]}`,
      };
    }
  }

  for (const field of ['sri_lanka_only', 'enable_filter', 'summarize_content']) {
    if (field in rest && typeof rest[field] !== 'boolean') {
      return {
        error: `${field} must be a boolean (true/false), got ${typeof rest[field]}`,
      };
    }
  }

  if ('days_back' in rest) {
    const n = rest.days_back;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
      return { error: 'days_back must be an integer >= 1' };
    }
  }

  for (const field of ['gemini_model', 'fallback_gemini_model']) {
    if (field in rest) {
      if (typeof rest[field] !== 'string' || !rest[field].trim()) {
        return { error: `${field} must be a non-empty string` };
      }
      rest[field] = rest[field].trim();
    }
  }

  return { keywords, options: { ...rest } };
}
