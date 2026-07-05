import { prisma } from "@/lib/prisma";

const PULSE_HOURS = [10, 13, 16, 20];
const DEFAULT_PROMPT = "What are you doing right now?";

export async function createDayPulsesForToday(userId: string) {
  const today = startOfDay(new Date());
  const created = [];

  for (const hour of PULSE_HOURS) {
    const scheduledFor = new Date(today);
    scheduledFor.setHours(hour, 0, 0, 0);

    const existing = await prisma.dayPulse.findFirst({
      where: { userId, scheduledFor },
    });

    if (!existing) {
      created.push(
        await prisma.dayPulse.create({
          data: {
            userId,
            scheduledFor,
            prompt: DEFAULT_PROMPT,
          },
        }),
      );
    }
  }

  return created;
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
