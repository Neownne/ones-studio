// src/utils/day.js — 04:00 日切 / 读时 rollover / 跨多天补空日
// 纯函数 + 依赖注入：rolloverIfNeeded 不直接读写 storage，read/write 由调用方注入。

// 常量唯一来源为 src/data/constants.js；此处 re-export 保持既有 import 路径兼容
import { ROLLOVER_HOUR, TODO_IDS } from '../data/constants.js'
export { ROLLOVER_HOUR, TODO_IDS } from '../data/constants.js'
// TODO_IDS 仍导出（derive 的 6 项 id 列表），但不再预写 todos——完成度自动推导

export const DAY_MS = 86400000

const pad = (n) => String(n).padStart(2, '0')
export const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// dayKey = 日期(now − 4h)，本地时区；禁用 toISOString（UTC 会偏 8h）
export function computeDayKey(now = Date.now(), rolloverHour = ROLLOVER_HOUR) {
  return fmtDate(new Date(now - rolloverHour * 3600000))
}

// dayKey → 本地零点时间戳（不跨 DST 的前提下安全，本项目时区无 DST）
export function d2t(dk) {
  const [y, m, d] = dk.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

export const monthOf = (dk) => dk.slice(0, 7)

// 4 分化轮转：plan.schedule.pattern 为 7 项（split id 或 'rest'）；0 计划 → 'no-plan'
export function computeDayType(plan, dayKey) {
  if (!plan) return 'no-plan'
  const idx = Math.round((d2t(dayKey) - d2t(plan.startDate)) / DAY_MS)
  const p = plan.schedule && plan.schedule.pattern[((idx % 7) + 7) % 7]
  return p === 'rest' || !p ? 'rest' : 'training'
}

// 仅「当天」按计划写快照；isGap 空日一律 no-plan + planId=null，不回填
// 待办不预写：完成度由 foods/workout 自动推导（见 derive.computeTodayProgress）
export function newDayLog(dayKey, plan, isGap = false) {
  const dayType = isGap ? 'no-plan' : computeDayType(plan, dayKey)
  const key = dayType === 'no-plan' ? null : dayType
  return {
    dayKey,
    planId: key ? plan.id : null,
    planName: key ? plan.name : null,
    dayType,
    macroTargetSnapshot: key ? { ...plan.macroTargets[key] } : null,
    foods: [],
    archived: isGap,
    isGap,
    daySeen: !isGap, // 非待办标记：不进 6 项、不参与完成度
  }
}

// 读时结算：onShow / 任何写入前调用；跨多天离线一次性补空日；零定时器
export function rolloverIfNeeded({ read, write, now = Date.now(), rolloverHour = ROLLOVER_HOUR }) {
  const settings = read('os:settings') || {}
  const dayKey = computeDayKey(now, rolloverHour)
  if (settings.lastDayKey === dayKey) return { dayKey, gaps: [], created: false }

  const plans = read('os:plans') || []
  const plan = plans.find((p) => p.id === settings.activePlanId) || null
  const prev = settings.lastDayKey
  const gaps = []

  if (prev) {
    const pm = `os:logs:${monthOf(prev)}`
    const pl = read(pm) || {}
    if (pl[prev]) { pl[prev] = { ...pl[prev], archived: true }; write(pm, pl) }
    for (let t = d2t(prev) + DAY_MS; t < d2t(dayKey); t += DAY_MS) {
      const dk = fmtDate(new Date(t))
      const mk = `os:logs:${monthOf(dk)}`
      const m = read(mk) || {}
      m[dk] = newDayLog(dk, plan, true) // 只补结构，不进外环分子
      write(mk, m)
      gaps.push(dk)
    }
  }

  const mk = `os:logs:${monthOf(dayKey)}`
  const m = read(mk) || {}
  let created = false
  if (!m[dayKey]) {
    m[dayKey] = newDayLog(dayKey, plan, false) // foods:[] = 已摄入清零
    write(mk, m)
    created = true
  } else if (!m[dayKey].daySeen) {
    m[dayKey] = { ...m[dayKey], daySeen: true }
    write(mk, m)
  }

  write('os:settings', { ...settings, lastDayKey: dayKey })
  return { dayKey, gaps, created }
}
