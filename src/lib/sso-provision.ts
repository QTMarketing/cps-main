import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/roles";
import type { HubSsoPayload } from "@/lib/hub-sso";

const USER_SELECT = {
  id: true,
  username: true,
  role: true,
  store_id: true,
} as const;

type CpsUser = {
  id: number;
  username: string;
  role: Role;
  store_id: number | null;
};

export class SsoAccountNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsoAccountNotFoundError";
  }
}

export function mapHubRoleToCps(
  hubRole: HubSsoPayload["role"],
  email: string
): Role {
  const superAdminUsername =
    process.env.SUPER_ADMIN_USERNAME?.toLowerCase().trim() ||
    "admin@quicktrackinc.com";

  if (email.toLowerCase() === superAdminUsername) {
    return Role.SUPER_ADMIN;
  }

  if (hubRole === "ADMIN") {
    return Role.OFFICE_ADMIN;
  }

  return Role.USER;
}

function parseDefaultStoreId(): number | null {
  const raw = process.env.CPS_SSO_DEFAULT_STORE_ID?.trim();
  if (!raw) {
    return null;
  }

  const storeId = Number.parseInt(raw, 10);
  return Number.isFinite(storeId) && storeId > 0 ? storeId : null;
}

async function syncCpsUserFromHub(
  user: CpsUser,
  cpsRole: Role,
  defaultStoreId: number | null
): Promise<CpsUser> {
  const updates: { role?: Role; store_id?: number | null } = {};

  if (user.role !== cpsRole) {
    updates.role = cpsRole;
  }

  if (
    cpsRole === Role.USER &&
    user.store_id === null &&
    defaultStoreId !== null
  ) {
    updates.store_id = defaultStoreId;
  }

  if (Object.keys(updates).length === 0) {
    return user;
  }

  return prisma.user.update({
    where: { id: user.id },
    data: updates,
    select: USER_SELECT,
  });
}

function assertEmailMatchesToken(user: CpsUser, email: string) {
  if (user.username.toLowerCase() !== email) {
    throw new SsoAccountNotFoundError(
      "Linked CPS account does not match the Hub user email."
    );
  }
}

/**
 * Resolve a CPS user from Hub SSO using HubAccountLink (by hub user id),
 * with one-time email fallback to auto-link existing CPS accounts.
 */
export async function resolveCpsUserFromHubSso(
  payload: HubSsoPayload
): Promise<{ id: number; username: string; role: Role }> {
  const hubUserId = payload.sub.trim();
  const email = payload.email.trim().toLowerCase();
  const cpsRole = mapHubRoleToCps(payload.role, email);
  const defaultStoreId = parseDefaultStoreId();

  if (!hubUserId) {
    throw new SsoAccountNotFoundError("Hub user id is missing from SSO token.");
  }

  const existingLink = await prisma.hubAccountLink.findUnique({
    where: { hub_user_id: hubUserId },
    include: { user: { select: USER_SELECT } },
  });

  if (existingLink) {
    assertEmailMatchesToken(existingLink.user, email);
    const synced = await syncCpsUserFromHub(
      existingLink.user,
      cpsRole,
      defaultStoreId
    );
    return {
      id: synced.id,
      username: synced.username,
      role: (synced.role as Role) ?? cpsRole,
    };
  }

  const emailMatches = await prisma.user.findMany({
    where: { username: email },
    select: USER_SELECT,
  });

  if (emailMatches.length === 1) {
    const matchedUser = emailMatches[0];
    await prisma.hubAccountLink.create({
      data: {
        hub_user_id: hubUserId,
        user_id: matchedUser.id,
        linked_via: "email_match",
      },
    });

    const synced = await syncCpsUserFromHub(
      matchedUser,
      cpsRole,
      defaultStoreId
    );
    return {
      id: synced.id,
      username: synced.username,
      role: (synced.role as Role) ?? cpsRole,
    };
  }

  if (emailMatches.length === 0) {
    throw new SsoAccountNotFoundError(
      "No CPS account found for this Hub user. Ask an administrator to create a CPS user with the same email, then open Cheque Printing again."
    );
  }

  throw new SsoAccountNotFoundError(
    "Multiple CPS accounts match this email. Contact an administrator to resolve the duplicate accounts."
  );
}

/** @deprecated Use resolveCpsUserFromHubSso */
export const provisionCpsUserFromHubSso = resolveCpsUserFromHubSso;
