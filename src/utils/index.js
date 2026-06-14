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
