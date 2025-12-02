/** "plan" items will be shown in blue; "actual" items in green. */
export type PlanStatus = "plan" | "actual" | "diary";

export interface TimelineItem {
  id: string;
  title: string;
  start: Date;
  end?: Date; // if undefined, the item is a point (no end).
  status: PlanStatus; // used for CSS color‐coding.
  notes?: string;
  subtasks?: TimelineItem[];
}
