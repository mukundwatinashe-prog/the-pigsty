import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import prisma from '../config/database';
import { env, stripeConfigured } from '../config/env';
import { FarmRequest } from '../middleware/rbac.middleware';
import { AppError } from '../middleware/error.middleware';
import { FarmPlan } from '@prisma/client';
import { GROWER_TIER_MAX_MEMBERS, GROWER_TRIAL_DAYS, pigLimitForPlan, allowsFinancialsExport, allowsEnterpriseAutomation } from '../config/planLimits';
import { onHandPigsWhere } from '../lib/pigStock';
import { sendUserEmail } from '../services/email/emailSender';
import { upgradeEmail } from '../services/email/templates';

function stripeClient(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY);
}

const checkoutSchema = z.object({
  plan: z.enum(['GROWER', 'ENTERPRISE']).default('GROWER'),
  /** When true, start a Grower free trial (one per account email). Paid £19 checkout omits this. */
  startTrial: z.boolean().optional().default(false),
});

function labelForPlan(plan: FarmPlan): string {
  if (plan === FarmPlan.GROWER) return 'Grower';
  if (plan === FarmPlan.ENTERPRISE) return 'Enterprise';
  return 'Free';
}

function matchesEnterpriseTier(priceId: string | null, productId: string | null): boolean {
  if (priceId && priceId === env.STRIPE_PRICE_ID_ENTERPRISE) return true;
  if (productId && productId === env.STRIPE_PRODUCT_ID_ENTERPRISE) return true;
  return false;
}

/** Emails the farm owner that their plan has been upgraded. Fire-and-forget. */
async function notifyFarmUpgrade(farmId: string, plan: FarmPlan): Promise<void> {
  try {
    const owner = await prisma.farmMember.findFirst({
      where: { farmId, role: 'OWNER' },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!owner?.user?.email) return;
    const tmpl = upgradeEmail(owner.user.name, labelForPlan(plan));
    await sendUserEmail({ to: owner.user.email, ...tmpl });
  } catch (err) {
    console.error('[billing] upgrade email failed:', err);
  }
}

function planFromSubscription(sub: Stripe.Subscription): FarmPlan {
  const firstItem = sub.items.data[0];
  const priceId = typeof firstItem?.price === 'string' ? firstItem.price : firstItem?.price?.id;
  const productId =
    typeof firstItem?.price === 'string'
      ? null
      : typeof firstItem?.price?.product === 'string'
        ? firstItem.price.product
        : firstItem?.price?.product?.id ?? null;
  if (matchesEnterpriseTier(priceId ?? null, productId)) return FarmPlan.ENTERPRISE;
  return FarmPlan.GROWER;
}

async function resolveCheckoutPriceId(
  stripe: Stripe,
  plan: 'GROWER' | 'ENTERPRISE',
): Promise<string> {
  const configuredPriceId =
    plan === 'ENTERPRISE' ? env.STRIPE_PRICE_ID_ENTERPRISE : env.STRIPE_PRICE_ID_GROWER;
  if (configuredPriceId) return configuredPriceId;

  const configuredProductId =
    plan === 'ENTERPRISE' ? env.STRIPE_PRODUCT_ID_ENTERPRISE : env.STRIPE_PRODUCT_ID_GROWER;
  if (!configuredProductId) {
    throw new AppError(`${labelForPlan(plan as FarmPlan)} billing is not configured yet. Contact support.`, 503);
  }

  const product = await stripe.products.retrieve(configuredProductId, {
    expand: ['default_price'],
  });
  if (product.deleted) {
    throw new AppError(`${labelForPlan(plan as FarmPlan)} billing product is archived. Contact support.`, 503);
  }

  const defaultPriceId =
    typeof product.default_price === 'string' ? product.default_price : product.default_price?.id;
  if (!defaultPriceId) {
    throw new AppError(
      `${labelForPlan(plan as FarmPlan)} product has no default price in Stripe. Contact support.`,
      503,
    );
  }

  return defaultPriceId;
}

export class BillingController {
  static async summary(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const farm = await prisma.farm.findUnique({
        where: { id: req.farmId! },
      });
      if (!farm || farm.isDeleted) return next(new AppError('Farm not found', 404));

      const pigCount = await prisma.pig.count({ where: onHandPigsWhere(req.farmId!) });
      const limit = pigLimitForPlan(farm.plan);
      const user = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { growerTrialUsedAt: true },
      });
      const growerTrialUsed = Boolean(user?.growerTrialUsedAt);
      const canStartGrowerTrial = farm.plan === FarmPlan.FREE && !growerTrialUsed;

      res.json({
        myRole: req.memberRole,
        plan: farm.plan,
        planLabel: labelForPlan(farm.plan),
        pigCount,
        pigLimit: limit,
        nearLimit: limit != null && pigCount >= limit * 0.8,
        atLimit: limit != null && pigCount >= limit,
        canAccessReports: farm.plan !== FarmPlan.FREE,
        canUseMassImport: farm.plan !== FarmPlan.FREE,
        canManageTeam: farm.plan !== FarmPlan.FREE,
        canExportFinancials: allowsFinancialsExport(farm.plan),
        canUseEnterpriseAutomation: allowsEnterpriseAutomation(farm.plan),
        memberLimit: farm.plan === FarmPlan.FREE ? 1 : farm.plan === FarmPlan.GROWER ? GROWER_TIER_MAX_MEMBERS : null,
        stripeConfigured,
        hasStripeCustomer: Boolean(farm.stripeCustomerId),
        growerTrialUsed,
        canStartGrowerTrial,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createCheckoutSession(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      if (!stripeConfigured) {
        return next(new AppError('Online billing is not configured. Contact support to upgrade.', 503));
      }
      const stripe = stripeClient();
      if (!stripe) return next(new AppError('Stripe not configured', 503));
      const { plan, startTrial } = checkoutSchema.parse(req.body ?? {});

      const farm = await prisma.farm.findUnique({ where: { id: req.farmId! } });
      if (!farm || farm.isDeleted) return next(new AppError('Farm not found', 404));
      if (farm.plan === plan) {
        return next(new AppError(`Farm is already on ${labelForPlan(farm.plan)}`, 400));
      }

      const user = await prisma.user.findUnique({ where: { id: req.userId! } });
      if (!user?.email) return next(new AppError('User email required for checkout', 400));

      if (startTrial) {
        if (plan !== 'GROWER') {
          return next(new AppError('Free trial is only available for the Grower plan', 400));
        }
        if (farm.plan !== FarmPlan.FREE) {
          return next(new AppError('Free trial is only available from the Smallholder plan', 400));
        }
        if (user.growerTrialUsedAt) {
          return next(new AppError('You have already used your one free Grower trial for this email address', 400));
        }
      }

      const targetPriceId = await resolveCheckoutPriceId(stripe, plan);

      if (farm.stripeSubscriptionId && farm.plan === FarmPlan.GROWER && plan === 'ENTERPRISE') {
        const sub = await stripe.subscriptions.retrieve(farm.stripeSubscriptionId);
        const itemId = sub.items.data[0]?.id;
        if (!itemId) return next(new AppError('Could not update subscription', 500));
        await stripe.subscriptions.update(farm.stripeSubscriptionId, {
          items: [{ id: itemId, price: targetPriceId }],
          proration_behavior: 'create_prorations',
          metadata: { farmId: farm.id, plan: 'ENTERPRISE' },
        });
        await prisma.farm.update({
          where: { id: farm.id },
          data: { plan: FarmPlan.ENTERPRISE },
        });
        void notifyFarmUpgrade(farm.id, FarmPlan.ENTERPRISE);
        return res.json({ url: `${env.FRONTEND_URL}/billing?checkout=success` });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: farm.stripeCustomerId ? undefined : user.email,
        ...(farm.stripeCustomerId ? { customer: farm.stripeCustomerId } : {}),
        line_items: [{ price: targetPriceId, quantity: 1 }],
        success_url: `${env.FRONTEND_URL}/billing?checkout=success`,
        cancel_url: `${env.FRONTEND_URL}/billing?checkout=canceled`,
        client_reference_id: farm.id,
        metadata: {
          farmId: farm.id,
          plan,
          startTrial: startTrial ? 'true' : 'false',
          userId: req.userId!,
        },
        subscription_data: {
          metadata: { farmId: farm.id, plan, startTrial: startTrial ? 'true' : 'false', userId: req.userId! },
          ...(startTrial && plan === 'GROWER' ? { trial_period_days: GROWER_TRIAL_DAYS } : {}),
        },
      });

      res.json({ url: session.url });
    } catch (error) {
      next(error);
    }
  }

  static async createPortalSession(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      if (!stripeConfigured) {
        return next(new AppError('Billing portal is not configured.', 503));
      }
      const stripe = stripeClient();
      if (!stripe) return next(new AppError('Stripe not configured', 503));

      const farm = await prisma.farm.findUnique({ where: { id: req.farmId! } });
      if (!farm?.stripeCustomerId) {
        return next(new AppError('No billing account for this farm yet.', 400));
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: farm.stripeCustomerId,
        return_url: `${env.FRONTEND_URL}/billing`,
      });

      res.json({ url: session.url });
    } catch (error) {
      next(error);
    }
  }

  static async webhook(req: Request, res: Response) {
    if (!stripeConfigured || !env.STRIPE_WEBHOOK_SECRET) {
      return res.status(503).send('Webhook not configured');
    }
    const stripe = stripeClient();
    if (!stripe) return res.status(503).send('Stripe not configured');

    const sig = req.headers['stripe-signature'];
    if (!sig || !Buffer.isBuffer(req.body)) {
      return res.status(400).send('Missing signature or body');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return res.status(400).send('Invalid signature');
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const farmId = session.metadata?.farmId || session.client_reference_id;
          if (!farmId) break;
          const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
          const subId =
            typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
          const newPlan = session.metadata?.plan === 'ENTERPRISE' ? FarmPlan.ENTERPRISE : FarmPlan.GROWER;
          const before = await prisma.farm.findUnique({ where: { id: farmId }, select: { plan: true } });
          await prisma.farm.update({
            where: { id: farmId },
            data: {
              plan: newPlan,
              ...(customerId ? { stripeCustomerId: customerId } : {}),
              ...(subId ? { stripeSubscriptionId: subId } : {}),
            },
          });
          if (before && before.plan !== newPlan) {
            void notifyFarmUpgrade(farmId, newPlan);
          }
          if (session.metadata?.startTrial === 'true' && session.metadata?.userId) {
            await prisma.user.updateMany({
              where: { id: session.metadata.userId, growerTrialUsedAt: null },
              data: { growerTrialUsedAt: new Date() },
            });
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const farmId = sub.metadata?.farmId;
          if (farmId) {
            await prisma.farm.updateMany({
              where: { id: farmId, stripeSubscriptionId: sub.id },
              data: { plan: FarmPlan.FREE, stripeSubscriptionId: null },
            });
          } else {
            await prisma.farm.updateMany({
              where: { stripeSubscriptionId: sub.id },
              data: { plan: FarmPlan.FREE, stripeSubscriptionId: null },
            });
          }
          break;
        }
        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          const mappedPlan = planFromSubscription(sub);
          const farmId = sub.metadata?.farmId;
          const where = farmId
            ? { id: farmId, stripeSubscriptionId: sub.id }
            : { stripeSubscriptionId: sub.id };
          const target = await prisma.farm.findFirst({ where, select: { id: true, plan: true } });
          await prisma.farm.updateMany({ where, data: { plan: mappedPlan } });
          if (target && target.plan === FarmPlan.FREE && mappedPlan !== FarmPlan.FREE) {
            void notifyFarmUpgrade(target.id, mappedPlan);
          }
          break;
        }
        default:
          break;
      }
    } catch (e) {
      console.error('Stripe webhook handler error', e);
      return res.status(500).send('Handler error');
    }

    res.json({ received: true });
  }
}
