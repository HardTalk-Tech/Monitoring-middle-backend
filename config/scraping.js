/**
 * Shared scraping / job settings.
 * Keep PLATFORM_FLAGS in sync with Python AllScrapingRequest
 * (includes intentional wire typo "instargram").
 */

export const PLATFORM_FLAGS = [
  'x',
  'tiktok',
  'youtube',
  'newssites',
  'facebook',
  'instargram', // matches Python AllScrapingRequest.instargram
  'linkedin',
  'reddit',
];

export const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || 'http://169.58.172.179';

export const ALL_SCRAPING_PATH = '/all_scraping';

/** Max parallel queues / in-flight Python requests. Change via PARALLEL_QUEUES in .env. */
export const PARALLEL_QUEUES = Number(process.env.PARALLEL_QUEUES) || 5;

export const MAX_KEYWORDS = Number(process.env.MAX_KEYWORDS) || 160;

export const MAX_KEYWORD_LENGTH = Number(process.env.MAX_KEYWORD_LENGTH) || 200;

/** Per-keyword HTTP timeout to Python. */
export const UNIT_HTTP_TIMEOUT_MS =
  Number(process.env.UNIT_HTTP_TIMEOUT_MS) || 600_000;

/** In-memory job records expire after this many seconds (default 24h). */
export const JOB_TTL_SECONDS = Number(process.env.JOB_TTL_SECONDS) || 86400;

export const UNIT_JOB_ATTEMPTS = Number(process.env.UNIT_JOB_ATTEMPTS) || 3;

export const UNIT_JOB_BACKOFF_MS = Number(process.env.UNIT_JOB_BACKOFF_MS) || 5000;

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';
export const DEFAULT_FALLBACK_GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Platforms the client enabled (boolean true). If none are set, all PLATFORM_FLAGS
 * are treated as enabled so a bare { keywords } request still scrapes everything.
 */
export function enabledPlatforms(options = {}) {
  const on = PLATFORM_FLAGS.filter((p) => options[p] === true);
  return on.length > 0 ? on : [...PLATFORM_FLAGS];
}

/** Shared Python payload fields (platforms + options) without keywords. */
export function buildSharedBody(options = {}) {
  const platforms = enabledPlatforms(options);
  const days_back = options.days_back ?? 30;
  const sri_lanka_only = options.sri_lanka_only ?? true;
  const enable_filter = options.enable_filter ?? false;
  const summarize_content = options.summarize_content ?? false;
  const gemini_model = options.gemini_model ?? DEFAULT_GEMINI_MODEL;
  const fallback_gemini_model =
    options.fallback_gemini_model ?? DEFAULT_FALLBACK_GEMINI_MODEL;

  const platformFlags = {};
  for (const flag of PLATFORM_FLAGS) {
    platformFlags[flag] = platforms.includes(flag);
  }

  return {
    platforms,
    days_back,
    sri_lanka_only,
    enable_filter,
    summarize_content,
    gemini_model,
    fallback_gemini_model,
    platformFlags,
  };
}

/**
 * Split keywords across up to `maxQueues` queues (round-robin).
 * Example with PARALLEL_QUEUES=5 and 11 keywords → 5 queues.
 * Fewer keywords than maxQueues → one queue per keyword.
 */
export function splitKeywordsIntoQueues(keywords, maxQueues = PARALLEL_QUEUES) {
  const queueCount = Math.min(keywords.length, Math.max(1, maxQueues));
  const batches = Array.from({ length: queueCount }, (_, i) => ({
    batchNumber: i + 1,
    indexId: `batch-${i + 1}`,
    keywords: [],
  }));

  keywords.forEach((keyword, i) => {
    batches[i % queueCount].keywords.push(keyword);
  });

  return batches;
}
