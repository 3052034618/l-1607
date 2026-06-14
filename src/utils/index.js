import dayjs from 'dayjs'

export function generatePickupCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function generateWaybillNo() {
  const prefix = 'ST' + dayjs().format('YYYYMMDD')
  const random = Math.floor(100000 + Math.random() * 900000)
  return prefix + random
}

export function getSizeLabel(size) {
  const map = { small: '小号', medium: '中号', large: '大号', xlarge: '超大号' }
  return map[size] || size
}

export function getSizeType(size) {
  const map = { small: 'success', medium: 'warning', large: 'danger', xlarge: 'info' }
  return map[size] || 'info'
}

export function getOrderStatusLabel(status) {
  const map = {
    'in_transit': '运输中',
    'arrived': '已入库',
    'picked_up': '已取件',
    'returned': '已退件',
    'locked': '已锁定'
  }
  return map[status] || status
}

export function getOrderStatusType(status) {
  const map = {
    'in_transit': 'info',
    'arrived': 'success',
    'picked_up': 'primary',
    'returned': 'warning',
    'locked': 'danger'
  }
  return map[status] || 'info'
}

export function getReturnStatusLabel(status) {
  const map = {
    'pending': '待取件',
    'picked': '已取件',
    'shipped': '已寄出',
    'completed': '已完成',
    'cancelled': '已取消'
  }
  return map[status] || status
}

export function getRoleLabel(role) {
  const map = { admin: '管理员', courier: '快递员', user: '普通用户' }
  return map[role] || role
}

export function getRoleType(role) {
  const map = { admin: 'danger', courier: 'warning', user: 'success' }
  return map[role] || 'info'
}

export function calculateStorageFee(inTime) {
  const hours = dayjs().diff(dayjs(inTime), 'hour')
  if (hours <= 48) return 0
  const days = Math.ceil((hours - 48) / 24)
  return days * 1
}

export function isOverdue(inTime) {
  const hours = dayjs().diff(dayjs(inTime), 'hour')
  return hours > 48
}

export function formatDateTime(dt) {
  return dayjs(dt).format('YYYY-MM-DD HH:mm:ss')
}

export function formatDate(dt) {
  return dayjs(dt).format('YYYY-MM-DD')
}

export async function runOverdueCheck(db) {
  if (!db || !db.query) return { processed: 0, fees: 0, notifs: 0 }

  try {
    const r = await db.query(`
      SELECT o.*, l.code as locker_code, l.zone 
      FROM express_orders o 
      LEFT JOIN lockers l ON o.locker_id = l.id 
      WHERE o.status = 'arrived' AND o.in_time IS NOT NULL
    `)
    if (!r.success || !r.data) return { processed: 0, fees: 0, notifs: 0 }

    let feeCount = 0
    let notifCount = 0
    const todayStr = dayjs().format('YYYY-MM-DD')

    for (const order of r.data) {
      const realFee = calculateStorageFee(order.in_time)
      const currentFee = Number(order.storage_fee || 0)
      const diff = Number((realFee - currentFee).toFixed(2))

      if (diff > 0) {
        await db.query('UPDATE express_orders SET storage_fee = ? WHERE id = ?', [realFee, order.id])
        await db.query(`
          INSERT INTO financial_records (order_id, type, company, amount, description)
          VALUES (?, 'storage', ?, ?, '超时保管费累计（第' + Math.ceil((dayjs().diff(dayjs(order.in_time), 'hour') - 48) / 24) + '天）')
        `, [order.id, order.company, diff])
        feeCount++
      }

      const notified = Number(order.notified || 0)
      if (realFee > 0 && notified < 10) {
        const lastNotifR = await db.query(`
          SELECT id, sent_at FROM notifications 
          WHERE order_id = ? AND type = 'reminder'
          ORDER BY sent_at DESC
        `, [order.id])
        let alreadySentToday = false
        if (lastNotifR.success && lastNotifR.data && lastNotifR.data.length > 0) {
          alreadySentToday = lastNotifR.data.some(n => {
            if (!n.sent_at) return false
            return n.sent_at.split(' ')[0] === todayStr
          })
        }

        if (!alreadySentToday) {
          const feeForMsg = realFee
          const hours = dayjs().diff(dayjs(order.in_time), 'hour')
          const overdueDays = Math.floor(hours / 24)
          const content = `【驿站提醒】您的包裹${order.waybill_no}已存放${overdueDays}天，产生保管费¥${feeForMsg.toFixed(2)}，请尽快前往${order.zone || ''}${order.locker_code || ''}取件，取件码：${order.pickup_code}`

          await db.query(`
            INSERT INTO notifications (order_id, phone, content, type)
            VALUES (?, ?, ?, 'reminder')
          `, [order.id, order.receiver_phone, content])
          const newNotified = Number(order.notified || 0) + 1
          await db.query('UPDATE express_orders SET notified = ? WHERE id = ?', [newNotified, order.id])
          notifCount++
        }
      }
    }
    return { processed: r.data.length, fees: feeCount, notifs: notifCount }
  } catch (e) {
    console.warn('runOverdueCheck error:', e.message)
    return { processed: 0, fees: 0, notifs: 0, error: e.message }
  }
}
