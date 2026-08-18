/**
 * Generates build/icon.png, the application mark.
 *
 * The mark is drawn here rather than committed as a binary blob so that anybody reading
 * this repository can see exactly what is in the icon file. Run `node build/make-icon.mjs`
 * to regenerate it.
 *
 * The design is a rounded square in the project's clay accent with an upward chevron:
 * "take what you have and raise it". It deliberately shares no shape, glyph or colour
 * with any Anthropic mark.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SIZE = 512
const SS = 4 // supersampling factor for smooth edges

const BG = [0xa9, 0x4e, 0x2b]
const FG = [0xff, 0xfd, 0xf9]

const here = dirname(fileURLToPath(import.meta.url))

function insideRoundedSquare(x, y) {
  const inset = SIZE * 0.06
  const r = SIZE * 0.22
  const min = inset
  const max = SIZE - inset
  if (x < min || x > max || y < min || y > max) return false
  const cx = Math.min(Math.max(x, min + r), max - r)
  const cy = Math.min(Math.max(y, min + r), max - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

/** Distance from a point to a line segment, used to draw the chevron with round caps. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function insideChevron(x, y) {
  const thickness = SIZE * 0.075
  const apexX = SIZE * 0.5
  const apexY = SIZE * 0.34
  const leftX = SIZE * 0.28
  const rightX = SIZE * 0.72
  const armY = SIZE * 0.53

  const upper =
    distanceToSegment(x, y, leftX, armY, apexX, apexY) <= thickness ||
    distanceToSegment(x, y, apexX, apexY, rightX, armY) <= thickness

  // A second, shorter chevron below reads as motion upward.
  const lowerY = SIZE * 0.72
  const lowerApexY = SIZE * 0.55
  const lowerLeftX = SIZE * 0.34
  const lowerRightX = SIZE * 0.66
  const lower =
    distanceToSegment(x, y, lowerLeftX, lowerY, apexX, lowerApexY) <= thickness * 0.78 ||
    distanceToSegment(x, y, apexX, lowerApexY, lowerRightX, lowerY) <= thickness * 0.78

  return upper || lower
}

const pixels = Buffer.alloc(SIZE * SIZE * 4)

for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    let bgHits = 0
    let fgHits = 0
    for (let sy = 0; sy < SS; sy += 1) {
      for (let sx = 0; sx < SS; sx += 1) {
        const px = x + (sx + 0.5) / SS
        const py = y + (sy + 0.5) / SS
        if (insideRoundedSquare(px, py)) {
          bgHits += 1
          if (insideChevron(px, py)) fgHits += 1
        }
      }
    }
    const samples = SS * SS
    const alpha = Math.round((bgHits / samples) * 255)
    const mix = bgHits === 0 ? 0 : fgHits / bgHits
    const offset = (y * SIZE + x) * 4
    for (let channel = 0; channel < 3; channel += 1) {
      pixels[offset + channel] = Math.round(BG[channel] * (1 - mix) + FG[channel] * mix)
    }
    pixels[offset + 3] = alpha
  }
}

// Encode as a PNG: filter byte 0 per scanline, then a single IDAT chunk.
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y += 1) {
  raw[y * (SIZE * 4 + 1)] = 0
  pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0)
  return Buffer.concat([length, body, crc])
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return c ^ 0xffffffff
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // RGBA
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

const out = join(here, 'icon.png')
writeFileSync(out, png)
console.log(`Wrote ${out} (${png.length} bytes, ${SIZE}x${SIZE})`)
