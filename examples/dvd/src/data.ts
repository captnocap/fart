// ── DVD Content Manifest ─────────────────────────────────
// Edit these paths to point to your actual video files.
// Place videos in the videos/ directory next to src/.

export interface Chapter {
  number: number;
  title: string;
  timestamp: number;       // seconds into main feature
  preview: string;         // path to short preview clip (for hoverVideo)
}

export interface Extra {
  title: string;
  description: string;
  duration: string;        // display string e.g. "3:45"
  src: string;             // video file path
}

// ── Main feature ─────────────────────────────────────────

export const FEATURE_VIDEO = 'videos/feature.mp4';
export const MENU_BG_VIDEO = 'videos/menu-bg.mp4';

// ── Chapters ─────────────────────────────────────────────

export const CHAPTERS: Chapter[] = [
  { number: 1, title: 'Opening',           timestamp: 0,    preview: 'videos/ch1-preview.mp4' },
  { number: 2, title: 'The Journey Begins', timestamp: 180,  preview: 'videos/ch2-preview.mp4' },
  { number: 3, title: 'Rising Tension',     timestamp: 420,  preview: 'videos/ch3-preview.mp4' },
  { number: 4, title: 'The Turning Point',  timestamp: 720,  preview: 'videos/ch4-preview.mp4' },
  { number: 5, title: 'Climax',             timestamp: 1080, preview: 'videos/ch5-preview.mp4' },
  { number: 6, title: 'Resolution',         timestamp: 1380, preview: 'videos/ch6-preview.mp4' },
];

// ── Special Features ─────────────────────────────────────

export const EXTRAS: Extra[] = [
  { title: 'Behind the Scenes',  description: 'A look at how it was made',  duration: '4:20', src: 'videos/extras/behind-the-scenes.mp4' },
  { title: 'Theatrical Trailer', description: 'The original trailer',       duration: '2:15', src: 'videos/extras/trailer.mp4' },
  { title: 'Director Commentary', description: 'Commentary by the director', duration: '12:00', src: 'videos/extras/commentary.mp4' },
];
