import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/errors";
import { PASSWORD_HEADER, passwordRequired } from "@/lib/guard";

export const runtime = "nodejs";

/** Lets the UI know whether to show the password prompt. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ required: passwordRequired() });
}

/** Checks a candidate password so the UI can validate before storing it. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!passwordRequired()) return NextResponse.json({ ok: true });

    const supplied = request.headers.get(PASSWORD_HEADER);
    if (supplied !== process.env.APP_PASSWORD) {
      return NextResponse.json({ error: "That password is not right." }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
