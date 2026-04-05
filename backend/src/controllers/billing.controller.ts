import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import prisma from '../config/database';
import { env, stripeConfigured } from '../config/env';
import { FarmRequest } from '../middleware/rbac.middleware';
import { AppError } from '../middleware/error.middleware';
import { FarmPlan } from '@prisma/client';
import { FREE_TIER_MAX_PIGS, pigLimitForPlan } from '../config/planLimits';

function stripeClient(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY);
}

export class BillingController {
  static async summary(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const farm = await prisma.farm.findUnique({
        where: { id: req.farmId! },
        include: { _count: { select: { pigs: true } } },
      });
      if (!farm || farm.isDeleted) return next(new AppError('Farm not found', 404));

      const pigCount = farm._count.pigs;
      const limit = pigLimitForPlan(farm.plan);

      res.json({
        myRole: req.memberRole,
        plan: farm.plan,
        pigCount,
        pigLimit: limit,
        nearLimit: farm.plan === FarmPlan.FREE && pigCount >= FREE_TIER_MAX_PIGS * 0.8,
        atLimit: farm.plan === FarmPlan.FREE && pigCount >= FREE_TIER_MAX_PIGS,
        stripeConfigured,
        hasStripeCustomer: Boolean(farm.stripeCustomerId),
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

      const farm = await prisma.farm.findUnique({ where: { id: req.farmId! } });
      if (!farm || farm.isDeleted) return next(new AppError('Farm not found', 404));
      if (farm.plan === FarmPlan.PRO) return next(new AppError('Farm is already on Pro', 400));

      const user = await prisma.user.findUnique({ where: { id: req.userId! } });
      if (!user?.email) return next(new AppError('User email required for checkout', 400));

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: farm.stripeCustomerId ? undefined : user.email,
        ...(farm.stripeCustomerId ? { customer: farm.stripeCustomerId } : {}),
        line_items: [{ price: env.STRIPE_PRICE_ID_PRO, quantity: 1 }],
        success_url: `${env.FRONTEND_URL}/billing?checkout=success`,
        cancel_url: `${env.FRONTEND_URL}/billing?checkout=canceled`,
        client_reference_id: farm.id,
        metadata: { farmId: farm.id },
        subscription_data: { metadata: { farmId: farm.id } },
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
          await prisma.farm.update({
            where: { id: farmId },
            data: {
              plan: FarmPlan.PRO,
              ...(customerId ? { stripeCustomerId: customerId } : {}),
              ...(subId ? { stripeSubscriptionId: subId } : {}),
            },
          });
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
