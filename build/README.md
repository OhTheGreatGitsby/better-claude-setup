# Build resources

| File | Used for |
| --- | --- |
| `icon.png` | The application logo. electron-builder generates the Windows `.ico`, the macOS `.icns` and the Linux icon from it at package time. |
| `entitlements.mac.plist` | macOS hardened-runtime entitlements, needed so the app can launch Homebrew and the Claude Code CLI. |

`icon.png` must stay square and at least 512×512; the current file is 1254×1254. The same
image is committed again at `src/renderer/src/assets/logo.png`, where the interface uses it
for the mark in the title strip.
