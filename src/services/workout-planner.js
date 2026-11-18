// src/services/workout-planner.js — 内置运动候选生成器（固定规则，不依赖 AI）
// 纯函数：由今日分化模板 + 当前锻炼条件（健身房/居家哑铃/徒手）生成「可替换」的候选槽位——
// 默认选模板动作本身；若该动作本周练过、或当前条件做不了（如徒手时没有史密斯机），
// 自动换成同肌群、同条件、本周未练的库内动作。
// 「换一个」在同肌群同条件的池内循环，排除其他槽位已选，优先本周未练。
import { poolOf, findExercise, partOfExercise } from '../data/exercises.js'

// 生成今日候选槽位：返回 [{ part, name, sets, repMax, weight, confirmed }]
export function planTodayWorkout({ split, template, weekDoneNames = [], cond = 'gym' } = {}) {
  const done = new Set(weekDoneNames)
  const used = new Set()
  return ((template && template.exercises) || []).map((ex) => {
    const part = partOfExercise(ex.name, split)
    const lib = findExercise(ex.name)
    // 库外自定义动作视为可用（用户自己写的，尊重）；库内动作要检查当前条件能否做
    const available = !lib || lib.conds.includes(cond)
    let pick = { name: ex.name, sets: ex.sets, repMax: ex.repMax, weight: ex.currentWeight }
    if (!available || done.has(pick.name) || used.has(pick.name)) {
      const alt = nextCandidate(part, { currentName: pick.name, otherNames: [...used], weekDone: done, cond })
      if (alt) pick = { name: alt.name, sets: alt.sets, repMax: alt.repMax, weight: alt.weight }
    }
    used.add(pick.name)
    return { part, ...pick, confirmed: false }
  })
}

// 换一个：同肌群 + 同锻炼条件池内从 currentName 之后循环找；
// 排除其他槽位已选，优先本周未练；池内都排除了就用整个池兜底（保证换得动）
export function nextCandidate(part, { currentName = '', otherNames = [], weekDone = [], cond = 'gym' } = {}) {
  let pool = poolOf(part, cond)
  if (!pool.length) pool = poolOf(part, 'gym') // 兜底：该肌群在该条件下没有动作（不应发生）
  if (!pool.length) return null
  const others = new Set(otherNames)
  const done = weekDone instanceof Set ? weekDone : new Set(weekDone)
  const start = Math.max(0, pool.findIndex((e) => e.name === currentName))
  // 第一圈：本周没练过且没被其他槽位占用
  for (let k = 1; k <= pool.length; k++) {
    const cand = pool[(start + k) % pool.length]
    if (!others.has(cand.name) && !done.has(cand.name)) return cand
  }
  // 第二圈：只排除占用（允许本周练过的，保证一定有得换）
  for (let k = 1; k <= pool.length; k++) {
    const cand = pool[(start + k) % pool.length]
    if (!others.has(cand.name)) return cand
  }
  return null
}
