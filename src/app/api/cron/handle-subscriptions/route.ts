import { handleExpiredSubscriptions } from "@/app/(main)/users/[username]/actions";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET() {
  const authHeader = headers().get("Authorization");
  
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  await handleExpiredSubscriptions();
  return new NextResponse("OK");
}