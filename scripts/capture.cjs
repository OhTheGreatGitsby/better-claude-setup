/**
 * Development helper: launches the built application, waits for it to settle, and saves a
 * screenshot. Used to verify the interface actually renders, rather than assuming it does.
 *
 * Usage: BCS_SHOT=path/to/out.png BCS_SCREEN=welcome npx electron scripts/capture.cjs
 */
const { app, BrowserWindow, nativeTheme } = require('electron')
const { writeFileSync } = require('node:fs')
const { resolve } = require('node:path')

require(resolve(__dirname, '..', 'out', 'main', 'index.js'))

const outPath = process.env.BCS_SHOT || resolve(__dirname, '..', 'screenshot.png')
const script = process.env.BCS_SCRIPT || ''
const waitMs = Number(process.env.BCS_WAIT || 3500)

app.whenReady().then(async () => {
  if (process.env.BCS_THEME) nativeTheme.themeSource = process.env.BCS_THEME
  await new Promise((r) => setTimeout(r, waitMs))
  const [window] = BrowserWindow.getAllWindows()
  if (window && process.env.BCS_SIZE) {
    const [w, h] = process.env.BCS_SIZE.split('x').map(Number)
    window.setContentSize(w, h)
    await new Promise((r) => setTimeout(r, 500))
  }
  if (!window) {
    console.error('No window was created.')
    app.exit(1)
    return
  }
  if (script) {
    try {
      await window.webContents.executeJavaScript(script)
      await new Promise((r) => setTimeout(r, Number(process.env.BCS_POST || 1200)))
    } catch (error) {
      console.error('Script failed:', error)
    }
  }
  const image = await window.webContents.capturePage()
  writeFileSync(outPath, image.toPNG())
  console.log(`Captured ${outPath}`)
  app.exit(0)
})
