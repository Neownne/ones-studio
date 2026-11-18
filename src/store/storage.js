// src/store/storage.js — localStorage 唯一读写口；依赖注入 backend 便于单测
import {
  STORAGE_QUOTA_BYTES, WARN_RATIO, REJECT_RATIO,
} from '../data/constants.js'

const defaultBackend = () => globalThis.localStorage

export function createStore(backend = defaultBackend(), { quotaBytes = STORAGE_QUOTA_BYTES } = {}) {
  const keys = () => {
    const out = []
    for (let i = 0; i < backend.length; i++) {
      const k = backend.key(i)
      if (k !== null) out.push(k)
    }
    return out
  }

  const read = (key, fallback) => {
    const raw = backend.getItem(key)
    if (raw === null || raw === undefined) return fallback
    try { return JSON.parse(raw) } catch { return fallback }
  }

  const write = (key, val) => {
    backend.setItem(key, JSON.stringify(val))
    return true
  }

  const remove = (key) => backend.removeItem(key)

  const info = () => {
    let usedBytes = 0
    for (const k of keys()) {
      const raw = backend.getItem(k)
      usedBytes += (raw ? raw.length : 0) + k.length
    }
    return { usedBytes, quotaBytes, ratio: usedBytes / quotaBytes }
  }

  // 写前容量检查 → 写入 → JSON 回读比对，防静默失败
  const safeWrite = (key, val) => {
    const serialized = JSON.stringify(val)
    const current = info()
    const existing = backend.getItem(key)
    const delta = serialized.length - (existing ? existing.length : 0)
    const projected = current.usedBytes + Math.max(0, delta)
    const ratio = projected / quotaBytes
    const warn = ratio >= WARN_RATIO
    if (ratio >= REJECT_RATIO) return { ok: false, warn: true, reason: 'quota' }

    try {
      backend.setItem(key, serialized)
    } catch {
      return { ok: false, warn, reason: 'error' }
    }
    // 回读比对：写入被篡改/截断时明确失败，不静默
    if (backend.getItem(key) !== serialized) return { ok: false, warn, reason: 'verify' }
    return { ok: true, warn }
  }

  return { keys, read, write, safeWrite, remove, info, quotaBytes }
}

// 浏览器默认单例；页面层只 import 这个
export const store = createStore()
