export interface Point {
  x: number;
  y: number;
}

export type FilterType = 'original' | 'magic_color' | 'bw_photocopy' | 'grayscale' | 'brighten';

export type CardPreset = 'aadhaar' | 'pan' | 'voter' | 'a4_doc' | 'custom';

export interface ScannedDocument {
  id: string;
  name: string;
  originalImage: HTMLImageElement;
  originalWidth: number;
  originalHeight: number;
  corners: [Point, Point, Point, Point];
  rotation: number;
  filter: FilterType;
  brightness: number;
  contrast: number;
  rectifiedDataUrl: string;
  rectifiedWidth: number;
  rectifiedHeight: number;
  tag: 'front' | 'back' | 'doc' | 'other';
  cardPreset: CardPreset;
}

export type PageLayoutType =
  | 'aadhaar_both'
  | 'single_fit'
  | 'two_vertical'
  | 'four_grid'
  | 'custom_grid';

export interface A4PrintConfig {
  layout: PageLayoutType;
  orientation: 'portrait' | 'landscape';
  printMode: 'color' | 'bw';
  showCutGuides: boolean;
  addTitleHeader: boolean;
  headerText: string;
  cardScalePercent: number;
  marginMm: number;
}
