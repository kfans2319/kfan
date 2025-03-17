import { handleExpiredSubscriptions } from "@/app/(main)/users/[username]/actions";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  return new Response('Not Found', { status: 404 });
}