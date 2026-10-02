/** Inline SVG icons for the 3D overlay markers (one stroke weight, currentColor). */
export type IconName = 'wheel' | 'fish' | 'book' | 'phone' | 'star' | 'wave';

const base = (body: string) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS: Record<IconName, string> = {
  wheel: base(
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v7M12 14v7M3 12h7M14 12h7M5.6 5.6l5 5M13.4 13.4l5 5M18.4 5.6l-5 5M10.6 13.4l-5 5"/>',
  ),
  fish: base(
    '<path d="M3 12c3-4 7-6 11-6 3 0 5 2 7 6-2 4-4 6-7 6-4 0-8-2-11-6z"/><path d="M3 12l-1-4M3 12l-1 4"/><circle cx="16" cy="11" r="1" fill="currentColor"/>',
  ),
  book: base('<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>'),
  phone: base('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'),
  star: base('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
  wave: base(
    '<path d="M7 11V6a1.5 1.5 0 0 1 3 0v5M10 10V4a1.5 1.5 0 0 1 3 0v6M13 10V5a1.5 1.5 0 0 1 3 0v8"/><path d="M16 13l2-2a1.5 1.5 0 0 1 2.2 2L17 17a6 6 0 0 1-10 0l-3-4a1.5 1.5 0 0 1 2.3-2L7 12"/>',
  ),
};
