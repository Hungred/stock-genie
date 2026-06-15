# 股小秘 Stock Genie 📈

台股投資組合追蹤系統，支援網頁介面與 LINE Bot 操作。

## 功能

- **總覽儀表板** — 總資產、損益金額、報酬率一覽
- **持股明細** — 各股平均成本、現值、損益即時計算
- **交易記錄** — 記錄每筆買賣，支援多次分批下單與手續費
- **配息追蹤** — 配息歷史紀錄與近期配息提醒
- **LINE Bot** — 用對話查詢損益、持股，隨時掌握投資狀況

## 技術架構

| 層級 | 技術 |
|------|------|
| 前端 | Vue 3 + Vite + Tailwind CSS + Element Plus |
| 後端 | Node.js + Express |
| 資料庫 | SQLite (better-sqlite3) |
| 股價 API | Fugle Market Data API |
| 訊息機器人 | LINE Messaging API |
| 部署 | Render |

## 專案結構

```
stock-genie/
├── frontend/          # Vue 3 前端
│   └── src/
│       ├── views/     # Dashboard、持股、交易、配息
│       ├── stores/    # Pinia 狀態管理
│       └── router/    # Vue Router
└── backend/           # Node.js 後端
    └── src/
        ├── routes/    # API 路由
        ├── services/  # 股價服務
        └── db/        # SQLite 資料庫
```

## 本機開發

### 前置需求

- Node.js 18+
- Fugle API Key（[申請連結](https://developer.fugle.tw/)）
- LINE Messaging API Channel（[申請連結](https://developers.line.biz/)）

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
cp .env.example .env
npm install
npm run dev            # 啟動於 http://localhost:5173
```

## 環境變數

### backend/.env

```env
PORT=3000
FUGLE_API_KEY=          # Fugle Market Data API Key
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
```

### frontend/.env

```env
VITE_API_URL=http://localhost:3000
```

## LINE Bot 指令

| 輸入 | 回應 |
|------|------|
| `損益` | 所有持股今日損益 |
| `持股` | 持股清單與均成本 |
| `0050` | 查詢單支股票狀況 |

## 部署

前後端分別部署至 Render Web Service，詳細步驟請參考 [Render 部署說明](#)。
