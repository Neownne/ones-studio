// src/data/seed.js — 默认计划 / 训练模板 / 清单定义（首次启动写入）
// 依据 DESIGN.md v2.0 §2（热量复算）、§5.7（加重判定）、§6.2（Plan schema）
import { SCHEMA_VERSION, EVE_DATE } from './constants.js'

export const PLAN_TOTAL_DAYS = 91
export const PLAN_START_DATE = '2026-11-10'

// 4 分化对应酒店健身房器械（史密斯/飞鸟/哈克/高位下拉/坐姿划船/腿屈伸/腿弯举/哑铃 2.5–20kg）
export const WORKOUT_TEMPLATES = {
  push: {
    id: 'push', name: '推 · 胸肩三头', split: 'push',
    exercises: [
      { id: 'p1', templateId: 'p1', name: '史密斯卧推', sets: 4, repMax: 8, currentWeight: 45, weightStep: 2.5 },
      { id: 'p2', templateId: 'p2', name: '坐姿哑铃肩推', sets: 3, repMax: 10, currentWeight: 12.5, weightStep: 2.5 },
      { id: 'p3', templateId: 'p3', name: '飞鸟机夹胸', sets: 3, repMax: 12, currentWeight: 20, weightStep: 2.5 },
      { id: 'p4', templateId: 'p4', name: '绳索下压', sets: 3, repMax: 12, currentWeight: 15, weightStep: 2.5 },
    ],
  },
  pull: {
    id: 'pull', name: '拉 · 背二头', split: 'pull',
    exercises: [
      { id: 'q1', templateId: 'q1', name: '高位下拉', sets: 4, repMax: 10, currentWeight: 40, weightStep: 2.5 },
      { id: 'q2', templateId: 'q2', name: '坐姿划船', sets: 4, repMax: 10, currentWeight: 40, weightStep: 2.5 },
      { id: 'q3', templateId: 'q3', name: '面拉', sets: 3, repMax: 15, currentWeight: 12.5, weightStep: 2.5 },
      { id: 'q4', templateId: 'q4', name: '哑铃弯举', sets: 3, repMax: 12, currentWeight: 10, weightStep: 2.5 },
    ],
  },
  legs: {
    id: 'legs', name: '腿 · 股四头/腘绳/臀', split: 'legs',
    exercises: [
      { id: 'l1', templateId: 'l1', name: '哈克深蹲', sets: 4, repMax: 8, currentWeight: 55, weightStep: 2.5 },
      { id: 'l2', templateId: 'l2', name: '史密斯罗马尼亚硬拉', sets: 3, repMax: 10, currentWeight: 40, weightStep: 2.5 },
      { id: 'l3', templateId: 'l3', name: '坐姿腿屈伸', sets: 3, repMax: 12, currentWeight: 30, weightStep: 2.5 },
      { id: 'l4', templateId: 'l4', name: '俯卧腿弯举', sets: 3, repMax: 12, currentWeight: 25, weightStep: 2.5 },
    ],
  },
  upper: {
    id: 'upper', name: '上肢综合', split: 'upper',
    exercises: [
      { id: 'u1', templateId: 'u1', name: '史密斯卧推', sets: 3, repMax: 8, currentWeight: 45, weightStep: 2.5 },
      { id: 'u2', templateId: 'u2', name: '高位下拉', sets: 3, repMax: 10, currentWeight: 40, weightStep: 2.5 },
      { id: 'u3', templateId: 'u3', name: '坐姿哑铃肩推', sets: 3, repMax: 10, currentWeight: 12.5, weightStep: 2.5 },
      { id: 'u4', templateId: 'u4', name: '坐姿划船', sets: 3, repMax: 10, currentWeight: 40, weightStep: 2.5 },
    ],
  },
}

// 7 项轮转数组，供 day.js computeDayType 使用；0 计划 → no-plan
export const DEFAULT_PATTERN = ['push', 'pull', 'rest', 'legs', 'upper', 'rest', 'rest']

export function makeDefaultPlan() {
  return {
    id: 'plan-default',
    name: '先减后增 · 减脂期',
    startDate: PLAN_START_DATE,
    endDate: EVE_DATE,
    totalDays: PLAN_TOTAL_DAYS,
    macroTargets: {
      training: { kcal: 2188, protein: 155, carb: 275, fat: 52 },
      rest: { kcal: 2038, protein: 155, carb: 247, fat: 48 },
    },
    metrics: {
      // 通用默认占位值（脱敏）；用户在计划编辑页改成自己的指标
      current: { weight: 70, bodyfat: 15 },
      target: { weight: 67.5, bodyfat: 13 },
    },
    // foods / exercises 一期存 id 列表，编辑页可增删
    foods: ['egg_boiled', 'egg_white', 'milk_whole', 'whey', 'chicken_breast', 'beef_rice', 'brown_rice'],
    exercises: Object.values(WORKOUT_TEMPLATES).flatMap((t) => t.exercises.map((e) => e.id)),
    schedule: { pattern: [...DEFAULT_PATTERN] },
  }
}

export function makeDefaultSettings() {
  return {
    schemaVersion: SCHEMA_VERSION,
    activePlanId: 'plan-default',
    progressCache: { configSig: '', archivedDays: 0 },
    lastDayKey: null,
    // 个人主页（设置页）
    profile: { name: '', birth: '', height: '', gender: '' },
    theme: 'dark',      // 'dark' | 'light'
    avatar: '',         // base64 dataURL（缩放后），空则用首字母占位
    trainingCond: 'gym', // 锻炼条件：'gym' 健身房 | 'dumbbell' 居家哑铃 | 'none' 徒手
  }
}

// 首次启动：只在缺键时写入，绝不覆盖用户数据
export function seedIfEmpty(store) {
  if (store.read('os:settings') === undefined) store.safeWrite('os:settings', makeDefaultSettings())
  if (store.read('os:plans') === undefined) store.safeWrite('os:plans', [makeDefaultPlan()])
  if (store.read('os:templates') === undefined) store.safeWrite('os:templates', WORKOUT_TEMPLATES)
  if (store.read('os:weights') === undefined) store.safeWrite('os:weights', [])
  if (store.read('os:foods') === undefined) store.safeWrite('os:foods', [])
  if (store.read('os:ai_config') === undefined) {
    store.safeWrite('os:ai_config', { base_url: '', api_key: '', model: '', enabled: false })
  }
}
