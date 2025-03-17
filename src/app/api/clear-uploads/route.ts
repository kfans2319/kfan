import prisma from "@/lib/prisma";
import { UTApi } from "uploadthing/server";

export async function GET(request: Request) {
  return new Response('Not Found', { status: 404 });
}
