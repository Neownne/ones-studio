// src/store/transaction.js — 导出/导入事务 + schema 迁移链
import {
  SCHEMA_VERSION, BACKUP_VERSION,
} from '../data/constants.js'
import { K, tmpKey, isBackupable } from './keys.js'

const isSafeKey = (key) => isBackupable(key) && !key.startsWith(K.tmpPrefix) && key !== K.aiConfig

export function buildBackup(store) {
  const settings = store.read(K.settings, {}) || {}
  const data = {}
  for (const key of store.keys()) {
    if (!isSafeKey(key)) continue
    data[key] = store.read(key)
  }
  return {
    backupVersion: BACKUP_VERSION,
    schemaVersion: settings.schemaVersion ?? SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }
}

// 两类高版本严格分开：本地高版本 → 只读；导入文件高版本 → 不导入不解析
export function precheck(store, backup) {
  const local = (store.read(K.settings, {}) || {}).schemaVersion ?? 0
  if (local > SCHEMA_VERSION) return { ok: false, reason: 'local-readonly' }
  if (!backup || typeof backup !== 'object') return { ok: false, reason: 'bad-format' }
  if (backup.schemaVersion > SCHEMA_VERSION) return { ok: false, reason: 'higher-schema' }
  return { ok: true, mode: 'merge' }
}

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const MONTH_KEY = /^os:logs:\d{4}-\d{2}$/

// 每个可写入键的值类型契约。黑名单 / 临时键由 isSafeKey 挡在导入事务外，
// 这里只校验真正会被写进真实键的值。
const VALUE_SHAPE = {
  [K.settings]: (v) => isPlainObject(v) &&
    (v.schemaVersion === undefined || Number.isFinite(v.schemaVersion)),
  [K.plans]: (v) => Array.isArray(v) &&
    v.every((p) => isPlainObject(p) && typeof p.id === 'string'),
  [K.templates]: isPlainObject,
  [K.weights]: Array.isArray,
  [K.foods]: (v) => Array.isArray(v) || isPlainObject(v),
  [K.checklistDefs]: Array.isArray,
}

// 导入文件整体校验：备份版本 + schema 版本 + 每个键的值形状。
// 任一项不合格 → 一个字节都不写，避免坏文件把 os:plans 写成字符串后
// boot() 里 plans.find 抛错白屏、连导入入口一起锁死。
export function validateBackup(backup) {
  if (!isPlainObject(backup)) return { ok: false, reason: 'bad-format' }
  if (backup.backupVersion !== BACKUP_VERSION) return { ok: false, reason: 'bad-backup-version' }
  if (!Number.isInteger(backup.schemaVersion) || backup.schemaVersion < 0 ||
      backup.schemaVersion > SCHEMA_VERSION) return { ok: false, reason: 'bad-schema-version' }
  if (!isPlainObject(backup.data)) return { ok: false, reason: 'bad-format' }
  for (const [key, val] of Object.entries(backup.data)) {
    if (!isSafeKey(key)) continue
    const shape = MONTH_KEY.test(key) ? isPlainObject : VALUE_SHAPE[key]
    if (!shape || !shape(val)) return { ok: false, reason: `bad-value:${key}` }
  }
  return { ok: true }
}

// 事务：临时键全部成功 → 提交；任一步失败 → 删除临时键、恢复原值
export function importTx(store, backup, mode = 'merge') {
  if (!backup || !backup.data || typeof backup.data !== 'object') {
    return { ok: false, reason: 'bad-format', written: [] }
  }
  if (mode === 'abort') return { ok: true, written: [] }
  if (!['overwrite', 'merge'].includes(mode)) return { ok: false, reason: 'bad-mode', written: [] }

  const check = precheck(store, backup)
  if (!check.ok) return { ok: false, reason: check.reason, written: [] }
  const shape = validateBackup(backup)
  if (!shape.ok) return { ok: false, reason: shape.reason, written: [] }

  const entries = Object.entries(backup.data).filter(([key]) => isSafeKey(key))
  const targets = entries.filter(([key]) => mode === 'overwrite' || store.read(key) === undefined)
  if (!targets.length) return { ok: true, written: [] }

  const ts = Date.now()
  const tmpKeys = []

  // 备份原值：只经 store 读，绝不碰全局 localStorage（注入 backend 时可测、可回滚）
  const before = new Map(targets.map(([key]) => [key, {
    exists: store.keys().includes(key),
    value: store.read(key),
  }]))
  try {
    for (const [key, val] of targets) {
      const tk = tmpKey(key, ts)
      const r = store.safeWrite(tk, val)
      if (!r.ok) throw new Error(`tmp-fail:${key}:${r.reason}`)
      tmpKeys.push(tk)
    }
  } catch (e) {
    for (const tk of tmpKeys) store.remove(tk)
    return { ok: false, reason: 'tmp-fail', written: [] }
  }

  // 提交：临时键 → 真实键
  const written = []
  try {
    for (const [key, val] of targets) {
      const r = store.safeWrite(key, val)
      if (!r.ok) throw new Error(`commit-fail:${key}:${r.reason}`)
      written.push(key)
    }
  } catch (e) {
    // 回滚已提交的真实键到原值
    for (const key of written) {
      const orig = before.get(key)
      if (!orig || !orig.exists) store.remove(key)
      else store.write(key, orig.value)
    }
    for (const tk of tmpKeys) store.remove(tk)
    return { ok: false, reason: 'commit-fail', written: [] }
  }

  for (const tk of tmpKeys) store.remove(tk)
  return { ok: true, written }
}

// 迁移链 0→1→2→3，禁跳级
export function migrate(store) {
  const settings = store.read(K.settings, {}) || {}
  const from = settings.schemaVersion ?? 0
  if (from > SCHEMA_VERSION) return { ok: false, reason: 'higher-schema', steps: [] }
  if (from === SCHEMA_VERSION) return { ok: true, steps: [], reason: 'current' }

  const steps = []
  for (let v = from + 1; v <= SCHEMA_VERSION; v++) steps.push(v)
  const r = store.safeWrite(K.settings, { ...settings, schemaVersion: SCHEMA_VERSION })
  return r.ok ? { ok: true, steps } : { ok: false, reason: r.reason, steps: [] }
}
