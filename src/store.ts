import { create } from 'zustand';
import type { TimelineItem } from './types';

interface State {
  items: TimelineItem[];
  upsert: (item: TimelineItem) => void;
  remove: (id: string) => void;
}

// Sample data for demonstration
const sampleItems: TimelineItem[] = [
  // {
  //   id: '1',
  //   title: 'Learn React & TypeScript',
  //   start: new Date('2025-01-15T09:00:00'),
  //   end: new Date('2025-03-15T17:00:00'),
  //   status: 'plan',
  //   notes: 'Master modern React patterns and TypeScript integration'
  // },
  // {
  //   id: '2',
  //   title: 'Complete Dojo Timeline Project',
  //   start: new Date('2025-02-01T10:00:00'),
  //   end: new Date('2025-02-28T18:00:00'),
  //   status: 'actual',
  //   notes: 'Build the interactive 5-year timeline application'
  // },
  // {
  //   id: '3',
  //   title: 'Career Milestone: Senior Developer',
  //   start: new Date('2026-01-01T00:00:00'),
  //   status: 'plan',
  //   notes: 'Promotion to senior developer role with increased responsibilities'
  // },
  // {
  //   id: '4',
  //   title: 'Launch Personal Project',
  //   start: new Date('2025-06-01T09:00:00'),
  //   end: new Date('2025-08-31T17:00:00'),
  //   status: 'plan',
  //   notes: 'Deploy and launch my side project to production'
  // }
];

export const useTimeline = create<State>()((set) => ({
  items: sampleItems,
  upsert: (item) =>
    set((s) => ({
      items: [...s.items.filter((i) => i.id !== item.id), item],
    })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
})); 