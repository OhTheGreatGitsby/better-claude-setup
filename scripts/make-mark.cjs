/**
 * Derives the small application mark from the full logo artwork.
 *
 * The logo is composed with generous margins, which is right for an application icon and
 * wrong for a 20px mark in the title strip: at that size the margins are most of the
 * image and the mark reads as an empty square. This crops to the artwork itself and
 * writes a dedicated asset, so the interface is not zooming the full image with CSS.
 *
 * The original is never modified. Run with:
 *   npx electron scripts/make-mark.cjs
 */
const { app, nativeImage } = require('electron')
const { writeFileSync } = require('node:fs')
const { resolve } = require('node:path')

const SOURCE = resolve(__dirname, '..', 'build', 'icon.png')
const OUTPUT = resolve(__dirname, '..', 'src', 'renderer', 'src', 'assets', 'logo-mark.png')

// Measured against the 1254px source: the hands and tiles sit inside this square.
const CROP = { x: 236, y: 232, width: 800, height: 800 }
const SIZE = 256

app.whenReady().then(() => {
  const source = nativeImage.createFromPath(SOURCE)
  if (source.isEmpty()) throw new Error(`Could not read ${SOURCE}`)

  const mark = source.crop(CROP).resize({ width: SIZE, height: SIZE, quality: 'best' })
  writeFileSync(OUTPUT, mark.toPNG())
  console.log(`Wrote ${OUTPUT} (${SIZE}x${SIZE}) from ${JSON.stringify(CROP)}`)
  app.exit(0)
})
