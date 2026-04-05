import prisma from '../config/database';

export class AuditService {
  static async log(params: {
    userId: string;
    farmId: string;
    action: string;
    entity: string;
    entityId: string;
    details?: string;
  }) {
    return prisma.auditLog.create({ data: params });
  }

  static async getByFarm(farmId: string, page = 1, pageSize = 50) {
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { farmId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where: { farmId } }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}
