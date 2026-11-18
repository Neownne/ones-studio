import { describe, it, expect } from 'vitest'
import {
  computeDayKey, computeDayType, monthOf, d2t, newDayLog, rolloverIfNeeded, TODO_IDS,
} from '../src/utils/day.js'

// 计划夹具：startDate 2025-11-03，4 分化 + 3 休息（DESIGN §6.2 schedule.pattern 约定）
const plan = {
  id: 'plan_1',
  name: '先减后增·减脂期',
  startDate: '2025-11-03',
  endDate: '2026-02-01',
  totalDays: 91,
  macroTargets: {
    training: { kcal: 2188, protein: 155, carb: 275, fat: 52 },
    rest: { kcal: 2038, protein: 155, carb: 247, fat: 48 },
  },
  schedule: { pattern: ['push', 'pull', 'rest', 'legs', 'upper', 'rest', 'rest'] },
}

function makeStore(initial = {}) {
  const data = { ...initial }
  return {
    data,
    read: (k) => (k in data ? data[k] : null),
    write: (k, v) => { data[k] = v; return true },
  }
}

describe('computeDayKey — 04:00 日切边界', () => {
  it('03:59 归前一天', () => {
    expect(computeDayKey(new Date(2025, 10, 14, 3, 59).getTime())).toBe('2025-11-13')
  })
  it('04:00 归当天', () => {
    expect(computeDayKey(new Date(2025, 10, 14, 4, 0).getTime())).toBe('2025-11-14')
  })
  it('23:59 归当天', () => {
    expect(computeDayKey(new Date(2025, 10, 14, 23, 59).getTime())).toBe('2025-11-14')
  })
  it('00:30 仍归前一天（熬夜记餐）', () => {
    expect(computeDayKey(new Date(2025, 10, 14, 0, 30).getTime())).toBe('2025-11-13')
  })
})

describe('monthOf / d2t', () => {
  it('monthOf 取 YYYY-MM', () => {
    expect(monthOf('2025-11-14')).toBe('2025-11')
  })
  it('d2t 返回本地零点时间戳，相邻日差一天', () => {
    expect(d2t('2025-11-15') - d2t('2025-11-14')).toBe(86400000)
  })
})

describe('computeDayType — 4 分化轮转', () => {
  it('训练日（push/pull/legs/upper）', () => {
    expect(computeDayType(plan, '2025-11-03')).toBe('training') // idx0 push
    expect(computeDayType(plan, '2025-11-04')).toBe('training') // idx1 pull
    expect(computeDayType(plan, '2025-11-13')).toBe('training') // idx10→3 legs
  })
  it('休息日', () => {
    expect(computeDayType(plan, '2025-11-05')).toBe('rest') // idx2
    expect(computeDayType(plan, '2025-11-08')).toBe('rest') // idx5
  })
  it('无计划 → no-plan', () => {
    expect(computeDayType(null, '2025-11-03')).toBe('no-plan')
  })
})

describe('newDayLog — 快照与不回填', () => {
  it('训练日：固化 planId + 当日宏量快照，不预写 todos（完成度自动推导）', () => {
    const log = newDayLog('2025-11-03', plan, false)
    expect(log.planId).toBe('plan_1')
    expect(log.planName).toBe('先减后增·减脂期')
    expect(log.dayType).toBe('training')
    expect(log.macroTargetSnapshot).toEqual({ kcal: 2188, protein: 155, carb: 275, fat: 52 })
    expect(log.todos).toBeUndefined()
    expect(TODO_IDS).toHaveLength(6)
    expect(log.foods).toEqual([])
    expect(log.archived).toBe(false)
    expect(log.daySeen).toBe(true)
  })
  it('快照是深拷贝：改快照不影响计划', () => {
    const log = newDayLog('2025-11-03', plan, false)
    log.macroTargetSnapshot.kcal = 9999
    expect(plan.macroTargets.training.kcal).toBe(2188)
  })
  it('无计划：planId=null、快照 null', () => {
    const log = newDayLog('2025-11-03', null, false)
    expect(log.planId).toBe(null)
    expect(log.dayType).toBe('no-plan')
    expect(log.macroTargetSnapshot).toBe(null)
  })
  it('isGap 空日：no-plan + planId=null，即使有计划也不回填', () => {
    const log = newDayLog('2025-11-04', plan, true)
    expect(log.isGap).toBe(true)
    expect(log.dayType).toBe('no-plan')
    expect(log.planId).toBe(null)
    expect(log.macroTargetSnapshot).toBe(null)
    expect(log.archived).toBe(true)
    expect(log.daySeen).toBe(false)
  })
})

describe('rolloverIfNeeded — 读时结算（DI 注入 read/write）', () => {
  const now = (y, m, d, h = 12) => new Date(y, m, d, h, 0).getTime()

  it('首次启动：只写当天，不补历史', () => {
    const s = makeStore()
    const r = rolloverIfNeeded({ read: s.read, write: s.write, now: now(2025, 10, 14) })
    expect(r.dayKey).toBe('2025-11-14')
    expect(r.gaps).toEqual([])
    expect(s.data['os:settings'].lastDayKey).toBe('2025-11-14')
    expect(s.data['os:logs:2025-11']['2025-11-14'].daySeen).toBe(true)
  })

  it('同一天重复调用：幂等，不再写', () => {
    const s = makeStore()
    rolloverIfNeeded({ read: s.read, write: s.write, now: now(2025, 10, 14) })
    const before = JSON.stringify(s.data)
    const r = rolloverIfNeeded({ read: s.read, write: s.write, now: now(2025, 10, 14, 20) })
    expect(r.gaps).toEqual([])
    expect(r.created).toBe(false)
    expect(JSON.stringify(s.data)).toBe(before)
  })

  it('跨多天离线：补全部空日、归档前一天、当天按计划写快照', () => {
    const s = makeStore({
      'os:settings': { lastDayKey: '2025-11-10', activePlanId: 'plan_1' },
      'os:plans': [plan],
      'os:logs:2025-11': { '2025-11-10': { dayKey: '2025-11-10', archived: false, isGap: false } },
    })
    const r = rolloverIfNeeded({ read: s.read, write: s.write, now: now(2025, 10, 13) })
    expect(r.gaps).toEqual(['2025-11-11', '2025-11-12'])
    const logs = s.data['os:logs:2025-11']
    expect(logs['2025-11-10'].archived).toBe(true)
    expect(logs['2025-11-11'].isGap).toBe(true)
    expect(logs['2025-11-11'].planId).toBe(null)
    expect(logs['2025-11-11'].dayType).toBe('no-plan')
    expect(logs['2025-11-13'].dayType).toBe('training')
    expect(logs['2025-11-13'].macroTargetSnapshot).toEqual(plan.macroTargets.training)
  })

  it('跨月分片：空日落入各自月键', () => {
    const s = makeStore({
      'os:settings': { lastDayKey: '2025-11-30', activePlanId: 'plan_1' },
      'os:plans': [plan],
      'os:logs:2025-11': { '2025-11-30': { dayKey: '2025-11-30', archived: false } },
    })
    const r = rolloverIfNeeded({ read: s.read, write: s.write, now: now(2025, 11, 2) })
    expect(r.gaps).toEqual(['2025-12-01'])
    expect(s.data['os:logs:2025-12']['2025-12-01'].isGap).toBe(true)
    expect(s.data['os:logs:2025-11']['2025-11-30'].archived).toBe(true)
    expect(s.data['os:logs:2025-12']['2025-12-02'].daySeen).toBe(true)
  })

  it('no-plan 期：空日与当天一律 planId=null、快照 null，不回填', () => {
    const s = makeStore({
      'os:settings': { lastDayKey: '2025-11-10' },
      'os:plans': [],
      'os:logs:2025-11': { '2025-11-10': { dayKey: '2025-11-10', archived: false } },
    })
    const r = rolloverIfNeeded({ read: s.read, write: s.write, now: now(2025, 10, 12) })
    expect(r.gaps).toEqual(['2025-11-11'])
    const logs = s.data['os:logs:2025-11']
    expect(logs['2025-11-11'].planId).toBe(null)
    expect(logs['2025-11-11'].macroTargetSnapshot).toBe(null)
    expect(logs['2025-11-12'].planId).toBe(null)
    expect(logs['2025-11-12'].dayType).toBe('no-plan')
  })
})
