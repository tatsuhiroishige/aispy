export type ImageProtocol = 'kitty' | 'iterm2' | 'sixel' | 'none';

export interface TermCapability {
  imageProtocol: ImageProtocol;
  cellPixelWidth: number;
  cellPixelHeight: number;
}

function detectProtocol(env: NodeJS.ProcessEnv = process.env): ImageProtocol {
  if (env['ASPYPY_IMAGE'] === 'none') return 'none';
  if (env['KITTY_WINDOW_ID']) return 'kitty';
  if (env['WEZTERM_PANE']) return 'kitty';
  if (env['TERM'] === 'xterm-kitty') return 'kitty';
  if (env['TERM'] === 'xterm-ghostty' || env['TERM_PROGRAM'] === 'ghostty') return 'kitty';
  if (env['TERM_PROGRAM'] === 'iTerm.app') return 'iterm2';
  if (env['TERM'] === 'mlterm') return 'sixel';
  if (env['TERM']?.startsWith('foot')) return 'sixel';
  return 'none';
}

// Reasonable defaults; terminal-specific query (CSI 16 t) is Phase 3.7 polish.
const DEFAULT_CELL_PX_W = 10;
const DEFAULT_CELL_PX_H = 20;

export function detectTermCapability(
  env: NodeJS.ProcessEnv = process.env,
): TermCapability {
  return {
    imageProtocol: detectProtocol(env),
    cellPixelWidth: DEFAULT_CELL_PX_W,
    cellPixelHeight: DEFAULT_CELL_PX_H,
  };
}
