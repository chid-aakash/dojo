// dojo/src/vis-timeline.d.ts

declare module 'vis-timeline/standalone' {
  export class Timeline {
    constructor(container: HTMLElement, data: any, options?: any);
    destroy(): void;
    zoomIn(percentage: number): void;
    zoomOut(percentage: number): void;
    moveTo(time: Date): void;
    getWindow(): { start: Date; end: Date };
    setWindow(start: Date, end: Date): void;
  }
  
  export class DataSet {
    constructor(data?: any[]);
  }
} 