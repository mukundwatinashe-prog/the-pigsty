import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { createPigImportTemplateBuffer } from './import.controller';

const leadSchema = z.object({
  email: z.string().email(),
  message: z.string().max(500).optional().nullable(),
  source: z.string().max(80).optional().default('landing'),
});

export class PublicController {
  /** Free Excel template — same file as in-app import; no account required. */
  static async downloadImportTemplate(_req: Request, res: Response, next: NextFunction) {
    try {
      const buf = await createPigImportTemplateBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=pigsty_pig_import_template.xlsx');
      res.send(buf);
    } catch (error) {
      next(error);
    }
  }

  static async captureLead(req: Request, res: Response, next: NextFunction) {
    try {
      const body = leadSchema.parse(req.body);
      await prisma.lead.create({
        data: {
          email: body.email.trim().toLowerCase(),
          source: body.source || 'landing',
          message: body.message?.trim() || null,
        },
      });
      res.status(201).json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }
}
