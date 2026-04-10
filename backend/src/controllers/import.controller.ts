import { Response, NextFunction } from 'express';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import prisma from '../config/database';
import { FarmRequest } from '../middleware/rbac.middleware';
import { AppError } from '../middleware/error.middleware';
import { AuditService } from '../services/audit.service';
import { FREE_TIER_MAX_PIGS, wouldExceedFreeTier } from '../config/planLimits';
import { onHandPigsWhere } from '../lib/pigStock';

const BREEDS = ['LARGE_WHITE', 'LANDRACE', 'DUROC', 'PIETRAIN', 'BERKSHIRE', 'HAMPSHIRE', 'CHESTER_WHITE', 'YORKSHIRE', 'TAMWORTH', 'MUKOTA', 'KOLBROEK', 'WINDSNYER', 'SA_LANDRACE', 'INDIGENOUS', 'CROSSBREED', 'OTHER'];
const STAGES = ['BOAR', 'SOW', 'GILT', 'WEANER', 'PIGLET', 'PORKER', 'GROWER', 'FINISHER'];
const STATUSES = ['ACTIVE', 'SOLD', 'DECEASED', 'QUARANTINE'];
const HEALTH = ['HEALTHY', 'SICK', 'UNDER_TREATMENT', 'RECOVERED'];

const BREED_LABELS: Record<string, string> = {
  'LARGE_WHITE': 'Large White', 'LANDRACE': 'Landrace', 'DUROC': 'Duroc',
  'PIETRAIN': 'Pietrain', 'BERKSHIRE': 'Berkshire', 'HAMPSHIRE': 'Hampshire',
  'CHESTER_WHITE': 'Chester White', 'YORKSHIRE': 'Yorkshire', 'TAMWORTH': 'Tamworth',
  'MUKOTA': 'Mukota', 'KOLBROEK': 'Kolbroek', 'WINDSNYER': 'Windsnyer',
  'SA_LANDRACE': 'SA Landrace', 'INDIGENOUS': 'Indigenous',
  'CROSSBREED': 'Crossbreed', 'OTHER': 'Other',
};

const BREED_MAP: Record<string, string> = {
  'large white': 'LARGE_WHITE', 'landrace': 'LANDRACE', 'duroc': 'DUROC',
  'pietrain': 'PIETRAIN', 'berkshire': 'BERKSHIRE', 'hampshire': 'HAMPSHIRE',
  'chester white': 'CHESTER_WHITE', 'yorkshire': 'YORKSHIRE', 'tamworth': 'TAMWORTH',
  'mukota': 'MUKOTA', 'kolbroek': 'KOLBROEK', 'windsnyer': 'WINDSNYER',
  'sa landrace': 'SA_LANDRACE', 'indigenous': 'INDIGENOUS',
  'cross-breed': 'CROSSBREED', 'crossbreed': 'CROSSBREED', 'other': 'OTHER',
};

const STAGE_MAP: Record<string, string> = {
  boar: 'BOAR',
  sow: 'SOW',
  gilt: 'GILT',
  weaner: 'WEANER',
  piglet: 'PIGLET',
  porker: 'PORKER',
  grower: 'GROWER',
  finisher: 'FINISHER',
};

function normalizeEnum(value: string, allowed: string[], map?: Record<string, string>): string | null {
  const upper = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (allowed.includes(upper)) return upper;
  if (map) {
    const mapped = map[value.trim().toLowerCase()];
    if (mapped && allowed.includes(mapped)) return mapped;
  }
  return null;
}

const PEN_NAME_MAX = 100;

/** Excel may return pen as number; trim and stringify for consistent DB matching. */
function normalizePenName(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  return s.length === 0 ? null : s;
}

/** Pen / Location: letters and/or digits, optional spaces, hyphen, underscore, period (e.g. A, 12, Pen A). */
function isValidPenName(name: string): boolean {
  if (name.length > PEN_NAME_MAX) return false;
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9\s\-_.]*[a-zA-Z0-9])?$|^[a-zA-Z0-9]$/.test(name);
}

/** Match header labels across Excel versions, NBSP, slash variants, BOM. */
function normalizeSheetHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/^\ufeff/, '')
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/\s*[/\\]\s*/g, '/')
    .replace(/\s+/g, ' ');
}

function findPenColumnIndex(headerRow: unknown[]): number {
  if (!Array.isArray(headerRow)) return -1;
  for (let c = 0; c < headerRow.length; c++) {
    const n = normalizeSheetHeader(headerRow[c]);
    if (
      n === 'pen / location' ||
      n === 'pen/location' ||
      n === 'pen location' ||
      n === 'pen'
    ) {
      return c;
    }
  }
  return -1;
}

/** Resolve pen cell when object keys differ (Excel, re-saved files, other tools). */
function extractPenCellFromRow(row: Record<string, any>): unknown {
  const directKeys = ['Pen / Location', 'Pen/Location', 'Pen Location', 'Pen'];
  for (const pk of directKeys) {
    const v = row[pk];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  for (const key of Object.keys(row)) {
    const n = normalizeSheetHeader(key);
    if (
      n === 'pen / location' ||
      n === 'pen/location' ||
      n === 'pen location' ||
      n === 'pen'
    ) {
      return row[key];
    }
  }
  return undefined;
}

/** Pen name from preview payload (validate + confirm); tolerates alternate JSON keys. */
function penNameFromImportData(data: Record<string, any>): string | null {
  return normalizePenName(
    data.penName ??
      data.pen ??
      data.Pen ??
      data['Pen / Location'] ??
      data.pen_name,
  );
}

function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    return new Date(d.y, d.m - 1, d.d);
  }
  const str = String(val).trim();
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
  }
  const iso = new Date(str);
  return isNaN(iso.getTime()) ? null : iso;
}

interface RowError { row: number; field: string; message: string; }
interface PreviewRow { row: number; data: Record<string, any>; errors: RowError[]; valid: boolean; }

/** Same workbook as the authenticated farm template; used for public marketing download. */
export async function createPigImportTemplateBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'The Pigsty';

  const breedValues = BREEDS.map(b => BREED_LABELS[b] || b);
      const stageValues = STAGES.map(s => s.charAt(0) + s.slice(1).toLowerCase());
      const statusValues = ['Active', 'Sold', 'Deceased', 'Quarantine'];
      const healthValues = ['Healthy', 'Sick', 'Under Treatment', 'Recovered'];
      const servicedValues = ['Yes', 'No'];

      // --- Instructions sheet ---
      const instrSheet = wb.addWorksheet('Instructions');
      const instrRows = [
        ['The Pigsty - Pig Import Template'],
        [''],
        ['Instructions:'],
        ['1. Fill in the "Pig Data" sheet with your pig records starting from ROW 3'],
        ['2. Row 2 is an example — do NOT delete it, use it as a guide'],
        ['3. Tag Number, Breed/Type, Stage, Acquisition Date, Entry Weight, and Status are required'],
        ['4. Breed/Type and Stage columns have dropdown selections — choose from the list'],
        ['5. Dates should be in DD/MM/YYYY format'],
        ['6. Pen / Location: use letters and/or numbers (e.g. A, 3, Pen-2). New pens in the file are created automatically and pigs are assigned to them.'],
        ['7. Upload the completed file in the Import section of The Pigsty after you sign in'],
        ['8. You can download this same template free from our website before creating an account — look for “Download Excel template”.'],
        [''],
        [`Allowed Breeds: ${breedValues.join(', ')}`],
        [`Allowed Stages: ${stageValues.join(', ')}`],
        [`Allowed Status: ${statusValues.join(', ')}`],
        [`Allowed Health Status: ${healthValues.join(', ')}`],
        ['Serviced: Yes or No (for sows that have been mated)'],
        ['Weaned Date: optional — for weaners/gilts, to track return-to-heat window'],
        [''],
        ['Maximum 5,000 records per file'],
      ];
      instrRows.forEach(r => instrSheet.addRow(r));
      instrSheet.getRow(1).font = { bold: true, size: 14 };
      instrSheet.getColumn(1).width = 80;

      // --- Pig Data sheet ---
      const dataSheet = wb.addWorksheet('Pig Data');

      const headers = [
        'Tag Number', 'Breed / Type', 'Stage',
        'Date of Birth', 'Acquisition Date', 'Entry Weight (kg)',
        'Pen / Location', 'Status', 'Health Status',
        'Serviced', 'Serviced Date', 'Weaned Date',
        'Mother Tag (Dam)', 'Father Tag (Sire)',
        'Vaccination 1 Name', 'Vaccination 1 Date',
        'Vaccination 2 Name', 'Vaccination 2 Date', 'Notes',
      ];
      const headerRow = dataSheet.addRow(headers);
      headerRow.font = { bold: true };
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E0F0' } };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FF999999' } },
        };
      });

      const exampleRow = dataSheet.addRow([
        'PIG-001', 'Large White', 'Sow',
        '15/01/2025', '20/01/2025', 25.5,
        'Pen A', 'Active', 'Healthy',
        'Yes', '01/02/2025', '',
        '', '', 'PRRS', '25/01/2025', '', '', 'Healthy sow',
      ]);
      exampleRow.font = { italic: true, color: { argb: 'FF888888' } };
      exampleRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        };
        cell.note = 'Example row — do not delete. Enter your data from row 3 onwards.';
      });

      // Protect the sheet so the example row cannot be deleted, but all other cells remain editable
      dataSheet.protect('', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: true,
        formatColumns: true,
        insertRows: true,
        deleteRows: false,
        sort: true,
        autoFilter: true,
      });
      // Lock only the header (row 1) and example (row 2) rows
      headerRow.eachCell(cell => { cell.protection = { locked: true }; });
      exampleRow.eachCell(cell => { cell.protection = { locked: true }; });

      // Column widths
      const widths = [14, 18, 12, 14, 16, 16, 16, 12, 16, 10, 14, 14, 16, 16, 20, 16, 20, 16, 30];
      widths.forEach((w, i) => { dataSheet.getColumn(i + 1).width = w; });

      // Data validation dropdowns (rows 3–5001, user data starts at row 3)
      const maxRow = 5001;
      for (let row = 3; row <= maxRow; row++) {
        // Unlock these cells so users can type/select in them
        for (let col = 1; col <= headers.length; col++) {
          dataSheet.getCell(row, col).protection = { locked: false };
        }
        // Column B — Breed / Type
        dataSheet.getCell(row, 2).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`"${breedValues.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Invalid Breed',
          error: 'Please select a breed from the dropdown list.',
        };

        // Column C — Stage
        dataSheet.getCell(row, 3).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`"${stageValues.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Invalid Stage',
          error: 'Please select a stage from the dropdown list.',
        };

        // Column H — Status
        dataSheet.getCell(row, 8).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${statusValues.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Invalid Status',
          error: 'Please select a status from the dropdown list.',
        };

        // Column I — Health Status
        dataSheet.getCell(row, 9).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${healthValues.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Invalid Health Status',
          error: 'Please select a health status from the dropdown list.',
        };

        // Column J — Serviced
        dataSheet.getCell(row, 10).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${servicedValues.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Invalid Value',
          error: 'Please select Yes or No.',
        };
      }

      // Freeze header row
      dataSheet.views = [{ state: 'frozen', ySplit: 1 }];

      const buf = await wb.xlsx.writeBuffer();
      return Buffer.from(buf);
}

export class ImportController {
  static async downloadTemplate(_req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const buf = await createPigImportTemplateBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=pigtrack_import_template.xlsx');
      res.send(buf);
    } catch (error) {
      next(error);
    }
  }

  static async validateUpload(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) return next(new AppError('No file uploaded', 400));

      const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
      const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('pig')) || wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const sheetJsonOpts = { defval: null, raw: false, blankrows: true } as const;
      const allRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, sheetJsonOpts);
      const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { ...sheetJsonOpts, header: 1 });
      const penColIdx = matrix.length > 0 ? findPenColumnIndex(matrix[0]) : -1;

      let dataRowCount = 0;
      for (let k = 0; k < allRows.length; k++) {
        if (k === 0) {
          const tag0 = String(allRows[k]['Tag Number'] || '').trim();
          if (tag0 === 'PIG-001') continue;
        }
        dataRowCount++;
      }

      if (dataRowCount === 0) return next(new AppError('No data rows found. Enter your data from row 3 onwards (row 2 is the example).', 400));
      if (dataRowCount > 5000) return next(new AppError('Maximum 5,000 records per file', 400));

      const existingTags = new Set(
        (await prisma.pig.findMany({
          where: { farmId: req.farmId! },
          select: { tagNumber: true },
        })).map(p => p.tagNumber)
      );

      const seenTags = new Set<string>();
      const preview: PreviewRow[] = [];

      for (let k = 0; k < allRows.length; k++) {
        if (k === 0) {
          const tagSkip = String(allRows[k]['Tag Number'] || '').trim();
          if (tagSkip === 'PIG-001') continue;
        }

        const row = allRows[k];
        const errors: RowError[] = [];
        const rowNum = k + 2;

        let penRaw: unknown;
        if (penColIdx >= 0) {
          const mrow = matrix[k + 1];
          if (Array.isArray(mrow) && penColIdx < mrow.length) {
            const v = mrow[penColIdx];
            if (v !== null && v !== undefined && String(v).trim() !== '') penRaw = v;
          }
        }
        if (penRaw === undefined) penRaw = extractPenCellFromRow(row);
        const penName = normalizePenName(penRaw);

        const tag = String(row['Tag Number'] || '').trim();
        if (!tag) errors.push({ row: rowNum, field: 'Tag Number', message: 'Required' });
        else if (tag.length > 20) errors.push({ row: rowNum, field: 'Tag Number', message: 'Max 20 characters' });
        else if (existingTags.has(tag)) errors.push({ row: rowNum, field: 'Tag Number', message: 'Already exists in farm' });
        else if (seenTags.has(tag)) errors.push({ row: rowNum, field: 'Tag Number', message: 'Duplicate in file' });
        else seenTags.add(tag);

        const breedRaw = String(row['Breed / Type'] || '').trim();
        const breed = breedRaw ? normalizeEnum(breedRaw, BREEDS, BREED_MAP) : null;
        if (!breedRaw) errors.push({ row: rowNum, field: 'Breed', message: 'Required' });
        else if (!breed) errors.push({ row: rowNum, field: 'Breed', message: `Invalid breed "${breedRaw}"` });

        const stageRaw = String(row['Stage'] || '').trim();
        const stage = stageRaw ? normalizeEnum(stageRaw, STAGES, STAGE_MAP) : null;
        if (!stageRaw) errors.push({ row: rowNum, field: 'Stage', message: 'Required' });
        else if (!stage) errors.push({ row: rowNum, field: 'Stage', message: `Invalid stage "${stageRaw}"` });

        const acqDate = parseDate(row['Acquisition Date']);
        if (!acqDate) errors.push({ row: rowNum, field: 'Acquisition Date', message: 'Required valid date (DD/MM/YYYY)' });
        else if (acqDate > new Date()) errors.push({ row: rowNum, field: 'Acquisition Date', message: 'Cannot be in the future' });

        const weight = parseFloat(row['Entry Weight (kg)']);
        if (isNaN(weight) || weight <= 0) errors.push({ row: rowNum, field: 'Entry Weight', message: 'Must be a positive number' });

        const statusRaw = String(row['Status'] || 'Active').trim();
        const status = normalizeEnum(statusRaw, STATUSES);
        if (!status) errors.push({ row: rowNum, field: 'Status', message: `Invalid status "${statusRaw}"` });

        const healthRaw = String(row['Health Status'] || 'Healthy').trim();
        const health = healthRaw ? normalizeEnum(healthRaw, HEALTH) : 'HEALTHY';
        if (healthRaw && !health) errors.push({ row: rowNum, field: 'Health Status', message: `Invalid "${healthRaw}"` });

        const dob = parseDate(row['Date of Birth']);
        if (row['Date of Birth'] && !dob) errors.push({ row: rowNum, field: 'Date of Birth', message: 'Invalid date' });
        if (dob && dob > new Date()) errors.push({ row: rowNum, field: 'Date of Birth', message: 'Cannot be in the future' });

        const servicedRaw = String(row['Serviced'] || '').trim().toLowerCase();
        const serviced = servicedRaw === 'yes' || servicedRaw === 'true' || servicedRaw === '1';
        const servicedDate = parseDate(row['Serviced Date']);
        const weanedDate = parseDate(row['Weaned Date']);
        if (row['Weaned Date'] && !weanedDate) {
          errors.push({ row: rowNum, field: 'Weaned Date', message: 'Invalid date' });
        }

        if (penName && !isValidPenName(penName)) {
          errors.push({
            row: rowNum,
            field: 'Pen / Location',
            message: 'Use letters and/or numbers (optional spaces or hyphen), e.g. A, 12, Pen-2',
          });
        }

        preview.push({
          row: rowNum,
          data: {
            tagNumber: tag,
            breed: breed || breedRaw,
            stage: stage || stageRaw,
            dateOfBirth: dob?.toISOString() || null,
            acquisitionDate: acqDate?.toISOString() || null,
            entryWeight: weight,
            penName,
            status: status || statusRaw,
            healthStatus: health || healthRaw,
            serviced,
            servicedDate: servicedDate?.toISOString() || null,
            weanedDate: weanedDate?.toISOString() || null,
            damTag: row['Mother Tag (Dam)'] || null,
            sireTag: row['Father Tag (Sire)'] || null,
            vax1Name: row['Vaccination 1 Name'] || null,
            vax1Date: parseDate(row['Vaccination 1 Date'])?.toISOString() || null,
            vax2Name: row['Vaccination 2 Name'] || null,
            vax2Date: parseDate(row['Vaccination 2 Date'])?.toISOString() || null,
            notes: row['Notes'] || null,
          },
          errors,
          valid: errors.length === 0,
        });
      }

      const validCount = preview.filter(r => r.valid).length;
      const errorCount = preview.filter(r => !r.valid).length;

      res.json({ total: preview.length, valid: validCount, errors: errorCount, preview });
    } catch (error) {
      next(error);
    }
  }

  static async confirmImport(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const { preview } = req.body as { preview: PreviewRow[] };
      if (!preview || !Array.isArray(preview)) return next(new AppError('Preview data required', 400));

      const validRows = preview.filter(r => r.valid);
      if (validRows.length === 0) return next(new AppError('No valid rows to import', 400));

      for (const row of validRows) {
        const p = penNameFromImportData(row.data);
        if (p && !isValidPenName(p)) return next(new AppError('Invalid Pen / Location in preview', 400));
      }

      const farmRec = await prisma.farm.findUnique({
        where: { id: req.farmId! },
        select: { plan: true },
      });
      if (!farmRec) return next(new AppError('Farm not found', 404));
      const currentPigs = await prisma.pig.count({ where: onHandPigsWhere(req.farmId!) });
      if (wouldExceedFreeTier(currentPigs, validRows.length, farmRec.plan)) {
        return next(
          new AppError(
            `This import would exceed the Free plan limit of ${FREE_TIER_MAX_PIGS} pigs. Upgrade to Pro or split the file.`,
            402,
          ),
        );
      }

      const allTags = [...new Set([
        ...validRows.map(r => r.data.damTag).filter(Boolean),
        ...validRows.map(r => r.data.sireTag).filter(Boolean),
      ])].map(t => String(t).trim()).filter(Boolean);

      const { imported } = await prisma.$transaction(async (tx) => {
        const penNames = [...new Set(
          validRows
            .map(r => penNameFromImportData(r.data))
            .filter((n): n is string => Boolean(n)),
        )];

        const penCounts = new Map<string, number>();
        for (const row of validRows) {
          const n = penNameFromImportData(row.data);
          if (n) penCounts.set(n, (penCounts.get(n) || 0) + 1);
        }

        const existingPens = penNames.length
          ? await tx.pen.findMany({
              where: { farmId: req.farmId!, name: { in: penNames } },
            })
          : [];
        const penMap = new Map(existingPens.map(p => [p.name, p.id]));

        for (const name of penNames) {
          if (penMap.has(name)) continue;
          const count = penCounts.get(name) || 1;
          const pen = await tx.pen.create({
            data: {
              farmId: req.farmId!,
              name,
              type: 'GROWER',
              capacity: Math.max(50, count),
            },
          });
          penMap.set(name, pen.id);
          await tx.auditLog.create({
            data: {
              userId: req.userId!,
              farmId: req.farmId!,
              action: 'CREATE',
              entity: 'Pen',
              entityId: pen.id,
              details: `Created pen "${pen.name}" from bulk import`,
            },
          });
        }

        const existingPigs = allTags.length
          ? await tx.pig.findMany({
              where: { farmId: req.farmId!, tagNumber: { in: allTags } },
              select: { id: true, tagNumber: true },
            })
          : [];
        const tagMap = new Map(existingPigs.map(p => [p.tagNumber, p.id]));

        let count = 0;
        for (const row of validRows) {
          const d = row.data;
          const penKey = penNameFromImportData(d);
          const pig = await tx.pig.create({
            data: {
              farmId: req.farmId!,
              tagNumber: d.tagNumber,
              breed: d.breed,
              stage: d.stage,
              dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : null,
              acquisitionDate: new Date(d.acquisitionDate),
              entryWeight: d.entryWeight,
              currentWeight: d.entryWeight,
              status: d.status,
              healthStatus: d.healthStatus,
              serviced: d.serviced || false,
              servicedDate: d.servicedDate ? new Date(d.servicedDate) : null,
              weanedDate: d.weanedDate ? new Date(d.weanedDate) : null,
              penId: penKey ? penMap.get(penKey) ?? null : null,
              damId: d.damTag ? tagMap.get(String(d.damTag).trim()) || null : null,
              sireId: d.sireTag ? tagMap.get(String(d.sireTag).trim()) || null : null,
              notes: d.notes,
            },
          });

          if (d.vax1Name && d.vax1Date) {
            await tx.vaccination.create({
              data: { pigId: pig.id, name: d.vax1Name, dateAdministered: new Date(d.vax1Date) },
            });
          }
          if (d.vax2Name && d.vax2Date) {
            await tx.vaccination.create({
              data: { pigId: pig.id, name: d.vax2Name, dateAdministered: new Date(d.vax2Date) },
            });
          }

          tagMap.set(d.tagNumber, pig.id);
          count++;
        }

        await tx.importLog.create({
          data: {
            farmId: req.farmId!,
            fileName: 'bulk_import',
            totalRows: preview.length,
            importedRows: count,
            errorRows: preview.length - count,
            status: 'COMPLETED',
          },
        });

        return { imported: count };
      });

      await AuditService.log({
        userId: req.userId!, farmId: req.farmId!,
        action: 'IMPORT', entity: 'Pig', entityId: 'bulk',
        details: `Imported ${imported} pigs`,
      });

      res.json({ imported, total: preview.length, errors: preview.length - imported });
    } catch (error) {
      next(error);
    }
  }
}
