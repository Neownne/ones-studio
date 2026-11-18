/**
 * canvas 镜像 token —— 与 src/styles/tokens.css 同源，人工同步。
 * 任何色值 / 纹理参数改动必须同时修改两处，并以 DESIGN.md v2.0 §4 为准。
 * 用途：canvas 2d 绘制（同心双环、趋势线等）无法读 CSS 变量，从这里取常量。
 */

export const COLOR = {
  canvas:     '#181a1d',                 // 页面画布：深灰（与 CSS 同步调亮）
  panel0:     '#222528',                 // 一级卡片 / 输入卡
  panel1:     '#2a2e32',                 // 二级面板
  panel2:     '#33373b',                 // 深嵌块
  line:       '#3d4146',                 // 底环 / 1px 结构描边
  text1:      '#f2f2ee',                 // 主文字
  text2:      'rgba(242,242,238,.58)',   // 次级
  text3:      'rgba(242,242,238,.40)',   // 说明 / 占位
  text4:      'rgba(242,242,238,.24)',   // 禁用 / 装饰
  accent:     '#d8fa00',                 // 唯一强调色：进度弧 / 焦点 / 编号
  accentDim:  '#b6d400',                 // 次级强调 / 环外标签
  amber:      '#ffde00',                 // 仅警告语义（超额 / 预警）
};

// 浅色主题色板（与 tokens.css [data-theme="light"] 同步）
export const COLOR_LIGHT = {
  canvas:     '#f2f3f0',
  panel0:     '#ffffff',
  panel1:     '#f7f8f6',
  panel2:     '#e9ebe6',
  line:       '#d3d7d0',
  text1:      '#17181a',
  text2:      'rgba(23,24,26,.6)',
  text3:      'rgba(23,24,26,.42)',
  text4:      'rgba(23,24,26,.26)',
  accent:     '#6f8f00',
  accentDim:  '#5f7c00',
  amber:      '#c99500',
};

// canvas 2d 绘制取色：按当前主题返回对应色板（document.documentElement.dataset.theme）
export function themeColors() {
  const light = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light'
  return light ? COLOR_LIGHT : COLOR
}

/** 纹理参数（§4.4） */
export const TEXTURE = {
  hazardPitch: 11,    // 45° 警戒带节距（品牌装饰）
  warnPitch: 5,       // 警告密斜纹节距（amber 态，与警戒带疏密区分）
  dotPitch: 18,       // 网点间距
  dotSize: 1,         // 网点圆点直径
  skewDeg: -24,       // 平行四边形 / 斜切色块倾角
  cutPx: 12,          // 卡片切角尺寸（右上 / 左下）
};

/** 硬偏移阴影：0 blur、纯色、只偏移不发散（§4.3） */
export const OFFSET = {
  ink: 'rgba(0,0,0,.55)',
  lime: 'rgba(216,250,0,.55)',
  steps: [3, 6, 8],
};
