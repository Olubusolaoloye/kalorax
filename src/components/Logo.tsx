// The Kalorax logo: a round plate cut into portions, where the cuts spell K (the arms sweep out like
// a spoon serving). The plate takes the text colour (ink on light, cream on dark); the served portion is lime.
import { useId } from "react";

/** Cut lines on the 256 canvas: the stem, then the two curved arms. */
const CUTS = "M100 0V256M100 128Q150 112 176 20M100 128Q150 144 188 236";
/** The served portion between the arms. */
const PORTION = "M100 128Q150 112 176 20L300 20L300 236L188 236Q150 144 100 128Z";

export function LogoMark({ size = 32, portion = "var(--lime)", className }: { size?: number; portion?: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  // Wider cuts at small sizes so the K stays open in tabs and on the tab bar.
  const cut = size <= 24 ? 28 : 20;
  return (
    <svg className={className} viewBox="0 0 256 256" width={size} height={size} aria-hidden focusable="false">
      <defs>
        <mask id={`k-cut-${id}`}>
          <rect width="256" height="256" fill="#fff" />
          <path d={CUTS} stroke="#000" strokeWidth={cut} fill="none" />
        </mask>
        <clipPath id={`k-portion-${id}`}>
          <path d={PORTION} />
        </clipPath>
      </defs>
      <g mask={`url(#k-cut-${id})`}>
        <circle cx="128" cy="128" r="112" fill="currentColor" />
        <circle cx="128" cy="128" r="112" fill={portion} clipPath={`url(#k-portion-${id})`} />
      </g>
    </svg>
  );
}

/** "kalorax" in the logo's geometric lowercase, drawn as lines (no font needed). */
const WORDMARK =
  "M21 49V183M79 105L25 152M43 140L81 183M207 144A39 39 0 1 1 129 144A39 39 0 1 1 207 144M207 105V183M255 49V183" +
  "M381 144A39 39 0 1 1 303 144A39 39 0 1 1 381 144M429 105V183M429 148A39 39 0 0 1 468 105" +
  "M594 144A39 39 0 1 1 516 144A39 39 0 1 1 594 144M594 105V183M642 105L706 183M706 105L642 183";

export function Wordmark({ height = 22, className }: { height?: number; className?: string }) {
  return (
    <svg className={className} viewBox="8 36 711 160" height={height} width={(height * 711) / 160} aria-hidden focusable="false">
      <path d={WORDMARK} fill="none" stroke="currentColor" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mark + wordmark, as used in headers. The accessible name is "Kalorax". */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span className={`logo${className ? ` ${className}` : ""}`} role="img" aria-label="Kalorax">
      <LogoMark size={size} />
      <Wordmark height={Math.round(size * 0.62)} />
    </span>
  );
}
