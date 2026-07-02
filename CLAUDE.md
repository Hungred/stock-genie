# CLAUDE.md — 股小秘 Stock Genie

## 專案概覽

台股投資組合追蹤系統。Node.js + Express 後端、Vue 3 前端、PostgreSQL（Supabase）資料庫、LINE Bot + LIFF 整合。

## 開發指令

```bash
# 後端（port 3000）
cd backend && npm run dev

# 前端（port 5173）
cd frontend && npm run dev

# 前端 build
cd frontend && npm run build

# 產生 Rich Menu 圖片（macOS 本機執行，需要 PingFang TC 字型）
cd backend && node scripts/generate-richmenu.js
```

## 架構說明

### 後端 `backend/src/`

| 路徑 | 說明 |
|------|------|
| `index.js` | Express 入口，掛載所有 router |
| `db/index.js` | pg Pool 連線、`initDb()` 建立資料表（啟動時自動執行） |
| `middleware/auth.js` | JWT 驗證（`authMiddleware`）與簽發（`signToken`） |
| `routes/auth.js` | LINE Login OAuth、LIFF 驗證、`/api/auth/me` |
| `routes/transactions.js` | 交易 CRUD |
| `routes/holdings.js` | 持股計算（含即時股價） |
| `routes/dividends.js` | 配息 CRUD |
| `routes/watchlist.js` | 自選清單 CRUD（`/api/watchlist`） |
| `routes/linebot.js` | LINE Webhook、Bot 指令、`/setup-richmenu`、`/set-default-richmenu` |
| `routes/charts.js` | 產生圓餅圖/長條圖/K線圖（`GET /api/charts/kline?code=XXXX`） |
| `services/stockPrice.js` | Fugle API 股價查詢（含 `isMarketOpen()`、`getFullQuote()`、`getDailyCandles()`） |
| `services/portfolio.js` | 持股損益計算邏輯（`calcHoldings`） |
| `services/chartGen.js` | echarts SSR → SVG → PNG，`generateKlineChart(candles)` 日K蠟燭圖 |
| `services/dividendSchedule.js` | TWSE 資料解析（`processTwseData`）、提醒設定（`getNotifySettings`）、日期工具 |

### 前端 `frontend/src/`

| 路徑 | 說明 |
|------|------|
| `main.js` | 應用入口，含 axios interceptor（自動帶 JWT） |
| `router/index.js` | 路由設定，`meta.requiresAuth` + navigation guard |
| `stores/auth.js` | Pinia auth store（token、displayName、logout） |
| `stores/portfolio.js` | Pinia portfolio store（holdings、transactions、dividends，含 delete/add 操作） |
| `stores/watchlist.js` | Pinia watchlist store（fetchLists、fetchStocks、addStock、removeStock、fetchHoldings） |
| `views/Login.vue` | LINE OAuth 登入頁（`/login`） |
| `views/Liff.vue` | LIFF SDK 登入頁（`/liff`），登入後帶 `?sg_token=` 跳外部瀏覽器 |
| `views/Dashboard.vue` | 總覽儀表板 |
| `views/Holdings.vue` | 持股明細與圖表 |
| `views/Watchlist.vue` | 自選清單（`/watchlist`），含我的持股 tab、多清單管理、查詢返回多筆清單供選擇（支援代號或中文名稱模糊搜尋）/移除股票 |
| `views/Transactions.vue` | 交易記錄，支援多筆新增、刪除 |
| `views/Dividends.vue` | 配息記錄、近期除息、提醒設定（折疊區塊）、配息歷史 |

## 資料庫 Schema（PostgreSQL / Supabase）

```sql
users (id SERIAL, line_user_id TEXT UNIQUE, display_name TEXT, created_at TIMESTAMPTZ)
transactions (id SERIAL, user_id INTEGER, date TEXT, code TEXT, name TEXT, category TEXT, type TEXT, shares INTEGER, price NUMERIC, fee NUMERIC, created_at TIMESTAMPTZ)
dividends (id SERIAL, user_id INTEGER, date TEXT, code TEXT, name TEXT, dividend_per_share NUMERIC, shares INTEGER, amount NUMERIC, created_at TIMESTAMPTZ)
watchlists (id SERIAL, user_id INTEGER, name TEXT, sort_order INTEGER, created_at TIMESTAMPTZ, UNIQUE(user_id, name))
watchlist_stocks (id SERIAL, watchlist_id INTEGER, code TEXT, name TEXT, sort_order INTEGER, created_at TIMESTAMPTZ, UNIQUE(watchlist_id, code))
stocks (code TEXT PRIMARY KEY, name TEXT, exchange TEXT, updated_at TIMESTAMPTZ)  -- 台股清單快取，每週一由 GitHub Actions seed
```

- 所有資料表以 `user_id` 隔離，LINE Bot 依 `line_user_id` 對應同一 user
- pg 回傳的 NUMERIC 欄位型別為字串，取值時需 `Number(t.price)` 轉換
- 連線設定：`DATABASE_URL` 環境變數，Supabase 需加 `ssl: { rejectUnauthorized: false }`
- 每位使用者預設有「我的最愛」清單（`ensureDefaultList` 自動建立，不可刪除）

## 身分驗證

### LINE Login（網頁）
1. 使用者點「用 LINE 登入」→ 跳轉 LINE OAuth（需 `VITE_LINE_LOGIN_CHANNEL_ID`）
2. LINE 回傳 `code` → 前端送 `/api/auth/line`（需後端 `LINE_LOGIN_CHANNEL_ID` + `LINE_LOGIN_CHANNEL_SECRET`）
3. 後端換取 access token → 取得 profile → 建帳號 → 回傳 JWT

### LIFF（從 LINE Bot 內綁定）
1. 使用者點選單「我的帳號」或輸入「綁定」→ 開啟 `https://liff.line.me/<LIFF_ID>`
2. LIFF SDK 自動登入 → `Liff.vue` 取得 ID Token（需 `VITE_LIFF_ID`）
3. 送 `/api/auth/liff`（需後端 `LINE_LOGIN_CHANNEL_ID`）→ 驗證 token → 建帳號 → 回傳 JWT
4. 點「開啟網頁版」→ 外部瀏覽器 `?sg_token=<jwt>` → router 存入 localStorage

- JWT 存 `localStorage('sg_token')`，`main.js` 的 axios interceptor 自動帶入
- 後端所有資料 API 都套用 `authMiddleware`
- Navigation guard 在 router 中，未登入自動跳轉 `/login`
- 登出：桌機 navbar 右側文字按鈕；手機 navbar 右側 `SwitchButton` 圖示按鈕

## LINE Bot 指令

### 查詢
| 輸入 | 功能 |
|------|------|
| `損益` | 全部持股損益 + 長條圖 |
| `持股` | 持股清單 + 圓餅圖 |
| `0050`（股票代號） | Flex Message 股票卡片（含持倉損益） |
| `0050 K線 / EPS / 股利` | 即將推出（佔位回覆） |

### 自選清單
| 輸入 | 功能 |
|------|------|
| `自選` | 顯示所有清單 |
| `自選 我的最愛` | 清單股票 + 現價 |
| `自選 持股` | 持倉股票 + 現價漲跌 |
| `加自選 0050` | 加入我的最愛 |
| `加自選 0050 清單名` | 加入指定清單 |
| `移自選 0050` | 從我的最愛移除 |
| `新增清單 清單名` | 建立新清單 |
| `刪除清單 清單名` | 刪除清單（不可刪我的最愛） |

### 交易與配息
| 輸入 | 功能 |
|------|------|
| `買 0050 100 145.2` | 新增買進（可加日期、費用） |
| `賣 0050 50 160` | 新增賣出 |
| `配息 0050 1.5 255` | 新增配息記錄 |
| 支援換行多筆 | 一次輸入多行批次新增 |

日期格式：`今天 / 昨天 / 前天 / 大前天 / YYYY-MM-DD`（不填預設今天）

### 其他
| 輸入 | 功能 |
|------|------|
| `綁定 / 登入 / 我的帳號` | 回覆 LIFF 綁定連結 |
| `指令說明 / 說明 / help` | 顯示完整指令說明 |

## Flex Message 股票卡片

- `buildStockFlex(code, quote, holding)` 在 `linebot.js` 中定義
- Header：股名、代號、現價、漲跌
- Body：開/高/低/量；若有持倉顯示持股數、均成本、損益
- Footer 5 個按鈕：即時 / K線 / EPS / 股利 / +自選
- 開高低量來自 `getFullQuote()`（`stockPrice.js`）

## 股價服務（`stockPrice.js`）

- `isMarketOpen()`：台灣市場時間 UTC+8，週一至五 09:00–13:30
- `resolvePrice(data)`：開盤中用 `lastPrice`，收盤後用 `closePrice`
- `getFullQuote(code)`：回傳 `{name, price, prevClose, change, changePercent, open, high, low, volumeLots, isOpen}`
- `getDailyCandles(code)`：Yahoo Finance 近 3 個月日線 OHLC（免費，`interval=1d&range=3mo`）
- `getMultiplePrices(codes)`：批次取多檔股價，回傳 `{code: price}` 物件

## 股票搜尋（`GET /api/stock/search?q=`）

- 回傳 **陣列**（多筆），前端顯示清單讓使用者點選
- 搜尋優先順序：
  1. 查 `stocks` 表：`name ILIKE '%q%' OR code ILIKE '%q%'`，代號前綴優先排序，最多 10 筆
  2. Fallback（`stocks` 表為空時）：Fugle `getStockInfo` 查單一代號
- `stocks` 表由每週一 GitHub Actions `seed-stocks` job 填充

## Rich Menu

- **6 格（2×3）2500×1686px**：
  - 上排：損益查詢 / 持股明細 / 自選清單
  - 下排：我的帳號 / 開啟網頁 / 指令說明
- 圖片 `backend/richmenu.png` 在本機（macOS）用 `generate-richmenu.js` 產生後 commit
  - Render 伺服器沒有 CJK 字型，不能在 Render 上產生
- `setup-richmenu` endpoint（`POST /api/linebot/setup-richmenu`）：
  1. 建立 Rich Menu（6 個 area）
  2. 上傳 `backend/richmenu.png` 圖片
  3. 設為 default
- `set-default-richmenu` endpoint（`POST /api/linebot/set-default-richmenu`）：
  - 接受 `{ richMenuId }` → 設指定選單為 default（一次性維運用途）

> **部署後需呼叫一次** `POST /api/linebot/setup-richmenu` 重設選單。

## Quick Reply（每則 Bot 回覆底部）

7 個按鈕：📊 損益 / 📋 持股 / ⭐ 自選 / 📅 近期配息 / ⚙️ 提醒設定 / 📖 指令說明 / 🖥️ 開啟網頁

## 環境變數

### 後端（Render Web Service）

| 變數 | 說明 |
|------|------|
| `DATABASE_URL` | Supabase Session Pooler 連線字串 |
| `FUGLE_API_KEY` | Fugle 股價 API |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API（Bot）Token |
| `LINE_CHANNEL_SECRET` | Messaging API Channel Secret |
| `LINE_LOGIN_CHANNEL_ID` | LINE Login Channel ID（`2010558038`） |
| `LINE_LOGIN_CHANNEL_SECRET` | LINE Login Channel Secret |
| `LIFF_ID` | LIFF App ID（`2010558038-kyZZsu41`） |
| `JWT_SECRET` | JWT 簽名密鑰 |
| `WEB_URL` | `https://stock-genie-web.onrender.com` |
| `API_URL` | `https://stock-genie-api.onrender.com` |

### 前端（Render Static Site）

| 變數 | 說明 |
|------|------|
| `VITE_API_URL` | `https://stock-genie-api.onrender.com` |
| `VITE_LINE_LOGIN_CHANNEL_ID` | LINE Login Channel ID（`2010558038`） |
| `VITE_LIFF_ID` | LIFF App ID（`2010558038-kyZZsu41`） |

> Vite 環境變數在 **build 時**注入，修改後需重新 deploy 才生效。

## 部署注意事項

- Render 靜態站台需在 **Redirects/Rewrites** 設 `/* → /index.html (Rewrite)` 才能支援 Vue Router
- LINE Login Channel 的 Callback URL 需加 `https://stock-genie-web.onrender.com/login`
- LIFF Endpoint URL：`https://stock-genie-web.onrender.com/liff`
- **每次部署後** 呼叫 `POST /api/linebot/setup-richmenu` 重建 Rich Menu（確保 LIFF_ID 已設定）

## 注意事項

- `pg` 是非同步 API，所有 DB 操作都需要 `await`，查詢結果從 `{ rows }` 解構
- SQL 佔位符用 `$1, $2...`（不是 `?`）
- Fugle API 有速率限制，`stockPrice.js` 有簡單快取
- `charts.js` 用 `chartjs-node-canvas` 產生圖片，中文字需確認字型
- 環境變數一定要設 `JWT_SECRET`，否則 default 是 `changeme-set-in-env`
- Render free tier 冷啟動 30–60 秒，LINE reply token 30 秒過期，建議用 UptimeRobot 每 14 分鐘 ping 防止休眠
- **Express 路由順序**：`/:id` 等參數路由必須放在所有具體路由（`/upcoming`、`/notify-settings` 等）**之後**，否則會攔截具體路由導致 500

## 配息提醒系統

### 資料表
- `dividend_schedules`：TWSE 除權息公告（code, name, ex_date, dividend_cash, dividend_stock）
- `dividend_notify_settings`：提醒設定（user_id, scope, enabled, remind_days_before）
  - `scope='ALL'`：全域設定；`scope='0050'`：個股設定
  - `remind_days_before=NULL`：個股沿用全域預設
- `dividends.source`：`'manual'`（手動）或 `'auto'`（除息日自動建立）

### 提醒邏輯
1. 全域 OFF → 全部不提醒
2. 全域 ON → 查個股設定
   - 個股 OFF → 不提醒
   - 個股有天數 → 用個股天數
   - 無個股設定（新股票）→ 用全域預設天數（預設 1 天）
3. 提醒日若落在週末 → 自動往前到週五

### LINE 配息指令
| 指令 | 功能 |
|------|------|
| `近期配息` | 持股 30 天內除息清單 |
| `提醒設定` | 顯示目前所有設定 |
| `提醒開啟 / 提醒關閉` | 全域開關 |
| `提醒天數 3` | 全域預設改為前 3 天 |
| `提醒 0050 開啟／關閉` | 個股開關 |
| `提醒 0050 5天` | 個股前 5 天提醒 |

### 排程端點（GitHub Actions 呼叫）
需在 request header 帶 `x-cron-secret: <CRON_SECRET>`

| 端點 | 時間 | 功能 |
|------|------|------|
| `POST /api/dividends/sync-data` | 08:00 台灣時間（週一至週五） | 接收 GitHub Actions 傳來的 TWSE JSON，寫入 DB |
| `POST /api/dividends/send-reminders` | 08:30 台灣時間 | 推播今日提醒（Flex Message） |
| `POST /api/dividends/auto-create` | 14:30 台灣時間 | 除息日自動建配息記錄 |
| `POST /api/stocks/seed` | 每週一 09:00 台灣時間 | 接收 GitHub Actions 傳來的股票清單 JSON，upsert 進 `stocks` 表 |

> **重要**：TWSE 封鎖 Render（美國）IP，sync 改由 **GitHub Actions 直接抓 TWSE**，再 POST 資料到 `/sync-data`。

### 環境變數（新增）
- `CRON_SECRET`：排程端點驗證 secret，Render 後端 + GitHub Actions Secrets 都要設

### GitHub Actions
`.github/workflows/dividend-cron.yml`：三個 job 各自對應上方時間
- `sync` job：runner 自行 curl TWSE，取得 JSON 後 POST 到 `/api/dividends/sync-data`
- `seed-stocks` job：每週一執行 `scripts/seed-stocks.py`，從 Fugle tickers API 抓 TWSE + TPEx 股票清單（分批 500 筆），POST 到 `/api/stocks/seed`
- 支援 `workflow_dispatch` 手動觸發（選 sync / send-reminders / auto-create / seed-stocks）
- 需要 GitHub Secrets：`API_URL`、`CRON_SECRET`、`FUGLE_API_KEY`

### 配息提醒 Flex Message（push 訊息）
- 每支股票一張 bubble，多支時為 Carousel（左右滑動）
- Header：橘色背景，顯示「N 天後除息 / 明天除息今天是最後買進日」
- Body：股票代號名稱、除息日、每股現金、持有股數、預計領取金額
- Footer（垂直兩個按鈕）：
  - 「關閉此股提醒」→ postback `action=disable_reminder&code=XXXX&name=...`
  - 「開啟配息紀錄」→ URI `WEB_URL/dividends`
- Postback handler 在 `linebot.js` `handlePostback()`，寫入 `dividend_notify_settings` 並回覆確認

### 前端異動
- `Dividends.vue`：
  - 近期除息卡片（30 天內持股除息）
  - 提醒設定折疊區塊（全域 toggle + 天數、個股 toggle + 天數）
  - auto 記錄黃標 + 編輯 dialog
- `stores/portfolio.js`（無需改）：fetchDividends 已包含 source 欄位
- 新用戶預設提醒開啟、前 1 天提醒（`getNotifySettings` fallback）

## Git 慣例

- commit 訊息不加 `Co-Authored-By`
- 改檔案前先說明並確認
- 每次完成功能後更新 CLAUDE.md
