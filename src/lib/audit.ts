import { prisma } from '@/lib/prisma';

export async function createAuditLog(
  userId: string,
  action: string,
  entityType: string,
  entityId: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}





