import { FarmPlan, Prisma, ReportEmailCadence } from '@prisma/client';
import prisma from '../config/database';
import { onHandPigsWhere } from '../lib/pigStock';
import { fetchFinancialsSummary, formatFinancialsPeriodLabel } from './financials-summary.service';
import { FEED_TYPES, getStockKgByType } from './feed.service';
import { notifyFarmLeads } from './farmNotify.service';
import { sendFarmAlertSms } from './sms.service';

const GESTATION_DAYS = 114;
const FARROWING_ALERT_DAYS = 7;

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeekMondayUtc(d: Date): Date {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function shouldSendWeekly(lastSent: Date | null, now: Date): boolean {
  return !lastSent || lastSent < startOfWeekMondayUtc(now);
}

function shouldSendMonthly(lastSent: Date | null, now: Date): boolean {
  return !lastSent || lastSent < startOfMonthUtc(now);
}

async function sendWeeklyReportEmail(farmId: string, farmName: string): Promise<boolean> {
  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - 6);
  const from = toYmd(fromDate);
  const to = toYmd(now);

  const [pigCount, salesAgg, financials] = await Promise.all([
    prisma.pig.count({ where: onHandPigsWhere(farmId) }),
    prisma.saleRecord.aggregate({
      where: {
        farmId,
        saleDate: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T23:59:59.999Z`) },
      },
      _sum: { totalPrice: true },
      _count: true,
    }),
    fetchFinancialsSummary(farmId, { from, to, recentSalesLimit: 5 }),
  ]);

  const revenue = Number(salesAgg._sum.totalPrice ?? 0);
  const herdValue = financials?.herd.estimatedValueAtFarmPrice ?? 0;
  const cur = financials?.farm.currency ?? 'GBP';

  await notifyFarmLeads({
    farmId,
    subject: `[The Pigsty] Weekly farm report — ${farmName}`,
    text: [
      `Weekly summary for "${farmName}" (${from} – ${to})`,
      '',
      `On-hand pigs: ${pigCount}`,
      `Estimated herd value: ${cur} ${herdValue.toFixed(2)}`,
      `Sales this week: ${salesAgg._count} transaction(s), ${cur} ${revenue.toFixed(2)} revenue`,
      financials
        ? `Feed purchases (period): ${cur} ${financials.feedPurchasesInPeriod.totalSpend.toFixed(2)}`
        : '',
      '',
      `View live data: ${process.env.FRONTEND_URL?.replace(/\/$/, '') || 'https://the-pigsty.org'}/financials`,
    ]
      .filter(Boolean)
      .join('\n'),
    logTag: 'enterprise-weekly-report',
  });
  return true;
}

async function sendMonthlyReportEmail(farmId: string, farmName: string): Promise<boolean> {
  const now = new Date();
  const monthStart = startOfMonthUtc(now);
  const prevEnd = new Date(monthStart);
  prevEnd.setUTCDate(0);
  const prevStart = startOfMonthUtc(prevEnd);
  const from = toYmd(prevStart);
  const to = toYmd(prevEnd);

  const data = await fetchFinancialsSummary(farmId, { from, to, recentSalesLimit: 10 });
  if (!data) return false;

  const { farm, herd, salesInPeriod, feedPurchasesInPeriod, period } = data;
  const cur = farm.currency;

  await notifyFarmLeads({
    farmId,
    subject: `[The Pigsty] Monthly financial report — ${farmName}`,
    text: [
      `Monthly financial summary for "${farmName}"`,
      `Period: ${formatFinancialsPeriodLabel(period)}`,
      '',
      `Inventory headcount: ${herd.inventoryHeadcount}`,
      `Estimated herd value (current): ${cur} ${herd.estimatedValueAtFarmPrice.toFixed(2)}`,
      `Sales revenue (period): ${cur} ${salesInPeriod.revenue.toFixed(2)} (${salesInPeriod.transactionCount} sales)`,
      `Feed purchase spend (period): ${cur} ${feedPurchasesInPeriod.totalSpend.toFixed(2)}`,
      '',
      `Full financials: ${process.env.FRONTEND_URL?.replace(/\/$/, '') || 'https://the-pigsty.org'}/financials`,
    ].join('\n'),
    logTag: 'enterprise-monthly-report',
  });
  return true;
}

async function buildFarrowingAlertMessage(farmId: string, farmName: string): Promise<string | null> {
  const sows = await prisma.pig.findMany({
    where: {
      farmId,
      serviced: true,
      servicedDate: { not: null },
      stage: { in: ['SOW', 'GILT'] },
      status: 'ACTIVE',
    },
    select: { tagNumber: true, servicedDate: true },
  });

  const now = Date.now();
  const msDay = 1000 * 60 * 60 * 24;
  const dueSoon = sows
    .map((s) => {
      const serviced = new Date(s.servicedDate!);
      const expected = new Date(serviced);
      expected.setDate(expected.getDate() + GESTATION_DAYS);
      const daysUntil = Math.ceil((expected.getTime() - now) / msDay);
      return { tag: s.tagNumber, daysUntil };
    })
    .filter((s) => s.daysUntil >= 0 && s.daysUntil <= FARROWING_ALERT_DAYS)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  if (!dueSoon.length) return null;

  const lines = dueSoon.slice(0, 3).map((s) => `${s.tag} (${s.daysUntil}d)`);
  const extra = dueSoon.length > 3 ? ` +${dueSoon.length - 3} more` : '';
  return `The Pigsty — ${farmName}: ${dueSoon.length} sow(s) due within ${FARROWING_ALERT_DAYS} days: ${lines.join(', ')}${extra}.`;
}

async function buildLowStockAlertMessage(
  farm: { id: string; name: string; feedLowStockThresholdKg: Prisma.Decimal | null },
): Promise<string | null> {
  const threshold = farm.feedLowStockThresholdKg ?? new Prisma.Decimal(50);
  const stock = await getStockKgByType(farm.id);
  const low = FEED_TYPES.filter((t) => stock[t].lte(threshold));
  if (!low.length) return null;

  const labels = low
    .slice(0, 3)
    .map((t) => t.replace(/_/g, ' ').toLowerCase())
    .join(', ');
  const extra = low.length > 3 ? ` +${low.length - 3} more` : '';
  return `The Pigsty — ${farm.name}: low feed stock (${parseFloat(threshold.toFixed(1))} kg threshold): ${labels}${extra}.`;
}

export async function runEnterpriseAutomationCron(): Promise<{ reportsSent: number; smsSent: number }> {
  const now = new Date();
  const todayStart = startOfDayUtc(now);
  let reportsSent = 0;
  let smsSent = 0;

  const farms = await prisma.farm.findMany({
    where: { isDeleted: false, plan: FarmPlan.ENTERPRISE },
  });

  for (const farm of farms) {
    if (farm.reportEmailCadence === ReportEmailCadence.WEEKLY && now.getUTCDay() === 1) {
      if (shouldSendWeekly(farm.reportEmailLastSentAt, now)) {
        await sendWeeklyReportEmail(farm.id, farm.name);
        await prisma.farm.update({
          where: { id: farm.id },
          data: { reportEmailLastSentAt: now },
        });
        reportsSent++;
      }
    } else if (farm.reportEmailCadence === ReportEmailCadence.MONTHLY && now.getUTCDate() === 1) {
      if (shouldSendMonthly(farm.reportEmailLastSentAt, now)) {
        await sendMonthlyReportEmail(farm.id, farm.name);
        await prisma.farm.update({
          where: { id: farm.id },
          data: { reportEmailLastSentAt: now },
        });
        reportsSent++;
      }
    }

    const phone = farm.alertSmsPhone?.trim();
    if (!phone) continue;

    if (farm.alertSmsFarrowing) {
      const last = farm.alertSmsLastFarrowingAt;
      if (!last || last < todayStart) {
        const msg = await buildFarrowingAlertMessage(farm.id, farm.name);
        if (msg && (await sendFarmAlertSms(phone, msg))) {
          await prisma.farm.update({
            where: { id: farm.id },
            data: { alertSmsLastFarrowingAt: now },
          });
          smsSent++;
        }
      }
    }

    if (farm.alertSmsLowStock) {
      const last = farm.alertSmsLastLowStockAt;
      if (!last || last < todayStart) {
        const msg = await buildLowStockAlertMessage(farm);
        if (msg && (await sendFarmAlertSms(phone, msg))) {
          await prisma.farm.update({
            where: { id: farm.id },
            data: { alertSmsLastLowStockAt: now },
          });
          smsSent++;
        }
      }
    }
  }

  return { reportsSent, smsSent };
}
