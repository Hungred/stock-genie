# CLAUDE.md — 股小秘 Stock Genie

## 專案概覽

台股投資組合追蹤系統。Node.js + Express 後端、Vue 3 前端、SQLite 資料庫、LINE Bot 整合。

## 開發指令

```bash
# 後端（port 3000）
cd backend && npm run dev

# 前端（port 5173）
cd frontend && npm run dev

# 前端 build
cd frontend && npm run build
```

## 架構說明

### 後端 `backend/src/`

| 路徑 | 說明 |
|------|------|
| `index.js` | Express 入口，掛載所有 router |
| `db/index.js` | SQLite 初始化、schema、migration |
| `middleware/auth.js` | JWT 驗證（`authMiddleware`）與簽發（`signToken`） |
| `routes/auth.js` | LINE Login、LIFF 驗證、`/api/auth/me` |
| `routes/transactions.js` | 交易 CRUD |
| `routes/holdings.js` | 持股計算（含即時股價） |
| `routes/dividends.js` | 配息 CRUD |
| `routes/linebot.js` | LINE Webhook 處理所有 Bot 指令 |
| `routes/charts.js` | 產生圓餅圖/長條圖圖片（chartjs-node-canvas） |
| `services/stockPrice.js` | Fugle API 股價查詢 |
| `services/portfolio.js` | 持股損益計算邏輯（`calcHoldings`） |

### 前端 `frontend/src/`

| 路徑 | 說明 |
|------|------|
| `main.js` | 應用入口，含 axios interceptor（自動帶 JWT） |
| `router/index.js` | 路由設定，`meta.requiresAuth` + navigation guard |
| `stores/auth.js` | Pinia auth store（token、displayName、logout） |
| `stores/portfolio.js` | Pinia portfolio store（holdings、transactions、dividends） |
| `views/Login.vue` | LINE OAuth 登入頁（`/login`） |
| `views/Liff.vue` | LIFF SDK 登入頁（`/liff`） |
| `views/Dashboard.vue` | 總覽儀表板 |
| `views/Holdings.vue` | 持股明細與圖表 |
| `views/Transactions.vue` | 交易記錄 |
| `views/Dividends.vue` | 配息記錄 |

## 資料庫 Schema

```sql
users (id, line_user_id UNIQUE, display_name, created_at)
transactions (id, user_id, date, code, name, category, type, shares, price, fee, created_at)
dividends (id, user_id, date, code, name, dividend_per_share, shares, amount, created_at)
```

所有資料表以 `user_id` 隔離，LINE Bot 也依 `line_user_id` 對應到同一 user。

## 身分驗證

- 網頁登入：LINE Login（OAuth code flow）→ `/api/auth/line` → JWT
- LIFF：LIFF SDK 取 ID Token → `/api/auth/liff` → JWT
- JWT 存 `localStorage('sg_token')`，`main.js` 的 axios interceptor 自動帶入
- 後端所有資料 API 都套用 `authMiddleware`
- Navigation guard 在 router 中，未登入自動跳轉 `/login`

## LINE Bot 邏輯

- Webhook 路徑：`POST /api/linebot/webhook`（`express.raw` 處理 signature 驗證）
- 指令解析在 `routes/linebot.js` 的 `handleEvent` 函式
- 圖表透過 `/api/charts/pie?token=<jwt>` 和 `/api/charts/bar?token=<jwt>` 取得
- Bot 指令會自動建立 user 記錄（依 LINE User ID）

## 注意事項

- `better-sqlite3` 是同步 API，所有 DB 操作不需 `await`
- Fugle API 有速率限制，`stockPrice.js` 有簡單快取
- `charts.js` 用 `chartjs-node-canvas` 產生圖片，中文字需確認字型
- 環境變數一定要設 `JWT_SECRET`，否則 default 是 `changeme-set-in-env`

## Git 慣例

- commit 訊息不加 `Co-Authored-By`
- 改檔案前先說明並確認
- 每次完成功能後更新 CLAUDE.md 和 README.md
