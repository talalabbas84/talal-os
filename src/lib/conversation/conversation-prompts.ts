import type { ConversationContext, ConversationPromptChoice } from "./conversation-types";

export function chooseConversationPrompt(context: ConversationContext): ConversationPromptChoice {
  const slot = context.slot;
  const recentAnswer = context.previousAnswers[0];
  const recentActivity = context.recentActivities[0];
  const recentPerson = context.recentPeople[0];
  const dueLearning = context.dueLearning[0];
  const growthChallenge = context.currentGrowth.find((item) => item.currentChallenge);
  const danceActivity = context.recentActivities.find((item) => item.category === "DANCE");
  const healthHabit = context.habitsDue.find((habit) => /gym|workout|sleep|walk|stretch/i.test(habit.name));
  const careerActivity = context.recentActivities.find((item) => item.category === "WORK" || item.category === "TALAL_OS");
  const latestInsight = context.recentInsights[0];

  if (slot === "MORNING") {
    return {
      mode: "PLANNING",
      slot,
      prompt: latestInsight
        ? `Yesterday's context includes this pattern: "${latestInsight.title}". What is one thing you want today to prove about you?`
        : "What would make today feel intentional instead of reactive?",
      contextNote: latestInsight ? `Using recent insight: ${latestInsight.description}` : "Morning planning question.",
      source: { latestInsight },
    };
  }

  if (slot === "AFTERNOON") {
    if (recentActivity) {
      return {
        mode: "CHECK_IN",
        slot,
        prompt: `Earlier you were ${recentActivity.activity}. What are you doing right now, and is it still the right thing?`,
        contextNote: `Based on today's activity: ${recentActivity.activity}.`,
        source: { recentActivity },
      };
    }

    return {
      mode: "CHECK_IN",
      slot,
      prompt: "What are you doing right now, and what is the honest next move?",
      contextNote: "Afternoon check-in.",
      source: {},
    };
  }

  if (dueLearning) {
    return {
      mode: "LEARNING",
      slot,
      prompt: `You have "${dueLearning.title}" due for review. Can you still explain it from memory?`,
      contextNote: `Learning review due: ${dueLearning.title}.`,
      source: { dueLearning },
    };
  }

  if (recentPerson) {
    return {
      mode: "RELATIONSHIPS",
      slot,
      prompt: `You recently mentioned ${recentPerson.personNameSnapshot}. What stood out about that interaction?`,
      contextNote: `Recent people context: ${recentPerson.summary}`,
      source: { recentPerson },
    };
  }

  if (danceActivity) {
    return {
      mode: "DANCE",
      slot,
      prompt: "In dance lately, what felt more natural than it used to?",
      contextNote: `Recent dance activity: ${danceActivity.activity}.`,
      source: { danceActivity },
    };
  }

  if (healthHabit) {
    return {
      mode: "HEALTH",
      slot,
      prompt: `${healthHabit.name} is still open today. What usually gets in the way of doing it?`,
      contextNote: `Health habit due: ${healthHabit.name}.`,
      source: { healthHabit },
    };
  }

  if (careerActivity) {
    return {
      mode: "CAREER",
      slot,
      prompt: `What was the hardest part of ${careerActivity.activity}, and what did it teach you?`,
      contextNote: `Recent work activity: ${careerActivity.activity}.`,
      source: { careerActivity },
    };
  }

  if (growthChallenge) {
    return {
      mode: "SELF_DISCOVERY",
      slot,
      prompt: `This challenge keeps showing up: "${growthChallenge.currentChallenge}". What is it asking you to learn?`,
      contextNote: `Growth area: ${growthChallenge.dimension}.`,
      source: { growthChallenge },
    };
  }

  if (recentAnswer) {
    return {
      mode: "EMOTIONAL_INTELLIGENCE",
      slot,
      prompt: `Last time you said: "${trimText(recentAnswer.answer, 90)}". What emotion was underneath that?`,
      contextNote: `Continuing from previous ${recentAnswer.mode.toLowerCase()} answer.`,
      source: { recentAnswer },
    };
  }

  return {
    mode: "REFLECTION",
    slot,
    prompt: "What surprised you today?",
    contextNote: "Default evening reflection.",
    source: {},
  };
}

export function chooseFollowUpQuestion(answer: string, depth: number): string | null {
  if (depth >= 2) return null;

  const words = answer.trim().split(/\s+/).filter(Boolean);
  if (words.length < 8) return "Can you give me one specific example?";
  if (/\bavoid|avoiding|scared|fear|anxious|stuck\b/i.test(answer)) return "What would be the smallest honest step toward that?";
  if (/\bproud|happy|alive|energized|confident\b/i.test(answer)) return "What conditions created that feeling?";
  if (/\bshould|supposed to|have to\b/i.test(answer)) return "Is that actually your choice, or pressure you inherited?";

  return "What does that tell you about the person you are becoming?";
}

export function buildCompanionFeedback(answer: string): string {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  if (words < 8) return "Short answer noted. The useful part is that you gave the system a signal to follow.";
  if (words < 30) return "That gives a clear signal. One concrete detail would make it even more useful later.";
  return "That answer has enough texture to become memory. The pattern matters more than the length.";
}

export function extractAnswerInsight(answer: string): string {
  const cleaned = answer.trim();
  if (cleaned.length <= 140) return cleaned;
  return `${cleaned.slice(0, 137)}...`;
}

export function inferXp(answer: string): { category: ConversationPromptChoice["mode"]; amount: number; meaningful: boolean } {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  return {
    category: "SELF_DISCOVERY",
    amount: words >= 30 ? 12 : words >= 12 ? 8 : 3,
    meaningful: words >= 12,
  };
}

function trimText(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}
