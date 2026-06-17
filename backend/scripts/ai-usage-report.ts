import prisma from '../src/config/database';

async function main() {
  const [summary] = await prisma.$queryRawUnsafe<
    Array<{ total: number; tokens: number; first_use: Date | null; last_use: Date | null }>
  >(
    `SELECT COUNT(*)::int AS total,
            COALESCE(SUM("tokensUsed"), 0)::int AS tokens,
            MIN("createdAt") AS first_use,
            MAX("createdAt") AS last_use
     FROM ai_usage_logs`,
  );
  const byEndpoint = await prisma.$queryRawUnsafe<
    Array<{ endpoint: string; requests: number; tokens: number }>
  >(
    `SELECT endpoint, COUNT(*)::int AS requests, COALESCE(SUM("tokensUsed"), 0)::int AS tokens
     FROM ai_usage_logs GROUP BY endpoint ORDER BY tokens DESC`,
  );
  const [convos] = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
    `SELECT COUNT(*)::int AS c FROM ai_conversations`,
  );
  const [msgs] = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
    `SELECT COUNT(*)::int AS c FROM ai_messages`,
  );
  const recent = await prisma.$queryRawUnsafe<
    Array<{ createdAt: Date; endpoint: string; tokensUsed: number | null }>
  >(
    `SELECT "createdAt", endpoint, "tokensUsed" FROM ai_usage_logs ORDER BY "createdAt" DESC LIMIT 15`,
  );
  console.log(JSON.stringify({ summary, byEndpoint, conversations: convos.c, messages: msgs.c, recent }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
