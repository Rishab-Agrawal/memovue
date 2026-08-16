"use server";

import { revalidatePath } from "next/cache";

import { mintCoupons } from "@/lib/coupons";
import { requireAdmin } from "@/lib/session";
import { fieldErrors, mintCouponSchema } from "@/lib/validation";

export async function mintAction(
  input: { count: number; note?: string },
): Promise<{ ok: true; codes: string[] } | { ok: false; error: string }> {
  await requireAdmin();

  const parsed = mintCouponSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: Object.values(fieldErrors(parsed.error))[0] ?? "Invalid" };
  }

  const codes = await mintCoupons(parsed.data.count, parsed.data.note);
  revalidatePath("/admin");
  return { ok: true, codes };
}
