import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, jsonGuardError } from "@/lib/guards";
import { Role } from "@/lib/roles";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, [Role.ADMIN, Role.SUPER_ADMIN]);
    const corporations = await prisma.corporation.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        owner: true,
        ein: true,
      },
    });
    return NextResponse.json({ corporations });
  } catch (error: any) {
    if (typeof error?.status === "number") {
      return jsonGuardError(error);
    }
    console.error("Error loading corporations:", error);
    return NextResponse.json(
      { error: "Failed to load corporations" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, [Role.ADMIN, Role.SUPER_ADMIN]);
    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const owner =
      typeof body?.owner === "string" && body.owner.trim().length > 0
        ? body.owner.trim()
        : null;
    const ein =
      typeof body?.ein === "string" && body.ein.trim().length > 0
        ? body.ein.trim()
        : null;

    if (!name) {
      return NextResponse.json(
        { error: "Corporation name is required" },
        { status: 400 }
      );
    }

    const corporation = await prisma.corporation.create({
      data: {
        name,
        owner,
        ein,
      },
      select: {
        id: true,
        name: true,
        owner: true,
        ein: true,
      },
    });

    return NextResponse.json(corporation, { status: 201 });
  } catch (error: any) {
    if (typeof error?.status === "number") {
      return jsonGuardError(error);
    }
    console.error("Error creating corporation:", error);
    return NextResponse.json(
      { error: "Failed to create corporation" },
      { status: 500 }
    );
  }
}