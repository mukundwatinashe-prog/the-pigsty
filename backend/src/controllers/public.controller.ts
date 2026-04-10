import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/error.middleware';
import { createPigImportTemplateBuffer } from './import.controller';
import { recordAndNotifyContact } from '../services/leadContact.service';

const contactPublicSchema = z.object({
  firstName: z.string().min(1).max(80).trim(),
  lastName: z.string().min(1).max(80).trim(),
  email: z.string().email().trim(),
  phone: z.string().max(40).optional().nullable(),
  subject: z.string().max(200).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  source: z.enum(['landing']).optional().default('landing'),
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

  static async submitContact(req: Request, res: Response, next: NextFunction) {
    try {
      const body = contactPublicSchema.parse(req.body);
      await recordAndNotifyContact({
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone?.trim() || null,
        subject: body.subject?.trim() || null,
        message: body.message?.trim() || null,
        source: body.source,
        userId: null,
        farmId: null,
      });
      res.status(201).json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }
}
