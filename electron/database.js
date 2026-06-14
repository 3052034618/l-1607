const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const dbDir = path.join(__dirname, '../data')
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const db = new Database(path.join(dbDir, 'station.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    real_name TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS lockers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL DEFAULT 'normal',
    size TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'empty',
    zone TEXT,
    shelf_no TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS express_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    waybill_no TEXT UNIQUE NOT NULL,
    company TEXT NOT NULL,
    sender_name TEXT,
    sender_phone TEXT,
    receiver_name TEXT,
    receiver_phone TEXT,
    receiver_address TEXT,
    size TEXT DEFAULT 'medium',
    refrigerated INTEGER DEFAULT 0,
    weight REAL,
    locker_id INTEGER,
    pickup_code TEXT,
    status TEXT DEFAULT 'in_transit',
    in_time DATETIME,
    pickup_time DATETIME,
    storage_fee REAL DEFAULT 0,
    notified INTEGER DEFAULT 0,
    failed_attempts INTEGER DEFAULT 0,
    locked INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (locker_id) REFERENCES lockers(id)
  );

  CREATE TABLE IF NOT EXISTS pickup_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    pickup_code TEXT,
    pickup_type TEXT,
    success INTEGER DEFAULT 0,
    attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    operator_id INTEGER,
    FOREIGN KEY (order_id) REFERENCES express_orders(id)
  );

  CREATE TABLE IF NOT EXISTS return_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_waybill TEXT,
    return_waybill TEXT UNIQUE,
    user_name TEXT,
    user_phone TEXT,
    reason TEXT,
    pickup_address TEXT,
    courier_id INTEGER,
    pickup_window_start DATETIME,
    pickup_window_end DATETIME,
    status TEXT DEFAULT 'pending',
    fee REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS couriers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    status TEXT DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS financial_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    type TEXT NOT NULL,
    company TEXT,
    amount REAL NOT NULL,
    description TEXT,
    settlement_date DATE,
    settled INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    phone TEXT,
    content TEXT,
    type TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS work_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    related_id INTEGER,
    description TEXT,
    handler_id INTEGER,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    handled_at DATETIME
  );

  CREATE INDEX IF NOT EXISTS idx_orders_status ON express_orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_waybill ON express_orders(waybill_no);
  CREATE INDEX IF NOT EXISTS idx_records_date ON pickup_records(attempt_time);
  CREATE INDEX IF NOT EXISTS idx_financial_company ON financial_records(company);
`)

const initData = db.prepare('SELECT COUNT(*) as cnt FROM users').get()
if (initData.cnt === 0) {
  const insertUser = db.prepare(
    'INSERT INTO users (username, password, real_name, phone, role) VALUES (?, ?, ?, ?, ?)'
  )
  insertUser.run('admin', '123456', '系统管理员', '13800000001', 'admin')
  insertUser.run('courier', '123456', '快递员张', '13800000002', 'courier')
  insertUser.run('user', '123456', '普通用户', '13800000003', 'user')

  const insertLocker = db.prepare(
    'INSERT INTO lockers (code, type, size, status, zone, shelf_no) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const sizes = ['small', 'medium', 'large', 'xlarge']
  for (let i = 1; i <= 48; i++) {
    const type = i <= 8 ? 'refrigerated' : 'normal'
    const size = sizes[i % 4]
    const zone = i <= 24 ? 'A区' : 'B区'
    const shelf = `S${Math.ceil(i / 6)}`
    insertLocker.run(`L${String(i).padStart(3, '0')}`, type, size, 'empty', zone, shelf)
  }

  const insertCourier = db.prepare(
    'INSERT INTO couriers (name, phone, company, status) VALUES (?, ?, ?, ?)'
  )
  insertCourier.run('李快递', '13900000001', '顺丰速运', 'available')
  insertCourier.run('王快递', '13900000002', '圆通速递', 'available')
  insertCourier.run('赵快递', '13900000003', '中通快递', 'available')

  console.log('初始数据已插入')
}

module.exports = db
