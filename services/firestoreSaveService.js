import { collection, doc, setDoc } from 'firebase/firestore';
import { Timestamp, firestoreCollectionName, getFirestore } from './firebase.js';

function toTimestamp(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return Timestamp.fromDate(date);
}

/** Firestore-safe keyword segment for the document id. */
function sanitizeKeyword(keyword) {
  return String(keyword || 'unknown')
    .trim()
    .replace(/[\/\\\s]+/g, '-')
    .replace(/[^\p{L}\p{N}._-]+/gu, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200) || 'unknown';
}

/** ISO -> YYYY-MM-DD_HH-mm-ss in UTC. Falls back to current time. */
function formatStamp(iso) {
  const date = iso ? new Date(iso) : new Date();
  const valid = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${valid.getUTCFullYear()}-${pad(valid.getUTCMonth() + 1)}-${pad(valid.getUTCDate())}` +
    `_${pad(valid.getUTCHours())}-${pad(valid.getUTCMinutes())}-${pad(valid.getUTCSeconds())}`
  );
}

function toFirestoreItem(item) {
  return {
    platform: item.platform,
    url: item.url,
    contentDate: toTimestamp(item.contentDate),
    language: item.language,
    publication: item.publication,
    title: item.title,
  };
}

/**
 * Save one keyword run as a single document keyed keyword_YYYY-MM-DD_HH-mm-ss.
 * Failures are logged by the caller; scraping is never blocked.
 */
export async function saveKeywordRun(run) {
  if (!run || !Array.isArray(run.items) || run.items.length === 0) {
    return { saved: 0 };
  }

  const db = getFirestore();
  if (!db) return { saved: 0, skipped: true };

  const docId = `${sanitizeKeyword(run.keyword)}_${formatStamp(run.runStartDateTime)}`;
  const body = {
    keyword: run.keyword,
    runStartDateTime: toTimestamp(run.runStartDateTime),
    runEndDateTime: toTimestamp(run.runEndDateTime),
    count: run.items.length,
    items: run.items.map(toFirestoreItem),
  };

  const ref = doc(collection(db, firestoreCollectionName()), docId);
  await setDoc(ref, body);

  return { saved: run.items.length, docId };
}
