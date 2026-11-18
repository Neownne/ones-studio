// src/pages/settings.js — 个人主页 / 设置：头像 + 名称 + 个人信息（左侧弹层编辑）+ 各设置入口
// 个人信息细项与历史记录一样：点行从左侧滑出弹层，弹层内编辑/查看
import { header, hint, label, card, btn, esc } from '../components/ui.js'

// 导航行（跳页面）
const navRow = (title, desc, route) => `
  <a class="setting-row" href="#/${route}" data-act="nav" data-route="${route}">
    <span class="setting-row__main">
      <span class="setting-row__title type-body">${esc(title)}</span>
      <span class="setting-row__desc type-caption">${esc(desc)}</span>
    </span>
    <span class="type-label setting-row__go">›</span>
  </a>`

// 弹层行（左侧滑出）：个人信息细项 / 历史记录
const drawerRow = (title, desc, kind) => `
  <button type="button" class="setting-row setting-row--btn" data-act="drawer-open" data-kind="${esc(kind)}">
    <span class="setting-row__main">
      <span class="setting-row__title type-body">${esc(title)}</span>
      <span class="setting-row__desc type-caption">${esc(desc)}</span>
    </span>
    <span class="type-label setting-row__go">›</span>
  </button>`

export function render(ctx) {
  const s = ctx.settings || {}
  const p = s.profile || {}
  const name = (p.name || '').trim() || '未命名'
  const initial = (name[0] || 'U').toUpperCase()
  const theme = s.theme === 'light' ? 'light' : 'dark'
  const genderText = { male: '男', female: '女' }[p.gender] || '未设置'

  return `
  ${header('我的', { sub: 'ME / SETTINGS', badge: 'ME' })}

  <section class="block profile-hero">
    <button type="button" class="avatar" data-act="avatar-pick" aria-label="更换头像">
      ${s.avatar
        ? `<img class="avatar__img" src="${s.avatar}" alt="头像" />`
        : `<span class="avatar__initial type-display">${esc(initial)}</span>`}
    </button>
    <div class="profile-hero__name type-title">${esc(name)}</div>
    <div class="type-caption">点击头像可更换</div>
  </section>

  <section class="block">
    <div class="section-head">${label('PROFILE / 个人信息')}</div>
    <div class="setting-list">
      ${drawerRow('名称', p.name || '未设置', 'profile-name')}
      ${drawerRow('出生日期', p.birth || '未设置', 'profile-birth')}
      ${drawerRow('身高', p.height ? `${p.height} cm` : '未设置', 'profile-height')}
      ${drawerRow('性别', genderText, 'profile-gender')}
    </div>
  </section>

  <section class="block">
    <div class="section-head">${label('SETTINGS / 设置')}</div>
    <div class="setting-list">
      ${drawerRow('历史记录', '每天完成情况的热力图', 'history')}
      ${navRow('健身计划', '训练模板 / 宏量 / 食物 / 周期', 'plan-list')}
      ${navRow('AI 设置', '生成吃法的模型与密钥', 'ai-settings')}
      <div class="setting-row setting-row--static">
        <span class="setting-row__main">
          <span class="setting-row__title type-body">浅色主题</span>
          <span class="setting-row__desc type-caption">默认深色 · 切换立即生效并存本机</span>
        </span>
        <button type="button" class="switch${theme === 'light' ? ' is-on' : ''}" data-act="theme-toggle"
          role="switch" aria-checked="${theme === 'light'}" aria-label="浅色主题开关">
          <span class="switch__dot"></span>
        </button>
      </div>
    </div>
  </section>

  <section class="block">
    <div class="section-head">${label('BACKUP / 备份')}</div>
    ${card(`
      <div class="type-caption">导出全部数据为 JSON；导入覆盖（AI 密钥除外）。换机用。</div>
      <div class="btn-row">${btn('导出备份', 'export')}${btn('导入备份', 'import')}</div>
    `)}
  </section>
  `
}
