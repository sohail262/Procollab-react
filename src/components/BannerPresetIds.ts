/**
 * BANNER_PRESET_IDS
 * Lightweight list of all banner preset IDs — no SVG render functions.
 * Import this when you only need an ID (e.g. random picker in AuthContext)
 * to avoid loading the full 109 KB BannerPresets.tsx on every page.
 */
export const BANNER_PRESET_IDS = [
    'aurora-glow',
    'liquid-mesh',
    'mountain-layers',
    'constellation',
    'circuit-board',
    'neon-grid',
    'watercolor-wash',
    'dark-topography',
    'pixel-rain',
    'synthwave',
    'crystalline',
    'ink-splash',
    'solar-flare',
    'deep-ocean',
    'forest-mist',
    'blueprint',
    'lava-flow',
    'northern-lights',
    'stained-glass',
    'copper-patina',
    'quantum-field',
    'sakura',
    'noir-city',
    'bioluminescence',
    'desert-dunes',
    'prism',
    'volcanic',
    'nebula',
    'arctic-ice',
    'retro-wave',
    'matrix',
    'origami',
    'coral-reef',
    'thunder-storm',
    'japanese-wave',
    'gothic-cathedral',
    'galactic-core',
    'ancient-map',
    'oil-spill',
    'glitch',
] as const

export type BannerPresetId = typeof BANNER_PRESET_IDS[number]
