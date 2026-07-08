"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { answerConversation } from "@/lib/conversation";
import type { ActionResult } from "@/types";
import type { ConversationAnswerResult } from "@/lib/conversation";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function submitConversationAnswer(input: {
  conversationId: string;
  answer: string;
}): Promise<ActionResult<ConversationAnswerResult>> {
  try {
    const userId = await requireUserId();
    const answer = input.answer.trim();
    if (answer.length < 2) return { success: false, error: "Answer with at least a few words." };

    const result = await answerConversation(userId, input.conversationId, answer);
    revalidatePath("/");
    revalidatePath("/memory");
    revalidatePath("/thoughts");
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save answer.",
    };
  }
}
