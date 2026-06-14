import dayjs from 'dayjs'

const STORAGE_KEY = 'station_db_v1'

const defaultData = {
  users: [
    { id: 1, username: 'admin', password: '123456', real_name: '系统管理员', phone: '13800000001', role: 'admin', created_at: '2025-01-01 00:00:00' },
    { id: 2, username: 'courier', password: '123456', real_name: '快递员张', phone: '13800000002', role: 'courier', created_at: '2025-01-01 00:00:00' },
    { id: 3, username: 'user', password: '123456', real_name: '普通用户', phone: '13800000003', role: 'user', created_at: '2025-01-01 00:00:00' }
  ],
  couriers: [
    { id: 1, name: '李快递', phone: '13900000001', company: '顺丰速运', status: 'available', created_at: '2025-01-01 00:00:00' },
    { id: 2, name: '王快递', phone: '13900000002', company: '圆通速递', status: 'available', created_at: '2025-01-01 00:00:00' },
    { id: 3, name: '赵快递', phone: '13900000003', company: '中通快递', status: 'available', created_at: '2025-01-01 00:00:00' }
  ],
  lockers: [],
  express_orders: [],
  pickup_records: [],
  return_orders: [],
  financial_records: [],
  notifications: [],
  work_orders: [],
  _meta: { nextId: 1000 }
}

const sizes = ['small', 'medium', 'large', 'xlarge']
for (let i = 1; i <= 48; i++) {
  defaultData.lockers.push({
    id: i,
    code: 'L' + String(i).padStart(3, '0'),
    type: i <= 8 ? 'refrigerated' : 'normal',
    size: sizes[(i - 1) % 4],
    status: 'empty',
    zone: i <= 24 ? 'A区' : 'B区',
    shelf_no: 'S' + Math.ceil(i / 6),
    created_at: '2025-01-01 00:00:00'
  })
}

const sampleCompanies = ['顺丰速运', '圆通速递', '中通快递', '韵达快递', '申通快递', '京东物流', '极兔速递']
const sampleNames = ['张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十']
for (let i = 1; i <= 15; i++) {
  const size = sizes[(i - 1) % 4]
  const company = sampleCompanies[(i - 1) % sampleCompanies.length]
  const receiverName = sampleNames[(i - 1) % sampleNames.length]
  const inTime = dayjs().subtract(i * 3, 'hour').format('YYYY-MM-DD HH:mm:ss')
  let lockerId = null
  const emptyLocker = defaultData.lockers.find(l => l.status === 'empty' && l.size === size && (i > 3 || l.type === 'normal'))
  if (emptyLocker) {
    emptyLocker.status = 'occupied'
    lockerId = emptyLocker.id
  }
  defaultData.express_orders.push({
    id: 100 + i,
    waybill_no: 'ST' + dayjs().format('YYYYMMDD') + String(1000 + i),
    company,
    sender_name: '发件人' + i,
    sender_phone: '130' + String(10000000 + i),
    receiver_name: receiverName,
    receiver_phone: '139' + String(10000000 + i),
    receiver_address: 'XX街道XX小区' + i + '号楼',
    size,
    refrigerated: i % 7 === 0 ? 1 : 0,
    weight: (Math.random() * 5 + 0.5).toFixed(2),
    locker_id: lockerId,
    pickup_code: String(100000 + i),
    status: lockerId ? 'arrived' : 'in_transit',
    in_time: lockerId ? inTime : null,
    pickup_time: null,
    storage_fee: 0,
    notified: lockerId ? 1 : 0,
    failed_attempts: 0,
    locked: 0,
    created_at: inTime
  })
}

defaultData.financial_records = defaultData.express_orders
  .filter(o => o.status === 'arrived')
  .map((o, i) => ({
    id: 200 + i,
    order_id: o.id,
    type: 'delivery',
    company: o.company,
    amount: 1.5,
    description: '派费收入',
    settlement_date: null,
    settled: 0,
    created_at: o.in_time
  }))

let db = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
if (!db || !db.users || db.users.length === 0) {
  db = defaultData
  save()
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

function getNextId(table) {
  if (!db._meta) db._meta = { nextId: 1000 }
  return ++db._meta.nextId
}

function parseSQL(sql) {
  sql = sql.trim()
  if (sql.toUpperCase().startsWith('SELECT')) {
    return parseSelect(sql)
  } else if (sql.toUpperCase().startsWith('INSERT')) {
    return parseInsert(sql)
  } else if (sql.toUpperCase().startsWith('UPDATE')) {
    return parseUpdate(sql)
  } else if (sql.toUpperCase().startsWith('DELETE')) {
    return parseDelete(sql)
  }
  return null
}

function parseSelect(sql) {
  const re = /SELECT\s+(.+?)\s+FROM\s+([\w_\-]+)/i
  const m = sql.match(re)
  if (!m) return null
  
  const fields = m[1].trim()
  let tableName = m[2].trim()
  
  const joins = []
  const joinRe = /LEFT\s+JOIN\s+([\w_\-]+)\s+([\w_\-]+)\s+ON\s+([\w_\-\.]+)\s*=\s*([\w_\-\.]+)/gi
  let jm
  while ((jm = joinRe.exec(sql)) !== null) {
    joins.push({ table: jm[1], alias: jm[2], left: jm[3], right: jm[4] })
  }
  
  const aliasMap = {}
  const aliasRe = /FROM\s+([\w_\-]+)\s+([\w_\-]+)/i
  const am = sql.match(aliasRe)
  if (am) {
    tableName = am[1]
    aliasMap[am[2]] = tableName
  }
  
  let where = null
  const whereRe = /WHERE\s+(.+?)(ORDER|LIMIT|$)/i
  const wm = sql.match(whereRe)
  if (wm) where = wm[1].trim()
  
  let limit = null, offset = null
  const limitRe = /LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?/i
  const lm = sql.match(limitRe)
  if (lm) {
    limit = parseInt(lm[1])
    if (lm[2]) offset = parseInt(lm[2])
  }
  
  const groupRe = /GROUP\s+BY\s+([\w_\-\.,\s]+)/i
  const gm = sql.match(groupRe)
  let groupBy = null
  if (gm) groupBy = gm[1].split(',').map(s => s.trim().split('.').pop())
  
  return { type: 'SELECT', fields, tableName, joins, where, limit, offset, groupBy, aliasMap }
}

function parseInsert(sql) {
  const re = /INSERT\s+INTO\s+([\w_\-]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i
  const m = sql.match(re)
  if (!m) return null
  return {
    type: 'INSERT',
    tableName: m[1].trim(),
    columns: m[2].split(',').map(s => s.trim()),
    valuesStr: m[3].trim()
  }
}

function parseUpdate(sql) {
  const re = /UPDATE\s+([\w_\-]+)\s+SET\s+(.+?)\s+WHERE\s+(.+?)$/i
  const m = sql.match(re)
  if (!m) return null
  return {
    type: 'UPDATE',
    tableName: m[1].trim(),
    setStr: m[2].trim(),
    where: m[3].trim()
  }
}

function parseDelete(sql) {
  const re = /DELETE\s+FROM\s+([\w_\-]+)\s+WHERE\s+(.+?)$/i
  const m = sql.match(re)
  if (!m) return null
  return { type: 'DELETE', tableName: m[1].trim(), where: m[3].trim() }
}

function evalCondition(condStr, row, params, paramStart = 0) {
  let pi = paramStart
  if (!condStr || condStr === '1=1') return true
  
  const parts = splitAnd(condStr)
  for (const part of parts) {
    if (!evalSingleCondition(part.trim(), row, params, pi)) return false
    const qCount = (part.match(/\?/g) || []).length
    pi += qCount
  }
  return true
}

function splitAnd(str) {
  const result = []
  let depth = 0
  let current = ''
  const words = str.split(/\s+/)
  for (let i = 0; i < words.length; i++) {
    if (words[i].toUpperCase() === 'AND' && depth === 0 && current.trim()) {
      result.push(current.trim())
      current = ''
    } else {
      current += (current ? ' ' : '') + words[i]
      const opens = (words[i].match(/\(/g) || []).length
      const closes = (words[i].match(/\)/g) || []).length
      depth += opens - closes
    }
  }
  if (current.trim()) result.push(current.trim())
  return result
}

function evalSingleCondition(cond, row, params, paramStart) {
  let pi = paramStart
  cond = cond.trim()
  
  const betweenRe = /(.+?)\s+BETWEEN\s+\?\s+AND\s+\?/i
  const bm = cond.match(betweenRe)
  if (bm) {
    const field = bm[1].trim().split('.').pop()
    const val = getFieldValue(row, field)
    const low = params[pi]
    const high = params[pi + 1]
    return val >= low && val <= high
  }
  
  const likeRe = /(.+?)\s+LIKE\s+\?/i
  const lm = cond.match(likeRe)
  if (lm) {
    const field = lm[1].trim().split('.').pop()
    const val = String(getFieldValue(row, field) || '')
    const pattern = String(params[pi] || '').replace(/%/g, '.*')
    return new RegExp('^' + pattern + '$', 'i').test(val)
  }
  
  const eqRe = /(.+?)\s*=\s*(.+?)$/i
  const em = cond.match(eqRe)
  if (em) {
    const field = em[1].trim().split('.').pop()
    const right = em[2].trim()
    let val
    if (right === '?') val = params[pi]
    else if (right.startsWith("'") && right.endsWith("'")) val = right.slice(1, -1)
    else val = right
    return String(getFieldValue(row, field)) === String(val)
  }
  
  const gtRe = /(.+?)\s*>\s*(.+?)$/i
  const gm = cond.match(gtRe)
  if (gm) {
    const field = gm[1].trim().split('.').pop()
    const right = gm[2].trim()
    let val
    if (right === '?') val = params[pi]
    else val = parseFloat(right)
    return parseFloat(getFieldValue(row, field)) > parseFloat(val)
  }
  
  const isNullRe = /(.+?)\s+IS\s+NOT\s+NULL/i
  const inm = cond.match(isNullRe)
  if (inm) {
    const field = inm[1].trim().split('.').pop()
    return getFieldValue(row, field) != null
  }
  
  return true
}

function getFieldValue(row, field) {
  if (row == null) return null
  if (field in row) return row[field]
  
  if (field === 'cnt' && row._count != null) return row._count
  if (field.startsWith('SUM(') || field.startsWith('AVG(') || field.startsWith('MAX(') || field.startsWith('MIN(') || field.startsWith('COUNT(')) {
    const inner = field.match(/\((.+?)\)/)[1].replace(/[^0-9.]/g, '')
    if (field.startsWith('COUNT(')) return row._count || 0
    return parseFloat(row['_' + field.toLowerCase().split('(')[0]]) || 0
  }
  return null
}

function doSelect(parsed, params) {
  let rows = db[parsed.tableName] || []
  if (!rows) return []
  
  if (parsed.joins && parsed.joins.length > 0) {
    let result = []
    for (const row of rows) {
      let current = [{ ...row }]
      for (const join of parsed.joins) {
        const jRows = db[join.table] || []
        const newCurrent = []
        for (const c of current) {
          const leftField = join.left.split('.').pop()
          const rightField = join.right.split('.').pop()
          let matched = false
          for (const jr of jRows) {
            if (String(c[rightField]) === String(jr[leftField]) || String(c[leftField]) === String(jr[rightField])) {
              newCurrent.push({ ...c, ...jr })
              matched = true
            }
          }
          if (!matched) newCurrent.push({ ...c })
        }
        current = newCurrent
      }
      result = result.concat(current)
    }
    rows = result
  }
  
  if (parsed.where) {
    rows = rows.filter(row => evalCondition(parsed.where, row, params))
  }
  
  if (parsed.groupBy) {
    const groups = {}
    for (const row of rows) {
      const key = parsed.groupBy.map(g => row[g]).join('|')
      if (!groups[key]) {
        groups[key] = { ...row, _count: 0, _sum: {}, _items: [] }
      }
      groups[key]._count++
      groups[key]._items.push(row)
    }
    rows = Object.values(groups).map(g => {
      const result = {}
      for (const k in g) {
        if (k === '_items' || k === '_sum') continue
        if (k === '_count') { result[k] = g[k]; continue }
        result[k] = g[k]
      }
      const fm = parsed.fields.match(/(SUM|AVG|MAX|MIN|COUNT)\s*\(\s*(.+?)\s*\)/gi)
      if (fm) {
        for (const f of fm) {
          const fm2 = f.match(/(SUM|AVG|MAX|MIN|COUNT)\s*\(\s*(.+?)\s*\)/i)
          const fn = fm2[1].toUpperCase()
          let inner = fm2[2].trim()
          if (inner === '*' || inner.toUpperCase() === '1') {
            result[`_${fn.toLowerCase()}`] = g._count
          } else {
            inner = inner.split('.').pop()
            const nums = g._items.map(x => parseFloat(x[inner])).filter(x => !isNaN(x))
            if (fn === 'SUM') result[`_${fn.toLowerCase()}`] = nums.reduce((s, x) => s + x, 0)
            else if (fn === 'AVG') result[`_${fn.toLowerCase()}`] = nums.length ? nums.reduce((s, x) => s + x, 0) / nums.length : 0
            else if (fn === 'MAX') result[`_${fn.toLowerCase()}`] = Math.max(...nums)
            else if (fn === 'MIN') result[`_${fn.toLowerCase()}`] = Math.min(...nums)
          }
        }
      }
      return result
    })
  }
  
  if (parsed.offset) rows = rows.slice(parsed.offset)
  if (parsed.limit) rows = rows.slice(0, parsed.limit)
  
  return rows
}

function doInsert(parsed, params) {
  const table = db[parsed.tableName]
  if (!table) return { lastInsertRowid: 0, changes: 0 }
  
  const values = []
  let inQuote = false, current = '', qi = 0
  for (const ch of parsed.valuesStr) {
    if (ch === "'") inQuote = !inQuote
    else if (ch === '?' && !inQuote) {
      if (current.trim()) values.push(current.trim()); current = ''
      values.push(params[qi++]); continue
    } else if (ch === ',' && !inQuote) {
      if (current.trim()) values.push(parseValue(current.trim()))
      current = ''; continue
    }
    current += ch
  }
  if (current.trim()) values.push(parseValue(current.trim()))
  
  const row = { id: getNextId(parsed.tableName) }
  parsed.columns.forEach((col, i) => {
    let v = values[i]
    if (typeof v === 'string') {
      if (v === "datetime('now')") v = dayjs().format('YYYY-MM-DD HH:mm:ss')
      else if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1)
    }
    row[col] = v
  })
  
  table.push(row)
  save()
  return { lastInsertRowid: row.id, changes: 1 }
}

function parseValue(v) {
  v = v.trim()
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1)
  if (v === 'NULL' || v === 'null') return null
  if (!isNaN(parseFloat(v)) && String(parseFloat(v)) === v) return parseFloat(v)
  return v
}

function doUpdate(parsed, params) {
  const table = db[parsed.tableName]
  if (!table) return { lastInsertRowid: 0, changes: 0 }
  
  const sets = []
  const setParts = parsed.setStr.split(',')
  let pi = 0
  for (const part of setParts) {
    const m = part.trim().match(/([\w_]+)\s*=\s*(.+?)$/)
    if (m) {
      let val = m[2].trim()
      if (val === '?') val = params[pi++]
      else if (val === "datetime('now')") val = dayjs().format('YYYY-MM-DD HH:mm:ss')
      else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
      else if (!isNaN(parseFloat(val))) val = parseFloat(val)
      sets.push({ field: m[1], value: val })
    }
  }
  
  const updatePi = countParams(parsed.setStr)
  let changes = 0
  for (const row of table) {
    if (evalCondition(parsed.where, row, params, updatePi)) {
      for (const s of sets) row[s.field] = s.value
      changes++
    }
  }
  
  if (changes > 0) save()
  return { lastInsertRowid: 0, changes }
}

function countParams(str) {
  return (str.match(/\?/g) || []).length
}

function doDelete(parsed, params) {
  const table = db[parsed.tableName]
  if (!table) return { lastInsertRowid: 0, changes: 0 }
  const before = table.length
  db[parsed.tableName] = table.filter(row => !evalCondition(parsed.where, row, params))
  const changes = before - db[parsed.tableName].length
  if (changes > 0) save()
  return { lastInsertRowid: 0, changes }
}

export function query(sql, params = []) {
  return new Promise(resolve => {
    setTimeout(() => {
      try {
        const parsed = parseSQL(sql)
        if (!parsed) {
          resolve({ success: false, error: 'SQL parse error' })
          return
        }
        
        if (parsed.type === 'SELECT') {
          const data = doSelect(parsed, params)
          const result = data.map(row => {
            const clean = {}
            for (const k in row) {
              if (!k.startsWith('_')) clean[k] = row[k]
            }
            if (parsed.fields.includes('COUNT(*)') || parsed.fields.includes('COUNT(1)')) {
              clean.cnt = row._count || 0
            }
            const fm = parsed.fields.match(/(SUM|AVG|MAX|MIN|COUNT)\s*\((.+?)\)\s+AS\s+([\w_]+)/gi)
            if (fm) {
              for (const f of fm) {
                const fma = f.match(/(SUM|AVG|MAX|MIN|COUNT)\s*\((.+?)\)\s+AS\s+([\w_]+)/i)
                clean[fma[3]] = row['_' + fma[1].toLowerCase()] || 0
              }
            }
            const fm2 = parsed.fields.match(/(SUM|AVG|MAX|MIN)\s*\((.+?)\)(\s|,|$)/gi)
            if (fm2 && !fm) {
              for (const f of fm2) {
                const fma = f.match(/(SUM|AVG|MAX|MIN)\s*\((.+?)\)/i)
                const alias = fma[2].trim().split('.').pop()
                clean[fma[1].toLowerCase() + '(' + alias + ')'] = row['_' + fma[1].toLowerCase()] || 0
              }
            }
            return clean
          })
          resolve({ success: true, data: result })
        } else if (parsed.type === 'INSERT') {
          resolve({ success: true, data: doInsert(parsed, params) })
        } else if (parsed.type === 'UPDATE') {
          resolve({ success: true, data: doUpdate(parsed, params) })
        } else if (parsed.type === 'DELETE') {
          resolve({ success: true, data: doDelete(parsed, params) })
        } else {
          resolve({ success: false, error: 'Unsupported SQL' })
        }
      } catch (e) {
        console.error('SQL Error:', sql, e)
        resolve({ success: false, error: e.message || String(e) })
      }
    }, 20)
  })
}

export function exec(sql) {
  return new Promise(resolve => {
    const statements = sql.split(';').map(s => s.trim()).filter(s => s)
    for (const stmt of statements) {
      try {
        const parsed = parseSQL(stmt)
        if (!parsed) continue
        if (parsed.type === 'INSERT') doInsert(parsed, [])
        else if (parsed.type === 'UPDATE') doUpdate(parsed, [])
        else if (parsed.type === 'DELETE') doDelete(parsed, [])
      } catch (e) { console.error(e) }
    }
    resolve({ success: true })
  })
}

export default { query, exec }
