import { create } from "zustand";

export interface TaskItem {
  id: string;
  title: string;
  date: Date; // the date/time the task is relevant to (start)
  notes?: string;
}

interface TaskState {
  tasks: TaskItem[];
  add: (task: TaskItem) => void;
  bulkAdd: (tasks: TaskItem[]) => void;
  remove: (id: string) => void;
}

// Example tasks for demonstration only. These will be replaced once the
// Dear Diary → Task extraction pipeline is wired up.
const sampleTasks: TaskItem[] = [
  {
    id: "task-1",
    title: "Attend friend's wedding (Jaipur)",
    date: new Date("2025-04-20T10:00:00"),
  },
  {
    id: "task-2",
    title: "Marathon 30 km training run",
    date: new Date("2025-02-15T07:00:00"),
  },
  {
    id: "task-3",
    title: 'Finish reading "Clean Code"',
    date: new Date("2025-01-31T23:59:00"),
  },
];

export const useTasks = create<TaskState>()((set) => ({
  tasks: sampleTasks,
  add: (task) =>
    set((s) => ({
      tasks: [...s.tasks.filter((t) => t.id !== task.id), task],
    })),
  bulkAdd: (newTasks) =>
    set((s) => ({
      tasks: [
        ...s.tasks.filter((t) => !newTasks.some((nt) => nt.id === t.id)),
        ...newTasks,
      ],
    })),
  remove: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
}));
