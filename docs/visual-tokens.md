# one's studio — 视觉 token 与样式规格（Phase 3 视觉地基）

> 来源：`DESIGN.md` v2.0 §4（视觉系统）。本文件供前端集成与评审对照。
> 文件：`src/styles/tokens.css` · `src/styles/base.css` · `src/styles/components.css` · `src/data/tokens.js`（canvas 镜像，人工同步）。

---

## 1. 色板 token（12 个，深色单主题）

| token | CSS 变量 | 值 | 用途 |
|---|---|---|---|
| canvas | `--canvas` | `#0a0a0a` | 页面画布（不用纯黑） |
| panel-0 | `--panel-0` | `#141614` | 一级卡片 / 输入卡 |
| panel-1 | `--panel-1` | `#1b1d1b` | 二级面板 |
| panel-2 | `--panel-2` | `#23251f` | 深嵌块 |
| line | `--line` | `#2a2c2b` | 1px 结构描边 / 分隔 / canvas 底环 |
| text-1 | `--text-1` | `#f2f2ee` | 主文字 |
| text-2 | `--text-2` | `rgba(242,242,238,.58)` | 次级 |
| text-3 | `--text-3` | `rgba(242,242,238,.40)` | 说明 / 占位 |
| text-4 | `--text-4` | `rgba(242,242,238,.24)` | 禁用 / 装饰 |
| accent | `--accent` | `#d8fa00` | 唯一强调色：主行动 / 选中 / 进度弧 / 焦点 / 编号 |
| accent-dim | `--accent-dim` | `#b6d400` | hover / 次级强调 / 环外标签 |
| amber | `--amber` | `#ffde00` | 仅警告语义（超额 / 预警），不做交互强调 |

canvas 镜像：`src/data/tokens.js` 的 `COLOR` 对象，key 为 camelCase。

## 2. 纹理与硬偏移（§4.4 / §4.3）

| 工具类 | 实现 | 规格 | 位置 |
|---|---|---|---|
| `.tx-hazard` | `repeating-linear-gradient(45deg, amber 0 2px, canvas 2px 11px)` | 45° 警戒带，11px 节距，黄黑细条 | 页面顶部分隔、空态、加载 |
| `.tx-dots` | `radial-gradient(circle, rgba(242,242,238,.08) 1px, transparent 1px)` + `background-size:18px` | 18px 网点，1px 圆点，低透明 | 画布背景 |
| `.tx-skew-block` | `42px × 3px` + `skewX(-24deg)` + accent 底 | 斜切色块 | 标题下划线 / 强调 |
| `.offset-3/6/8` | `box-shadow: Npx Npx 0 rgba(0,0,0,.55)` | 硬偏移，0 blur | 卡片 / 按钮层级 |
| `.offset-3/6/8-lime` | `rgba(216,250,0,.55)` | 硬偏移，青柠 | 仅主行动 / 选中态 |
| `.scanlines` | `repeating-linear-gradient(0deg, rgba(0,0,0,.28) 0 1px, transparent 1px 3px)`，fixed 全屏 | 3px 循环暗线 | **仅启动页** |

- 硬边双色条纹用 `repeating-linear-gradient` 属 §4.4 指定的纹理实现，**不是渐变铺底**（无插值过渡），不违反零渐变纪律。
- 所有装饰层 `pointer-events: none`，永不压住数字与可点区。
- **待评审**：品牌警戒带与警告态同用 amber（12 token 色板锁定，无第二个黄色可用），靠疏密（11px vs 5px）、位置（页面顶部/空态 vs 行内警告）与文案区分。若评审认为需色相区分，需新增 1 个 token。

## 3. 字体与排版阶梯（§4.2）

| 角色 | 类名 | 字体栈 | 规格 |
|---|---|---|---|
| 超大数字（倒计时） | `.type-display` | 系统窄体 `--font-display`：Impact → Arial Narrow → DIN Condensed → Helvetica Neue Condensed | 56px / 400 / lh 1 / ls .01em / tabular |
| 页面标题 | `.type-title` | 同上 | 24px / 400 / lh 1 / ls .02em |
| 区块标题 | `.type-section` | 同上 | 18px / 400 / lh 1 / ls .02em |
| 宏量 / 重量数字 | `.type-number` | 同上 | 22px / 400 / lh 1 / ls .01em / tabular |
| 等宽标签 | `.type-label` | `Cascadia Mono → SF Mono → Consolas → monospace` | 11px / 400 / 全大写 / ls .12em，宽版 `.type-label--wide` .38em，`// ` 前缀（accent-dim） |
| 正文 | `.type-body` / body | 系统黑体（PingFang SC / 雅黑 / Noto Sans SC） | 14px / 400 / lh 1.6 |
| 说明 | `.type-caption` | 同上 | 12px / 400 / lh 1.4 / text-2 |

- 标题数字类均 `font-synthesis: none`（禁伪造加粗/斜体）；`em, i` 强制 `font-style: normal`（中文不斜体）。
- 粗体只给标题和数字，正文一律 400。
- 焦点环：`:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }`。
- 动效：`.u-motion` 仅 `color/background-color/border-color/transform` 140ms，位移 ≤1px；`prefers-reduced-motion` 下关闭。

## 4. 字体子集方案（Anton）—— 二期可选，一期不启用

**一期口径（已落地）**：`base.css` **不声明 `@font-face`**，标题数字直接用系统窄体栈 `--font-display`，零字体请求、完全离线可用。

原因：仓库无 Anton 源文件（Anton 为 SIL OFL，可自行下载子集化）；系统自带的 Impact / Arial Narrow 是商业字体，不允许打包再分发。早期版本指向 `/assets/fonts/anton-subset.woff2` 的声明在缺文件时产生 404，且绝对路径在 GitHub Pages 子路径下必然失败，已删除。`sw.js` 缓存版本同步升到 `ones-studio-v3` 使旧缓存失效。

**字符集（44 个，二期启用时用）**：`0-9`（10）+ `A-Z`（26）+ 空格、`%`、`+`、`-`、`.`、`/`、`:`，即 `unicode-range: U+0020, U+0025, U+002B-003A, U+0041-005A`；中文与范围外字符自动回退系统黑体。

**产出命令**（需自备 `Anton-Regular.ttf` 与 OFL 许可文件）：

```bash
pip install fonttools brotli
pyftsubset Anton-Regular.ttf \
  --unicodes="U+0020,U+0025,U+002B-003A,U+0041-005A" \
  --flavor=woff2 \
  --layout-features='*' \
  --output-file=assets/fonts/anton-subset.woff2
```

**启用方式**：`base.css` 加回 `@font-face`，`src` 必须用相对路径 `../assets/fonts/anton-subset.woff2`（CSS 位于 `src/styles/`），并把字体文件加进 `sw.js` 的 `CORE_ASSETS`，同时升 `CACHE_VERSION`。`font-display: swap`，未加载时用系统窄体回退，布局不抖动（lh 1 + tabular）。

**体积估算**：Anton 全量 latin woff2 ≈ 45–50KB；44 个字形子集 woff2 预计 **6–10KB**（预算上限 15KB）。

## 5. 组件关键 CSS 值清单

| 组件 | 类名 | 关键值 |
|---|---|---|
| 斜切卡 | `.card-skew` | `panel-0` 底 + `1px solid var(--line)` + `clip-path` 右上/左下切 `12px`（`--cut`），padding 16px；变体 `--panel-1` / `--panel-2` |
| 平行四边形按钮 | `.btn-para` | `skewX(-24deg)`、min 44×44px、padding 0 20px、文字内层 `<span>` 反斜回正；默认 `panel-1` 底 + line 边 |
| 主按钮 | `.btn-para--primary` | accent 底 + canvas 字（青柠 ≤5% 配额） |
| 警告按钮 | `.btn-para--warn` | amber 底 + `::before` 5px 密斜纹（`rgba(10,10,10,.22)`，2px 条）+ canvas 字；不用红色 |
| 禁用按钮 | `.btn-para--disabled` | `panel-1` 底 + line 边 + text-4 字 + `pointer-events:none` |
| tab-bar | `.tab-bar` | fixed 底部、`56px + safe-area-inset-bottom`、canvas 底 + 顶部 1px line 边、6 项 `flex:1`、标签 mono 11px ls .12em 大写（HOME/FOOD/TASK/GYM/WT/LIST） |
| tab 选中 | `.tab-bar__item.is-active` | `::before` 青柠斜切块（`inset: 8px 6px` + `skewX(-24deg)`），文字反为 canvas 深色 |
| hint 首页 | `.hint--l1` | mono 12px；`panel-1` 底 + 1px line 边 + padding 12px 16px；`.hint__label` accent-dim + `// ` 前缀 |
| hint 二级页 | `.hint--l2` | 无底无边框，仅左 1px line 竖线 + padding 4px 0 4px 12px |
| 编号徽章 | `.badge-num` | accent 底、高 20px、min-width 20px、`skewX(-24deg)`，内层窄体 12px canvas 数字回正 |
| 扫描线 | `.scanlines` | fixed 全屏 3px 循环暗线、`pointer-events:none`、z-index 999，**仅启动页** |

## 6. 验收对照（DESIGN.md §10.3）

| 纪律 | 验收方法 |
|---|---|
| 青柠 ≤5% 整屏 | 截图人工估算：accent 只出现在主按钮/选中 tab/进度弧/焦点环/编号徽章 |
| 不引红色 | 全局搜 `#f00`/`red`/`crimson` 等应为 0；错误/超额只出现 amber + 斜纹 + 文案 |
| 零软阴影/发光/模糊 | 全局搜 `blur(`、`text-shadow`、非 0 blur 的 `box-shadow` 应为 0；仅允许 3/6/8px 硬偏移 |
| 文本四档白 | 正文/说明只用 text-1/2/3/4，画布 `#0a0a0a` 不用纯黑 |
| 热区 ≥44×44px | 按钮/ tab / 勾选框实测最小 44×44 |
| 装饰不压数字 | 装饰层均 `pointer-events:none`，且不放在数字上层 |
| 粗体纪律 | 正文/说明均 400；`em,i` 不斜体 |
