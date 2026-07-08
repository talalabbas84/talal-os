export const NEED_TYPES = [
  "SUPPORT",      // emotional support, feeling overwhelmed
  "PLANNING",     // wants to organize or plan
  "REMEMBERING",  // wants to save/remember something
  "LEARNING",     // acquiring knowledge
  "REFLECTING",   // processing experience or emotion
  "DECIDING",     // needs help choosing between options
  "TRACKING",     // logging an observation or metric
  "PREPARING",    // getting ready for something upcoming
  "VENTING",      // expressing frustration without needing action
  "CELEBRATING",  // sharing a win or success
  "SOCIAL",       // relationship or people context
  "HEALTH",       // physical state or health concern
  "RECOVERY",     // needs rest, burnout, illness
  "IDEATION",     // brainstorming, creative exploration
  "PRODUCTIVITY", // efficiency, focus, getting things done
  "UNCERTAIN",    // can't determine from context
] as const;

export type NeedType = typeof NEED_TYPES[number];

export interface NeedDetectionResult {
  primaryNeed: NeedType;
  secondaryNeeds: NeedType[];
  confidence: "high" | "medium" | "low";
}
