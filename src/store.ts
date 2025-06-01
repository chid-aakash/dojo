import { create } from 'zustand';
import type { TimelineItem } from './types';

interface State {
  items: TimelineItem[];
  upsert: (item: TimelineItem) => void;
  remove: (id: string) => void;
}

export const useTimeline = create<State>()((set) => ({
  items: [],
  upsert: (item) =>
    set((s) => ({
      items: [...s.items.filter((i) => i.id !== item.id), item],
    })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
})); 