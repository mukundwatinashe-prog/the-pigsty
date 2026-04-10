import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import type { FeedType } from '@prisma/client';
import { drawPdfBrandHeader, drawPdfGridTable } from '../controllers/report.controller';
import { FEED_TYPES, type FeedUsageReportRange } from './feed.service';

function feedTypeLabel(t: FeedType): string {
  return t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function toFeedPurchaseExportRow(p: {
  purchasedAt: Date;
  feedType: FeedType;
  quantityKg: number;
  totalCost: number;
  supplier: string | null;
  loggedByName: string;
}): FeedPurchaseExportRow {
  return {
    purchasedAtIso: p.purchasedAt.toISOString(),
    feedTypeLabel: feedTypeLabel(p.feedType),
    quantityKg: p.quantityKg,
    totalCost: p.totalCost,
    supplier: p.supplier?.trim() || '—',
    loggedByName: p.loggedByName,
  };
}

function rangeTitle(range: FeedUsageReportRange): string {
  if (range === 'daily') return 'Daily';
  if (range === 'weekly') return 'Weekly (7 days)';
  return 'Monthly';
}

export type FeedPurchaseExportRow = {
  purchasedAtIso: string;
  feedTypeLabel: string;
  quantityKg: number;
  totalCost: number;
  supplier: string;
  loggedByName: string;
};

export type FeedUsageReportExportPayload = {
  farmName: string;
  logoUrl: string | null;
  currency: string;
  range: FeedUsageReportRange;
  start: string;
  end: string;
  series: { date: string; byType: Record<FeedType, number>; loggedByName: string }[];
  totalsKg: { feedType: FeedType; kg: number }[];
  purchases: FeedPurchaseExportRow[];
};

/** One logical table: usage rows + purchase rows share Date & Logged by; no repeated header blocks. */
function unifiedHeaders(currency: string): string[] {
  return [
    'Record',
    'Date',
    ...FEED_TYPES.map((t) => `${feedTypeLabel(t)} (kg)`),
    'Purchase feed',
    'Purchase qty (kg)',
    `Cost (${currency})`,
    'Supplier',
    'Logged by',
  ];
}

const COL_COUNT = 2 + FEED_TYPES.length + 5; // Record, Date, 6×kg, purchase feed, qty, cost, supplier, logged by

function emptyPdfRow(): string[] {
  return Array(COL_COUNT).fill('');
}

function usageToPdfRow(row: FeedUsageReportExportPayload['series'][0]): string[] {
  return [
    'Daily usage',
    row.date,
    ...FEED_TYPES.map((t) => String(row.byType[t] ?? 0)),
    '',
    '',
    '',
    '',
    row.loggedByName,
  ];
}

function purchaseToPdfRow(p: FeedPurchaseExportRow): string[] {
  return [
    'Purchase',
    p.purchasedAtIso.slice(0, 10),
    ...FEED_TYPES.map(() => ''),
    p.feedTypeLabel,
    p.quantityKg.toFixed(3),
    p.totalCost.toFixed(2),
    p.supplier,
    p.loggedByName,
  ];
}

function mergeUsageAndPurchases(
  series: FeedUsageReportExportPayload['series'],
  purchases: FeedPurchaseExportRow[],
): { kind: 'usage' | 'purchase'; date: string; idx: number }[] {
  const out: { kind: 'usage' | 'purchase'; date: string; idx: number }[] = [];
  series.forEach((u, i) => out.push({ kind: 'usage', date: u.date, idx: i }));
  purchases.forEach((p, i) => out.push({ kind: 'purchase', date: p.purchasedAtIso.slice(0, 10), idx: i }));
  out.sort((a, b) => {
    const c = a.date.localeCompare(b.date);
    if (c !== 0) return c;
    if (a.kind !== b.kind) return a.kind === 'usage' ? -1 : 1;
    return 0;
  });
  return out;
}

function summaryPdfRows(totalsKg: FeedUsageReportExportPayload['totalsKg'], purchases: FeedPurchaseExportRow[]): string[][] {
  const totalSpend = purchases.reduce((s, p) => s + p.totalCost, 0);
  const byType = Object.fromEntries(totalsKg.map((t) => [t.feedType, t.kg])) as Record<FeedType, number>;
  const usageTotalRow: string[] = [
    'Period total (usage kg)',
    '',
    ...FEED_TYPES.map((t) => byType[t]?.toFixed(3) ?? '0'),
    '',
    '',
    '',
    '',
    '',
  ];
  const purchSumRow: string[] = [
    `Period total (${purchases.length} purchase${purchases.length === 1 ? '' : 's'})`,
    '',
    ...FEED_TYPES.map(() => ''),
    '',
    '',
    totalSpend.toFixed(2),
    '',
    '',
  ];
  return [usageTotalRow, purchSumRow];
}

export async function buildFeedUsageReportPdf(payload: FeedUsageReportExportPayload): Promise<Buffer> {
  const { farmName, logoUrl, currency, range, start, end, series, totalsKg, purchases } = payload;
  const subtitle = `${rangeTitle(range)} · ${start.slice(0, 10)} – ${end.slice(0, 10)} · Generated: ${new Date().toLocaleDateString()}`;
  const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  drawPdfBrandHeader(doc, farmName, logoUrl, 'Feed report (usage & purchases)', subtitle);

  const headers = unifiedHeaders(currency);
  const wRecord = 68;
  const wDate = 62;
  const wKg = 44;
  const wPurchFeed = 72;
  const wPurchQty = 48;
  const wCost = 52;
  const wSupplier = 88;
  const wLogged = 78;
  const colWidths = [
    wRecord,
    wDate,
    ...FEED_TYPES.map(() => wKg),
    wPurchFeed,
    wPurchQty,
    wCost,
    wSupplier,
    wLogged,
  ];

  const order = mergeUsageAndPurchases(series, purchases);
  const bodyRows: string[][] = order.map((e) =>
    e.kind === 'usage' ? usageToPdfRow(series[e.idx]) : purchaseToPdfRow(purchases[e.idx]),
  );

  if (bodyRows.length === 0) {
    bodyRows.push([
      '—',
      '',
      ...FEED_TYPES.map(() => '0'),
      '',
      '',
      '',
      '',
      'No rows in period',
    ]);
  }

  const allRows = [...bodyRows, emptyPdfRow(), ...summaryPdfRows(totalsKg, purchases)];

  drawPdfGridTable(doc, {
    x: doc.page.margins.left,
    y: doc.y,
    colWidths,
    headers,
    rows: allRows,
    headerFontSize: 6,
    bodyFontSize: 5.5,
    headerRowHeight: 20,
    dataRowHeight: 14,
  });

  doc.end();
  return done;
}

export async function buildFeedUsageReportXlsx(payload: FeedUsageReportExportPayload): Promise<Buffer> {
  const { farmName, currency, range, start, end, series, totalsKg, purchases } = payload;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Feed report', { views: [{ state: 'frozen', ySplit: 6 }] });

  ws.getCell('A1').value = farmName;
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A2').value = `Feed report — daily usage & purchases — ${rangeTitle(range)}`;
  ws.getCell('A2').font = { size: 12 };
  ws.getCell('A3').value = `${start.slice(0, 10)} – ${end.slice(0, 10)}`;
  ws.getCell('A4').value = `Generated: ${new Date().toLocaleString()}`;
  ws.getCell('A5').value =
    'One table: each row is either daily usage (kg by type) or a purchase. Shared columns Date and Logged by. No duplicate headers.';

  const headers = unifiedHeaders(currency);
  let row = 6;
  ws.getRow(row).values = headers;
  ws.getRow(row).font = { bold: true };
  ws.getRow(row).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E8E8' },
  };
  row++;

  const order = mergeUsageAndPurchases(series, purchases);
  for (const e of order) {
    if (e.kind === 'usage') {
      const s = series[e.idx];
      ws.getRow(row).values = [
        'Daily usage',
        s.date,
        ...FEED_TYPES.map((t) => s.byType[t] ?? 0),
        '',
        '',
        '',
        '',
        s.loggedByName,
      ];
    } else {
      const p = purchases[e.idx];
      ws.getRow(row).values = [
        'Purchase',
        p.purchasedAtIso.slice(0, 10),
        ...FEED_TYPES.map(() => ''),
        p.feedTypeLabel,
        p.quantityKg,
        p.totalCost,
        p.supplier,
        p.loggedByName,
      ];
    }
    row++;
  }

  if (order.length === 0) {
    ws.getRow(row).values = [
      '—',
      '',
      ...FEED_TYPES.map(() => 0),
      '',
      '',
      '',
      '',
      'No usage or purchases in period',
    ];
    row++;
  }

  row++;
  const byType = Object.fromEntries(totalsKg.map((t) => [t.feedType, t.kg])) as Record<FeedType, number>;
  const totalSpend = purchases.reduce((s, p) => s + p.totalCost, 0);
  ws.getRow(row).values = [
    'Period total (usage kg)',
    '',
    ...FEED_TYPES.map((t) => byType[t] ?? 0),
    '',
    '',
    '',
    '',
    '',
  ];
  ws.getRow(row).font = { bold: true };
  row++;
  ws.getRow(row).values = [
    `Period total (${purchases.length} purchase${purchases.length === 1 ? '' : 's'})`,
    '',
    ...FEED_TYPES.map(() => ''),
    '',
    '',
    totalSpend,
    '',
    '',
  ];
  ws.getRow(row).font = { bold: true };

  const widths = [22, 12, ...FEED_TYPES.map(() => 11), 16, 14, 12, 24, 20];
  ws.columns = widths.map((width) => ({ width }));

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export type FeedPurchaseHistoryExportPayload = {
  farmName: string;
  logoUrl: string | null;
  currency: string;
  purchases: FeedPurchaseExportRow[];
};

export async function buildFeedPurchaseHistoryPdf(payload: FeedPurchaseHistoryExportPayload): Promise<Buffer> {
  const { farmName, logoUrl, currency, purchases } = payload;
  const subtitle = `All recorded purchases · Generated: ${new Date().toLocaleDateString()}`;
  const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  drawPdfBrandHeader(doc, farmName, logoUrl, `Feed purchase history (${currency})`, subtitle);

  const headers = unifiedHeaders(currency);
  const wRecord = 68;
  const wDate = 62;
  const wKg = 44;
  const wPurchFeed = 72;
  const wPurchQty = 48;
  const wCost = 52;
  const wSupplier = 88;
  const wLogged = 78;
  const colWidths = [
    wRecord,
    wDate,
    ...FEED_TYPES.map(() => wKg),
    wPurchFeed,
    wPurchQty,
    wCost,
    wSupplier,
    wLogged,
  ];

  const bodyRows =
    purchases.length > 0
      ? purchases.map(purchaseToPdfRow)
      : [
          [
            '—',
            '',
            ...FEED_TYPES.map(() => ''),
            '',
            '',
            '',
            '',
            'No purchases yet',
          ],
        ];

  const totalSpend = purchases.reduce((s, p) => s + p.totalCost, 0);
  const summaryRows: string[][] = [
    emptyPdfRow(),
    [
      `Total (${purchases.length} purchase${purchases.length === 1 ? '' : 's'})`,
      '',
      ...FEED_TYPES.map(() => ''),
      '',
      '',
      totalSpend.toFixed(2),
      '',
      '',
    ],
  ];

  drawPdfGridTable(doc, {
    x: doc.page.margins.left,
    y: doc.y,
    colWidths,
    headers,
    rows: [...bodyRows, ...summaryRows],
    headerFontSize: 6,
    bodyFontSize: 5.5,
    headerRowHeight: 20,
    dataRowHeight: 14,
  });

  doc.end();
  return done;
}

export async function buildFeedPurchaseHistoryXlsx(payload: FeedPurchaseHistoryExportPayload): Promise<Buffer> {
  const { farmName, currency, purchases } = payload;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Feed report', { views: [{ state: 'frozen', ySplit: 5 }] });

  ws.getCell('A1').value = farmName;
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A2').value = `Feed purchase history (${currency})`;
  ws.getCell('A2').font = { size: 12 };
  ws.getCell('A3').value = `Generated: ${new Date().toLocaleString()}`;
  ws.getCell('A4').value = 'Same column layout as the combined feed report; only purchase rows appear below.';

  const headers = unifiedHeaders(currency);
  let row = 5;
  ws.getRow(row).values = headers;
  ws.getRow(row).font = { bold: true };
  ws.getRow(row).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E8E8' },
  };
  row++;

  for (const p of purchases) {
    ws.getRow(row).values = [
      'Purchase',
      p.purchasedAtIso.slice(0, 10),
      ...FEED_TYPES.map(() => ''),
      p.feedTypeLabel,
      p.quantityKg,
      p.totalCost,
      p.supplier,
      p.loggedByName,
    ];
    row++;
  }

  if (purchases.length === 0) {
    ws.getRow(row).values = [
      '—',
      '',
      ...FEED_TYPES.map(() => ''),
      '',
      '',
      '',
      '',
      'No purchases yet',
    ];
    row++;
  }

  row++;
  const totalSpend = purchases.reduce((s, p) => s + p.totalCost, 0);
  ws.getRow(row).values = [
    `Total (${purchases.length} purchase${purchases.length === 1 ? '' : 's'})`,
    '',
    ...FEED_TYPES.map(() => ''),
    '',
    '',
    totalSpend,
    '',
    '',
  ];
  ws.getRow(row).font = { bold: true };

  const widths = [22, 12, ...FEED_TYPES.map(() => 11), 16, 14, 12, 24, 20];
  ws.columns = widths.map((width) => ({ width }));

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
