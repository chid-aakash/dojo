// dojo/src/vis-timeline.d.ts

declare module 'vis-timeline/standalone' {
  export class Timeline {
    constructor(container: HTMLElement, data: any, options?: any);
    destroy(): void;
    zoomIn(percentage: number): void;
    zoomOut(percentage: number): void;
  }
  
  export class DataSet {
    constructor(data?: any[]);
  }
} 