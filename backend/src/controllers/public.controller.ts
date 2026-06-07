import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/error.middleware';
import { createPigImportTemplateBuffer } from './import.controller';
import { recordAndNotifyContact } from '../services/leadContact.service';
import { contactPageInboxAddress } from '../services/contactNotify.service';
import { aiService } from '../services/ai.service';
import { getAiSystemPrompt } from '../utils/aiPrompts';

const contactPublicSchema = z.object({
  firstName: z.string().min(1).max(80).trim(),
  lastName: z.string().min(1).max(80).trim(),
  email: z.string().email().trim(),
  phone: z.string().max(40).optional().nullable(),
  subject: z.string().max(200).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  source: z.enum(['landing', 'contact']).optional().default('landing'),
});

const publicChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(5000),
      }),
    )
    .min(1)
    .max(24),
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
      // Dedicated Contact page submissions are delivered to the contact-page inbox.
      const inboxOverride = body.source === 'contact' ? contactPageInboxAddress() : undefined;
      await recordAndNotifyContact(
        {
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          phone: body.phone?.trim() || null,
          subject: body.subject?.trim() || null,
          message: body.message?.trim() || null,
          source: body.source,
          userId: null,
          farmId: null,
        },
        inboxOverride,
      );
      res.status(201).json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  /** Stateless help chat for the public Contact page ("Piggy"). No account or persistence. */
  static async chat(req: Request, res: Response, next: NextFunction) {
    try {
      const { messages } = publicChatSchema.parse(req.body ?? {});
      const aiResponse = await aiService.generateResponse(messages, getAiSystemPrompt('Piggy'));
      if (!aiResponse.content.trim()) {
        throw new AppError('AI provider returned an empty response', 502);
      }
      res.json({ content: aiResponse.content });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }
}
