# 股小秘 Stock Genie

台股投資組合追蹤系統，支援網頁介面與 LINE Bot 雙入口操作。

## 功能

### 網頁
- **總覽儀表板** — 總資產、損益金額、報酬率一覽
- **持股明細** — 各股平均成本、現值、損益即時計算，圓餅圖與長條圖視覺化
- **自選清單** — 多清單管理，支援代號或中文名稱搜尋，顯示即時現價漲跌
- **交易記錄** — 記錄每筆買賣，支援多筆批次新增、截圖 AI 辨識匯入
- **配息追蹤** — 配息歷史、近期除息提醒設定（全域 + 個股）

### LINE Bot
- 查詢損益、持股清單、自選清單（附圖表）
- 股票代號查詢 — Flex Message 卡片（含 K 線圖、開高低量、持倉損益）
- 新增買賣交易、配息記錄（支援多筆換行）
- 配息提醒推播 — 除息前 N 天 Flex Message 通知
- Quick Reply 快速指令列

## 技術架構

| 層級 | 技術 |
|------|------|
| 前端 | Vue 3 + Vite + Tailwind CSS + Element Plus |
| 後端 | Node.js + Express |
| 資料庫 | PostgreSQL（Supabase） |
| 股價 API | Fugle Market Data API |
| K 線資料 | Yahoo Finance API |
| 圖表產生 | ECharts SSR → SVG → PNG（sharp） |
| 訊息機器人 | LINE Messaging API |
| 身分驗證 | LINE Login / LIFF + JWT |
| AI 辨識 | Google Gemini Vision API |
| 排程 | GitHub Actions |
| 部署 | Render |

## 本機開發

### 前置需求

- Node.js 18+
- PostgreSQL 資料庫（或 Supabase 帳號）
- [Fugle API Key](https://developer.fugle.tw/)
- LINE Messaging API Channel（Bot）
- LINE Login Channel（網頁登入 + LIFF）
- Google Gemini API Key（截圖匯入功能，免費）

### 後端

```bash
cd backend
cp .env.example .env   # 填入 API Keys
npm install
npm run dev            # 啟動於 http://localhost:3000
```

### 前端

```bash
cd frontend
cp .env.example .env   # 填入設定值
npm install
npm run dev            # 啟動於 http://localhost:5173
```

## 環境變數

### backend/.env

```env
PORT=3000
DATABASE_URL=                         # PostgreSQL 連線字串（Supabase Session Pooler）
FUGLE_API_KEY=                        # Fugle Market Data API Key
GEMINI_API_KEY=                       # Google Gemini API Key（截圖匯入）

# LINE Messaging API（Bot）
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=

# LINE Login（網頁登入 + LIFF）
LINE_LOGIN_CHANNEL_ID=
LINE_LOGIN_CHANNEL_SECRET=
LIFF_ID=

# JWT
JWT_SECRET=                           # 隨機字串，請務必設定

# 排程驗證
CRON_SECRET=                          # GitHub Actions 排程端點驗證用

# 部署網址
WEB_URL=https://your-frontend.onrender.com
API_URL=https://your-backend.onrender.com
```

### frontend/.env

```env
VITE_API_URL=http://localhost:3000
VITE_LINE_LOGIN_CHANNEL_ID=
VITE_LIFF_ID=
```

## LINE Bot 指令

### 查詢

| 輸入 | 功能 |
|------|------|
| `損益` | 全部持股損益 + 長條圖 |
| `持股` | 持股清單 + 圓餅圖 |
| `0050` | 股票 Flex Message 卡片（現價、K 線、持倉損益） |
| `0050 K線` | 單獨回傳 K 線圖 |
| `近期配息` | 持股 30 天內除息清單 |
| `指令說明` | 完整指令說明 |

### 自選清單

| 輸入 | 功能 |
|------|------|
| `自選` | 顯示所有清單 |
| `自選 我的最愛` | 清單股票 + 現價漲跌 |
| `加自選 0050` | 加入我的最愛 |
| `加自選 0050 清單名` | 加入指定清單 |
| `移自選 0050` | 從我的最愛移除 |

### 新增交易

```
買 0050 100 145.2          # 今天買入
買 0050 100 145.2 20       # 含手續費
賣 0050 50 160

買 昨天 0050 100 145.2     # 今天/昨天/前天/大前天/YYYY-MM-DD
```

多筆換行一次送出：

```
買 2026-01-15 0050 100 145.2
買 2026-03-10 00878 200 19.5
賣 2026-06-01 2330 1 850
```

### 新增配息

```
配息 0050 1.5 255          # 代號 每股金額 股數
```

### 配息提醒

| 輸入 | 功能 |
|------|------|
| `提醒開啟 / 提醒關閉` | 全域開關 |
| `提醒天數 3` | 全域預設前 3 天提醒 |
| `提醒 0050 開啟／關閉` | 個股開關 |
| `提醒 0050 5天` | 個股前 5 天提醒 |

## GitHub Actions 排程

`.github/workflows/dividend-cron.yml` 每天自動執行：

| 時間（台灣） | 功能 |
|-------------|------|
| 08:00 週一~五 | 從 TWSE 同步除權息資料 |
| 08:30 週一~五 | 推播今日配息提醒 |
| 14:30 週一~五 | 除息日自動建立配息記錄 |
| 09:00 每週一 | 更新台股清單（供中文名稱搜尋） |

GitHub Actions Secrets 需設定：`API_URL`、`CRON_SECRET`、`FUGLE_API_KEY`

## 部署（Render）

1. **後端**：Render Web Service，設定所有環境變數
2. **前端**：Render Static Site，`VITE_API_URL` 指向後端網址，Redirects/Rewrites 設 `/* → /index.html`
3. 部署後呼叫一次 `POST /api/linebot/setup-richmenu` 重建 LINE Rich Menu
