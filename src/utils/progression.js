// src/utils/progression.js — 加重判定：同一动作连续 2 次「达上限」才建议 +2.5kg
// 纯函数：连击状态从最近两次执行记录派生，不落库；写回只改模板 currentWeight，不改历史。

// 达上限 = 全部组完成 && 每组次数 ≥ repMax && 每组重量 ≥ 模板当前重量
const isHit = (ex, tpl) =>
  ex.sets.length === tpl.sets &&
  ex.sets.every((s) => s.done && s.reps >= tpl.repMax && s.weight >= tpl.currentWeight)

export function shouldSuggestIncrease(logsByDay, tpl, todayKey) {
  if (tpl.bodyweight) return { suggest: false, reason: 'bodyweight', hits: 0 }
  if (tpl.suppressIncrease) return { suggest: false, reason: 'suppressed', hits: 0 }

  // 取该动作最近 2 次有执行记录的自然日（排除今天未归档）；无该动作的日子跳过
  const recs = []
  for (const dk of Object.keys(logsByDay).filter((d) => d < todayKey).sort().reverse()) {
    const w = (logsByDay[dk] && logsByDay[dk].workout) || {}
    const ex = (w.exercises || []).find((e) => e.templateId === tpl.id)
    if (ex) { recs.push(ex); if (recs.length === 2) break }
  }

  // 从最近一次往回连续达上限计数；中间任一次未达即清零
  let hits = 0
  for (const ex of recs) { if (!isHit(ex, tpl)) break; hits++ }

  const step = typeof tpl.weightStep === 'number' ? tpl.weightStep : 2.5
  return {
    suggest: hits >= 2,
    hits,
    nextWeight: tpl.currentWeight + step,
    reason: hits >= 2 ? 'two-consecutive' : 'streak-broken',
  }
}

// 「写回模板」只改下次建议重量；返回新对象，不改原模板，更不碰任何历史日志
export function commitIncrease(tpl, nextWeight) {
  return { ...tpl, currentWeight: nextWeight }
}
