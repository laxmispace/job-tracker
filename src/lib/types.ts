export const STATUSES = [
  { id: "saved", label: "Saved", color: "default" },
  { id: "applied", label: "Applied", color: "accent" },
  { id: "interview", label: "Interview", color: "warning" },
  { id: "offer", label: "Offer", color: "success" },
  { id: "rejected", label: "Rejected", color: "danger" },
  { id: "ghosted", label: "Ghosted", color: "default" },
] as const;

export type Status = (typeof STATUSES)[number]["id"];

export type TailoredExperience = {
  experience_id: string;
  company: string;
  title: string;
  bullets: string[];
};

export type Tailored = {
  keywords: string[];
  missing_keywords: string[];
  summary: string;
  experiences: TailoredExperience[];
  generated_at: string;
  provider?: string;
  model?: string;
};

export type Job = {
  id: string;
  user_id: string;
  url: string;
  title: string;
  company: string;
  location: string | null;
  source: string | null;
  status: Status;
  applied_at: string | null;
  description: string | null;
  notes: string | null;
  salary: string | null;
  tailored: Tailored | null;
  created_at: string;
  updated_at: string;
};

export type Answer = {
  id: string;
  user_id: string;
  key: string;
  category: string;
  question: string;
  answer: string;
  aliases: string[];
  long_form: boolean;
  sort: number;
};

export type Experience = {
  id: string;
  user_id: string;
  company: string;
  title: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  bullets: string;
  skills: string | null;
  sort: number;
};

export function statusMeta(s: string) {
  return STATUSES.find((x) => x.id === s) ?? STATUSES[0];
}
