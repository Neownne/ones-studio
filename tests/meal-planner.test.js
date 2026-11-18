import { describe, it, expect } from 'vitest'
import { planDailyMeals, swapMealItem, recalcCandidate, normalizeFoodName } from '../src/services/meal-planner.js'

const REM = { kcal: 1388, protein: 95, carb: 185, fat: 27 }

describe('planDailyMeals — 内置食谱生成', () => {
  it('返回 3 组，结构兼容 eat-plan 采纳逻辑', () => {
    const { candidates } = planDailyMeals({ remaining: REM, dayType: 'training' })
    expect(candidates.length).toBe(3)
    for (const c of candidates) {
      expect(c.meals.length).toBeGreaterThan(0)
      expect(c.total.kcal).toBeGreaterThan(0)
      for (const m of c.meals) {
        expect(m.slot).toBeTruthy()
        expect(m.items.length).toBeGreaterThan(0)
        for (const it of m.items) {
          expect(it).toHaveProperty('name')
          expect(it).toHaveProperty('qty')
          expect(typeof it.kcal).toBe('number')
          expect(typeof it.protein).toBe('number')
        }
      }
    }
  })

  it('训练日有练后餐，休息日换成下午加餐', () => {
    const tr = planDailyMeals({ remaining: REM, dayType: 'training' })
    const rs = planDailyMeals({ remaining: REM, dayType: 'rest' })
    const trSlots = tr.candidates[0].meals.map((m) => m.slot)
    const restSlots = rs.candidates[0].meals.map((m) => m.slot)
    expect(trSlots).toContain('练后')
    expect(restSlots).toContain('下午加餐')
    expect(restSlots).not.toContain('练后')
  })

  it('热量逼近剩余缺口（容差内），三组有差异', () => {
    const { candidates } = planDailyMeals({ remaining: REM, dayType: 'training' })
    for (const c of candidates) {
      expect(c.total.kcal).toBeGreaterThan(REM.kcal * 0.4)
      expect(c.total.kcal).toBeLessThan(REM.kcal * 1.4)
    }
    // 三组不完全相同（策略 offset 制造差异）
    const names = candidates.map((c) => c.meals.flatMap((m) => m.items.map((i) => i.name)).join('|'))
    expect(new Set(names).size).toBeGreaterThan(1)
  })

  it('picked 关键词匹配到的食物优先纳入', () => {
    const { candidates } = planDailyMeals({ remaining: REM, dayType: 'training', picked: '鸡腿' })
    const all = candidates.flatMap((c) => c.meals.flatMap((m) => m.items.map((i) => i.name)))
    expect(all.some((n) => n.includes('鸡'))).toBe(true)
  })

  it('picked 匹配不到 → note 提示、仍出候选', () => {
    const { candidates, note } = planDailyMeals({ remaining: REM, dayType: 'training', picked: '满汉全席' })
    expect(note).toContain('满汉全席')
    expect(candidates.length).toBe(3)
  })

  it('零缺口 → 安全返回，不抛错', () => {
    const { candidates } = planDailyMeals({ remaining: { kcal: 0, protein: 0, carb: 0, fat: 0 } })
    expect(Array.isArray(candidates)).toBe(true)
  })
})

describe('planDailyMeals — 昨天吃过的今天不再推荐', () => {
  it('excludeNames 里的食物不进候选', () => {
    // 真实场景：昨天吃过若干种（远小于场景池），今天全部避开
    const excludeNames = ['鸡胸肉(白切/煎)', '牛肉饭', '黄焖鸡米饭', '水煮蛋', '燕麦粥', '混合坚果']
    const { candidates, note } = planDailyMeals({ remaining: REM, dayType: 'training', excludeNames })
    const names = candidates.flatMap((c) => c.meals.flatMap((m) => m.items.map((i) => i.name)))
    for (const n of excludeNames) expect(names).not.toContain(n)
    expect(note).toContain('昨天')
    expect(candidates.length).toBe(3)
  })

  it('排除后池子太小 → 放宽兜底，候选不为空', () => {
    // 把早餐场景几乎全部排除（hotel-breakfast 共 17 项，排 16 项剩 1 < 2 → 放宽）
    const excludeNames = ['水煮蛋', '茶叶蛋', '煎蛋', '蛋白(去黄)', '全脂牛奶', '酸奶(原味)', '豆浆(无糖)', '豆腐脑', '蛋炒饭', '炒面', '炒蔬菜', '早餐香肠', '面包(白吐司)', '燕麦粥', '香蕉', '苹果']
    const { candidates } = planDailyMeals({ remaining: REM, dayType: 'training', excludeNames })
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates[0].meals.length).toBeGreaterThan(0)
  })

  it('picked 食物昨天吃过 → 不强制纳入并提示', () => {
    const { candidates, note } = planDailyMeals({
      remaining: REM, dayType: 'training', picked: '牛肉饭', excludeNames: ['牛肉饭'],
    })
    const names = candidates.flatMap((c) => c.meals.flatMap((m) => m.items.map((i) => i.name)))
    expect(names).not.toContain('牛肉饭')
    expect(note).toContain('牛肉饭')
  })
})

describe('normalizeFoodName — 记录食物名规整', () => {
  it('剥掉餐次前缀与用量后缀', () => {
    expect(normalizeFoodName('早餐·水煮蛋（1份）')).toBe('水煮蛋')
    expect(normalizeFoodName('午餐·牛肉饭（2份）')).toBe('牛肉饭')
    expect(normalizeFoodName('水煮蛋')).toBe('水煮蛋')
    expect(normalizeFoodName('')).toBe('')
  })
})

describe('swapMealItem — 条目可换（锁定后仍可更换）', () => {
  it('同餐次场景内换一个不同的食物', () => {
    const next = swapMealItem({ dayType: 'training', slot: '午餐', currentName: '牛肉饭', otherNames: [] })
    expect(next).toBeTruthy()
    expect(next.name).not.toBe('牛肉饭')
    expect(next.kcal).toBeGreaterThan(0)
  })
  it('排除本方案其他条目与昨天吃过的', () => {
    const next = swapMealItem({
      dayType: 'training', slot: '午餐', currentName: '牛肉饭',
      otherNames: ['黄焖鸡米饭', '兰州拉面(牛肉)'], excludeNames: ['猪肉水饺'],
    })
    expect(['牛肉饭', '黄焖鸡米饭', '兰州拉面(牛肉)', '猪肉水饺']).not.toContain(next.name)
  })
  it('未知餐次 → 用全场景池兜底', () => {
    const next = swapMealItem({ dayType: 'training', slot: '火星餐', currentName: 'x', otherNames: [] })
    expect(next).toBeTruthy()
  })
  it('连续换会循环到不同食物', () => {
    const a = swapMealItem({ dayType: 'training', slot: '早餐', currentName: '水煮蛋', otherNames: [] })
    const b = swapMealItem({ dayType: 'training', slot: '早餐', currentName: a.name, otherNames: ['水煮蛋'] })
    expect(b.name).not.toBe(a.name)
    expect(b.name).not.toBe('水煮蛋')
  })
})

describe('recalcCandidate — 换条目后重算合计', () => {
  it('合计等于所有条目之和', () => {
    const c = {
      name: 't',
      meals: [
        { slot: '早餐', items: [{ name: 'a', kcal: 100, protein: 10, carb: 5, fat: 2 }] },
        { slot: '午餐', items: [{ name: 'b', kcal: 200, protein: 20, carb: 10, fat: 4 }, { name: 'c', kcal: 50, protein: 5, carb: 2, fat: 1 }] },
      ],
      total: {},
    }
    recalcCandidate(c)
    expect(c.total).toEqual({ kcal: 350, protein: 35, carb: 17, fat: 7 })
  })
})
