import type { ReactNode } from 'react'

/**
 * The interface icon set.
 *
 * Version 1.1 used whatever glyph characters happened to look close enough — a pencil
 * here, a diamond there, an arrow somewhere else. They rendered at different weights and
 * sizes depending on the installed fonts and sat badly next to carefully drawn pixel art.
 *
 * These are drawn on a 24px grid with a consistent 1.75 stroke, so they read as one
 * family and inherit colour from the surrounding text.
 */
export type IconName =
  | 'sparkle'
  | 'pen'
  | 'search'
  | 'code'
  | 'route'
  | 'palette'
  | 'plus'
  | 'check'
  | 'alert'
  | 'info'
  | 'undo'
  | 'refresh'
  | 'download'
  | 'folder'
  | 'settings'
  | 'terminal'
  | 'window'
  | 'chat'
  | 'shield'
  | 'arrow-right'
  | 'clipboard'

const PATHS: Record<IconName, ReactNode> = {
  sparkle: <path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7L12 3z" />,
  pen: (
    <>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M14.5 6.5l3 3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.3-4.3" />
    </>
  ),
  code: <path d="M9 8l-4 4 4 4M15 8l4 4-4 4" />,
  route: (
    <>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <path d="M8.4 6H14a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6h5.6" />
    </>
  ),
  palette: (
    <>
      <path d="M12 4a8 8 0 1 0 0 16c1.1 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.8 1.8-1.8H16a4 4 0 0 0 4-4c0-3.3-3.6-6-8-6z" />
      <circle cx="8.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M4.5 12.5l4.5 4.5L19.5 6.5" />,
  alert: (
    <>
      <path d="M12 4.5L2.8 20h18.4L12 4.5z" />
      <path d="M12 10v4.5M12 17.4v.1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8v.1" />
    </>
  ),
  undo: <path d="M4 9h9a5.5 5.5 0 1 1 0 11H8M4 9l4-4M4 9l4 4" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4" />,
  download: <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14" />,
  folder: (
    <path d="M4 7a1 1 0 0 1 1-1h4l2 2.2h8a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z" />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1" />
    </>
  ),
  terminal: <path d="M5 7l4.5 4.5L5 16M12.5 17H19" />,
  window: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="1.6" />
      <path d="M3.5 9.5h17" />
    </>
  ),
  chat: (
    <path d="M20 12.5a6.5 6.5 0 0 1-6.5 6.5H8l-4 2.5.9-3.6A6.5 6.5 0 0 1 8.5 6h5A6.5 6.5 0 0 1 20 12.5z" />
  ),
  shield: <path d="M12 3.5l7 2.7v5.3c0 4-2.9 7.4-7 8.6-4.1-1.2-7-4.6-7-8.6V6.2l7-2.7z" />,
  'arrow-right': <path d="M5 12h13M13 6.5l5.5 5.5L13 17.5" />,
  clipboard: (
    <>
      <path d="M9 5H7.5A1.5 1.5 0 0 0 6 6.5v12A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 16.5 5H15" />
      <rect x="9" y="3.2" width="6" height="3.4" rx="1" />
    </>
  )
}

export function Icon({
  name,
  size = 18,
  className
}: {
  name: IconName
  size?: number
  className?: string
}): ReactNode {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
