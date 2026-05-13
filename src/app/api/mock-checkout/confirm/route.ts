import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const apptId = String(form.get("appt") ?? "");
  if (!apptId) return NextResponse.redirect(new URL("/", req.url));
  await prisma.appointment.update({
    where: { id: apptId },
    data: { depositStatus: "paid" },
  }).catch(() => undefined);
  return NextResponse.redirect(new URL(`/deposit/thanks?appt=${apptId}`, req.url));
}
