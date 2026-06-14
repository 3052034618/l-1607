<template>
  <div>
    <h2 class="page-title">取件核验</h2>

    <el-row :gutter="16">
      <el-col :span="10">
        <div class="table-container">
          <h3 style="font-size: 16px; margin-bottom: 20px;">
            {{ step === 1 ? '第一步：查找包裹' : '第二步：取件码核验' }}
          </h3>

          <template v-if="step === 1">
            <el-form label-width="100px">
              <el-form-item label="运单号/扫码">
                <el-input
                  v-model="searchInput"
                  placeholder="请输入运单号或扫码定位包裹"
                  size="large"
                  ref="searchInputRef"
                  @keyup.enter="searchPackage"
                >
                  <template #append>
                    <el-button type="primary" @click="searchPackage" :loading="searching">
                      查找包裹
                    </el-button>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item label="快速扫码">
                <el-button size="large" @click="simulateScan" :loading="scanning">
                  <el-icon><Search /></el-icon>
                  模拟扫码
                </el-button>
              </el-form-item>
            </el-form>
          </template>

          <template v-if="step === 2">
            <el-form label-width="100px">
              <el-form-item label="取件码">
                <el-input
                  v-model="pickupCodeInput"
                  placeholder="请输入6位取件码"
                  size="large"
                  maxlength="6"
                  ref="codeInputRef"
                  type="password"
                  show-password
                  @keyup.enter="verifyCode"
                >
                  <template #append>
                    <el-button type="primary" @click="verifyCode" :loading="verifying">
                      核验取件码
                    </el-button>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item>
                <el-button size="large" @click="backToSearch">
                  返回查找
                </el-button>
              </el-form-item>
            </el-form>
          </template>

          <el-divider />

          <el-alert
            v-if="verifyResult"
            :type="verifyResult.success ? 'success' : 'error'"
            show-icon
            :closable="false"
            style="margin-bottom: 16px;"
          >
            <template #title>{{ verifyResult.message }}</template>
          </el-alert>

          <div v-if="currentOrder" class="table-container" style="background: #f5f7fa; margin-top: 16px;">
            <h4 style="margin-bottom: 12px;">包裹信息</h4>
            <el-descriptions :column="1" size="small" border>
              <el-descriptions-item label="运单号">{{ currentOrder.waybill_no }}</el-descriptions-item>
              <el-descriptions-item label="快递公司">{{ currentOrder.company }}</el-descriptions-item>
              <el-descriptions-item label="收件人">{{ currentOrder.receiver_name }}</el-descriptions-item>
              <el-descriptions-item label="联系电话">{{ currentOrder.receiver_phone }}</el-descriptions-item>
              <el-descriptions-item label="格口位置">
                <el-tag type="success">{{ currentOrder.zone }} - {{ currentOrder.locker_code }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="入库时间">{{ formatDateTime(currentOrder.in_time) }}</el-descriptions-item>
              <el-descriptions-item label="超时保管费" v-if="currentOrder.storage_fee > 0">
                <span style="color: #f56c6c; font-weight: 600;">¥{{ currentOrder.storage_fee.toFixed(2) }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag v-if="currentOrder.locked" type="danger">
                  <el-icon><Lock /></el-icon>
                  已锁定
                </el-tag>
                <el-tag v-else :type="getOrderStatusType(currentOrder.status)">
                  {{ getOrderStatusLabel(currentOrder.status) }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="错误次数">
                <el-tag :type="currentOrder.failed_attempts >= 2 ? 'danger' : 'info'">
                  {{ currentOrder.failed_attempts }} / 3
                </el-tag>
              </el-descriptions-item>
            </el-descriptions>

            <div v-if="!currentOrder.locked && currentOrder.status === 'arrived' && step === 2 && codeVerified" style="margin-top: 16px;">
              <el-button type="success" size="large" style="width: 100%;" @click="confirmPickup" :loading="pickingUp">
                <el-icon><Check /></el-icon>
                确认取件（格口自动解锁）
              </el-button>
            </div>
            <el-button v-if="currentOrder.locked && isAdmin" type="warning" size="large" style="width: 100%; margin-top: 12px;" @click="unlockOrder">
              <el-icon><Setting /></el-icon>
              管理员解锁（错误次数清零）
            </el-button>
          </div>
        </div>
      </el-col>

      <el-col :span="14">
        <div class="table-container">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="font-size: 16px;">今日取件记录</h3>
            <el-tag type="info">成功: {{ successCount }} | 失败: {{ failCount }}</el-tag>
          </div>
          <el-table :data="pickupRecords" border stripe max-height="400">
            <el-table-column label="时间" width="170">
              <template #default="{ row }">{{ formatDateTime(row.attempt_time) }}</template>
            </el-table-column>
            <el-table-column prop="waybill_no" label="运单号" width="160" />
            <el-table-column prop="pickup_code" label="取件码" width="100" />
            <el-table-column label="取件方式" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.pickup_type === 'code'" size="small" type="primary">取件码</el-tag>
                <el-tag v-else size="small" type="success">扫码</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="结果" width="80">
              <template #default="{ row }">
                <el-tag v-if="row.success" size="small" type="success">成功</el-tag>
                <el-tag v-else size="small" type="danger">失败</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="message" label="备注" />
          </el-table>

          <el-divider />

          <div class="toolbar">
            <h4 style="margin-right: 12px;">在库包裹查询{{ isAdmin ? '' : '（仅显示您的包裹）' }}</h4>
            <el-input v-model="searchKey" placeholder="输入运单号/收件人" clearable style="width: 280px;" @input="searchOrders" />
          </div>
          <el-table :data="searchResults" border stripe max-height="300">
            <el-table-column prop="waybill_no" label="运单号" width="160" />
            <el-table-column prop="company" label="快递" width="90" />
            <el-table-column prop="receiver_name" label="收件人" width="90" />
            <el-table-column label="格口" width="110">
              <template #default="{ row }">
                <span>{{ row.zone }} - {{ row.locker_code }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag v-if="row.locked" type="danger">锁定</el-tag>
                <el-tag v-else :type="getOrderStatusType(row.status)">{{ getOrderStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="保管费" width="80">
              <template #default="{ row }">
                <span v-if="row.storage_fee > 0" style="color: #f56c6c;">¥{{ row.storage_fee.toFixed(2) }}</span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="selectOrder(row)">取件</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage, ElNotification, ElMessageBox } from 'element-plus'
import { Search, Check, Lock, Setting } from '@element-plus/icons-vue'
import db from '@/api/db'
import { formatDateTime, getOrderStatusLabel, getOrderStatusType, calculateStorageFee, runOverdueCheck, formatDate } from '@/utils'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const isAdmin = computed(() => userStore.isAdmin)
const isCourier = computed(() => userStore.user?.role === 'courier')
const isUser = computed(() => userStore.user?.role === 'user')
const currentUserPhone = computed(() => userStore.user?.phone || '')
const currentUserCompany = computed(() => {
  if (isCourier.value) {
    return userStore.user?.company || ''
  }
  return ''
})

const step = ref(1)
const searchInput = ref('')
const pickupCodeInput = ref('')
const searching = ref(false)
const scanning = ref(false)
const verifying = ref(false)
const pickingUp = ref(false)
const codeVerified = ref(false)
const currentOrder = ref(null)
const verifyResult = ref(null)
const pickupRecords = ref([])
const searchKey = ref('')
const searchResults = ref([])
const searchInputRef = ref(null)
const codeInputRef = ref(null)

const successCount = computed(() => pickupRecords.value.filter(r => r.success).length)
const failCount = computed(() => pickupRecords.value.filter(r => !r.success).length)

function getDataFilterSQL() {
  if (isUser.value && currentUserPhone.value) {
    return " AND o.receiver_phone = '" + currentUserPhone.value + "'"
  }
  if (isCourier.value) {
    if (currentUserCompany.value) {
      return " AND o.company = '" + currentUserCompany.value + "'"
    }
    return " AND 1 = 0"
  }
  return ''
}

async function insertPickupRecord({ order_id, pickup_code, pickup_type, success, message }) {
  try {
    await db.query(`
      INSERT INTO pickup_records (order_id, pickup_code, pickup_type, success, message, operator_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [order_id || null, pickup_code || null, pickup_type || 'scan', success ? 1 : 0, message || '', userStore.user?.id || null])
    await loadRecords()
  } catch (e) {
    console.warn('insertPickupRecord error:', e.message)
  }
}

async function loadRecords() {
  const today = formatDate(new Date())
  const r = await db.query(`
    SELECT pr.*, o.waybill_no, o.company, o.receiver_phone 
    FROM pickup_records pr 
    LEFT JOIN express_orders o ON pr.order_id = o.id 
    ORDER BY pr.attempt_time DESC
  `)
  if (r.success && r.data) {
    const filtered = r.data.filter(item => {
      if (!item.attempt_time) return false
      const d = item.attempt_time.split(' ')[0]
      if (d !== today) return false
      if (isUser.value && currentUserPhone.value) {
        return item.receiver_phone === currentUserPhone.value
      }
      if (isCourier.value && currentUserCompany.value) {
        return item.company === currentUserCompany.value
      }
      return true
    })
    pickupRecords.value = filtered
  }
}

async function simulateScan() {
  scanning.value = true
  const extraFilter = getDataFilterSQL()
  const r = await db.query(`
    SELECT id, waybill_no, company, receiver_phone FROM express_orders o 
    WHERE status = 'arrived' ${extraFilter} LIMIT 1
  `)
  setTimeout(async () => {
    scanning.value = false
    if (r.success && r.data && r.data.length > 0) {
      const o = r.data[0]
      searchInput.value = o.waybill_no
      ElMessage.success('扫码成功')
      await insertPickupRecord({
        order_id: o.id,
        pickup_type: 'scan',
        success: 1,
        message: `模拟扫码找到包裹：${o.waybill_no}`
      })
    } else {
      const msg = isUser.value ? '您暂无待取包裹' : (isCourier.value ? '您的承运公司暂无在库包裹' : '暂无在库包裹')
      ElMessage.warning(msg)
      await insertPickupRecord({
        order_id: null,
        pickup_type: 'scan',
        success: 0,
        message: `模拟扫码未找到包裹：${msg}`
      })
    }
  }, 600)
}

async function searchPackage() {
  if (!searchInput.value.trim()) {
    ElMessage.warning('请输入运单号或扫码')
    return
  }
  searching.value = true
  verifyResult.value = null
  currentOrder.value = null
  codeVerified.value = false
  pickupCodeInput.value = ''
  const waybill = searchInput.value.trim()

  try {
    await runOverdueCheck(db)
    const extraFilter = getDataFilterSQL()
    const r = await db.query(`
      SELECT o.*, l.code as locker_code, l.zone 
      FROM express_orders o 
      LEFT JOIN lockers l ON o.locker_id = l.id 
      WHERE o.waybill_no = ? ${extraFilter}
    `, [waybill])

    if (!r.success || !r.data || r.data.length === 0) {
      let msg = '运单号不存在，请检查后重试'
      if (isUser.value) msg = '未找到该包裹（或不属于您），请检查运单号'
      else if (isCourier.value) msg = '未找到该包裹（或不属于您的承运公司），请检查运单号'
      verifyResult.value = { success: false, message: msg }
      await insertPickupRecord({
        order_id: null,
        pickup_type: 'scan',
        success: 0,
        message: `扫码查找「${waybill}」失败：${msg}`
      })
      searching.value = false
      return
    }

    const order = r.data[0]
    order.storage_fee = Number(order.storage_fee || 0)
    if (order.locked) {
      currentOrder.value = order
      const msg = `该包裹已被锁定，请联系管理员处理（连续错误3次）`
      verifyResult.value = { success: false, message: msg }
      await insertPickupRecord({
        order_id: order.id,
        pickup_type: 'scan',
        success: 0,
        message: `扫码查找「${waybill}」：${msg}`
      })
      searching.value = false
      return
    }
    if (order.status !== 'arrived') {
      const msg = `包裹状态：${getOrderStatusLabel(order.status)}，无法取件`
      verifyResult.value = { success: false, message: msg }
      await insertPickupRecord({
        order_id: order.id,
        pickup_type: 'scan',
        success: 0,
        message: `扫码查找「${waybill}」：${msg}`
      })
      searching.value = false
      return
    }

    currentOrder.value = order
    step.value = 2
    verifyResult.value = { success: true, message: '找到包裹，请输入取件码进行核验' }
    await insertPickupRecord({
      order_id: order.id,
      pickup_type: 'scan',
      success: 1,
      message: `扫码查找找到包裹：${waybill}`
    })
    nextTick(() => {
      codeInputRef.value && codeInputRef.value.focus()
    })
  } catch (e) {
    verifyResult.value = { success: false, message: '查询异常：' + e.message }
    await insertPickupRecord({
      order_id: null,
      pickup_type: 'scan',
      success: 0,
      message: `扫码查找「${waybill}」异常：${e.message}`
    })
  } finally {
    searching.value = false
  }
}

function selectOrder(row) {
  searchInput.value = row.waybill_no
  searchPackage()
}

function backToSearch() {
  step.value = 1
  pickupCodeInput.value = ''
  codeVerified.value = false
  verifyResult.value = null
  nextTick(() => {
    searchInputRef.value && searchInputRef.value.focus()
  })
}

async function verifyCode() {
  if (!pickupCodeInput.value.trim() || !currentOrder.value) {
    ElMessage.warning('请输入6位取件码')
    return
  }

  verifying.value = true
  verifyResult.value = null
  const inputCode = pickupCodeInput.value.trim()
  const order = currentOrder.value

  try {
    const isCorrect = inputCode === order.pickup_code

    if (isCorrect) {
      await insertPickupRecord({
        order_id: order.id,
        pickup_code: inputCode,
        pickup_type: 'code',
        success: 1,
        message: '取件码核验通过'
      })

      codeVerified.value = true
      verifyResult.value = {
        success: true,
        message: order.storage_fee > 0
          ? `核验通过！需支付超时保管费 ¥${order.storage_fee.toFixed(2)}（已存放超过48小时）`
          : '核验通过，请确认取件'
      }
    } else {
      const newFailed = (order.failed_attempts || 0) + 1
      let isLocked = 0
      let lockMsg = ''

      if (newFailed >= 3) {
        isLocked = 1
        lockMsg = '，已自动锁定并通知管理员介入'
        await db.query(`
          INSERT INTO work_orders (type, related_id, description, status)
          VALUES ('unlock', ?, ?, 'pending')
        `, [order.id, `运单${order.waybill_no}连续输错取件码3次，包裹自动锁定，请管理员介入解锁`])
      }

      await db.query(`
        UPDATE express_orders SET failed_attempts = ?, locked = ? WHERE id = ?
      `, [newFailed, isLocked, order.id])

      await insertPickupRecord({
        order_id: order.id,
        pickup_code: inputCode,
        pickup_type: 'code',
        success: 0,
        message: `取件码错误（第${newFailed}次）${lockMsg}`
      })

      currentOrder.value.failed_attempts = newFailed
      currentOrder.value.locked = isLocked

      if (isLocked) {
        verifyResult.value = { success: false, message: `取件码错误！已连续错误${newFailed}次，包裹已锁定，请联系管理员` }
        ElNotification({
          title: '包裹已锁定',
          message: `运单 ${order.waybill_no} 已自动锁定并生成异常工单`,
          type: 'error'
        })
      } else {
        verifyResult.value = { success: false, message: `取件码错误！还剩 ${3 - newFailed} 次机会` }
      }
    }
  } catch (e) {
    verifyResult.value = { success: false, message: '核验异常：' + e.message }
  } finally {
    verifying.value = false
  }
}

async function confirmPickup() {
  if (!currentOrder.value) return

  try {
    await ElMessageBox.confirm(
      currentOrder.value.storage_fee > 0
        ? `确认取件？需收取保管费 ¥${Number(currentOrder.value.storage_fee).toFixed(2)}`
        : '确认取件？格口将自动解锁',
      '确认取件',
      { type: 'warning' }
    )
  } catch {
    return
  }

  pickingUp.value = true

  try {
    await runOverdueCheck(db)
    const orderId = currentOrder.value.id

    const latestR = await db.query(`
      SELECT storage_fee, company, locker_id, pickup_code, waybill_no, in_time
      FROM express_orders WHERE id = ?
    `, [orderId])
    const latestOrder = latestR.data[0]
    const finalStorageFee = Number(latestOrder.storage_fee || 0)

    await db.query(`
      UPDATE express_orders 
      SET status = 'picked_up', pickup_time = datetime('now'), failed_attempts = 0, locked = 0
      WHERE id = ?
    `, [orderId])

    if (latestOrder.locker_id) {
      await db.query("UPDATE lockers SET status = 'empty' WHERE id = ?", [latestOrder.locker_id])
    }

    await insertPickupRecord({
      order_id: orderId,
      pickup_code: latestOrder.pickup_code,
      pickup_type: 'code',
      success: 1,
      message: finalStorageFee > 0
        ? `取件完成，收取保管费¥${finalStorageFee.toFixed(2)}`
        : '取件完成'
    })

    ElNotification({
      title: '取件成功',
      message: `格口已解锁，欢迎再次使用！${finalStorageFee > 0 ? '（保管费¥' + finalStorageFee.toFixed(2) + '）' : ''}`,
      type: 'success'
    })

    searchInput.value = ''
    pickupCodeInput.value = ''
    currentOrder.value = null
    verifyResult.value = null
    step.value = 1
    codeVerified.value = false
    await searchOrders()
  } catch (e) {
    ElMessage.error('取件失败：' + e.message)
  } finally {
    pickingUp.value = false
  }
}

async function unlockOrder() {
  if (!currentOrder.value) return
  try {
    await ElMessageBox.confirm('确定要解锁该包裹吗？解锁后错误次数将清零', '管理员解锁', { type: 'warning' })
    await db.query('UPDATE express_orders SET locked = 0, failed_attempts = 0 WHERE id = ?', [currentOrder.value.id])

    const r = await db.query(`
      SELECT id FROM work_orders WHERE type = 'unlock' AND related_id = ? AND status = 'pending'
    `, [currentOrder.value.id])
    if (r.success && r.data && r.data.length > 0) {
      await db.query(`
        UPDATE work_orders SET handler_id = ?, status = 'handled', handled_at = datetime('now'), description = description || ' - 管理员已解锁'
        WHERE id = ?
      `, [userStore.user.id, r.data[0].id])
    } else {
      await db.query(`
        INSERT INTO work_orders (type, related_id, description, handler_id, status, handled_at)
        VALUES ('unlock', ?, '管理员手动解锁包裹', ?, 'handled', datetime('now'))
      `, [currentOrder.value.id, userStore.user.id])
    }

    currentOrder.value.locked = 0
    currentOrder.value.failed_attempts = 0
    pickupCodeInput.value = ''
    codeVerified.value = false
    verifyResult.value = { success: true, message: '解锁成功！错误次数已清零，请重新输入取件码' }
    ElMessage.success('解锁成功，错误次数已清零')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('操作失败：' + e.message)
  }
}

async function searchOrders() {
  await runOverdueCheck(db)
  const baseSQL = `
    SELECT o.*, l.code as locker_code, l.zone 
    FROM express_orders o 
    LEFT JOIN lockers l ON o.locker_id = l.id 
    WHERE o.status = 'arrived' ${getDataFilterSQL()}
  `
  let sql, params
  if (!searchKey.value.trim()) {
    sql = baseSQL + ` ORDER BY o.in_time DESC LIMIT 50`
    params = []
  } else {
    const key = '%' + searchKey.value.trim() + '%'
    sql = baseSQL + ` AND (o.waybill_no LIKE ? OR o.receiver_name LIKE ?) ORDER BY o.in_time DESC`
    params = [key, key]
  }
  const r = await db.query(sql, params)
  if (r.success && r.data) {
    searchResults.value = r.data.map(o => ({ ...o, storage_fee: Number(o.storage_fee || 0) }))
  }
}

onMounted(async () => {
  await runOverdueCheck(db)
  await loadRecords()
  await searchOrders()
})
</script>
