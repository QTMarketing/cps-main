import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/roles";

interface CpsUserScope {
  storeId: number | null;
  storeName: string | null;
  isAdmin: boolean;
}

async function resolveCpsUserScope(
  hubUserEmail: string | null | undefined,
): Promise<CpsUserScope> {
  if (!hubUserEmail?.trim()) {
    return { storeId: null, storeName: null, isAdmin: true };
  }

  const user = await prisma.user.findUnique({
    where: { username: hubUserEmail.trim().toLowerCase() },
    select: {
      role: true,
      store_id: true,
      Store: { select: { name: true } },
    },
  });

  if (!user) {
    return { storeId: null, storeName: null, isAdmin: true };
  }

  const isAdmin =
    user.role === Role.SUPER_ADMIN ||
    user.role === Role.OFFICE_ADMIN ||
    user.role === Role.ADMIN ||
    user.role === Role.BACK_OFFICE;

  return {
    storeId: user.store_id,
    storeName: user.Store?.name ?? null,
    isAdmin,
  };
}

function checkWhere(scope: CpsUserScope) {
  if (scope.isAdmin) {
    return {};
  }

  if (scope.storeId === null) {
    return { id: -1 };
  }

  return { store_id: scope.storeId };
}

export async function getPendingChecksSummary(hubUserEmail?: string | null) {
  const scope = await resolveCpsUserScope(hubUserEmail);
  const pendingCount = await prisma.check.count({
    where: {
      status: "PENDING",
      ...checkWhere(scope),
    },
  });

  return {
    pendingCount,
    storeName: scope.isAdmin ? null : scope.storeName,
  };
}

export async function getRecentChecksSummary(
  hubUserEmail: string | null | undefined,
  limit: number,
) {
  const scope = await resolveCpsUserScope(hubUserEmail);
  const checks = await prisma.check.findMany({
    where: checkWhere(scope),
    orderBy: { created_at: "desc" },
    take: limit,
    select: {
      check_number: true,
      payee_name: true,
      amount: true,
      status: true,
      created_at: true,
    },
  });

  return {
    storeName: scope.isAdmin ? null : scope.storeName,
    checks: checks.map((check) => ({
      checkNumber: check.check_number?.toString() ?? null,
      payeeName: check.payee_name,
      amount: check.amount?.toString() ?? null,
      status: check.status,
      createdAt: check.created_at.toISOString(),
    })),
  };
}

export type ChequeTotalsScope = "all" | "pending";

export async function getChequeTotalsSummary(
  hubUserEmail: string | null | undefined,
  totalsScope: ChequeTotalsScope = "all",
) {
  const scope = await resolveCpsUserScope(hubUserEmail);
  const where = {
    ...checkWhere(scope),
    ...(totalsScope === "pending" ? { status: "PENDING" } : {}),
  };

  const [aggregate, pendingCount] = await Promise.all([
    prisma.check.aggregate({
      where,
      _sum: { amount: true },
      _count: { id: true },
    }),
    totalsScope === "all"
      ? prisma.check.count({
          where: { status: "PENDING", ...checkWhere(scope) },
        })
      : Promise.resolve(null),
  ]);

  const totalAmount = aggregate._sum.amount?.toString() ?? "0";
  const chequeCount = aggregate._count.id;

  return {
    scope: totalsScope,
    chequeCount,
    totalAmount,
    pendingCount: totalsScope === "all" ? pendingCount : chequeCount,
    storeName: scope.isAdmin ? null : scope.storeName,
  };
}
