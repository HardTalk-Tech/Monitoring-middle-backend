import ExcelJS from 'exceljs';
import { fetchRowsForDay, isValidExportDate } from '../services/exportService.js';

const COLUMNS = [
  { header: 'runStartDateTime', key: 'runStartDateTime', width: 24 },
  { header: 'keyword', key: 'keyword', width: 24 },
  { header: 'platform', key: 'platform', width: 18 },
  { header: 'url', key: 'url', width: 60 },
  { header: 'contentDate', key: 'contentDate', width: 24 },
  { header: 'language', key: 'language', width: 14 },
  { header: 'publication', key: 'publication', width: 28 },
  { header: 'runEndDateTime', key: 'runEndDateTime', width: 24 },
];

function applyDateFormatting(worksheet) {
  for (const key of ['runStartDateTime', 'contentDate', 'runEndDateTime']) {
    worksheet.getColumn(key).numFmt = 'yyyy-mm-dd hh:mm:ss';
  }
}

function addRows(worksheet, rows) {
  for (const row of rows) {
    worksheet.addRow({
      ...row,
      runStartDateTime: row.runStartDateTime || null,
      contentDate: row.contentDate || null,
      runEndDateTime: row.runEndDateTime || null,
    });
  }
}

export async function exportToExcel(req, res) {
  const date = typeof req.query.date === 'string' ? req.query.date.trim() : '';
  if (!isValidExportDate(date)) {
    return res.status(400).json({
      error: 'date query parameter is required in YYYY-MM-DD format',
    });
  }

  try {
    const rows = await fetchRowsForDay(date);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'nodebackend';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Monitoring outputs');
    sheet.columns = COLUMNS;
    sheet.getRow(1).font = { bold: true };
    addRows(sheet, rows);
    applyDateFormatting(sheet);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="monitoring_${date}.xlsx"`
    );

    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    console.error('Failed to export Excel:', err);
    return res.status(500).json({
      error: 'Failed to export Excel',
      details: err.message,
    });
  }
}
