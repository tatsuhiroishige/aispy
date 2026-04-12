export type FocusPane = 'log' | 'viewer';

export interface ViewerState {
  url: string;
  content: string;
  scrollOffset: number;
}
