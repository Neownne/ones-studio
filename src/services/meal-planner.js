// src/services/meal-planner.js — 内置食谱生成器（不依赖 AI）
// 纯函数：按剩余宏量缺口，从食物库确定性地组合出 2-3 组当日吃法候选。
// 算法：按餐次热量权重把缺口拆到五餐，每餐在其场景内贪心选「蛋白源 + 主食」，
// 份数逼近该餐热量目标；三种策略（均衡/高蛋白/快手）制造候选差异。
// 输出结构与 ai.js parseCandidates 一致，eat-plan 页与采纳逻辑可复用。
import { FOODS, SCENE_LABELS, searchFoods } from '../data/foods.js'

// 餐次 → 场景 + 热量占比（训练日有「练后」，休息日换「下午加餐」）
const SLOTS = {
  training: [
    { slot: '早餐', scenes: ['hotel-breakfast'], w: 0.25 },
    { slot: '上午加餐', scenes: ['snack', 'supplement'], w: 0.08 },
    { slot: '午餐', scenes: ['takeout'], w: 0.32 },
    { slot: '练后', scenes: ['supplement', 'snack'], w: 0.12 },
    { slot: '晚餐', scenes: ['takeout'], w: 0.23 },
  ],
  rest: [
    { slot: '早餐', scenes: ['hotel-breakfast'], w: 0.25 },
    { slot: '上午加餐', scenes: ['snack', 'supplement'], w: 0.10 },
    { slot: '午餐', scenes: ['takeout'], w: 0.35 },
    { slot: '下午加餐', scenes: ['snack', 'supplement'], w: 0.08 },
    { slot: '晚餐', scenes: ['takeout'], w: 0.22 },
  ],
}

// 三种策略：宏量侧重 + 选食物偏好
const STRATEGIES = [
  { name: '方案A · 均衡', proteinBoost: 1.0, offset: 0 },
  { name: '方案B · 高蛋白', proteinBoost: 1.18, offset: 1 },
  { name: '方案C · 快手', proteinBoost: 0.95, offset: 2 },
]

const round1 = (n) => Math.round(n * 10) / 10

// 记录里的食物名规整：剥掉「餐次·」前缀和「（用量）」后缀，用于与食物库比对
export const normalizeFoodName = (n = '') =>
  String(n).replace(/^[^·\s]+·/, '').replace(/（[^）]*）/g, '').trim()

function byScene(scenes) {
  return FOODS.filter((f) => scenes.includes(f.scene))
}

const sum = (items, k) => round1(items.reduce((s, it) => s + (it[k] || 0), 0))

function mkItem(f, qty, strategy) {
  return {
    name: f.name, qty: `${qty}份`,
    kcal: round1(f.perUnit.kcal * qty),
    protein: round1(f.perUnit.protein * qty * strategy.proteinBoost),
    carb: round1(f.perUnit.carb * qty),
    fat: round1(f.perUnit.fat * qty),
  }
}

// 每餐选 1 个「主食物」（单份热量最接近该餐目标），份数按目标 clamp 到 1-2；
// 若还有富余热量，补一个高蛋白小食。这样五餐合计逼近剩余缺口。
function pickMeal(pool, targetKcal, strategy, usedIds) {
  if (!pool.length || targetKcal <= 0) return []
  const sorted = [...pool].sort((a, b) =>
    Math.abs(a.perUnit.kcal - targetKcal) - Math.abs(b.perUnit.kcal - targetKcal))
  let main = null
  for (let k = 0; k < sorted.length; k++) {
    const f = sorted[(strategy.offset + k) % sorted.length]
    if (!usedIds.has(f.id)) { main = f; break }
  }
  if (!main) main = sorted[0]
  usedIds.add(main.id)
  const qty = Math.max(1, Math.min(2, Math.round(targetKcal / (main.perUnit.kcal || 1))))
  const items = [mkItem(main, qty, strategy)]
  const lack = targetKcal - main.perUnit.kcal * qty
  if (lack > 80) {
    const booster = pool
      .filter((f) => !usedIds.has(f.id) && f.perUnit.kcal <= lack * 1.2)
      .sort((a, b) => (b.perUnit.protein / (b.perUnit.kcal || 1)) - (a.perUnit.protein / (a.perUnit.kcal || 1)))[0]
    if (booster) { usedIds.add(booster.id); items.push(mkItem(booster, 1, strategy)) }
  }
  return items
}

// 主入口：返回 { candidates, note }
// excludeNames：昨天已吃过的食物名（昨天吃过的今天不再推荐）
export function planDailyMeals({ remaining = {}, dayType = 'training', picked = '', excludeNames = [] } = {}) {
  const slots = SLOTS[dayType] || SLOTS.training
  const rkcal = Math.max(0, remaining.kcal || 0)
  const rprotein = Math.max(0, remaining.protein || 0)
  const exclude = new Set(excludeNames)
  const pickedFoods = picked ? searchFoods(picked).filter((f) => !exclude.has(f.name)) : []
  const notes = []
  if (picked && !searchFoods(picked).length) notes.push(`食物库里没有「${picked}」，已按缺口自由安排`)
  else if (picked && !pickedFoods.length) notes.push(`「${picked}」昨天吃过了，今天换别的`)
  if (exclude.size) notes.push(`已避开昨天吃过的 ${exclude.size} 种食物`)
  const note = notes.join(' · ')

  // 场景池：优先排除昨天吃过的；池子太小（<2）时放宽，保证一定有候选
  const poolOf = (scenes) => {
    const all = byScene(scenes)
    const fresh = all.filter((f) => !exclude.has(f.name))
    return fresh.length >= 2 ? fresh : all
  }

  const candidates = STRATEGIES.map((strategy) => {
    const usedIds = new Set()
    // 自选食物优先：纳入它所属场景的第一餐
    const pickedByScene = {}
    for (const f of pickedFoods) {
      for (const s of slots) {
        if (s.scenes.includes(f.scene)) {
          (pickedByScene[s.slot] = pickedByScene[s.slot] || []).push(f)
          break
        }
      }
    }
    const meals = slots.map(({ slot, scenes, w }) => {
      const pool = poolOf(scenes)
      const forced = pickedByScene[slot] || []
      const forcedItems = forced.map((f) => ({
        name: f.name, qty: '1份',
        kcal: f.perUnit.kcal, protein: f.perUnit.protein,
        carb: f.perUnit.carb, fat: f.perUnit.fat,
      }))
      forced.forEach((f) => usedIds.add(f.id))
      const forcedKcal = forcedItems.reduce((s, it) => s + it.kcal, 0)
      const items = [...forcedItems, ...pickMeal(pool, rkcal * w - forcedKcal, strategy, usedIds)]
      return { slot, items }
    }).filter((m) => m.items.length)
    const all = meals.flatMap((m) => m.items)
    return {
      name: strategy.name, meals,
      total: { kcal: sum(all, 'kcal'), protein: sum(all, 'protein'), carb: sum(all, 'carb'), fat: sum(all, 'fat') },
    }
  }).filter((c) => c.meals.length)

  return { candidates: candidates.slice(0, 3), note }
}

// 换一个：同餐次场景池内从 currentName 之后循环找；
// 排除本方案其他条目与昨天吃过的（池子兜底：都不满足时仍给下一个，保证换得动）
export function swapMealItem({ dayType = 'training', slot, currentName, otherNames = [], excludeNames = [] } = {}) {
  const slots = SLOTS[dayType] || SLOTS.training
  const scenes = (slots.find((s) => s.slot === slot) || {}).scenes ||
    ['hotel-breakfast', 'takeout', 'snack', 'supplement']
  const others = new Set(otherNames)
  const exclude = new Set(excludeNames)
  const pool = byScene(scenes).filter((f) => !others.has(f.name))
  if (!pool.length) return null
  const start = Math.max(0, pool.findIndex((f) => f.name === currentName))
  for (let k = 1; k <= pool.length; k++) {
    const f = pool[(start + k) % pool.length]
    if (!exclude.has(f.name)) return mkItem(f, 1, { proteinBoost: 1 })
  }
  const f = pool[(start + 1) % pool.length]
  return mkItem(f, 1, { proteinBoost: 1 })
}

// 换条目后重算方案合计
export function recalcCandidate(c) {
  const all = (c.meals || []).flatMap((m) => m.items)
  c.total = { kcal: sum(all, 'kcal'), protein: sum(all, 'protein'), carb: sum(all, 'carb'), fat: sum(all, 'fat') }
  return c
}
