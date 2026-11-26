export type ColorToken = {
  name: string;
  variable: string;
  usage: string;
};

export type ColorGroup = {
  title: string;
  tokens: ColorToken[];
};

/** Names and usage notes only. Values are read live from tokens.css. */
export const COLOR_GROUPS: ColorGroup[] = [
  {
    title: 'Brand',
    tokens: [
      { name: 'Primary red', variable: '--color-primary', usage: 'Brand, primary buttons, key actions' },
      { name: 'Primary hover', variable: '--color-primary-hover', usage: 'Hover state of primary actions' },
      { name: 'Primary active', variable: '--color-primary-active', usage: 'Pressed state of primary actions' },
      { name: 'Primary tint', variable: '--color-primary-tint', usage: 'Soft backgrounds behind red text' },
    ],
  },
  {
    title: 'Surfaces',
    tokens: [
      { name: 'Page background', variable: '--color-bg', usage: 'Main app background' },
      { name: 'White', variable: '--color-surface', usage: 'Cards and raised surfaces' },
      { name: 'Sunken', variable: '--color-surface-sunken', usage: 'Image wells, hover fills' },
      { name: 'Border', variable: '--color-border', usage: 'Hairline dividers and outlines' },
    ],
  },
  {
    title: 'Text',
    tokens: [
      { name: 'Main text', variable: '--color-text', usage: 'Headings and body text' },
      { name: 'Muted text', variable: '--color-text-muted', usage: 'Supporting labels and metadata' },
      { name: 'Faint', variable: '--color-text-faint', usage: 'Decorative icons only, never body text' },
    ],
  },
  {
    title: 'Feedback',
    tokens: [
      { name: 'Success', variable: '--color-success', usage: 'Open items, confirmations' },
      { name: 'Warning', variable: '--color-warning', usage: 'Items under review' },
      { name: 'Info', variable: '--color-info', usage: 'Claimed items, neutral notices' },
      { name: 'Danger', variable: '--color-danger', usage: 'Form errors and destructive actions' },
    ],
  },
];

export type ScaleToken = {
  name: string;
  variable: string;
};

export const SPACING_TOKENS: ScaleToken[] = [
  { name: 'Space 1', variable: '--space-1' },
  { name: 'Space 2', variable: '--space-2' },
  { name: 'Space 3', variable: '--space-3' },
  { name: 'Space 4', variable: '--space-4' },
  { name: 'Space 5', variable: '--space-5' },
  { name: 'Space 6', variable: '--space-6' },
  { name: 'Space 7', variable: '--space-7' },
  { name: 'Space 8', variable: '--space-8' },
];

export const RADIUS_TOKENS: ScaleToken[] = [
  { name: 'Small', variable: '--radius-sm' },
  { name: 'Medium', variable: '--radius-md' },
  { name: 'Large', variable: '--radius-lg' },
  { name: 'Extra large', variable: '--radius-xl' },
];

export const ELEVATION_TOKENS: ScaleToken[] = [
  { name: 'Raised small', variable: '--shadow-raised-sm' },
  { name: 'Raised', variable: '--shadow-raised' },
  { name: 'Raised large', variable: '--shadow-raised-lg' },
  { name: 'Inset', variable: '--shadow-inset' },
];

export type TypeSample = {
  name: string;
  variable: string;
  fontFamily: 'display' | 'body';
  sample: string;
};

export const TYPE_SAMPLES: TypeSample[] = [
  { name: 'Display', variable: '--text-display', fontFamily: 'display', sample: 'Find it again' },
  { name: 'Heading 1', variable: '--text-3xl', fontFamily: 'display', sample: 'Report a found item' },
  { name: 'Heading 2', variable: '--text-2xl', fontFamily: 'display', sample: 'Recently found items' },
  { name: 'Heading 3', variable: '--text-xl', fontFamily: 'display', sample: 'Black umbrella, Library' },
  { name: 'Body large', variable: '--text-lg', fontFamily: 'body', sample: 'Describe the item so its owner can recognise it.' },
  { name: 'Body', variable: '--text-base', fontFamily: 'body', sample: 'Describe the item so its owner can recognise it.' },
  { name: 'Small', variable: '--text-sm', fontFamily: 'body', sample: 'Last known location and date lost' },
  { name: 'Caption', variable: '--text-xs', fontFamily: 'body', sample: 'POSTED 2 HOURS AGO' },
];
