// src/pages/ai-settings.js — 黑底反色页：三字段 + 配置状态 + 合规说明
// 二期起按配置完整性启用；api_key 不回显明文、不进导出备份。
import { header, hint, label, field, btn, card, esc } from '../components/ui.js'
import { getConfig, isEnabled, mask } from '../services/ai.js'

export function render(ctx) {
  const cfg = getConfig()
  const ready = isEnabled()

  return `
  <div class="invert-page">
  ${header('AI 设置', { sub: 'MODEL / CONNECTION', badge: 'AI', back: 'plan-list' })}

  ${hint(2, ready ? 'READY' : 'NOT CONFIGURED',
    ready
      ? '配置完整 · 记餐页「生成今日吃法」可用。'
      : '填齐三项后，记餐页「生成今日吃法」才可用。配置只存本机，密钥不进导出备份。')}

  <section class="block">
    <div class="section-head">${label('CONNECTION')}</div>
    ${card(`
      ${field('ai-base', 'BASE URL', cfg.base_url, { placeholder: 'https://api.example.com 或 …/v1' })}
      ${field('ai-key', 'API KEY', '', { type: 'password', placeholder: cfg.api_key ? mask(cfg.api_key) : 'sk-...' })}
      ${field('ai-model', 'MODEL', cfg.model, { placeholder: 'model-name' })}
      <div class="type-caption">已保存的密钥不会明文显示；留空保存 = 保留旧密钥。</div>
      <div class="btn-row">${btn('保存设置', 'ai-save', { variant: 'primary' })}</div>
    `, { level: 1 })}
  </section>

  <section class="block">
    <div class="section-head">${label('DAILY PLAN GENERATOR')}</div>
    ${card(`<div class="ai-status${ready ? ' ai-status--on' : ''}">
      <span class="type-body">生成今日吃法</span>
      <span class="type-label">${ready ? 'READY' : 'NOT CONFIGURED'}</span>
    </div>
    <div class="type-caption">按当天已摄入与剩余缺口生成 2-3 组候选，选一组采纳写入记餐。入口在记餐页「GENERATE / AI」。</div>`)}
  </section>

  <section class="block">
    <div class="section-head">${label('COMPLIANCE')}</div>
    <div class="type-caption">本程序只用于记录、健康管理与生活习惯改善，不提供诊断、治疗、处方或疗效承诺。AI 生成的吃法为估算建议，仅供参考。</div>
  </section>
  </div>
  `
}
