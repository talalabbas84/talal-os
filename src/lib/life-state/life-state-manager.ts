import { prisma } from "@/lib/prisma";
import { detectLifeState } from "./life-state-detector";
import { recordStateTransition } from "./life-state-history";
import type { LifeStateContext, LifeStateType } from "./life-state-types";

type StateSignals = Omit<LifeStateContext, "currentLifeState" | "lifeStateAge">;

// Gets the current active life state, detects if it should change, persists transition.
// Call this once per page load from the server component.
export async function getActiveLifeState(
  userId: string,
  signals: StateSignals,
): Promise<LifeStateType> {
  const userState = await prisma.userState.findUnique({ where: { userId } });
  const persisted = (userState?.currentLifeState ?? "DEFAULT") as LifeStateType;
  const enteredAt = userState?.lifeStateEnteredAt ?? signals.now;
  const lifeStateAge = (signals.now.getTime() - enteredAt.getTime()) / 60_000;

  const ctx: LifeStateContext = { ...signals, currentLifeState: persisted, lifeStateAge };
  const detected = detectLifeState(ctx);

  if (detected !== persisted) {
    await transitionState(userId, detected, "auto", signals.now);
  }

  return detected;
}

export async function transitionState(
  userId: string,
  to: LifeStateType,
  triggeredBy: "auto" | "capture" | "event" | "manual",
  now: Date,
): Promise<void> {
  await Promise.all([
    prisma.userState.upsert({
      where: { userId },
      update: { currentLifeState: to, lifeStateEnteredAt: now },
      create: { userId, currentLifeState: to, lifeStateEnteredAt: now },
    }),
    recordStateTransition(userId, to, triggeredBy, now),
  ]);
}

export async function manualTransition(userId: string, to: LifeStateType): Promise<void> {
  await transitionState(userId, to, "manual", new Date());
}
