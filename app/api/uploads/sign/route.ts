import { NextResponse } from "next/server";
import { getUserFromJwt } from "@/lib/appwrite/admin-server";
import { hasVerifiedAdminSession } from "@/lib/firebase/admin-session";
import { createUploadSignature } from "@/lib/cloudinary-server";
import { errorMessage, log, newCorrelationId } from "@/lib/logger";
import { isUploadKind } from "@/lib/uploads";

export const runtime = "nodejs";

const SCOPE = "uploads.sign";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }
  return header.slice(7).trim();
}

export async function POST(request: Request) {
  const correlationId = newCorrelationId();

  try {
    const body = (await request.json().catch(() => ({}))) as { kind?: unknown };
    const kind = body.kind;

    if (!isUploadKind(kind)) {
      return NextResponse.json({ error: "Invalid upload kind." }, { status: 400 });
    }

    // Authorize per kind: product images require an admin session; review images
    // require any authenticated user.
    if (kind === "product") {
      if (!(await hasVerifiedAdminSession())) {
        return NextResponse.json({ error: "Admin session required." }, { status: 401 });
      }
    } else {
      const token = getBearerToken(request);
      if (!token) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 });
      }
      // Throws if the JWT is invalid/expired.
      await getUserFromJwt(token);
    }

    const signature = createUploadSignature(kind);
    log("info", SCOPE, "signed", { correlationId, kind, folder: signature.folder });

    return NextResponse.json(signature);
  } catch (error) {
    log("error", SCOPE, "failed", { correlationId, message: errorMessage(error) });
    return NextResponse.json({ error: "Failed to sign upload.", correlationId }, { status: 500 });
  }
}
