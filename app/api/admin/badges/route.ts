import { NextResponse } from "next/server";

import { hasVerifiedAdminSession } from "@/lib/firebase/admin-session";
import { createCustomBadge, listCustomBadges } from "@/lib/firebase/product-badges-server";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  if (!(await hasVerifiedAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const badges = await listCustomBadges();
    return NextResponse.json({ badges });
  } catch {
    return NextResponse.json({ error: "Failed to load badges." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await hasVerifiedAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let label = "";
  try {
    const body = (await request.json()) as { label?: unknown };
    label = String(body.label ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!label || label.length > 60) {
    return NextResponse.json({ error: "Badge label must be 1–60 characters." }, { status: 400 });
  }

  try {
    const badge = await createCustomBadge(label);
    return NextResponse.json(badge);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create badge." },
      { status: 500 },
    );
  }
}
