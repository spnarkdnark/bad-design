/** The app's icon set: 16 px line icons drawn in currentColor (so they follow the text color). */
export const Icons = {
  pen: (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <path
        d="M2.5 13.5l2-5 6.5-6.5 3 3-6.5 6.5zM9.5 3.5l3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  ),
  text: (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <path d="M3 3.5h10M8 3.5v9.5M6 13h4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  select: (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <path d="M3 2l9 5-4 1-1.5 4z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  bubble: (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5.5v5M5.5 8h5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  square: (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <rect x="2.5" y="2.5" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5.5v5M5.5 8h5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  shape: (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <path
        d="M3 9c-1-3 1.5-6 4.5-5.5S11 2 13 4.5s.5 5.5-1.5 7.5-6 2.5-8.5-3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  ),
  connect: (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <circle cx="3.5" cy="12.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="12.5" cy="3.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 11l6-6" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
};
