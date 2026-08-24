function asIso(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function extractRunStart(pythonData) {
  const platforms = pythonData?.data?.platform_results;
  if (!platforms || typeof platforms !== 'object') return null;

  let earliest = null;
  for (const platform of Object.values(platforms)) {
    const startedAt = platform?.response?.data?.summary?.runtime?.started_at;
    const iso = asIso(startedAt);
    if (!iso) continue;
    const ms = Date.parse(iso);
    if (earliest == null || ms < earliest) earliest = ms;
  }

  return earliest == null ? null : new Date(earliest).toISOString();
}

function matchedItemsByPlatform(pythonData) {
  const grouped = pythonData?.data?.matched_items_by_platform;
  if (!grouped || typeof grouped !== 'object') return {};
  return grouped;
}

/**
 * Group one keyword scrape result into a single per-run object:
 * { keyword, runStartDateTime, runEndDateTime, items[] }.
 * Returns null when the result is not ok or has no matched links.
 * @param {object} result — batches[].results[] entry
 * @param {{ startedAtFallback?: string }} extras
 */
export function mapKeywordRun(result, extras = {}) {
  if (!result || result.status !== 'ok') return null;

  const pythonData = result.data;
  const runStartDateTime =
    extractRunStart(pythonData) || asIso(extras.startedAtFallback);
  const runEndDateTime = asIso(result.finishedAt);
  const fallbackKeyword = result.keyword;

  const items = [];
  const grouped = matchedItemsByPlatform(pythonData);
  let keyword = String(fallbackKeyword || '').trim();

  for (const [platformKey, list] of Object.entries(grouped)) {
    if (!Array.isArray(list)) continue;

    for (const item of list) {
      const url = typeof item?.url === 'string' ? item.url.trim() : '';
      if (!url) continue;

      const keywordFromItem = Array.isArray(item.keyword)
        ? item.keyword.find((k) => typeof k === 'string' && k.trim())
        : item.keyword;
      const itemKeyword = String(keywordFromItem || fallbackKeyword || '').trim();
      if (itemKeyword && !keyword) keyword = itemKeyword;

      items.push({
        platform: String(item.platform || platformKey || ''),
        url,
        contentDate: asIso(item.date),
        language: typeof item.language === 'string' ? item.language : '',
        publication: typeof item.publication === 'string' ? item.publication : '',
        title: typeof item.title === 'string' ? item.title : '',
      });
    }
  }

  if (!keyword || items.length === 0) return null;

  return {
    keyword,
    runStartDateTime,
    runEndDateTime,
    items,
  };
}
