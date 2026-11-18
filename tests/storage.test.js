import { describe, it, expect } from 'vitest'
import { createStore } from '../src/store/storage.js'

function mem(seed = {}, opts = {}) {
  const m = new Map(Object.entries(seed))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      if (opts.throwOn === k) throw new Error('QuotaExceeded')
      m.set(k, opts.corrupt ? '{"bad":' : String(v))
    },
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size },
    _map: m,
  }
}

describe('createStore / read / write', () => {
  it('read 缺键返回 fallback', () => {
    const s = createStore(mem())
    expect(s.read('os:plans', [])).toEqual([])
  })

  it('write → read JSON 往返', () => {
    const s = createStore(mem())
    s.write('os:plans', [{ id: 'p1', totalDays: 91 }])
    expect(s.read('os:plans')).toEqual([{ id: 'p1', totalDays: 91 }])
  })

  it('read 遇到损坏 JSON 返回 fallback 而不抛', () => {
    const s = createStore(mem({ 'os:plans': '{broken' }))
    expect(s.read('os:plans', [])).toEqual([])
  })

  it('keys() 列出全部键、remove 后消失', () => {
    const s = createStore(mem({ 'os:settings': '{}', 'os:plans': '[]' }))
    expect(s.keys().sort()).toEqual(['os:plans', 'os:settings'])
    s.remove('os:plans')
    expect(s.keys()).toEqual(['os:settings'])
  })
})

describe('safeWrite：写后回读比对 + 容量双阈值', () => {
  it('正常写入返回 ok:true', () => {
    const s = createStore(mem())
    expect(s.safeWrite('os:settings', { a: 1 })).toEqual({ ok: true, warn: false })
    expect(s.read('os:settings')).toEqual({ a: 1 })
  })

  it('写入被 backend 损坏 → ok:false reason:verify', () => {
    const s = createStore(mem({}, { corrupt: true }))
    expect(s.safeWrite('os:settings', { a: 1 })).toEqual({ ok: false, warn: false, reason: 'verify' })
  })

  it('setItem 抛错 → ok:false reason:error，不静默吞掉', () => {
    const s = createStore(mem({}, { throwOn: 'os:settings' }))
    expect(s.safeWrite('os:settings', { a: 1 })).toEqual({ ok: false, warn: false, reason: 'error' })
  })

  it('≥80% 配额 → warn:true 但仍写入', () => {
    const s = createStore(mem(), { quotaBytes: 1000 })
    const r = s.safeWrite('os:blob', 'x'.repeat(820))
    expect(r.ok).toBe(true)
    expect(r.warn).toBe(true)
  })

  it('≥95% 配额 → 拒写且原值不变', () => {
    const s = createStore(mem({ 'os:settings': '{"keep":1}' }), { quotaBytes: 1000 })
    const r = s.safeWrite('os:blob', 'x'.repeat(960))
    expect(r).toEqual({ ok: false, warn: true, reason: 'quota' })
    expect(s.read('os:settings')).toEqual({ keep: 1 })
    expect(s.read('os:blob')).toBeUndefined()
  })

  it('info() 返回已用字节与配额（按 key+value 长度计，与 localStorage 配额口径一致）', () => {
    const s = createStore(mem({ a: '1234' }), { quotaBytes: 1000 })
    expect(s.info()).toEqual({ usedBytes: 5, quotaBytes: 1000, ratio: 0.005 })
  })
})
