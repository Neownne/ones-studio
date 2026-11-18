import { describe, it, expect } from 'vitest'
import { planTodayWorkout, nextCandidate } from '../src/services/workout-planner.js'
import { partOfExercise, findExercise, EXERCISE_LIBRARY, poolOf, CONDS } from '../src/data/exercises.js'
import { splitOfDay, collectWeekDoneNames } from '../src/utils/derive.js'

const PUSH_TPL = {
  id: 'push', name: '推 · 胸肩三头', split: 'push',
  exercises: [
    { id: 'p1', templateId: 'p1', name: '史密斯卧推', sets: 4, repMax: 8, currentWeight: 45 },
    { id: 'p2', templateId: 'p2', name: '坐姿哑铃肩推', sets: 3, repMax: 10, currentWeight: 12.5 },
    { id: 'p3', templateId: 'p3', name: '飞鸟机夹胸', sets: 3, repMax: 12, currentWeight: 20 },
    { id: 'p4', templateId: 'p4', name: '绳索下压', sets: 3, repMax: 12, currentWeight: 15 },
  ],
}

describe('planTodayWorkout — 今日运动候选生成（固定规则）', () => {
  it('默认选模板动作本身，槽位数 = 模板动作数', () => {
    const slots = planTodayWorkout({ split: 'push', template: PUSH_TPL })
    expect(slots).toHaveLength(4)
    expect(slots.map((s) => s.name)).toEqual(['史密斯卧推', '坐姿哑铃肩推', '飞鸟机夹胸', '绳索下压'])
    expect(slots.every((s) => s.confirmed === false)).toBe(true)
    expect(slots[0].part).toBe('chest')
    expect(slots[1].part).toBe('shoulder')
    expect(slots[3].part).toBe('arms')
  })

  it('本周已练的动作自动换成同肌群未练的候选', () => {
    const slots = planTodayWorkout({ split: 'push', template: PUSH_TPL, weekDoneNames: ['史密斯卧推'] })
    expect(slots[0].name).not.toBe('史密斯卧推')
    expect(slots[0].part).toBe('chest') // 同肌群替换
    // 其他没练过的保持模板动作
    expect(slots[1].name).toBe('坐姿哑铃肩推')
  })

  it('本周已练全部胸动作 → 兜底仍给出候选（不为空）', () => {
    const chest = ['史密斯卧推', '飞鸟机夹胸', '哑铃平板卧推', '上斜哑铃卧推', '俯卧撑']
    const slots = planTodayWorkout({ split: 'push', template: PUSH_TPL, weekDoneNames: chest })
    expect(slots[0].name).toBeTruthy()
    expect(slots[0].part).toBe('chest')
  })

  it('库外的自定义动作名保留，按分化主肌群归类', () => {
    const tpl = { exercises: [{ id: 'x', name: '我的自定义推', sets: 3, repMax: 10, currentWeight: 20 }] }
    const slots = planTodayWorkout({ split: 'push', template: tpl })
    expect(slots[0].name).toBe('我的自定义推')
    expect(slots[0].part).toBe('chest')
    expect(partOfExercise('我的自定义推', 'push')).toBe('chest')
  })
})

describe('nextCandidate — 换一个（同肌群循环）', () => {
  it('换出不同的同肌群动作', () => {
    const next = nextCandidate('chest', { currentName: '史密斯卧推' })
    expect(next).toBeTruthy()
    expect(next.name).not.toBe('史密斯卧推')
    expect(next.part).toBe('chest')
  })

  it('排除其他槽位已选，优先本周未练', () => {
    const next = nextCandidate('chest', {
      currentName: '史密斯卧推', otherNames: ['飞鸟机夹胸'], weekDone: ['哑铃平板卧推'],
    })
    expect(['史密斯卧推', '飞鸟机夹胸', '哑铃平板卧推']).not.toContain(next.name)
  })

  it('连续换会循环遍历整个肌群池', () => {
    const seen = new Set()
    let cur = '史密斯卧推'
    for (let i = 0; i < 4; i++) {
      const next = nextCandidate('chest', { currentName: cur })
      seen.add(next.name)
      cur = next.name
    }
    expect(seen.size).toBe(4) // 胸池 5 个动作，连换 4 次不重
  })

  it('未知肌群 → null', () => {
    expect(nextCandidate('wing', { currentName: 'x' })).toBe(null)
  })
})

describe('splitOfDay — 今日分化', () => {
  const plan = {
    startDate: '2026-11-16', // 周一
    schedule: { pattern: ['push', 'pull', 'rest', 'legs', 'upper', 'rest', 'rest'] },
  }
  it('训练日返回 split，休息日返回 null', () => {
    expect(splitOfDay(plan, '2026-11-16')).toBe('push')
    expect(splitOfDay(plan, '2026-11-17')).toBe('pull')
    expect(splitOfDay(plan, '2026-11-18')).toBe(null)
    expect(splitOfDay(plan, '2026-11-19')).toBe('legs')
  })
  it('无计划 → null', () => {
    expect(splitOfDay(null, '2026-11-16')).toBe(null)
  })
})

describe('collectWeekDoneNames — 本周已练动作集合', () => {
  const templates = { push: PUSH_TPL }
  it('解析组次记录（templateId→名称）与候选确认记录，只取本周周一到昨天', () => {
    const logs = {
      '2026-11-16': { workout: { exercises: [{ templateId: 'p1', sets: [{ done: true }] }] } }, // 周一
      '2026-11-17': { workout: { selections: [{ name: '哈克深蹲', confirmed: true }, { name: '面拉', confirmed: false }] } }, // 周二
      '2026-11-15': { workout: { selections: [{ name: '上周动作', confirmed: true }] } }, // 上周日，不计
    }
    const names = collectWeekDoneNames(logs, '2026-11-18', templates) // 周三看本周一二
    expect(names.has('史密斯卧推')).toBe(true)
    expect(names.has('哈克深蹲')).toBe(true)
    expect(names.has('面拉')).toBe(false) // 未确认
    expect(names.has('上周动作')).toBe(false) // 上周
  })
})

describe('动作库数据完整性', () => {
  it('默认模板动作全部在库内（保证能归类肌群）', () => {
    for (const name of ['史密斯卧推', '坐姿哑铃肩推', '飞鸟机夹胸', '绳索下压', '高位下拉', '坐姿划船', '面拉', '哑铃弯举', '哈克深蹲', '史密斯罗马尼亚硬拉', '坐姿腿屈伸', '俯卧腿弯举']) {
      expect(findExercise(name), name).toBeTruthy()
    }
  })

  it('每个肌群在每种锻炼条件下都至少有一个动作（候选不会空）', () => {
    for (const part of ['chest', 'back', 'shoulder', 'arms', 'legs', 'core']) {
      for (const cond of CONDS) {
        expect(poolOf(part, cond).length, `${part}/${cond}`).toBeGreaterThan(0)
      }
    }
  })

  it('有一批徒手无器材动作（酒店房间也能做）', () => {
    const noneOnly = EXERCISE_LIBRARY.filter((e) => e.conds.includes('none'))
    expect(noneOnly.length).toBeGreaterThanOrEqual(20)
    for (const name of ['俯卧撑', '上斜俯卧撑', '跪姿俯卧撑', '桌下反向划船', '俯卧超人式', '派克俯卧撑', '水瓶侧平举', '椅上臂屈伸', '自重深蹲', '保加利亚分腿蹲', '臀桥', '靠墙静蹲', '开合跳', '平板支撑', '死虫式', '仰卧举腿', '登山跑']) {
      expect(noneOnly.some((e) => e.name === name), name).toBe(true)
    }
  })
})

describe('锻炼条件 — 候选按条件筛选（健身房 / 居家哑铃 / 徒手）', () => {
  it('徒手条件下不会选出器械动作（模板器械动作自动替换为自重）', () => {
    const slots = planTodayWorkout({ split: 'push', template: PUSH_TPL, cond: 'none' })
    expect(slots).toHaveLength(4)
    for (const s of slots) {
      const lib = findExercise(s.name)
      expect(lib, s.name).toBeTruthy()
      expect(lib.conds.includes('none'), `${s.name} 不是徒手动作`).toBe(true)
    }
  })

  it('居家哑铃条件下不选纯器械动作', () => {
    const slots = planTodayWorkout({ split: 'push', template: PUSH_TPL, cond: 'dumbbell' })
    for (const s of slots) {
      const lib = findExercise(s.name)
      expect(lib.conds.includes('dumbbell'), `${s.name} 做不了（居家哑铃）`).toBe(true)
    }
  })

  it('健身房条件下保留模板器械动作', () => {
    const slots = planTodayWorkout({ split: 'push', template: PUSH_TPL, cond: 'gym' })
    expect(slots[0].name).toBe('史密斯卧推')
  })

  it('nextCandidate 在指定条件的池内循环', () => {
    const next = nextCandidate('chest', { currentName: '俯卧撑', cond: 'none' })
    expect(next).toBeTruthy()
    expect(next.conds.includes('none')).toBe(true)
    expect(next.name).not.toBe('俯卧撑')
  })
})
