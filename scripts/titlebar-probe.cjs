/**
 * Measures the title strip against the native control area at several window widths and
 * display scales. Guarding this bug with a number rather than by eye is the point: the
 * v1.1 overlap only appeared at some widths and scales.
 */
const { app, BrowserWindow } = require('electron')
const { resolve } = require('node:path')

require(resolve(__dirname, '..', 'out', 'main', 'index.js'))

const WIDTHS = [760, 900, 1120, 1400]

app.whenReady().then(async () => {
  await new Promise((r) => setTimeout(r, 3500))
  const [win] = BrowserWindow.getAllWindows()
  if (!win) {
    console.error('no window')
    app.exit(1)
    return
  }

  let failures = 0
  for (const width of WIDTHS) {
    if (win.isMaximized()) win.unmaximize()
    win.setBounds({ x: 40, y: 40, width, height: 820 })
    await new Promise((r) => setTimeout(r, 700))
    const result = await win.webContents.executeJavaScript(`(() => {
      const inner = document.querySelector('.titlebar__inner')
      const meta = document.querySelector('.titlebar__meta')
      const name = document.querySelector('.titlebar__name')
      const mark = document.querySelector('.titlebar__mark')
      const cs = getComputedStyle(inner)
      const box = inner.getBoundingClientRect()
      // Probe whether the window controls overlay actually publishes its geometry.
      const probe = document.createElement('div')
      probe.style.cssText = 'position:absolute;left:0;top:0;width:env(titlebar-area-width, -1px);height:0'
      document.body.appendChild(probe)
      const overlayWidth = Math.round(probe.getBoundingClientRect().width)
      probe.remove()
      return {
        windowWidth: window.innerWidth,
        contentRight: Math.round(Math.max(meta ? meta.getBoundingClientRect().right : 0, name.getBoundingClientRect().right)),
        contentLeft: Math.round(mark.getBoundingClientRect().left),
        safeRight: Math.round(box.right - parseFloat(cs.paddingRight)),
        paddingRight: Math.round(parseFloat(cs.paddingRight)),
        overlayWidth
      }
    })()`)

    const reserved = result.windowWidth - result.safeRight
    const ok = result.contentRight <= result.safeRight + 1 && result.contentLeft >= 0
    console.log(
      `asked ${String(width).padEnd(5)} actual ${String(result.windowWidth).padEnd(5)} content ends ${String(result.contentRight).padEnd(5)} ` +
        `safe area ends ${String(result.safeRight).padEnd(5)} reserved ${String(reserved).padEnd(4)} ` +
        `overlayWidth ${String(result.overlayWidth).padEnd(5)} ` +
        (ok ? 'ok' : 'OVERLAP')
    )
    if (!ok) failures += 1
  }

  console.log(failures === 0 ? 'PASS: no content under the native controls' : `FAIL: ${failures}`)
  app.exit(failures === 0 ? 0 : 1)
})
