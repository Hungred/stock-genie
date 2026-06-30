# 股小秘 Stock Genie 📈

台股投資組合追蹤系統，支援網頁介面與 LINE Bot 操作。

## 功能

- **總覽儀表板** — 總資產、損益金額、報酬率一覽
- **持股明細** — 各股平均成本、現值、損益即時計算，圓餅圖與長條圖視覺化
- **交易記錄** — 記錄每筆買賣，支援多次分批下單與手續費，可指定日期
- **配息追蹤** — 配息歷史紀錄，支援多筆同時新增
- **LINE Bot** — 查詢損益、持股、新增交易與配息，回傳圖表圖片
- **LINE 登入** — 以 LINE 帳號登入，資料依帳號隔離

## 技術架構

| 層級 | 技術 |
|------|------|
| 前端 | Vue 3 + Vite + Tailwind CSS + Element Plus |
| 後端 | Node.js + Express |
| 資料庫 | SQLite (better-sqlite3) |
| 股價 API | Fugle Market Data API |
| 訊息機器人 | LINE Messaging API |
| 身分驗證 | LINE Login / LIFF + JWT |
| 部署 | Render |

## 專案結構

```
stock-genie/
├── frontend/
│   └── src/
│       ├── views/         # Dashboard、Holdings、Transactions、Dividends、Login、Liff
│       ├── stores/        # auth（JWT）、portfolio（持股/交易/配息）
│       └── router/        # Vue Router，含 navigation guard
└── backend/
    └── src/
        ├── routes/        # auth、transactions、holdings、dividends、linebot、charts
        ├── services/      # stockPrice（Fugle API）、portfolio（持股計算）
        ├── middleware/    # auth（JWT 驗證）
        └── db/            # SQLite schema 與 migration
```

## 本機開發

### 前置需求

- Node.js 18+
- Fugle API Key（[申請連結](https://developer.fugle.tw/)）
- LINE Messaging API Channel（Bot）
- LINE Login Channel（網頁登入 + LIFF）

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
FUGLE_API_KEY=                    # Fugle Market Data API Key

# LINE Messaging API（Bot）
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=

# LINE Login（網頁登入 + LIFF）
LINE_LOGIN_CHANNEL_ID=
LINE_LOGIN_CHANNEL_SECRET=
LIFF_ID=

# JWT
JWT_SECRET=                       # 隨機字串，請務必設定

# 部署網址（用於 LINE Bot 回傳圖表連結）
WEB_URL=https://stock-genie-web.onrender.com
API_URL=https://stock-genie-api.onrender.com
```

### frontend/.env

```env
VITE_API_URL=http://localhost:3000
VITE_LINE_LOGIN_CHANNEL_ID=       # LINE Login Channel ID
VITE_LIFF_ID=                     # LIFF ID
VITE_WEB_URL=http://localhost:5173
```

## 登入流程

| 入口 | 流程 |
|------|------|
| 網頁 | `/login` → LINE OAuth → 後端換 token → 發 JWT |
| LINE Bot 內嵌頁 | `/liff` → LIFF SDK init → 後端驗證 ID Token → 發 JWT |

JWT 存於 `localStorage`，axios interceptor 自動帶入所有 API 請求。

## LINE Bot 指令

| 輸入 | 說明 |
|------|------|
| `損益` | 全部持股今日損益（附長條圖） |
| `持股` | 持股清單與均成本（附圓餅圖） |
| `0050` | 查詢單支股票現價與損益 |
| `指令說明` | 顯示完整指令說明 |

### 新增交易

```
買 0050 100 145.2          # 今天買入
買 0050 100 145.2 20       # 含手續費 20 元
賣 0050 50 160

買 昨天 0050 100 145.2     # 指定日期：今天/昨天/前天/大前天
買 2026-01-15 0050 100 145.2
```

多筆換行同時送出：

```
買 2026-01-15 0050 100 145.2
買 2026-03-10 00878 200 19.5
賣 2026-06-01 2330 1 850
```

### 新增配息

```
配息 0050 1.5 255          # 代號 每股金額 股數

配息 0050 1.5 255
配息 00878 0.48 350        # 多筆換行
```

## 部署

前後端分別部署至 Render Web Service。後端需設定所有環境變數；前端 build 後部署靜態檔案，`VITE_API_URL` 指向後端網址。
