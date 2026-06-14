<template>
  <div>
    <h2 class="page-title">取件核验</h2>

    <el-row :gutter="16">
      <el-col :span="10">
        <div class="table-container">
          <h3 style="font-size: 16px; margin-bottom: 20px;">取件码核验</h3>
          <el-form label-width="100px">
            <el-form-item label="取件码">
              <el-input
                v-model="pickupCode"
                placeholder="请输入6位取件码或扫描运单"
                size="large"
                maxlength="6"
                ref="codeInput"
                @keyup.enter="verifyPickup"
              >
                <template #append>
                  <el-button type="primary" @click="verifyPickup" :loading="verifying">
                    核验取件
                  </el-button>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item label="或扫码">
              <el-button size="large" @click="simulateScan" :loading="scanning">
                <el-icon><Search /></el-icon>
                模拟扫码
              </el-button>
            </el-form-item>
          </el-form>

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

            <div v-if="!currentOrder.locked && currentOrder.status === 'arrived'" style="margin-top: 16px;">
              <el-button type="success" size="large" style="width: 100%;" @click="confirmPickup" :loading="pickingUp">
                <el-icon><Check /></el-icon>
                确认取件（格口自动解锁）
              </el-button>
            </div>
            <el-button v-if="currentOrder.locked && isAdmin" type="warning" size="large" style="width: 100%; margin-top: 12px;" @click="unlockOrder">
              <el-icon><Setting /></el-icon>
              管理员解锁
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
            <h4 style="margin-right: 12px;">在库包裹查询</h4>
            <el-input v-model="searchKey" placeholder="输入运单号/收件人/手机号" clearable style="width: 280px;" @input="searchOrders" />
          </div>
          <el-table :data="searchResults" border stripe max-height="300">
            <el-table-column prop="waybill_no" label="运单号" width="160" />
            <el-table-column prop="company" label="快递" width="90" />
            <el-table-column prop="receiver_name" label="收件人" width="90" />
            <el-table-column prop="receiver_phone" label="电话" width="120" />
            <el-table-column label="格口" width="110">
              <template #default="{ row }">
                <span>{{ row.zone }} - {{ row.locker_code }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="pickup_code" label="取件码" width="90">
              <template #default="{ row }">
                <span style="letter-spacing: 2px; font-weight: 600;">{{ row.pickup_code }}</span>
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
          </el-table>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElNotification, ElMessageBox } from 'element-plus'
import { Search, Check, Lock, Setting } from '@element-plus/icons-vue'
import db from '@/api/db'
import { formatDateTime, getOrderStatusLabel, getOrderStatusType, calculateStorageFee } from '@/utils'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const isAdmin = computed(() => userStore.isAdmin)

const pickupCode = ref('')
const verifying = ref(false)
const scanning = ref(false)
const pickingUp = ref(false)
const currentOrder = ref(null)
const verifyResult = ref(null)
const pickupRecords = ref([])
const searchKey = ref('')
const searchResults = ref([])

const successCount = computed(() => pickupRecords.value.filter(r => r.success).length)
const failCount = computed(() => pickupRecords.value.filter(r => !r.success).length)

async function loadRecords() {
  const today = new Date().toISOString().split('T')[0]
  const r = await db.query(`
    SELECT pr.*, o.waybill_no 
    FROM pickup_records pr 
    LEFT JOIN express_orders o ON pr.order_id = o.id 
    WHERE DATE(pr.attempt_time) = ? 
    ORDER BY pr.attempt_time DESC
  `, [today])
  if (r.success) pickupRecords.value = r.data
}

async function simulateScan() {
  scanning.value = true
  const r = await db.query("SELECT waybill_no FROM express_orders WHERE status = 'arrived' LIMIT 1")
  setTimeout(() => {
    scanning.value = false
    if (r.success && r.data.length > 0) {
      pickupCode.value = r.data[0].waybill_no
      ElMessage.success('扫码成功')
    } else {
      ElMessage.warning('暂无在库包裹')
    }
  }, 600)
}

async function verifyPickup() {
  if (!pickupCode.value.trim()) {
    ElMessage.warning('请输入取件码或扫码')
    return
  }

  verifying.value = true
  verifyResult.value = null
  currentOrder.value = null

  try {
    const code = pickupCode.value.trim()
    let query, params

    if (/^\d{6}$/.test(code)) {
      query = `
        SELECT o.*, l.code as locker_code, l.zone 
        FROM express_orders o 
        LEFT JOIN lockers l ON o.locker_id = l.id 
        WHERE o.pickup_code = ?
      `
      params = [code]
    } else {
      query = `
        SELECT o.*, l.code as locker_code, l.zone 
        FROM express_orders o 
        LEFT JOIN lockers l ON o.locker_id = l.id 
        WHERE o.waybill_no = ?
      `
      params = [code]
    }

    const r = await db.query(query, params)
    if (!r.success || r.data.length === 0) {
      verifyResult.value = { success: false, message: '取件码或运单号不存在，请检查后重试' }
      verifying.value = false
      return
    }

    const order = r.data[0]
    const pickupType = /^\d{6}$/.test(code) ? 'code' : 'scan'

    if (order.locked) {
      await db.query(`
        INSERT INTO pickup_records (order_id, pickup_code, pickup_type, success, message)
        VALUES (?, ?, ?, 0, '账号已锁定，需管理员解锁')
      `, [order.id, code, pickupType])

      verifyResult.value = { success: false, message: `该包裹已被锁定，请联系管理员处理（锁定原因：连续错误3次）` }
      currentOrder.value = order
      await loadRecords()
      verifying.value = false
      return
    }

    if (order.status !== 'arrived') {
      await db.query(`
        INSERT INTO pickup_records (order_id, pickup_code, pickup_type, success, message)
        VALUES (?, ?, ?, 0, '包裹状态异常')
      `, [order.id, code, pickupType])
      verifyResult.value = { success: false, message: `包裹状态：${getOrderStatusLabel(order.status)}，无法取件` }
      verifying.value = false
      return
    }

    const fee = calculateStorageFee(order.in_time)
    order.storage_fee = fee
    currentOrder.value = order
    verifyResult.value = {
      success: true,
      message: fee > 0
        ? `核验通过！需支付超时保管费 ¥${fee.toFixed(2)}（已存放超过48小时）`
        : '核验通过，请确认取件'
    }

    verifying.value = false
  } catch (e) {
    verifyResult.value = { success: false, message: '核验异常：' + e.message }
    verifying.value = false
  }
}

async function confirmPickup() {
  if (!currentOrder.value) return

  try {
    await ElMessageBox.confirm(
      currentOrder.value.storage_fee > 0
        ? `确认取件？需收取保管费 ¥${currentOrder.value.storage_fee.toFixed(2)}`
        : '确认取件？格口将自动解锁',
      '确认取件',
      { type: 'warning' }
    )
  } catch {
    return
  }

  pickingUp.value = true

  try {
    const order = currentOrder.value

    await db.query(`
      UPDATE express_orders 
      SET status = 'picked_up', pickup_time = datetime('now'), storage_fee = ?, failed_attempts = 0
      WHERE id = ?
    `, [order.storage_fee, order.id])

    await db.query("UPDATE lockers SET status = 'empty' WHERE id = ?", [order.locker_id])

    await db.query(`
      INSERT INTO pickup_records (order_id, pickup_code, pickup_type, success)
      VALUES (?, ?, ?, 1)
    `, [order.id, order.pickup_code, 'code'])

    if (order.storage_fee > 0) {
      await db.query(`
        INSERT INTO financial_records (order_id, type, company, amount, description)
        VALUES (?, 'storage', ?, ?, '超时保管费收入')
      `, [order.id, order.company, order.storage_fee])
    }

    ElNotification({
      title: '取件成功',
      message: `格口 ${order.locker_code} 已解锁，欢迎再次使用！`,
      type: 'success'
    })

    pickupCode.value = ''
    currentOrder.value = null
    verifyResult.value = null
    await loadRecords()
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
    await ElMessageBox.confirm('确定要解锁该包裹吗？', '管理员解锁', { type: 'warning' })
    await db.query('UPDATE express_orders SET locked = 0, failed_attempts = 0 WHERE id = ?', [currentOrder.value.id])
    await db.query(`
      INSERT INTO work_orders (type, related_id, description, handler_id, status, handled_at)
      VALUES ('unlock', ?, '取件码锁定解锁', ?, 'handled', datetime('now'))
    `, [currentOrder.value.id, userStore.user.id])
    currentOrder.value.locked = 0
    currentOrder.value.failed_attempts = 0
    ElMessage.success('解锁成功')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('操作失败：' + e.message)
  }
}

async function searchOrders() {
  if (!searchKey.value.trim()) {
    const r = await db.query(`
      SELECT o.*, l.code as locker_code, l.zone 
      FROM express_orders o 
      LEFT JOIN lockers l ON o.locker_id = l.id 
      WHERE o.status = 'arrived'
      ORDER BY o.in_time DESC
      LIMIT 50
    `)
    if (r.success) searchResults.value = r.data.map(o => ({ ...o, storage_fee: calculateStorageFee(o.in_time) }))
    return
  }
  const key = '%' + searchKey.value.trim() + '%'
  const r = await db.query(`
    SELECT o.*, l.code as locker_code, l.zone 
    FROM express_orders o 
    LEFT JOIN lockers l ON o.locker_id = l.id 
    WHERE o.status = 'arrived' 
    AND (o.waybill_no LIKE ? OR o.receiver_name LIKE ? OR o.receiver_phone LIKE ?)
    ORDER BY o.in_time DESC
  `, [key, key, key])
  if (r.success) searchResults.value = r.data.map(o => ({ ...o, storage_fee: calculateStorageFee(o.in_time) }))
}

onMounted(async () => {
  await loadRecords()
  await searchOrders()
})
</script>
