// src/store/keys.js — localStorage key 唯一来源；日志按月分片
export const K = {
  settings: 'os:settings',
  plans: 'os:plans',
  templates: 'os:templates',
  weights: 'os:weights',
  foods: 'os:foods',
  aiConfig: 'os:ai_config', // 导出黑名单，导入事务全程不碰
  tmpPrefix: 'os:tmp:',
}
export const logsKey = (dayKey) => `os:logs:${dayKey.slice(0, 7)}`
export const tmpKey = (key, ts) => `${K.tmpPrefix}${key}:${ts}`

// 导出白名单：ai_config 与任何 tmp 键一律排除
export const isBackupable = (key) =>
  key === K.settings || key === K.plans || key === K.templates ||
  key === K.weights || key === K.foods ||
  key.startsWith('os:logs:')
