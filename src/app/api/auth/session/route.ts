import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonGuardError } from "@/lib/guards";

export async function GET(req: NextRequest) {
  try {
    console.log('[SESSION] Request received');
    console.log('[SESSION] Cookies:', req.cookies.getAll());
    console.log('[SESSION] Auth header:', req.headers.get('authorization'));
    
    const ctx = await requireAuth(req);

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        username: true,
        role: true,
        assigned_bank_id: true,
        store_id: true,
        created_at: true,
        Store: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    return NextResponse.json({
      success: true,
      user: {
        id: String(user.id),
        username: user.username,
        role: user.role,
        email: null,
        assignedBankId: user.assigned_bank_id
          ? String(user.assigned_bank_id)
          : null,
        createdAt: user.created_at,
        storeId: user.store_id, // Direct 1:1 store assignment
        store: user.Store ? {
          id: user.Store.id,
          code: user.Store.code,
          name: user.Store.name,
        } : null,
      },
    });
  } catch (error) {
    return jsonGuardError(error);
  }
}

