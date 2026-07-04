export interface CaptureTask {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string | null;
  projectName: string | null;
}

export interface CaptureIdea {
  title: string;
  description: string;
  category: string;
}

export interface CaptureJournal {
  accomplished: string;
  distractedBy: string;
  improveTomorrow: string;
  feeling: string;
}

export interface CaptureHabit {
  name: string;
  completed: boolean;
  note: string;
}

export interface CaptureProject {
  name: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

export interface CaptureOutput {
  summary: string;
  mood?: string;
  healthStatus?: string;
  tasks: CaptureTask[];
  ideas: CaptureIdea[];
  journal: CaptureJournal;
  habits: CaptureHabit[];
  projects: CaptureProject[];
}

export interface AIProvider {
  processCapture(text: string): Promise<CaptureOutput>;
}
