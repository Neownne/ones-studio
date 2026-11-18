import { describe, it, expect } from 'vitest'
import { createStore } from '../src/store/storage.js'
import { buildBackup, precheck, importTx, migrate } from '../src/store/transaction.js'

function mem(seed = {}, opts = {}) {
  const m = new Map(Object.entries(seed))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      if (opts.throwOn && k.includes(opts.throwOn)) throw new Error('boom')
      if (opts.throwOnExact && k === opts.throwOnExact) throw new Error('boom')
      m.set(k, String(v))
    },
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size },
    _map: m,
  }
}

const seed = () => ({
  'os:settings': JSON.stringify({ schemaVersion: 3, activePlanId: 'p1' }),
  'os:plans': JSON.stringify([{ id: 'p1', name: '本机计划' }]),
  'os:logs:2026-11': JSON.stringify({ '2026-11-14': { dayKey: '2026-11-14' } }),
  'os:ai_config': JSON.stringify({ api_key: 'sk-secret', base_url: 'https://x', model: 'm' }),
})

describe('buildBackup 导出白名单', () => {
  it('含 settings/plans/logs，不含 os:ai_config', () => {
    const s = createStore(mem(seed()))
    const b = buildBackup(s)
    expect(b.backupVersion).toBe(1)
    expect(b.schemaVersion).toBe(3)
    expect(Object.keys(b.data)).toContain('os:plans')
    expect(Object.keys(b.data)).toContain('os:logs:2026-11')
    expect(JSON.stringify(b)).not.toContain('sk-secret')
    expect(Object.keys(b.data)).not.toContain('os:ai_config')
  })

  it('不含 os:tmp: 临时键', () => {
    const s = createStore(mem({ ...seed(), 'os:tmp:os:plans:1': '[]' }))
    expect(Object.keys(buildBackup(s).data)).not.toContain('os:tmp:os:plans:1')
  })
})

describe('precheck 版本分支严格分开', () => {
  it('导入文件 schemaVersion > 3 → 不导入不解析', () => {
    const s = createStore(mem(seed()))
    const r = precheck(s, { backupVersion: 1, schemaVersion: 4, data: {} })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('higher-schema')
  })

  it('本地 schemaVersion > 3 → 只读模式', () => {
    const s = createStore(mem({ 'os:settings': JSON.stringify({ schemaVersion: 4 }) }))
    const r = precheck(s, { backupVersion: 1, schemaVersion: 3, data: {} })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('local-readonly')
  })

  it('正常文件 → ok:true', () => {
    const s = createStore(mem(seed()))
    expect(precheck(s, { backupVersion: 1, schemaVersion: 3, data: { 'os:plans': [] } }).ok).toBe(true)
  })
})

describe('importTx 事务', () => {
  it('abort → 一个键都不改', () => {
    const s = createStore(mem(seed()))
    const before = s.keys().sort()
    const r = importTx(s, { backupVersion: 1, schemaVersion: 3, data: { 'os:plans': [{ id: 'new' }] } }, 'abort')
    expect(r.ok).toBe(true)
    expect(s.keys().sort()).toEqual(before)
    expect(s.read('os:plans')).toEqual([{ id: 'p1', name: '本机计划' }])
  })

  it('overwrite → 数据替换，ai_config 原封不动', () => {
    const s = createStore(mem(seed()))
    const r = importTx(s, { backupVersion: 1, schemaVersion: 3, data: { 'os:plans': [{ id: 'new' }] } }, 'overwrite')
    expect(r.ok).toBe(true)
    expect(s.read('os:plans')).toEqual([{ id: 'new' }])
    expect(s.read('os:ai_config').api_key).toBe('sk-secret')
    expect(s.keys().filter((k) => k.startsWith('os:tmp:'))).toEqual([])
  })

  it('merge → 本机优先（同名已存在键不覆盖）', () => {
    const s = createStore(mem(seed()))
    importTx(s, { backupVersion: 1, schemaVersion: 3, data: {
      'os:plans': [{ id: 'new' }], 'os:weights': [{ kg: 74 }],
    } }, 'merge')
    expect(s.read('os:plans')).toEqual([{ id: 'p1', name: '本机计划' }])
    expect(s.read('os:weights')).toEqual([{ kg: 74 }])
  })

  it('中途写入失败 → 全部回滚，临时键清空', () => {
    const s = createStore(mem(seed(), { throwOn: 'os:tmp:' }))
    const before = JSON.stringify(s.read('os:plans'))
    const r = importTx(s, { backupVersion: 1, schemaVersion: 3, data: { 'os:plans': [{ id: 'new' }] } }, 'overwrite')
    expect(r.ok).toBe(false)
    expect(JSON.stringify(s.read('os:plans'))).toBe(before)
    expect(s.keys().filter((k) => k.startsWith('os:tmp:'))).toEqual([])
  })

  it('提交阶段部分失败 → 已写入的真实键恢复到原值（不误删）', () => {
    const s = createStore(mem(seed(), { throwOnExact: 'os:weights' }))
    const r = importTx(s, { backupVersion: 1, schemaVersion: 3, data: {
      'os:plans': [{ id: 'new' }], 'os:weights': [{ kg: 70 }],
    } }, 'overwrite')
    expect(r.ok).toBe(false)
    expect(s.read('os:plans')).toEqual([{ id: 'p1', name: '本机计划' }])
    expect(s.read('os:weights')).toBeUndefined()
    expect(s.keys().filter((k) => k.startsWith('os:tmp:'))).toEqual([])
  })

  it('全程不碰 os:ai_config（含 merge 与 overwrite）', () => {
    const s = createStore(mem(seed()))
    for (const mode of ['merge', 'overwrite']) {
      importTx(s, { backupVersion: 1, schemaVersion: 3, data: {
        'os:ai_config': { api_key: 'hacked' }, 'os:plans': [{ id: 'x' }],
      } }, mode)
      expect(s.read('os:ai_config').api_key).toBe('sk-secret')
    }
  })
})

describe('migrate 迁移链禁跳级', () => {
  it('0→1→2→3 逐级成功', () => {
    const s = createStore(mem({ 'os:settings': JSON.stringify({ schemaVersion: 0 }) }))
    const r = migrate(s)
    expect(r.ok).toBe(true)
    expect(r.steps).toEqual([1, 2, 3])
    expect(s.read('os:settings').schemaVersion).toBe(3)
  })

  it('已是 3 → 空操作', () => {
    const s = createStore(mem(seed()))
    expect(migrate(s)).toEqual({ ok: true, steps: [], reason: 'current' })
  })

  it('本地 4 → 拒绝迁移（只读由 precheck 负责）', () => {
    const s = createStore(mem({ 'os:settings': JSON.stringify({ schemaVersion: 4 }) }))
    expect(migrate(s).ok).toBe(false)
  })
})

// 回归：坏备份文件曾把 os:plans 写成字符串，导致 boot() 里 plans.find 抛错白屏，
// 连「导入备份」这个唯一恢复入口也一起锁死。导入必须整体拒写。
describe('importTx 导入值结构校验（坏备份整体拒写）', () => {
  const bk = (data, extra = {}) => ({ backupVersion: 1, schemaVersion: 3, data, ...extra })

  it('os:plans 是字符串 / os:settings 是数字 → 拒绝，本机数据一字不改', () => {
    const s = createStore(mem(seed()))
    const r = importTx(s, bk({ 'os:plans': 'NOT-AN-ARRAY', 'os:settings': 12345 }), 'overwrite')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/bad-value/)
    expect(s.read('os:plans')).toEqual([{ id: 'p1', name: '本机计划' }])
    expect(s.read('os:settings').schemaVersion).toBe(3)
  })

  it('backupVersion 缺失或不匹配 → 拒绝', () => {
    const s = createStore(mem(seed()))
    expect(importTx(s, { schemaVersion: 3, data: { 'os:plans': [] } }, 'overwrite').ok).toBe(false)
    expect(importTx(s, bk({ 'os:plans': [] }, { backupVersion: 99 }), 'overwrite').ok).toBe(false)
  })

  it('schemaVersion 非整数或超范围 → 拒绝', () => {
    const s = createStore(mem(seed()))
    expect(importTx(s, bk({}, { schemaVersion: '3' }), 'overwrite').ok).toBe(false)
    expect(importTx(s, bk({}, { schemaVersion: 99 }), 'overwrite').ok).toBe(false)
  })

  it('data 是数组 → 拒绝', () => {
    const s = createStore(mem(seed()))
    expect(importTx(s, { backupVersion: 1, schemaVersion: 3, data: [] }, 'overwrite').ok).toBe(false)
  })

  it('日志月分片键格式非法，或值不是对象 → 拒绝', () => {
    const s = createStore(mem(seed()))
    expect(importTx(s, bk({ 'os:logs:abc': {} }), 'overwrite').ok).toBe(false)
    expect(importTx(s, bk({ 'os:logs:2026-11': [] }), 'overwrite').ok).toBe(false)
    expect(importTx(s, bk({ 'os:logs:2026-11': { '2026-11-14': {} } }), 'overwrite').ok).toBe(true)
  })

  it('plans 数组元素 id 不是字符串 → 拒绝', () => {
    const s = createStore(mem(seed()))
    expect(importTx(s, bk({ 'os:plans': [{ id: 1 }] }), 'overwrite').ok).toBe(false)
  })

  it('校验失败不留下 os:tmp 临时键', () => {
    const s = createStore(mem(seed()))
    importTx(s, bk({ 'os:plans': 'bad' }), 'overwrite')
    expect(s.keys().filter((k) => k.startsWith('os:tmp:'))).toEqual([])
  })

  it('合法备份里夹带 ai_config 黑名单键 → 仍可导入，且不覆盖本机密钥', () => {
    const s = createStore(mem(seed()))
    const r = importTx(s, bk({ 'os:plans': [{ id: 'x' }], 'os:ai_config': { api_key: 'hacked' } }), 'overwrite')
    expect(r.ok).toBe(true)
    expect(s.read('os:ai_config').api_key).toBe('sk-secret')
  })
})
