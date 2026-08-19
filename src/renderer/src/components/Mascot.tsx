import type { ReactNode } from 'react'
import searching from '../assets/claude-searching.png'
import installing from '../assets/claude-installing.png'
import done from '../assets/claude-done.png'

/**
 * The Claude mascot, as a state system rather than decoration.
 *
 * Three pieces of artwork were supplied, so seven application states map onto them by
 * closest meaning. Inventing a fourth character to fill a gap would produce an
 * inconsistent mascot, so states that have no dedicated artwork reuse the nearest one and
 * are distinguished by motion, framing and copy instead:
 *
 *   idle       coffee and laptop   at rest, nothing running
 *   scanning   detective           looking through the machine
 *   thinking   detective           working something out
 *   installing chef                actively changing something
 *   success    coffee and laptop   finished, arriving with a small bounce
 *   warning    detective           looking into something that needs attention
 *   error      detective           investigating a failure
 *
 * The artwork is pixel art, so it is only ever rendered at whole sizes with smoothing
 * disabled, and never stretched: the box is square and the image is contained.
 */
export type MascotState =
  | 'idle'
  | 'scanning'
  | 'thinking'
  | 'installing'
  | 'success'
  | 'warning'
  | 'error'

type Motion = 'float' | 'hunt' | 'work' | 'arrive' | 'concern' | 'none'

const ART: Record<MascotState, { src: string; alt: string; motion: Motion; pulse: boolean }> = {
  idle: { src: done, alt: 'Claude, resting', motion: 'float', pulse: false },
  scanning: {
    src: searching,
    alt: 'Claude, looking through your computer',
    motion: 'hunt',
    pulse: true
  },
  thinking: { src: searching, alt: 'Claude, working it out', motion: 'float', pulse: true },
  installing: { src: installing, alt: 'Claude, setting things up', motion: 'work', pulse: true },
  success: { src: done, alt: 'Claude, finished and pleased', motion: 'arrive', pulse: false },
  warning: {
    src: searching,
    alt: 'Claude, looking into something',
    motion: 'concern',
    pulse: false
  },
  error: { src: searching, alt: 'Claude, investigating a problem', motion: 'concern', pulse: false }
}

/**
 * Whole-number sizes only, so the pixel grid stays even. The artwork sits on a 500px
 * square canvas with a wide transparent margin, so the box has to be generous for the
 * character itself to read at the intended size.
 */
const SIZES = { sm: 76, md: 116, lg: 168, xl: 224 } as const

export function Mascot({
  state,
  size = 'md',
  still = false
}: {
  state: MascotState
  size?: keyof typeof SIZES
  /** Freezes the animation, for screenshots and for rows where motion would be noise. */
  still?: boolean
}): ReactNode {
  const art = ART[state]
  const px = SIZES[size]

  return (
    <div
      className="mascot"
      style={{ width: px, height: px }}
      data-motion={still ? 'none' : art.motion}
      data-state={state}
    >
      {art.pulse && !still ? <span className="mascot__pulse" aria-hidden="true" /> : null}
      <img
        className="mascot__img"
        src={art.src}
        alt={art.alt}
        width={px}
        height={px}
        draggable={false}
      />
    </div>
  )
}
