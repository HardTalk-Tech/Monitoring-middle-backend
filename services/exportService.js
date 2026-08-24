import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import {
  Timestamp,
  firestoreCollectionName,
  getFirestore,
} from './firebase.js';

const COLOMBO_OFFSET_MINUTES = 5 * 60 + 30;

function parseDateParts(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function colomboDayRange(dateStr) {
  const parts = parseDateParts(dateStr);
  if (!parts) return null;

  const startUtcMs =
    Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0) -
    COLOMBO_OFFSET_MINUTES * 60 * 1000;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;

  return {
    start: Timestamp.fromDate(new Date(startUtcMs)),
    end: Timestamp.fromDate(new Date(endUtcMs)),
  };
}

const LOOKBACK_MS = 24 * 60 * 60 * 1000;
const DOC_STAMP_RE = /(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/;

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Parse trailing YYYY-MM-DD_HH-mm-ss from a document id as UTC. */
function parseSavedAtFromDocId(docId) {
  const match = DOC_STAMP_RE.exec(String(docId || ''));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const savedAt = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return Number.isNaN(savedAt.getTime()) ? null : savedAt;
}

function isWithinLookback(contentDate, savedAt) {
  if (!contentDate || !savedAt) return false;
  const startMs = savedAt.getTime() - LOOKBACK_MS;
  const contentMs = contentDate.getTime();
  return contentMs >= startMs && contentMs <= savedAt.getTime();
}

function flattenRun(docData, docId) {
  const items = Array.isArray(docData?.items) ? docData.items : [];
  const runStartDateTime = asDate(docData?.runStartDateTime);
  const runEndDateTime = asDate(docData?.runEndDateTime);
  const savedAt = parseSavedAtFromDocId(docId) || runStartDateTime;

  return items
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      runStartDateTime,
      keyword: typeof docData?.keyword === 'string' ? docData.keyword : '',
      platform: typeof item.platform === 'string' ? item.platform : '',
      url: typeof item.url === 'string' ? item.url : '',
      contentDate: asDate(item.contentDate),
      language: typeof item.language === 'string' ? item.language : '',
      publication: typeof item.publication === 'string' ? item.publication : '',
      runEndDateTime,
    }))
    .filter((row) => isWithinLookback(row.contentDate, savedAt));
}

export function isValidExportDate(dateStr) {
  return Boolean(parseDateParts(dateStr));
}

export async function fetchRowsForDay(dateStr) {
  const range = colomboDayRange(dateStr);
  if (!range) {
    throw new Error('Invalid export date');
  }

  const db = getFirestore();
  if (!db) return [];

  const colRef = collection(db, firestoreCollectionName());
  const snapshot = await getDocs(
    query(
      colRef,
      where('runStartDateTime', '>=', range.start),
      where('runStartDateTime', '<', range.end),
      orderBy('runStartDateTime', 'asc')
    )
  );

  const rows = [];
  for (const docSnap of snapshot.docs) {
    rows.push(...flattenRun(docSnap.data(), docSnap.id));
  }

  return rows;
}
