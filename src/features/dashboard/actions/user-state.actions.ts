import { prisma } from "@/lib/prisma";
import type { UserState } from "@prisma/client";

export async function getUserState(userId: string): Promise<UserState | null> {
  return prisma.userState.findUnique({ where: { userId } });
}
