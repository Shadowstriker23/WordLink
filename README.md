# WordLink — 英语单词记忆知识库

> AI 驱动 · 标签化记忆 · 间隔复习 · 知识图谱

WordLink 是面向高中英语学习者的智能单词记忆工具。通过 **AI 自动分析**词根词缀、意思分组、词性，以**标签**为纽带串联起分散的单词，搭配 **FSRS-6 间隔复习算法**科学规划记忆节奏。

核心思路：与其孤立地背单词，不如用 **tag 体系**把同一词根、同一意思、同一词性的词汇聚在一起，在关联中加深记忆。

## 特性

- **标签检索** — 核心体验。多标签 AND 搜索 `#-tion #adj. #spect`、词性检索 `#vt.`、单词直接检索，相似推荐。右侧大数据卡片展示完整词条信息
- **三栏全局面板** — 右侧常驻标签面板：选中任意词/标签时，实时显示词根词缀、意思分组、词性、同义词/反义词。所有标签均可点击跳转延伸
- **AI 自动分析** — 输入单词，DeepSeek 自动拆解词根词缀、生成意思标签、关联已有词库，一语导出
- **内置词典** — 整合 [ECDICT 开源词典](https://github.com/skywind3000/ECDICT)（76 万词条），分词性释义、音标，支持在线 TTS 美/英发音
- **词根词缀本意** — 词根/词缀 tag 附带含义解释（如 `spect = 看，注视`），AI 生成 + 内置 80+ 常见词根词缀对照表
- **FSRS-6 间隔复习** — 闪卡式每日复习，自动排程；复习时右栏隐藏意思防止剧透
- **统计看板** — 遗忘曲线 30 天预测、近 7 天复习量、复习质量评级分布
- **模块化 & 主题** — 功能模块可插拔注册；内置"夜读"暗色主题，可照模板写新主题

## 预览

| 标签检索 | 单词详情 | 知识图谱 |
|-----------|----------|----------|
| ![explore](docs/screenshots/explore.png) | ![detail](docs/screenshots/detail.png) | ![graph](docs/screenshots/graph.png) |

*(截图待补充至 `docs/screenshots/`)*

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 |
| 数据库 | Prisma 7 + SQLite (better-sqlite3) |
| AI | DeepSeek API (OpenAI 兼容) |
| 复习算法 | [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (FSRS-6) |
| 图谱 | cytoscape.js |
| 图表 | recharts |
| TTS | 有道 / 百度 / Google 语音 (API 代理) |
| OCR | tesseract.js |

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY（也可在网页设置页配置）

# 3. 生成 Prisma Client + 同步数据库
pnpm exec prisma generate
pnpm exec prisma db push

# 4. (可选) 导入种子数据
pnpm db:seed

# 5. 构建词典库
#    下载 ECDICT 数据（约 65MB）
curl -L -o ecdict.csv "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
#    国内网络可使用 ghfast.top 加速
curl -L -o ecdict.csv "https://ghfast.top/https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
pnpm db:dict        # 构建 data/ecdict.db（约 100MB，耗时 1-2 分钟）

# 6. 启动
pnpm dev
# 访问 http://localhost:3000
```

> 也可跳过第 5 步，程序仍可正常使用，仅标签检索页缺失词典释义。

首次启动后，进入左侧栏 → **设置** → 填入 DeepSeek API Key，点击"测试连接"即可使用 AI 功能。

## 部署到 Ubuntu 服务器

```bash
# 克隆项目
git clone https://github.com/yourname/wordlink.git /opt/wordlink

# 运行部署脚本（自动安装依赖、构建、配置 PM2）
sudo bash /opt/wordlink/deploy.sh

# PM2 管理
pm2 status              # 查看状态
pm2 logs wordlink       # 日志
pm2 restart wordlink    # 重启
```

应用默认运行在 `http://服务器IP:3000`。可配合 Nginx 反向代理绑定域名 + HTTPS。

## Nginx 反向代理（可选）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 项目结构

```
src/
├── app/
│   ├── api/                    # API 路由
│   │   ├── import/             # OCR + AI 处理 + 词典导入
│   │   ├── explore/            # 标签检索 + 单词卡片
│   │   ├── review/             # FSRS 复习排程
│   │   ├── stats/              # 统计数据
│   │   ├── tags/               # 标签信息
│   │   ├── tts/                # TTS 发音代理
│   │   └── words/              # 单词 CRUD
│   ├── explore/                # 标签检索页
│   ├── words/                  # 单词库
│   ├── words/[id]/             # 单词详情页
│   ├── graph/                  # 知识图谱
│   ├── review/                 # 每日复习
│   ├── stats/                  # 统计看板
│   ├── tags/[name]/            # 标签页
│   └── settings/               # 设置页
├── components/                 # UI 组件
│   ├── app-shell.tsx           # 三栏全局布局
│   ├── tag-panel.tsx           # 右栏标签面板
│   ├── word-card.tsx           # 单词大卡片
│   ├── word-audio.tsx          # TTS 发音按钮
│   └── ui/                     # 基础 UI 库
├── lib/                        # 核心逻辑
│   ├── ai.ts                   # DeepSeek AI 客户端
│   ├── db.ts                   # Prisma + SQLite 客户端
│   ├── dict.ts                 # ECDICT 词典查询
│   ├── fsrs.ts                 # FSRS-6 间隔复习
│   ├── affix-desc.ts           # 词根词缀本意对照表
│   ├── tag-panel-context.tsx   # 全局面板状态
│   ├── registry.ts             # 模块注册中心
│   └── theme.ts               # 主题引擎
├── modules/                    # 功能模块注册
├── themes/                     # 主题定义
│   ├── default/                # 默认浅色主题
│   └── dark/                   # 夜读暗色主题
└── data/                       # 运行时数据
    ├── ecdict.db               # 词典数据库
    └── settings.json           # 用户设置
```

## 自定义主题

主题系统基于 CSS 变量。新建主题只需在 `src/themes/` 下创建文件并在 provider 中注册：

```ts
// 1. 创建 src/themes/forest/index.ts
import { registerTheme } from "@/lib/theme";

registerTheme({
  id: "forest",
  label: "森系",
  description: "柔和绿色护眼主题",
  scheme: "light",
  variables: {
    "--wl-primary": "#059669",
    "--wl-accent": "#10b981",
    "--wl-bg": "#f0fdf4",
    "--wl-surface": "#ffffff",
    "--wl-surface-2": "#ecfdf5",
    "--wl-border": "#a7f3d0",
    "--wl-text": "#064e3b",
    "--wl-muted": "#6b7280",
    "--wl-danger": "#ef4444",
    "--wl-success": "#22c55e",
    "--wl-warning": "#f59e0b",
    "--wl-radius": "0.75rem",
  },
});

// 2. 在 src/components/theme-provider.tsx 中添加 import
import "@/themes/forest";

// 3. 在 src/components/theme-switcher.tsx 中也添加
import "@/themes/forest";
```

重新构建后，主题即可在左侧栏底部切换。

## 数据备份

所有用户数据存储在 `dev.db`（SQLite）和 `data/settings.json`（设置）中：

```bash
# 备份
cp dev.db /backup/wordlink-$(date +%F).db
cp data/settings.json /backup/wordlink-settings-$(date +%F).json
```

词典库 `data/ecdict.db` 为只读静态数据（从 ECDICT CSV 构建），无需备份，可在新环境重建。

## 常见问题

**AI 导入报错**
- 检查 DeepSeek API Key 是否在设置页正确填写并测试通过
- 国内网络不稳定时可在设置页切换模型/Base URL

**OCR 识别不准确**
- 手写识别是公认难题。推荐先用英文印刷体测试
- 可在设置页调整 OCR 语言（`eng+chi_sim` / `eng`），或设置 `TESSDATA_MIRROR` 环境变量指向国内镜像

**词典构建网络问题**
- 原始 ECDICT CSV 托管在 GitHub（约 65MB），国内可使用 ghfast.top 代理下载
- 也可从 [ECDICT 仓库](https://github.com/skywind3000/ECDICT) 手动下载后放置到项目根目录，再运行 `pnpm db:dict`

**修改数据模型后**
```bash
pnpm exec prisma db push   # 同步数据库
pnpm exec prisma generate  # 重新生成客户端
```

## 致谢

- [ECDICT](https://github.com/skywind3000/ECDICT) — 开源英语词典数据
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) — FSRS-6 开箱即用的 TypeScript 实现
- [cytoscape.js](https://js.cytoscape.org/) — 知识图谱渲染
- [有道词典](https://dict.youdao.com/) & [百度翻译](https://fanyi.baidu.com/) — 免费 TTS 语音

## License

MIT
