import { Response, NextFunction } from 'express';
import { FarmRequest } from '../middleware/rbac.middleware';
import { AppError } from '../middleware/error.middleware';
import { fetchFinancialsSummary, parseFinancialsDateQuery } from '../services/financials-summary.service';

export class FinancialController {
  static async summary(req: FarmRequest, res: Response, next: NextFunction) {
    try {
      const parsed = parseFinancialsDateQuery(req.query as Record<string, unknown>);
      if (parsed.error) return next(new AppError(parsed.error, 400));

      const data = await fetchFinancialsSummary(req.farmId!, {
        from: parsed.from ?? null,
        to: parsed.to ?? null,
        recentSalesLimit: 40,
      });
      if (!data) return next(new AppError('Farm not found', 404));

      const { farm, herd, breakdownByStage, breakdownByPen, period, salesInPeriod, recentSales } = data;

      res.json({
        farm: {
          name: farm.name,
          currency: farm.currency,
          weightUnit: farm.weightUnit,
          pricePerKg: farm.pricePerKg,
        },
        period,
        herd,
        breakdownByStage,
        breakdownByPen,
        salesInPeriod,
        recentSales: recentSales.map((s) => ({
          id: s.id,
          tagNumber: s.tagNumber,
          saleType: s.saleType,
          saleDate: s.saleDate.toISOString(),
          weightAtSale: s.weightAtSale,
          pricePerKg: s.pricePerKg,
          totalPrice: s.totalPrice,
          buyer: s.buyer,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
}
