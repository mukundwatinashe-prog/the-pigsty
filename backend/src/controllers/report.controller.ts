import { Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import prisma from '../config/database';
import { FarmRequest } from '../middleware/rbac.middleware';
import { AppError } from '../middleware/error.middleware';
import {
  fetchFinancialsSummary,
  formatFinancialsPeriodLabel,
  parseFinancialsDateQuery,
  type FinancialsSummaryResult,
} from '../services/financials-summary.service';

function imageExtFromDataUrl(dataUrl?: string | null): 'png' | 'jpeg' | null {
  if (!dataUrl) return null;
  const m = dataUrl.match(/^data:image\/(png|jpe?g|webp);base64,/i);
  if (!m) return null;
  return m[1].toLowerCase() === 'png' ? 'png' : 'jpeg';
}

function base64BufferFromDataUrl(dataUrl?: string | null): Buffer | null {
  if (!dataUrl) return null;
  const m = dataUrl.match(/^data:image\/(?:png|jpe?g|webp);base64,(.+)$/i);
  if (!m) return null;
  try {
    return Buffer.from(m[1], 'base64');
  } catch {
    return null;
  }
}

function drawPdfBrandHeader(doc: PDFKit.PDFDocument, farmName: string, logoUrl: string | null | undefined, title: string, subtitle?: string) {
  const topY = doc.y;
  const logo = base64BufferFromDataUrl(logoUrl);
  if (logo) {
    try {
      doc.image(logo, 40, topY, { fit: [52, 52] });
    } catch {
      // ignore bad image data; still render report text
    }
  }
  const textX = logo ? 100 : 40;
  doc.fontSize(16).font('Helvetica-Bold').text(farmName, textX, topY);
  doc.fontSize(13).font('Helvetica').text(title, textX, topY + 20);
  if (subtitle) {
    doc.fontSize(9).fillColor('#666').text(subtitle, textX, topY + 38).fillColor('#000');
  }
  doc.moveDown(3);
}

const PDF_TABLE_LINE = '#333333';
const PDF_TABLE_HEADER_FILL = '#e8e8e8';

/**
 * Grid table with vertical/horizontal rules and a shaded header row.
 * Repeats column titles after each page break.
 */
function drawPdfGridTable(
  doc: PDFKit.PDFDocument,
  params: {
    x: number;
    y: number;
    colWidths: number[];
    headers: string[];
    rows: string[][];
    headerRowHeight?: number;
    dataRowHeight?: number;
    headerFontSize?: number;
    bodyFontSize?: number;
  },
): number {
  const {
    colWidths,
    headers,
    rows,
    headerRowHeight = 22,
    dataRowHeight = 16,
    headerFontSize = 8,
    bodyFontSize = 7,
  } = params;
  let y = params.y;
  const x0 = params.x;
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const xRight = x0 + totalW;
  const m = doc.page.margins;
  const pageBottom = doc.page.height - m.bottom - 12;
  const marginTop = m.top;

  const colLeft = (i: number) => x0 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);

  const strokeV = (xLine: number, yTop: number, yBot: number) => {
    doc.save();
    doc.lineWidth(0.65).strokeColor(PDF_TABLE_LINE);
    doc.moveTo(xLine, yTop).lineTo(xLine, yBot).stroke();
    doc.restore();
  };

  const strokeH = (yLine: number) => {
    doc.save();
    doc.lineWidth(0.65).strokeColor(PDF_TABLE_LINE);
    doc.moveTo(x0, yLine).lineTo(xRight, yLine).stroke();
    doc.restore();
  };

  const drawColumnHeaderRow = (atY: number): number => {
    const yTop = atY;
    const yBot = atY + headerRowHeight;
    doc.save();
    doc.fillColor(PDF_TABLE_HEADER_FILL).rect(x0, yTop, totalW, headerRowHeight).fill();
    doc.restore();
    strokeH(yTop);
    for (let i = 0; i <= colWidths.length; i++) {
      strokeV(colLeft(i), yTop, yBot);
    }
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(headerFontSize);
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], colLeft(i) + 4, yTop + 6, {
        width: colWidths[i] - 8,
        lineGap: 0,
      });
    }
    strokeH(yBot);
    return yBot;
  };

  y = drawColumnHeaderRow(y);

  for (const row of rows) {
    if (y + dataRowHeight > pageBottom) {
      doc.addPage();
      y = marginTop;
      y = drawColumnHeaderRow(y);
    }
    const yTop = y;
    const yBot = y + dataRowHeight;
    for (let i = 0; i <= colWidths.length; i++) {
      strokeV(colLeft(i), yTop, yBot);
    }
    doc.font('Helvetica').fontSize(bodyFontSize).fillColor('#000000');
    for (let i = 0; i < colWidths.length; i++) {
      doc.text(String(row[i] ?? ''), colLeft(i) + 4, yTop + 4, {
        width: colWidths[i] - 8,
        lineGap: 0,
        ellipsis: true,
      });
    }
    strokeH(yBot);
    y = yBot;
  }

  return y;
}

async function buildBrandedWorkbook(params: {
  farmName: string;
  logoUrl?: string | null;
  sheetName: string;
  reportTitle: string;
  rows: Record<string, unknown>[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(params.sheetName);
  const logoExt = imageExtFromDataUrl(params.logoUrl);
  let currentRow = 1;

  if (logoExt && params.logoUrl) {
    try {
      const imageId = wb.addImage({ base64: params.logoUrl, extension: logoExt });
      ws.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 72, height: 72 } });
    } catch {
      // ignore bad image data
    }
  }

  ws.getCell('C1').value = params.farmName;
  ws.getCell('C1').font = { bold: true, size: 14 };
  ws.getCell('C2').value = params.reportTitle;
  ws.getCell('C2').font = { size: 12 };
  ws.getCell('C3').value = `Generated: ${new Date().toLocaleDateString()}`;
  ws.getCell('C3').font = { italic: true, size: 10 };
  currentRow = 5;

  const headers = Object.keys(params.rows[0] || {});
  if (headers.length > 0) {
    ws.getRow(currentRow).values = headers;
    ws.getRow(currentRow).font = { bold: true };
    ws.getRow(currentRow).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEDEDED' },
    };
    currentRow++;

    for (const row of params.rows) {
      ws.getRow(currentRow).values = headers.map((h) => row[h] as any);
      currentRow++;
    }
    ws.columns = headers.map((h) => ({ key: h, width: Math.max(14, Math.min(32, h.length + 6)) }));
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function financialStageLabel(stage: string): string {
  return stage.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function applyFinancialsGridHeaderRow(row: ExcelJS.Row): void {
  row.font = { bold: true };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E8E8' },
  };
  row.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF666666' } },
      bottom: { style: 'thin', color: { argb: 'FF666666' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  });
}

function applyFinancialsBodyRowBorders(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.border = {
      bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } },
      right: { style: 'hair', color: { argb: 'FFEEEEEE' } },
    };
  });
}

function addFinancialsSheetTitleBlock(ws: ExcelJS.Worksheet, farmName: string, title: string, startRow: number): number {
  let r = startRow;
  ws.getCell(`A${r}`).value = farmName;
  ws.getCell(`A${r}`).font = { bold: true, size: 14 };
  r++;
  ws.getCell(`A${r}`).value = title;
  ws.getCell(`A${r}`).font = { size: 12 };
  r++;
  ws.getCell(`A${r}`).value = `Generated: ${new Date().toLocaleString()}`;
  ws.getCell(`A${r}`).font = { italic: true, size: 10 };
  return r + 2;
}

async function buildFinancialsXlsx(data: FinancialsSummaryResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const { farm, herd, breakdownByStage, breakdownByPen, period, salesInPeriod, recentSales } = data;
  const cur = farm.currency;
  const wu = farm.weightUnit;
  const logoExt = imageExtFromDataUrl(farm.logoUrl);

  const ws0 = wb.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 6 }] });
  if (logoExt && farm.logoUrl) {
    try {
      const imageId = wb.addImage({ base64: farm.logoUrl, extension: logoExt });
      ws0.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 72, height: 72 } });
    } catch {
      // ignore bad image data
    }
  }
  ws0.getCell('C1').value = farm.name;
  ws0.getCell('C1').font = { bold: true, size: 14 };
  ws0.getCell('C2').value = 'Financials report';
  ws0.getCell('C2').font = { size: 12 };
  ws0.getCell('C3').value = `Generated: ${new Date().toLocaleString()}`;
  ws0.getCell('C4').value = `Reference price: ${farm.pricePerKg} per ${wu} (${cur})`;

  let row = 6;
  ws0.getRow(row).values = ['Metric', `Value (${cur} / ${wu} as noted)`];
  applyFinancialsGridHeaderRow(ws0.getRow(row));
  row++;
  const summaryRows: [string, string][] = [
    ['Estimated herd value (inventory)', herd.estimatedValueAtFarmPrice.toFixed(2)],
    ['Total live weight', `${herd.totalCurrentWeight.toFixed(1)} ${wu}`],
    ['Inventory headcount', String(herd.inventoryHeadcount)],
    ['Average weight (inventory)', herd.inventoryHeadcount ? `${herd.avgWeight.toFixed(1)} ${wu}` : '—'],
    [`Reference price per ${wu}`, farm.pricePerKg.toFixed(4)],
  ];
  for (const sr of summaryRows) {
    ws0.getRow(row).values = sr;
    applyFinancialsBodyRowBorders(ws0.getRow(row));
    row++;
  }
  ws0.getColumn(1).width = 44;
  ws0.getColumn(2).width = 28;

  const ws1 = wb.addWorksheet('By stage');
  row = addFinancialsSheetTitleBlock(ws1, farm.name, 'Value by stage (current weights × reference price)', 1);
  ws1.getRow(row).values = ['Stage', 'Head count', `Total weight (${wu})`, `Estimated value (${cur})`];
  applyFinancialsGridHeaderRow(ws1.getRow(row));
  row++;
  for (const b of [...breakdownByStage].sort((a, b) => a.stage.localeCompare(b.stage))) {
    ws1.getRow(row).values = [
      financialStageLabel(b.stage),
      b.count,
      Number(b.totalWeight.toFixed(2)),
      Number(b.estimatedValue.toFixed(2)),
    ];
    applyFinancialsBodyRowBorders(ws1.getRow(row));
    row++;
  }
  ws1.getColumn(1).width = 26;
  ws1.getColumn(2).width = 14;
  ws1.getColumn(3).width = 20;
  ws1.getColumn(4).width = 22;

  const ws2 = wb.addWorksheet('By pen');
  row = addFinancialsSheetTitleBlock(ws2, farm.name, 'Value by pen', 1);
  ws2.getRow(row).values = ['Pen', 'Head count', `Total weight (${wu})`, `Estimated value (${cur})`];
  applyFinancialsGridHeaderRow(ws2.getRow(row));
  row++;
  for (const b of breakdownByPen) {
    ws2.getRow(row).values = [b.penName, b.count, Number(b.totalWeight.toFixed(2)), Number(b.value.toFixed(2))];
    applyFinancialsBodyRowBorders(ws2.getRow(row));
    row++;
  }
  ws2.getColumn(1).width = 24;
  ws2.getColumn(2).width = 14;
  ws2.getColumn(3).width = 20;
  ws2.getColumn(4).width = 22;

  const ws3 = wb.addWorksheet('Sales summary');
  row = addFinancialsSheetTitleBlock(
    ws3,
    farm.name,
    `Sales in selected period (${formatFinancialsPeriodLabel(period)})`,
    1,
  );
  ws3.getRow(row).values = ['Date range', `Revenue (${cur})`, 'Transactions', `Weight sold (${wu})`];
  applyFinancialsGridHeaderRow(ws3.getRow(row));
  row++;
  ws3.getRow(row).values = [
    formatFinancialsPeriodLabel(period),
    salesInPeriod.revenue.toFixed(2),
    salesInPeriod.transactionCount,
    salesInPeriod.totalWeightSold.toFixed(1),
  ];
  applyFinancialsBodyRowBorders(ws3.getRow(row));
  row++;
  ws3.getColumn(1).width = 28;
  ws3.getColumn(2).width = 18;
  ws3.getColumn(3).width = 16;
  ws3.getColumn(4).width = 20;

  const ws4 = wb.addWorksheet('Recent sales');
  row = addFinancialsSheetTitleBlock(ws4, farm.name, `Recent sales (up to ${recentSales.length} rows)`, 1);
  ws4.getRow(row).values = [
    'Date',
    'Tag',
    'Sale type',
    `Weight (${wu})`,
    `Price / ${wu} (${cur})`,
    `Total (${cur})`,
    'Buyer',
  ];
  applyFinancialsGridHeaderRow(ws4.getRow(row));
  row++;
  for (const s of recentSales) {
    const dateStr = s.saleDate.toISOString().split('T')[0];
    const typeStr = s.saleType === 'SLAUGHTER' ? 'Slaughter' : 'Live sale';
    ws4.getRow(row).values = [
      dateStr,
      s.tagNumber,
      typeStr,
      s.weightAtSale,
      s.pricePerKg,
      s.totalPrice,
      s.buyer || '—',
    ];
    applyFinancialsBodyRowBorders(ws4.getRow(row));
    row++;
  }
  ws4.getColumn(1).width = 12;
  ws4.getColumn(2).width = 14;
  ws4.getColumn(3).width = 14;
  ws4.getColumn(4).width = 14;
  ws4.getColumn(5).width = 18;
  ws4.getColumn(6).width = 16;
  ws4.getColumn(7).width = 32;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export class ReportController {
  static async herdInventory(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const { format = 'json', status, breed } = req.query as Record<string, string>;
      const where: any = { farmId: req.farmId! };
      if (status) where.status = status;
      if (breed) where.breed = breed;

      const pigs = await prisma.pig.findMany({
        where,
        include: { pen: { select: { name: true } } },
        orderBy: { tagNumber: 'asc' },
      });

      const farm = await prisma.farm.findUnique({ where: { id: req.farmId! } });

      if (format === 'pdf') {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=herd_inventory.pdf');
        doc.pipe(res);
        drawPdfBrandHeader(doc, farm!.name, farm?.logoUrl, 'Herd Inventory Report', `Generated: ${new Date().toLocaleDateString()} | Total: ${pigs.length} pigs`);

        const headers = ['Tag', 'Breed', 'Stage', 'Weight', 'Status', 'Health', 'Pen'];
        const colW = [72, 86, 54, 54, 58, 76, 75];
        const tableRows = pigs.map((pig) => [
          pig.tagNumber,
          pig.breed,
          pig.stage,
          String(pig.currentWeight),
          pig.status,
          pig.healthStatus,
          pig.pen?.name || '—',
        ]);
        drawPdfGridTable(doc, {
          x: doc.page.margins.left,
          y: doc.y,
          colWidths: colW,
          headers,
          rows: tableRows,
        });
        doc.end();
      } else if (format === 'xlsx') {
        const data = pigs.map((p) => ({
          'Tag Number': p.tagNumber, Breed: p.breed,
          Stage: p.stage, 'Entry Weight': Number(p.entryWeight), 'Current Weight': Number(p.currentWeight),
          Status: p.status, 'Health Status': p.healthStatus, Pen: p.pen?.name || '',
          'Acquisition Date': p.acquisitionDate.toISOString().split('T')[0],
        }));
        const buf = await buildBrandedWorkbook({
          farmName: farm!.name,
          logoUrl: farm?.logoUrl,
          sheetName: 'Herd Inventory',
          reportTitle: 'Herd Inventory Report',
          rows: data,
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=herd_inventory.xlsx');
        res.send(buf);
      } else {
        res.json({ farm: farm!.name, total: pigs.length, pigs });
      }
    } catch (error) {
      next(error);
    }
  }

  static async weightGain(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const { format = 'json', from, to } = req.query as Record<string, string>;
      const dateFilter: any = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);

      const pigs = await prisma.pig.findMany({
        where: { farmId: req.farmId!, status: 'ACTIVE' },
        include: {
          weightLogs: {
            where: Object.keys(dateFilter).length ? { date: dateFilter } : undefined,
            orderBy: { date: 'asc' },
          },
        },
      });

      const report = pigs.map(pig => {
        const logs = pig.weightLogs;
        let adg = 0;
        if (logs.length >= 2) {
          const first = logs[0];
          const last = logs[logs.length - 1];
          const days = (last.date.getTime() - first.date.getTime()) / (1000 * 60 * 60 * 24);
          if (days > 0) adg = (Number(last.weight) - Number(first.weight)) / days;
        }
        return {
          tagNumber: pig.tagNumber,
          entryWeight: Number(pig.entryWeight),
          currentWeight: Number(pig.currentWeight),
          totalGain: Number(pig.currentWeight) - Number(pig.entryWeight),
          adg: Math.round(adg * 100) / 100,
          measurements: logs.length,
        };
      });
      const farm = await prisma.farm.findUnique({ where: { id: req.farmId! } });

      if (format === 'xlsx') {
        const rows = report.map(r => ({
          'Tag': r.tagNumber, 'Entry Weight': r.entryWeight,
          'Current Weight': r.currentWeight, 'Total Gain': r.totalGain,
          'Avg Daily Gain': r.adg, 'Measurements': r.measurements,
        }));
        const buf = await buildBrandedWorkbook({
          farmName: farm?.name || 'Farm',
          logoUrl: farm?.logoUrl,
          sheetName: 'Weight Gain',
          reportTitle: 'Weight Gain Report',
          rows,
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=weight_gain_report.xlsx');
        res.send(buf);
      } else if (format === 'pdf') {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=weight_gain_report.pdf');
        doc.pipe(res);
        drawPdfBrandHeader(doc, farm?.name || 'Farm', farm?.logoUrl, 'Weight Gain Report', `Generated: ${new Date().toLocaleDateString()}`);

        const wgHeaders = ['Tag', 'Entry (kg)', 'Current (kg)', 'Total gain (kg)', 'ADG (kg/day)', '# Weighings'];
        const wgColW = [78, 72, 78, 88, 88, 72];
        const wgRows = report.map((r) => [
          r.tagNumber,
          String(r.entryWeight),
          String(r.currentWeight),
          String(r.totalGain),
          String(r.adg),
          String(r.measurements),
        ]);
        drawPdfGridTable(doc, {
          x: doc.page.margins.left,
          y: doc.y,
          colWidths: wgColW,
          headers: wgHeaders,
          rows: wgRows,
          dataRowHeight: 17,
        });
        doc.end();
      } else {
        res.json(report);
      }
    } catch (error) {
      next(error);
    }
  }

  static async activityLog(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const { format = 'json', page = '1', pageSize = '50' } = req.query as Record<string, string>;

      const [data, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: { farmId: req.farmId! },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (parseInt(page) - 1) * parseInt(pageSize),
          take: parseInt(pageSize),
        }),
        prisma.auditLog.count({ where: { farmId: req.farmId! } }),
      ]);
      const farm = await prisma.farm.findUnique({ where: { id: req.farmId! } });

      if (format === 'xlsx') {
        const rows = data.map(a => ({
          Date: a.createdAt.toISOString(), User: a.user.name, Action: a.action,
          Entity: a.entity, 'Entity ID': a.entityId, Details: a.details || '',
        }));
        const buf = await buildBrandedWorkbook({
          farmName: farm?.name || 'Farm',
          logoUrl: farm?.logoUrl,
          sheetName: 'Activity Log',
          reportTitle: 'Activity Log Report',
          rows,
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=activity_log.xlsx');
        res.send(buf);
      } else {
        res.json({ data, total, page: parseInt(page), pageSize: parseInt(pageSize), totalPages: Math.ceil(total / parseInt(pageSize)) });
      }
    } catch (error) {
      next(error);
    }
  }

  static async salesReport(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const { format = 'json', from, to } = req.query as Record<string, string>;
      const dateFilter: any = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);

      const farm = await prisma.farm.findUnique({ where: { id: req.farmId! } });
      const sales = await prisma.saleRecord.findMany({
        where: {
          farmId: req.farmId!,
          ...(Object.keys(dateFilter).length ? { saleDate: dateFilter } : {}),
        },
        include: { pig: { select: { tagNumber: true, breed: true, stage: true } } },
        orderBy: { saleDate: 'desc' },
      });

      const totalRevenue = sales.reduce((s, r) => s + Number(r.totalPrice), 0);
      const totalWeight = sales.reduce((s, r) => s + Number(r.weightAtSale), 0);
      const liveSales = sales.filter(s => s.saleType === 'LIVE_SALE');
      const slaughters = sales.filter(s => s.saleType === 'SLAUGHTER');
      const currency = farm?.currency ?? 'USD';

      const rows = sales.map(s => ({
        tag: s.pig.tagNumber,
        breed: s.pig.breed,
        stage: s.pig.stage,
        type: s.saleType === 'LIVE_SALE' ? 'Live Sale' : 'Slaughter',
        date: s.saleDate.toISOString().split('T')[0],
        weight: Number(s.weightAtSale),
        pricePerKg: Number(s.pricePerKg),
        totalPrice: Number(s.totalPrice),
        buyer: s.buyer || '—',
      }));

      if (format === 'xlsx') {
        const excelRows = rows.map((r) => ({
          'Tag': r.tag, 'Breed': r.breed, 'Stage': r.stage, 'Type': r.type,
          'Date': r.date, 'Weight (kg)': r.weight,
          [`Price per kg (${currency})`]: r.pricePerKg,
          [`Total (${currency})`]: r.totalPrice, 'Buyer': r.buyer,
        }));
        const buf = await buildBrandedWorkbook({
          farmName: farm?.name || 'Farm',
          logoUrl: farm?.logoUrl,
          sheetName: 'Sales',
          reportTitle: 'Sales Report',
          rows: excelRows,
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=sales_report.xlsx');
        return res.send(buf);
      }

      if (format === 'pdf') {
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');
        doc.pipe(res);
        drawPdfBrandHeader(
          doc,
          farm?.name || 'Farm',
          farm?.logoUrl,
          'Sales Report',
          `Generated: ${new Date().toLocaleDateString()} | ${sales.length} sales | Total: ${currency} ${totalRevenue.toFixed(2)}`
        );

        const wuSale = farm?.weightUnit ?? 'kg';
        const saleHeaders = ['Tag', 'Breed', 'Stage', 'Type', 'Date', `Weight (${wuSale})`, `Price / ${wuSale}`, `Total (${currency})`, 'Buyer'];
        const saleColW = [64, 78, 52, 58, 72, 48, 48, 78, 92];
        const saleRows = rows.map((r) => [
          r.tag,
          r.breed,
          r.stage,
          r.type,
          r.date,
          String(r.weight),
          String(r.pricePerKg),
          `${r.totalPrice.toFixed(2)}`,
          r.buyer,
        ]);
        drawPdfGridTable(doc, {
          x: doc.page.margins.left,
          y: doc.y,
          colWidths: saleColW,
          headers: saleHeaders,
          rows: saleRows,
          headerFontSize: 7,
          bodyFontSize: 6.5,
          headerRowHeight: 24,
          dataRowHeight: 17,
        });

        doc.end();
        return;
      }

      res.json({
        currency,
        totalSales: sales.length,
        liveSales: liveSales.length,
        slaughters: slaughters.length,
        totalRevenue,
        totalWeight,
        sales: rows,
      });
    } catch (error) {
      next(error);
    }
  }

  static async financials(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const { format } = req.query as Record<string, string>;
      if (format !== 'pdf' && format !== 'xlsx') {
        return next(new AppError('Query format must be pdf or xlsx', 400));
      }

      const parsed = parseFinancialsDateQuery(req.query as Record<string, unknown>);
      if (parsed.error) return next(new AppError(parsed.error, 400));

      const data = await fetchFinancialsSummary(req.farmId!, {
        from: parsed.from ?? null,
        to: parsed.to ?? null,
        recentSalesLimit: 500,
      });
      if (!data) return next(new AppError('Farm not found', 404));

      const { farm, herd, breakdownByStage, breakdownByPen, period, salesInPeriod, recentSales } = data;
      const cur = farm.currency;
      const wu = farm.weightUnit;
      const subtitle = `Reference: ${farm.pricePerKg} ${cur} per ${wu} | Generated: ${new Date().toLocaleDateString()}`;

      if (format === 'xlsx') {
        const buf = await buildFinancialsXlsx(data);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=financials.xlsx');
        return res.send(buf);
      }

      const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=financials.pdf');
      doc.pipe(res);

      drawPdfBrandHeader(doc, farm.name, farm.logoUrl, 'Financials report', subtitle);

      let y = drawPdfGridTable(doc, {
        x: doc.page.margins.left,
        y: doc.y,
        colWidths: [320, 220],
        headers: ['Herd metric', `Value (${cur} / ${wu} as noted)`],
        rows: [
          ['Estimated herd value (inventory)', `${herd.estimatedValueAtFarmPrice.toFixed(2)} ${cur}`],
          ['Total live weight', `${herd.totalCurrentWeight.toFixed(1)} ${wu}`],
          ['Inventory headcount', String(herd.inventoryHeadcount)],
          ['Average weight (inventory)', herd.inventoryHeadcount ? `${herd.avgWeight.toFixed(1)} ${wu}` : '—'],
        ],
        headerFontSize: 9,
        bodyFontSize: 8,
        headerRowHeight: 22,
        dataRowHeight: 18,
      });

      doc.y = y + 14;
      doc.fontSize(11).font('Helvetica-Bold').text('Value by stage', doc.page.margins.left, doc.y);
      doc.moveDown(0.7);

      y = drawPdfGridTable(doc, {
        x: doc.page.margins.left,
        y: doc.y,
        colWidths: [220, 72, 100, 120],
        headers: ['Stage', 'Head', `Weight (${wu})`, `Est. value (${cur})`],
        rows: [...breakdownByStage]
          .sort((a, b) => a.stage.localeCompare(b.stage))
          .map((b) => [
            financialStageLabel(b.stage),
            String(b.count),
            b.totalWeight.toFixed(1),
            b.estimatedValue.toFixed(2),
          ]),
        headerFontSize: 8,
        bodyFontSize: 7.5,
      });

      doc.y = y + 14;
      doc.fontSize(11).font('Helvetica-Bold').text('Value by pen', doc.page.margins.left, doc.y);
      doc.moveDown(0.7);

      y = drawPdfGridTable(doc, {
        x: doc.page.margins.left,
        y: doc.y,
        colWidths: [220, 72, 100, 120],
        headers: ['Pen', 'Head', `Weight (${wu})`, `Est. value (${cur})`],
        rows: breakdownByPen.map((b) => [
          b.penName,
          String(b.count),
          b.totalWeight.toFixed(1),
          b.value.toFixed(2),
        ]),
        headerFontSize: 8,
        bodyFontSize: 7.5,
      });

      doc.y = y + 14;
      doc.fontSize(11).font('Helvetica-Bold').text('Sales (selected period)', doc.page.margins.left, doc.y);
      doc.moveDown(0.7);

      y = drawPdfGridTable(doc, {
        x: doc.page.margins.left,
        y: doc.y,
        colWidths: [240, 140, 100, 120],
        headers: ['Date range', `Revenue (${cur})`, 'Transactions', `Weight sold (${wu})`],
        rows: [
          [
            formatFinancialsPeriodLabel(period),
            salesInPeriod.revenue.toFixed(2),
            String(salesInPeriod.transactionCount),
            salesInPeriod.totalWeightSold.toFixed(1),
          ],
        ],
        headerFontSize: 8,
        bodyFontSize: 7.5,
      });

      doc.y = y + 14;
      doc.fontSize(11).font('Helvetica-Bold').text('Recent sales', doc.page.margins.left, doc.y);
      doc.moveDown(0.7);

      drawPdfGridTable(doc, {
        x: doc.page.margins.left,
        y: doc.y,
        colWidths: [72, 68, 70, 52, 64, 72, 168],
        headers: ['Date', 'Tag', 'Type', `Wt (${wu})`, `P/${wu}`, `Total (${cur})`, 'Buyer'],
        rows: recentSales.map((s) => [
          s.saleDate.toISOString().split('T')[0],
          s.tagNumber,
          s.saleType === 'SLAUGHTER' ? 'Slaughter' : 'Live sale',
          String(s.weightAtSale),
          s.pricePerKg.toFixed(2),
          s.totalPrice.toFixed(2),
          (s.buyer || '—').slice(0, 48),
        ]),
        headerFontSize: 7,
        bodyFontSize: 6.5,
        headerRowHeight: 24,
        dataRowHeight: 16,
      });

      doc.end();
    } catch (error) {
      next(error);
    }
  }

  static async dailySummary(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const { format = 'json' } = req.query as Record<string, string>;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalPigs, byStatus, avgWeight, todayWeightLogs, todayAudit] = await Promise.all([
        prisma.pig.count({ where: { farmId: req.farmId! } }),
        prisma.pig.groupBy({ by: ['status'], where: { farmId: req.farmId! }, _count: true }),
        prisma.pig.aggregate({ where: { farmId: req.farmId!, status: 'ACTIVE' }, _avg: { currentWeight: true } }),
        prisma.weightLog.count({
          where: { pig: { farmId: req.farmId! }, createdAt: { gte: today } },
        }),
        prisma.auditLog.count({ where: { farmId: req.farmId!, createdAt: { gte: today } } }),
      ]);

      const summary = {
        date: new Date().toISOString().split('T')[0],
        totalPigs,
        statusBreakdown: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
        avgWeight: Number(avgWeight._avg.currentWeight || 0).toFixed(2),
        todayWeightLogs,
        todayActivities: todayAudit,
      };

      if (format === 'pdf') {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=daily_summary.pdf');
        doc.pipe(res);

        const farm = await prisma.farm.findUnique({ where: { id: req.farmId! } });
        drawPdfBrandHeader(doc, farm?.name || 'Farm', farm?.logoUrl, 'Daily Summary', `Date: ${summary.date}`);

        const wu = farm?.weightUnit ?? 'kg';
        let yAfter = drawPdfGridTable(doc, {
          x: doc.page.margins.left,
          y: doc.y,
          colWidths: [220, 255],
          headers: ['Status', 'Count'],
          rows: Object.entries(summary.statusBreakdown).map(([status, count]) => [status, String(count)]),
          headerRowHeight: 22,
          dataRowHeight: 16,
        });

        doc.y = yAfter + 14;
        drawPdfGridTable(doc, {
          x: doc.page.margins.left,
          y: doc.y,
          colWidths: [220, 255],
          headers: ['Metric', 'Value'],
          rows: [
            ['Total pigs', String(summary.totalPigs)],
            [`Average weight (${wu})`, summary.avgWeight],
            ['Weight logs today', String(summary.todayWeightLogs)],
            ['Activities today', String(summary.todayActivities)],
          ],
          headerRowHeight: 22,
          dataRowHeight: 16,
        });
        doc.end();
      } else {
        res.json(summary);
      }
    } catch (error) {
      next(error);
    }
  }
}
