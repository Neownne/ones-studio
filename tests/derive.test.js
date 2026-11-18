import { describe, it, expect } from 'vitest'
import {
  computePlanProgress, computeTodayProgress, computeMacroRemain, computeRingCenter,
  shouldPersistProgressCache, resolveWorkoutTemplates, computeWeekProgress, buildHistoryGrid, EVE_DATE,
} from '../src/utils/derive.js'
import { TODO_IDS } from '../src/utils/day.js'

const plan = {
  id: 'plan_1', name: '先减后增·减脂期',
  startDate: '2025-11-03', endDate: '2026-02-01', totalDays: 91,
  macroTargets: {
    training: { kcal: 2188, protein: 155, carb: 275, fat: 52 },
    rest: { kcal: 2038, protein: 155, carb: 247, fat: 48 },
  },
  schedule: { pattern: ['push', 'pull', 'rest', 'legs', 'upper', 'rest', 'rest'] },
}
const now = (y, m, d, h = 12) => new Date(y, m, d, h, 0).getTime()

describe('computePlanProgress — 外环：日历分子', () => {
  it('分子 = clamp(今天−startDate+1, 0, totalDays)，含休息/缺勤，不依赖日志', () => {
    const r = computePlanProgress(plan, {}, now(2025, 10, 10)) // 11-10
    expect(r.archivedDays).toBe(8) // 11-03..11-10 = 8 个自然日
    expect(r.totalDays).toBe(91)
    expect(r.ratio).toBeCloseTo(8 / 91, 6)
    expect(r.state).toBe('active')
  })
  it('起始日在未来 → 0%，state=notStarted', () => {
    const r = computePlanProgress(plan, {}, now(2025, 10, 1))
    expect(r.archivedDays).toBe(0)
    expect(r.ratio).toBe(0)
    expect(r.state).toBe('notStarted')
  })
  it('已过期 → 100%，state=expired', () => {
    const r = computePlanProgress(plan, {}, now(2026, 1, 5)) // 2026-02-05
    expect(r.state).toBe('expired')
    expect(r.ratio).toBe(1)
  })
  it('结束日当天 → active 且 100%（clamp）', () => {
    const r = computePlanProgress(plan, {}, now(2026, 1, 1)) // 2026-02-01
    expect(r.state).toBe('active')
    expect(r.ratio).toBe(1)
  })
  it('无计划 → no-plan', () => {
    expect(computePlanProgress(null, {}, now(2025, 10, 10)).state).toBe('no-plan')
  })
  it('缓存仅在「配置未变 + 系统时间倒退」时兜底', () => {
    const cache = { configSig: '2025-11-03|91', archivedDays: 10 }
    const r = computePlanProgress(plan, cache, now(2025, 10, 10)) // 真实只过 8 天
    expect(r.archivedDays).toBe(10) // 用缓存防倒退
    expect(r.ratio).toBeCloseTo(10 / 91, 6)
  })
  it('configSig 变化（编辑起始日/总天数）→ 必按新配置重算，缓存失效', () => {
    const cache = { configSig: '2025-11-03|91', archivedDays: 10 }
    const moved = { ...plan, startDate: '2025-11-20' } // 起始日改到未来
    const r = computePlanProgress(moved, cache, now(2025, 10, 10))
    expect(r.archivedDays).toBe(0)
    expect(r.ratio).toBe(0)
    expect(r.state).toBe('notStarted')
    expect(r.configSig).toBe('2025-11-20|91')
  })
})

describe('computeTodayProgress — 内环：6 项自动推导（只确认吃和练）', () => {
  const food = (i) => ({ foodId: `f${i}` })
  it('每记录 1 条食物勾 1 个锚点（第 i 条存在 → anchor_i 完成）', () => {
    const r = computeTodayProgress({ dayType: 'training', foods: [food(1), food(2), food(3)] })
    expect(r.done).toBe(3)
    expect(r.total).toBe(6)
    expect(r.ratio).toBeCloseTo(3 / 6, 6)
    expect(r.items).toHaveLength(6)
    expect(r.items.map((i) => i.id)).toEqual(TODO_IDS)
    expect(r.items[0].checked).toBe(true)
    expect(r.items[2].checked).toBe(true)
    expect(r.items[3].checked).toBe(false)
  })
  it('5 条食物 + 训练记录 → 6/6；全空 → 0/6', () => {
    const full = computeTodayProgress({
      dayType: 'training',
      foods: [1, 2, 3, 4, 5].map(food),
      workout: { selections: [{ name: '史密斯卧推', confirmed: true }] },
    })
    expect(full.done).toBe(6)
    expect(computeTodayProgress({ dayType: 'training', foods: [] }).done).toBe(0)
  })
  it('超过 5 条食物最多勾 5 个锚点', () => {
    const r = computeTodayProgress({ dayType: 'training', foods: [1, 2, 3, 4, 5, 6, 7].map(food) })
    expect(r.done).toBe(5)
  })
  it('训练项：组次完成 或 候选确认 都算练了', () => {
    const bySet = computeTodayProgress({
      dayType: 'training', foods: [],
      workout: { exercises: [{ templateId: 'p1', sets: [{ done: true }] }] },
    })
    expect(bySet.items.find((i) => i.id === 'training_or_rest').checked).toBe(true)
    const byConfirm = computeTodayProgress({
      dayType: 'training', foods: [],
      workout: { selections: [{ name: '哈克深蹲', confirmed: true }] },
    })
    expect(byConfirm.done).toBe(1)
    const none = computeTodayProgress({ dayType: 'training', foods: [], workout: { selections: [{ name: 'x', confirmed: false }] } })
    expect(none.done).toBe(0)
  })
  it('休息日训练项自动完成（休息即任务），无记录也有 1/6', () => {
    const r = computeTodayProgress({ dayType: 'rest', foods: [] })
    const sixth = r.items.find((i) => i.id === 'training_or_rest')
    expect(sixth.checked).toBe(true)
    expect(sixth.disabled).toBe(false)
    expect(r.done).toBe(1)
  })
  it('no-plan 日第 6 项 false 且禁用；食物锚点照常推导', () => {
    const r = computeTodayProgress({ dayType: 'no-plan', foods: [food(1)] })
    const sixth = r.items.find((i) => i.id === 'training_or_rest')
    expect(sixth.checked).toBe(false)
    expect(sixth.disabled).toBe(true)
    expect(r.done).toBe(1)
  })
  it('手动 todos 字段不再影响完成度（旧日志兼容）', () => {
    const r = computeTodayProgress({ dayType: 'training', todos: { anchor_1: true }, foods: [] })
    expect(r.done).toBe(0)
  })
})

describe('computeMacroRemain — 四小环', () => {
  const snap = { kcal: 2188, protein: 155, carb: 275, fat: 52 }
  it('剩余 = 目标 − 已摄入（含 qty 倍乘）', () => {
    const log = { macroTargetSnapshot: snap, foods: [
      { foodId: 'a', perUnit: { kcal: 700, protein: 40, carb: 80, fat: 20 }, qty: 1 },
      { foodId: 'b', perUnit: { kcal: 100, protein: 10, carb: 10, fat: 5 }, qty: 2 },
    ] }
    const r = computeMacroRemain(log)
    expect(r.hidden).toBe(false)
    const k = r.items.find((i) => i.key === 'kcal')
    expect(k.target).toBe(2188)
    expect(k.intake).toBe(900)
    expect(k.remain).toBe(1288)
    expect(k.over).toBe(false)
    expect(r.items.find((i) => i.key === 'protein').remain).toBe(95)
  })
  it('超额 → remain 为负 + over:true', () => {
    const log = { macroTargetSnapshot: snap, foods: [{ foodId: 'a', perUnit: { kcal: 2400, protein: 0, carb: 0, fat: 0 }, qty: 1 }] }
    const k = computeMacroRemain(log).items.find((i) => i.key === 'kcal')
    expect(k.remain).toBe(-212)
    expect(k.over).toBe(true)
  })
  it('no-plan（快照 null）→ hidden:true，只累计已摄入，无剩余/超额', () => {
    const log = { macroTargetSnapshot: null, foods: [{ foodId: 'a', perUnit: { kcal: 500, protein: 20, carb: 60, fat: 10 }, qty: 1 }] }
    const r = computeMacroRemain(log)
    expect(r.hidden).toBe(true)
    expect(r.intake).toEqual({ kcal: 500, protein: 20, carb: 60, fat: 10 })
    expect(r.items).toBeUndefined()
  })
  it('空 foods → intake 全 0', () => {
    const r = computeMacroRemain({ macroTargetSnapshot: snap, foods: [] })
    expect(r.items.find((i) => i.key === 'kcal').intake).toBe(0)
  })
})

describe('computeRingCenter — 环心', () => {
  it('起始日在未来 → untilStart「距计划开始」', () => {
    const future = { ...plan, startDate: '2025-11-20' }
    const r = computeRingCenter(future, now(2025, 10, 10))
    expect(r.mode).toBe('untilStart')
    expect(r.days).toBe(10)
    expect(r.topLabel).toBe('距计划开始')
  })
  it('进行中 → countdown「倒计时」纯天数，不带周序', () => {
    const r = computeRingCenter(plan, now(2025, 10, 10)) // 计划第 8 天
    expect(r.mode).toBe('countdown')
    expect(r.days).toBe(452) // 2025-11-10 → 2027-02-05
    expect(r.topLabel).toBe('倒计时')
    expect(r.bottomLabel).toBe('天')
    expect(r.fontSize).toBe(64)
    expect(r.ariaLabel).toContain('倒计时')
  })
  it('无计划 → countdown 无周序', () => {
    const r = computeRingCenter(null, now(2025, 10, 10))
    expect(r.mode).toBe('countdown')
    expect(r.bottomLabel).toBe('天')
  })
  it('EVE_DATE 固定为 2027-02-05', () => {
    expect(EVE_DATE).toBe('2027-02-05')
  })
})

// 回归：computePlanProgress 的缓存分支一直存在，但应用从不把结果写回 settings，
// 导致 DESIGN §5.1「系统时间倒退兜底」在真实运行中永不生效。
describe('shouldPersistProgressCache — 进度缓存写回判定', () => {
  const p = { configSig: '2026-01-01|91', archivedDays: 10 }

  it('无缓存或 configSig 变化 → 写回', () => {
    expect(shouldPersistProgressCache({}, p)).toBe(true)
    expect(shouldPersistProgressCache({ configSig: 'old|30', archivedDays: 99 }, p)).toBe(true)
  })
  it('同配置且 archivedDays 前进 → 写回', () => {
    expect(shouldPersistProgressCache({ configSig: p.configSig, archivedDays: 9 }, p)).toBe(true)
  })
  it('同配置且 archivedDays 相同 → 不写回（避免每次 render 都写存储）', () => {
    expect(shouldPersistProgressCache({ configSig: p.configSig, archivedDays: 10 }, p)).toBe(false)
  })
  it('时钟回拨命中缓存兜底 → 不写回，进度不倒退', () => {
    const cache = { configSig: '2026-01-01|91', archivedDays: 12 }
    const r = computePlanProgress(
      { ...plan, startDate: '2026-01-01', endDate: '2026-04-01', totalDays: 91 },
      cache, now(2026, 0, 5))
    expect(r.archivedDays).toBe(12)
    expect(shouldPersistProgressCache(cache, r)).toBe(false)
  })
  it('no-plan（configSig 为空）→ 不写回', () => {
    expect(shouldPersistProgressCache({}, computePlanProgress(null, {}))).toBe(false)
  })
})

describe('resolveWorkoutTemplates — 计划级模板覆盖全局（自定义训练的取值口）', () => {
  const global = {
    push: { id: 'push', exercises: [{ id: 'p1', name: '史密斯卧推' }] },
    pull: { id: 'pull', exercises: [{ id: 'q1' }] },
  }

  it('无计划 → 返回全局模板', () => {
    expect(resolveWorkoutTemplates(null, global)).toEqual(global)
  })
  it('计划无 workoutTemplates → 返回全局模板', () => {
    expect(resolveWorkoutTemplates({ id: 'p1' }, global)).toEqual(global)
  })
  it('计划有 workoutTemplates 但为空对象 → 回落全局', () => {
    expect(resolveWorkoutTemplates({ workoutTemplates: {} }, global)).toEqual(global)
  })
  it('同 split 用计划级模板，未覆盖的 split 回落全局', () => {
    const plan = { id: 'p1', workoutTemplates: { push: { id: 'push', exercises: [{ id: 'x1', custom: true }] } } }
    const r = resolveWorkoutTemplates(plan, global)
    expect(r.push.exercises[0].id).toBe('x1')
    expect(r.pull).toEqual(global.pull)
  })
})

describe('computeWeekProgress — 本周进度（自然周，周一到周日）', () => {
  // 自动推导夹具：n 条食物 + 可选训练记录 → 完成 n(+1) 项
  const mkLog = (nFoods, workoutDone = false) => ({
    foods: Array.from({ length: nFoods }, (_, i) => ({ foodId: `f${i}` })),
    dayType: 'training',
    ...(workoutDone ? { workout: { selections: [{ name: 'x', confirmed: true }] } } : {}),
  })
  const fullLog = () => mkLog(5, true) // 6/6

  it('今天是周一时只算今天', () => {
    const r = computeWeekProgress({ '2026-11-16': mkLog(1) }, '2026-11-16')
    expect(r.daysElapsed).toBe(1)
    expect(r.ratio).toBeCloseTo(1 / 6, 5)
  })
  it('周二 = 周一 + 周二两天的完成率平均', () => {
    const logs = {
      '2026-11-16': fullLog(),
      '2026-11-17': mkLog(0),
    }
    const r = computeWeekProgress(logs, '2026-11-17')
    expect(r.daysElapsed).toBe(2)
    expect(r.ratio).toBeCloseTo((1 + 0) / 2, 5)
  })
  it('无日志的天按 0 计入分母（本周已过去的天数）', () => {
    const r = computeWeekProgress({ '2026-11-16': fullLog() }, '2026-11-18')
    expect(r.daysElapsed).toBe(3)
    expect(r.ratio).toBeCloseTo(1 / 3, 5)
  })
  it('完全无日志 → 0', () => {
    const r = computeWeekProgress({}, '2026-11-19')
    expect(r.ratio).toBe(0)
  })
})

describe('buildHistoryGrid — 历史热力图（GitHub 贡献方块风）', () => {
  const mkLog = (nFoods, workoutDone = false) => ({
    foods: Array.from({ length: nFoods }, (_, i) => ({ foodId: `f${i}` })),
    dayType: 'training',
    ...(workoutDone ? { workout: { selections: [{ name: 'x', confirmed: true }] } } : {}),
  })

  it('网格从 startDate 所在周的周一开始，按周列 × 7 天', () => {
    const g = buildHistoryGrid({}, '2026-11-10', '2026-11-16')
    expect(g.weeks[0][0].dayKey).toBe('2026-11-09') // 11-10 周二，所在周周一 11-09
    expect(g.weeks.length).toBe(2)
    expect(g.weeks[0].length).toBe(7)
  })
  it('完成度映射色阶：满完成 level 4，未来天空心 -1', () => {
    const logs = { '2026-11-10': mkLog(5, true) }
    const g = buildHistoryGrid(logs, '2026-11-10', '2026-11-12')
    const d10 = g.weeks.flat().find((d) => d.dayKey === '2026-11-10')
    expect(d10.ratio).toBe(1)
    expect(d10.level).toBe(4)
    const future = g.weeks.flat().find((d) => d.isFuture)
    expect(future.level).toBe(-1)
  })
  it('部分完成映射中间色阶；无记录日 level 0；inPlan 标记 startDate 起', () => {
    const logs = { '2026-11-11': mkLog(3) } // 3/6 = .5 → level 2
    const g = buildHistoryGrid(logs, '2026-11-10', '2026-11-11')
    const d9 = g.weeks.flat().find((d) => d.dayKey === '2026-11-09')
    const d10 = g.weeks.flat().find((d) => d.dayKey === '2026-11-10')
    const d11 = g.weeks.flat().find((d) => d.dayKey === '2026-11-11')
    expect(d9.inPlan).toBe(false)
    expect(d10.inPlan).toBe(true)
    expect(d10.level).toBe(0)
    expect(d11.level).toBe(2)
  })
})
