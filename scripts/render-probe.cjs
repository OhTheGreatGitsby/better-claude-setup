/** Clicks through to a screen and reports what actually rendered, plus any page error. */
const { app, BrowserWindow } = require('electron')
const { resolve } = require('node:path')
require(resolve(__dirname, '..', 'out', 'main', 'index.js'))

app.whenReady().then(async () => {
  await new Promise((r) => setTimeout(r, 2500))
  const [w] = BrowserWindow.getAllWindows()
  await w.webContents.executeJavaScript(
    `window.__err = null; window.addEventListener('error', e => { window.__err = String(e.error && e.error.stack || e.message) }); true`
  )
  await w.webContents.executeJavaScript(
    `(() => { const b=[...document.querySelectorAll('.btn')].find(x=>x.textContent.includes('${process.env.CLICK || 'Set up Claude'}')); if(b) b.click(); return !!b })()`
  )
  await new Promise((r) => setTimeout(r, 7000))
  const out = await w.webContents.executeJavaScript(
    `({ err: window.__err, text: document.querySelector('.app__body').innerText.slice(0, 400) })`
  )
  console.log('ERROR:', out.err)
  console.log('TEXT:', JSON.stringify(out.text))
  app.exit(0)
})
