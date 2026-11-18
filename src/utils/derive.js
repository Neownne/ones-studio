// src/utils/derive.js — 纯函数派生层：不读 storage、不依赖宿主 API，node 可直接单测
import { computeDayKey, d2t, fmtDate, TODO_IDS } from './day.js'
import { EVE_DATE } from '../data/constants.js'

export { EVE_DATE } from '../data/constants.js'
export const DEN = TODO_IDS.length // 分母 = 待办数（删睡前清单后恒 6）

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
export const diffDays = (a, b) => Math.round((d2t(b) - d2t(a)) / 86400000)
const configSig = (p) => `${p.startDate}|${p.totalDays}`

// 外环：分子 = clamp(今天 − startDate + 1, 0, totalDays)，纯日历（含休息/缺勤，没打开也算）
// 缓存 progressCache 仅作「配置未变 + 系统时间倒退」兜底；configSig 变化必按新配置重算
export function computePlanProgress(plan, cache = {}, now = Date.now()) {
  if (!plan) return { ratio: 0, archivedDays: 0, totalDays: 0, state: 'no-plan', configSig: '' }
  const totalDays = plan.totalDays
  const today = computeDayKey(now)
  const sig = configSig(plan)
  const elapsed = clamp(diffDays(plan.startDate, today) + 1, 0, totalDays)
  const archivedDays = (cache && cache.configSig === sig && elapsed < cache.archivedDays)
    ? cache.archivedDays
    : elapsed
  const state = today < plan.startDate ? 'notStarted' : today > plan.endDate ? 'expired' : 'active'
  return {
    ratio: state === 'expired' ? 1 : clamp(archivedDays / totalDays, 0, 1),
    archivedDays, totalDays, state, configSig: sig,
  }
}

// 是否把本次外环计算结果写回 settings.progressCache。
// 只在「配置变化」或「日历分子前进」时写；时钟回拨命中缓存兜底时下游值不变，
// 禁止写回（否则兜底值被抹掉，外环会跟着倒退）。
export function shouldPersistProgressCache(cache = {}, progress = {}) {
  if (!progress || !progress.configSig) return false
  const c = cache || {}
  return c.configSig !== progress.configSig || c.archivedDays !== progress.archivedDays
}

// 内环：6 项全自动推导——用户只需确认「吃了什么、练了什么」，不手动勾选
// anchor_1..5：foods 里每记录 1 条食物勾 1 个（第 i 条存在 → anchor_i 完成）
// training_or_rest：训练日有任一运动记录（候选确认或组次完成）→ 完成；
//                   休息日自动完成（休息本身就是任务）；无计划日禁用
export function computeTodayProgress(log) {
  const foods = (log && log.foods) || []
  const w = (log && log.workout) || {}
  const workoutDone =
    (w.exercises || []).some((e) => (e.sets || []).some((s) => s.done)) ||
    (w.selections || []).some((s) => s.confirmed)
  const items = TODO_IDS.map((id) => {
    if (id === 'training_or_rest') {
      return {
        id,
        checked: log.dayType === 'rest' ? true : workoutDone,
        disabled: log.dayType === 'no-plan',
      }
    }
    const idx = Number(id.slice(-1)) - 1 // anchor_1..5 → 0..4
    return { id, checked: foods.length > idx, disabled: false }
  })
  const done = items.filter((i) => i.checked).length
  return { done, total: DEN, ratio: clamp(done / DEN, 0, 1), items }
}

// 本周进度（首页外环）：自然周周一到周日；本周已过去的天数里，每天 6 项完成率的平均。
// 无日志的天按 0 计入分母——已过去却没记录，就是没完成，不从分母里剔除。
export function computeWeekProgress(logsByDay, dayKey) {
  const d = new Date(`${dayKey}T12:00:00`)
  const dow = (d.getDay() + 6) % 7 // 周一=0 … 周日=6
  const monday = d.getTime() - dow * 86400000
  let sum = 0
  for (let i = 0; i <= dow; i++) {
    const dk = fmtDate(new Date(monday + i * 86400000))
    const log = (logsByDay || {})[dk]
    sum += log ? computeTodayProgress(log).ratio : 0
  }
  const daysElapsed = dow + 1
  return { ratio: clamp(sum / daysElapsed, 0, 1), daysElapsed }
}

// 四小环：额度取当日 macroTargetSnapshot（快照，非当前计划）
// no-plan（无快照）→ hidden:true，只累计已摄入，不做剩余/超额判定
export function computeMacroRemain(log) {
  const keys = ['kcal', 'protein', 'carb', 'fat']
  const t = log.macroTargetSnapshot
  const intakeArr = keys.map((k) =>
    (log.foods || []).reduce((s, f) => s + ((f.perUnit && f.perUnit[k]) || 0) * (f.qty || 1), 0))
  const intake = Object.fromEntries(keys.map((k, i) => [k, intakeArr[i]]))
  if (!t) return { hidden: true, intake }
  return {
    hidden: false,
    intake,
    items: keys.map((k, i) => {
      const remain = t[k] - intakeArr[i]
      return { key: k, target: t[k], intake: intakeArr[i], remain, over: remain < 0, ratio: clamp(intakeArr[i] / (t[k] || 1), 0, 1) }
    }),
  }
}

// 历史热力图（GitHub 贡献方块风）：周列 × 星期行（周一到周日），
// 每天 6 项完成度映射色阶。level：-1 未来（空心）、0 无记录/0%、1-4 完成度递增。
export function buildHistoryGrid(logsByDay, planStartDate, dayKey) {
  const start = d2t(planStartDate)
  const startDow = (new Date(start).getDay() + 6) % 7 // 周一=0
  const gridMonday = start - startDow * 86400000
  const end = d2t(dayKey)
  const weeks = []
  for (let cursor = gridMonday; cursor <= end; cursor += 7 * 86400000) {
    const week = []
    for (let i = 0; i < 7; i++) {
      const t = cursor + i * 86400000
      const dk = fmtDate(new Date(t))
      const log = (logsByDay || {})[dk]
      const ratio = log ? computeTodayProgress(log).ratio : 0
      const isFuture = t > end
      const level = isFuture ? -1 : (log && ratio > 0 ? Math.min(4, Math.ceil(ratio * 4)) : 0)
      week.push({
        dayKey: dk, ratio, level,
        inPlan: dk >= planStartDate,
        isFuture, isToday: dk === dayKey,
        isGap: !!(log && log.isGap),
      })
    }
    weeks.push(week)
  }
  return { weeks }
}

// 环心：起始日在未来 → untilStart「距计划开始」；否则 countdown「距除夕」+ 周序
export function computeRingCenter(plan, now = Date.now(), eveDate = EVE_DATE) {
  const today = computeDayKey(now)
  if (plan && today < plan.startDate) {
    const days = diffDays(today, plan.startDate)
    return {
      mode: 'untilStart', days, fontSize: 64,
      topLabel: '距计划开始', bottomLabel: '天 · 未开始',
      ariaLabel: `距计划开始 ${days} 天`,
    }
  }
  const days = Math.max(0, Math.ceil((d2t(eveDate) - d2t(today)) / 86400000))
  return {
    mode: 'countdown', days, fontSize: 64,
    topLabel: '倒计时',
    bottomLabel: '天',
    ariaLabel: `倒计时 ${days} 天`,
  }
}

// 训练模板取值口：计划级 workoutTemplates 覆盖全局模板（自定义训练计划在此生效）。
// 无计划 / 计划未带模板 → 回落全局 WORKOUT_TEMPLATES；同 split 以计划级为准。
export function resolveWorkoutTemplates(plan, globalTemplates = {}) {
  const g = globalTemplates || {}
  const own = (plan && plan.workoutTemplates) || {}
  if (!plan || !Object.keys(own).length) return g
  return { ...g, ...own }
}

// 今日分化：plan.schedule.pattern 7 项轮转；休息日 / 无计划 → null
export function splitOfDay(plan, dayKey) {
  if (!plan) return null
  const pattern = (plan.schedule && plan.schedule.pattern) || []
  const idx = Math.round((d2t(dayKey) - d2t(plan.startDate)) / 86400000)
  const split = pattern[((idx % 7) + 7) % 7]
  return split && split !== 'rest' ? split : null
}

// 本周此前（周一到昨天）已练动作名集合：组次记录（templateId 解析）+ 候选确认记录
export function collectWeekDoneNames(recentLogs, dayKey, templates = {}) {
  const d = new Date(`${dayKey}T12:00:00`)
  const dow = (d.getDay() + 6) % 7 // 周一=0
  const monday = d.getTime() - dow * 86400000
  const tplName = {}
  for (const t of Object.values(templates || {})) {
    for (const ex of (t.exercises || [])) tplName[ex.id] = ex.name
  }
  const names = new Set()
  for (let i = 0; i < dow; i++) {
    const dk = fmtDate(new Date(monday + i * 86400000))
    const w = ((recentLogs || {})[dk] || {}).workout
    if (!w) continue
    for (const e of (w.exercises || [])) {
      if (!(e.sets || []).some((s) => s.done)) continue
      if (tplName[e.templateId]) names.add(tplName[e.templateId])
      if (e.name) names.add(e.name)
    }
    for (const s of (w.selections || [])) if (s.confirmed) names.add(s.name)
  }
  return names
}
