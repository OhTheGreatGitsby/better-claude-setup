import type { BcsApi } from './index'

declare global {
  interface Window {
    bcs: BcsApi
  }
}

export {}
