import { describe, it, expect } from 'vitest'
import { shouldSuggestIncrease, commitIncrease } from '../src/utils/progression.js'

// 模板夹具：卧推 45kg、3 组、上限 10 次、步长 2.5kg
const tpl = { id: 'e_bench', sets: 3, repMax: 10, currentWeight: 45, weightStep: 2.5, bodyweight: false, suppressIncrease: false }
const sets = (reps, weight, done = true, n = 3) => Array.from({ length: n }, () => ({ reps, weight, done }))
const hitSets = () => sets(10, 45)
const logWith = (dk, exSets) => ({ dayKey: dk, workout: { exercises: [{ templateId: 'e_bench', sets: exSets }] } })
const logOther = (dk) => ({ dayKey: dk, workout: { exercises: [{ templateId: 'e_row', sets: hitSets() }] } })

describe('shouldSuggestIncrease — 连续 2 次达上限才建议', () => {
  it('最近 2 次都达上限 → suggest，nextWeight = currentWeight + 2.5', () => {
    const logs = { '2025-11-10': logWith('2025-11-10', hitSets()), '2025-11-12': logWith('2025-11-12', hitSets()) }
    const r = shouldSuggestIncrease(logs, tpl, '2025-11-13')
    expect(r.suggest).toBe(true)
    expect(r.hits).toBe(2)
    expect(r.nextWeight).toBe(47.5)
    expect(r.reason).toBe('two-consecutive')
  })
  it('最近一次未达 → 连击清零', () => {
    const logs = { '2025-11-10': logWith('2025-11-10', hitSets()), '2025-11-12': logWith('2025-11-12', sets(8, 45)) }
    const r = shouldSuggestIncrease(logs, tpl, '2025-11-13')
    expect(r.suggest).toBe(false)
    expect(r.hits).toBe(0)
  })
  it('更早一次未达不影响最近两次连击', () => {
    const logs = {
      '2025-11-08': logWith('2025-11-08', sets(8, 45)),
      '2025-11-10': logWith('2025-11-10', hitSets()),
      '2025-11-12': logWith('2025-11-12', hitSets()),
    }
    expect(shouldSuggestIncrease(logs, tpl, '2025-11-13').suggest).toBe(true)
  })
  it('只有一次记录 → 不建议', () => {
    const logs = { '2025-11-12': logWith('2025-11-12', hitSets()) }
    const r = shouldSuggestIncrease(logs, tpl, '2025-11-13')
    expect(r.suggest).toBe(false)
    expect(r.hits).toBe(1)
  })
  it('无该动作的日子跳过（不计入也不中断连击）', () => {
    const logs = {
      '2025-11-10': logWith('2025-11-10', hitSets()),
      '2025-11-11': logOther('2025-11-11'),
      '2025-11-12': logWith('2025-11-12', hitSets()),
    }
    expect(shouldSuggestIncrease(logs, tpl, '2025-11-13').suggest).toBe(true)
  })
  it('排除今天（未归档不计）', () => {
    const logs = { '2025-11-10': logWith('2025-11-10', hitSets()), '2025-11-12': logWith('2025-11-12', hitSets()) }
    expect(shouldSuggestIncrease(logs, tpl, '2025-11-12').suggest).toBe(false)
  })
  it('达上限三要素：次数、重量、组数与完成标记', () => {
    const today = '2025-11-20'
    const hit = logWith('2025-11-19', hitSets())
    expect(shouldSuggestIncrease({ '2025-11-18': hit, '2025-11-19': logWith('2025-11-19', sets(9, 45)) }, tpl, today).suggest).toBe(false) // 次数不够
    expect(shouldSuggestIncrease({ '2025-11-18': hit, '2025-11-19': logWith('2025-11-19', sets(10, 42.5)) }, tpl, today).suggest).toBe(false) // 重量低于模板
    expect(shouldSuggestIncrease({ '2025-11-18': hit, '2025-11-19': logWith('2025-11-19', sets(10, 45, false)) }, tpl, today).suggest).toBe(false) // 有组未勾
    expect(shouldSuggestIncrease({ '2025-11-18': hit, '2025-11-19': logWith('2025-11-19', sets(10, 45, true, 2)) }, tpl, today).suggest).toBe(false) // 组数不足
    expect(shouldSuggestIncrease({ '2025-11-18': hit, '2025-11-19': hit }, tpl, today).suggest).toBe(true) // 重量等于模板当前值即达
  })
  it('bodyweight 自重动作跳过', () => {
    const bw = { ...tpl, id: 'e_pushup', bodyweight: true }
    const logs = {
      '2025-11-10': { dayKey: '2025-11-10', workout: { exercises: [{ templateId: 'e_pushup', sets: hitSets() }] } },
      '2025-11-12': { dayKey: '2025-11-12', workout: { exercises: [{ templateId: 'e_pushup', sets: hitSets() }] } },
    }
    const r = shouldSuggestIncrease(logs, bw, '2025-11-13')
    expect(r.suggest).toBe(false)
    expect(r.reason).toBe('bodyweight')
  })
  it('suppressIncrease（不再提示这个动作）跳过', () => {
    const sup = { ...tpl, suppressIncrease: true }
    const logs = { '2025-11-10': logWith('2025-11-10', hitSets()), '2025-11-12': logWith('2025-11-12', hitSets()) }
    const r = shouldSuggestIncrease(logs, sup, '2025-11-13')
    expect(r.suggest).toBe(false)
    expect(r.reason).toBe('suppressed')
  })
})

describe('commitIncrease — 写回只改下次建议重量', () => {
  it('返回新对象，只改 currentWeight，不改原模板', () => {
    const next = commitIncrease(tpl, 47.5)
    expect(next.currentWeight).toBe(47.5)
    expect(next.repMax).toBe(10)
    expect(tpl.currentWeight).toBe(45) // 原对象不被修改
    expect(next).not.toBe(tpl)
  })
})
