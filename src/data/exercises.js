// src/data/exercises.js — 动作库：按肌肉部位 + 锻炼条件分类
// conds 列出该动作「能做」的环境：gym=健身房器械齐全 / dumbbell=居家哑铃 / none=徒手无器材（酒店房间）
// 徒手动作三处都能做，所以 conds 含全部三项；器械动作只在 gym；重量为起步建议，非医疗建议
const X = (name, part, conds, sets, repMax, weight, equipment = '') => ({
  name, part, conds, sets, repMax, weight, equipment,
})

export const MUSCLE_LABELS = {
  chest: '胸', back: '背', shoulder: '肩', arms: '手臂', legs: '腿', core: '核心',
}

export const COND_LABELS = {
  gym: '健身房',
  dumbbell: '居家哑铃',
  none: '徒手无器材',
}

export const CONDS = ['gym', 'dumbbell', 'none']

const ALL = ['gym', 'dumbbell', 'none']
const HOME = ['gym', 'dumbbell'] // 有哑铃就能做

export const EXERCISE_LIBRARY = [
  // ---- 胸 ----
  X('史密斯卧推', 'chest', ['gym'], 4, 8, 45, '史密斯机'),
  X('飞鸟机夹胸', 'chest', ['gym'], 3, 12, 20, '飞鸟机'),
  X('哑铃平板卧推', 'chest', HOME, 4, 10, 15, '哑铃'),
  X('上斜哑铃卧推', 'chest', HOME, 3, 10, 12.5, '哑铃'),
  X('哑铃飞鸟', 'chest', HOME, 3, 12, 7.5, '哑铃'),
  X('俯卧撑', 'chest', ALL, 3, 15, 0, '自重'),
  X('宽距俯卧撑', 'chest', ALL, 3, 15, 0, '自重'),
  X('上斜俯卧撑', 'chest', ALL, 3, 15, 0, '手扶桌沿'),
  X('跪姿俯卧撑', 'chest', ALL, 3, 12, 0, '自重'),

  // ---- 背 ----
  X('高位下拉', 'back', ['gym'], 4, 10, 40, '高位下拉'),
  X('坐姿划船', 'back', ['gym'], 4, 10, 40, '划船机'),
  X('直臂下压', 'back', ['gym'], 3, 12, 15, '绳索'),
  X('单臂哑铃划船', 'back', HOME, 3, 12, 15, '哑铃'),
  X('哑铃俯身划船', 'back', HOME, 3, 12, 12.5, '哑铃'),
  X('桌下反向划船', 'back', ALL, 3, 10, 0, '桌沿'),
  X('俯卧超人式', 'back', ALL, 3, 12, 0, '自重'),
  X('俯身Y-T-W', 'back', ALL, 3, 12, 0, '自重'),

  // ---- 肩 ----
  X('坐姿哑铃肩推', 'shoulder', HOME, 3, 10, 12.5, '哑铃'),
  X('面拉', 'shoulder', ['gym'], 3, 15, 12.5, '绳索'),
  X('哑铃侧平举', 'shoulder', HOME, 3, 15, 7.5, '哑铃'),
  X('哑铃前平举', 'shoulder', HOME, 3, 12, 7.5, '哑铃'),
  X('哑铃俯身飞鸟', 'shoulder', HOME, 3, 12, 7.5, '哑铃'),
  X('派克俯卧撑', 'shoulder', ALL, 3, 10, 0, '自重'),
  X('水瓶侧平举', 'shoulder', ['dumbbell', 'none'], 3, 15, 0, '500ml 水瓶'),

  // ---- 手臂 ----
  X('绳索下压', 'arms', ['gym'], 3, 12, 15, '绳索'),
  X('哑铃弯举', 'arms', HOME, 3, 12, 10, '哑铃'),
  X('锤式弯举', 'arms', HOME, 3, 12, 10, '哑铃'),
  X('颈后臂屈伸', 'arms', HOME, 3, 12, 10, '哑铃'),
  X('窄距俯卧撑', 'arms', ALL, 3, 12, 0, '自重'),
  X('椅上臂屈伸', 'arms', ALL, 3, 12, 0, '床沿/椅背'),
  X('水瓶弯举', 'arms', ['dumbbell', 'none'], 3, 15, 0, '500ml 水瓶'),

  // ---- 腿 ----
  X('哈克深蹲', 'legs', ['gym'], 4, 8, 55, '哈克机'),
  X('史密斯罗马尼亚硬拉', 'legs', ['gym'], 3, 10, 40, '史密斯机'),
  X('坐姿腿屈伸', 'legs', ['gym'], 3, 12, 30, '腿屈伸机'),
  X('俯卧腿弯举', 'legs', ['gym'], 3, 12, 25, '腿弯举机'),
  X('哑铃箭步蹲', 'legs', HOME, 3, 10, 10, '哑铃'),
  X('哑铃罗马尼亚硬拉', 'legs', HOME, 3, 10, 12.5, '哑铃'),
  X('自重深蹲', 'legs', ALL, 3, 20, 0, '自重'),
  X('保加利亚分腿蹲', 'legs', ALL, 3, 10, 0, '后脚搭床沿'),
  X('臀桥', 'legs', ALL, 3, 15, 0, '自重'),
  X('单腿臀桥', 'legs', ALL, 3, 12, 0, '自重'),
  X('靠墙静蹲', 'legs', ALL, 3, 1, 0, '自重'),
  X('开合跳', 'legs', ALL, 3, 30, 0, '自重'),

  // ---- 核心 ----
  X('卷腹', 'core', ALL, 3, 15, 0, '自重'),
  X('平板支撑', 'core', ALL, 3, 1, 0, '自重'),
  X('侧平板支撑', 'core', ALL, 3, 1, 0, '自重'),
  X('俄罗斯转体', 'core', ALL, 3, 20, 0, '自重'),
  X('死虫式', 'core', ALL, 3, 12, 0, '自重'),
  X('仰卧举腿', 'core', ALL, 3, 15, 0, '自重'),
  X('登山跑', 'core', ALL, 3, 20, 0, '自重'),
  X('悬垂举腿', 'core', ['gym'], 3, 10, 0, '单杠'),
]

// 分化 → 主肌群（模板动作名不在库里时的兜底归类）
export const SPLIT_PRIMARY_PART = {
  push: 'chest', pull: 'back', legs: 'legs', upper: 'chest',
}

export const findExercise = (name) => EXERCISE_LIBRARY.find((e) => e.name === name)

// 动作名 → 肌群；库外（用户自定义动作）按分化主肌群兜底
export function partOfExercise(name, split) {
  const hit = findExercise(name)
  if (hit) return hit.part
  return SPLIT_PRIMARY_PART[split] || 'chest'
}

// 某肌群在某锻炼条件下的动作池
export function poolOf(part, cond = 'gym') {
  return EXERCISE_LIBRARY.filter((e) => e.part === part && e.conds.includes(cond))
}
