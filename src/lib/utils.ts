import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Determine a readable text color (black or white) for a given background color.
// Accepts hex strings like '#RRGGBB' or '#RGB'. Returns '#000000' or '#ffffff'.
export function readableTextColor(bgColor?: string | null): string {
  try {
    if (!bgColor) return '#000000';

    // Normalize and extract hex
    let hex = bgColor.trim();
    if (hex.startsWith('#')) hex = hex.slice(1);

    // Expand shorthand (#RGB)
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }

    if (hex.length !== 6) return '#000000';

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    // convert sRGB to linear values
    const srgb = [r, g, b].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    const L = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];

    // If luminance is high, use dark text, else use white text.
    return L > 0.5 ? '#000000' : '#ffffff';
  } catch (e) {
    return '#000000';
  }
}
