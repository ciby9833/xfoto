

### 后端架构（`backend/`）

| 文件 | 作用 |
|---|---|
| `src/index.js` | Express 入口，挂载所有路由 |
| `src/config/db.js` | PostgreSQL 连接池 |
| `src/config/storage.js` | 文件存储抽象（本地 dev / S3 生产切换） |
| `src/services/PaymentService.js` | 支付驱动（mock / Xendit / Midtrans 三选一） |
| `src/models/` | Device / Frame / Order / Coupon / Download |
| `src/routes/` | 6 个路由模块 |
| `migrations/001_init.sql` | 建表 SQL（一键 `npm run migrate`） |

**API 路由表：**
```
POST /api/devices/register          设备注册 → JWT
GET  /api/devices/me/config         获取当前设备配置 + 相框列表
POST /api/frames                    上传相框（含缩略图生成）
POST /api/payments/create           创建订单 + 支付二维码
GET  /api/payments/:id/status       轮询支付状态
POST /api/payments/webhook          支付回调（Xendit/Midtrans）
POST /api/coupons/validate          验证优惠码（预览，不扣次数）
POST /api/orders/:id/photo          上传合成照片 → 生成下载码
GET  /api/downloads/:code           扫码下载 → 302 跳转到签名 URL
```

---

### 启动方式

```bash
# 启动后端（需先有 PostgreSQL）
cd backend
cp .env.example .env        # 填入 DATABASE_URL + JWT_SECRET
npm run migrate             # 建表
npm run dev                 # 启动 (port 3000)

# 启动 Electron app
cd xfoto
npm run dev
```