import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export function isPrismaConfigured(): boolean {
  const dbUrl = process.env.DATABASE_URL;
  return Boolean(
    dbUrl &&
    (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) &&
    !dbUrl.includes('[PASSWORD]') &&
    !dbUrl.includes('your-password')
  );
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;

