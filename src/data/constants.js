// src/data/constants.js — 全局常量（唯一来源，禁止在别处硬编码）
export const EVE_DATE = '2027-02-05'
export const ROLLOVER_HOUR = 4
export const SCHEMA_VERSION = 3 // 内部迁移链 0→1→2→3，禁跳级
export const BACKUP_VERSION = 1 // 用户可见备份文件版本
export const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 // localStorage 保守估计
export const WARN_RATIO = 0.8 // ≥80% 预警
export const REJECT_RATIO = 0.95 // ≥95% 拒写
export const TODO_IDS = [
  'anchor_1', 'anchor_2', 'anchor_3', 'anchor_4', 'anchor_5',
  'training_or_rest',
]
export const TODO_LABELS = {
  anchor_1: '早餐蛋白锚点',
  anchor_2: '上午蛋白锚点',
  anchor_3: '午餐蛋白锚点',
  anchor_4: '练后蛋白锚点',
  anchor_5: '晚餐蛋白锚点',
  training_or_rest: '训练 / 休息',
}
export const MACRO_LABELS = { kcal: 'KCAL', protein: 'PRO', carb: 'CARB', fat: 'FAT' }
