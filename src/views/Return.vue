<template>
  <div>
    <h2 class="page-title">退件管理</h2>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="在线申请退件" name="apply">
        <div class="table-container">
          <el-form :model="applyForm" label-width="120px" style="max-width: 700px;">
            <el-form-item label="原运单号">
              <el-input v-model="applyForm.original_waybill" placeholder="请输入原运单号" size="large" />
            </el-form-item>
            <el-form-item label="申请人姓名">
              <el-input v-model="applyForm.user_name" placeholder="请输入姓名" size="large" />
            </el-form-item>
            <el-form-item label="联系电话">
              <el-input v-model="applyForm.user_phone" placeholder="请输入联系电话" size="large" />
            </el-form-item>
            <el-form-item label="取件地址">
              <el-input v-model="applyForm.pickup_address" type="textarea" :rows="2" placeholder="请输入上门取件地址" />
            </el-form-item>
            <el-form-item label="退件原因">
              <el-select v-model="applyForm.reason" style="width: 100%;" size="large">
                <el-option label="商品质量问题" value="商品质量问题" />
                <el-option label="错发/漏发" value="错发/漏发" />
                <el-option label="不想要了" value="不想要了" />
                <el-option label="尺码不合适" value="尺码不合适" />
                <el-option label="其他原因" value="其他原因" />
              </el-select>
            </el-form-item>
            <el-form-item label="期望取件时间">
              <el-date-picker
                v-model="applyForm.window"
                type="datetimerange"
                range-separator="至"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
                style="width: 100%;"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" size="large" @click="submitReturn">
                <el-icon><Check /></el-icon>
                提交退件申请
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <el-tab-pane label="退件列表" name="list">
        <div class="toolbar">
          <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 160px;" @change="loadReturns">
            <el-option label="待取件" value="pending" />
            <el-option label="已取件" value="picked" />
            <el-option label="已寄出" value="shipped" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
          <el-button @click="loadReturns">刷新</el-button>
        </div>

        <div class="table-container">
          <el-table :data="returns" border stripe v-loading="loading">
            <el-table-column prop="return_waybill" label="退运单号" width="160" />
            <el-table-column prop="original_waybill" label="原运单号" width="160" />
            <el-table-column prop="user_name" label="申请人" width="100" />
            <el-table-column prop="user_phone" label="联系电话" width="130" />
            <el-table-column prop="reason" label="退件原因" width="140" />
            <el-table-column label="快递员" width="100">
              <template #default="{ row }">
                <span v-if="row.courier_name">{{ row.courier_name }}</span>
                <el-tag v-else size="small" type="info">待分配</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="取件时间窗口" width="260">
              <template #default="{ row }">
                <span v-if="row.pickup_window_start">
                  {{ formatDateTime(row.pickup_window_start) }} ~ {{ formatDateTime(row.pickup_window_end) }}
                </span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="fee" label="退件费" width="90">
              <template #default="{ row }">
                <span style="color: #e6a23c;">¥{{ row.fee.toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag size="small" :type="getReturnStatusType(row.status)">{{ getReturnStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="申请时间" width="170">
              <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="260" fixed="right">
              <template #default="{ row }">
                <el-button v-if="row.status === 'pending'" link type="primary" size="small" @click="assignCourier(row)">分配快递员</el-button>
                <el-button v-if="row.status === 'pending'" link type="success" size="small" @click="markStatus(row, 'picked')">标记已取件</el-button>
                <el-button v-if="row.status === 'picked'" link type="success" size="small" @click="markStatus(row, 'shipped')">标记已寄出</el-button>
                <el-button v-if="row.status === 'shipped'" link type="success" size="small" @click="markStatus(row, 'completed')">标记完成</el-button>
                <el-button v-if="row.status === 'pending'" link type="danger" size="small" @click="markStatus(row, 'cancelled')">取消</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="courierVisible" title="分配快递员" width="480px">
      <el-form label-width="100px">
        <el-form-item label="当前退件">
          <el-tag type="info" size="large">{{ currentReturn?.return_waybill }}</el-tag>
        </el-form-item>
        <el-form-item label="选择快递员">
          <el-select v-model="selectedCourierId" style="width: 100%;" size="large" placeholder="请选择快递员">
            <el-option
              v-for="c in couriers"
              :key="c.id"
              :label="`${c.name} - ${c.phone} (${c.company})`"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="取件时间窗口">
          <el-date-picker
            v-model="courierWindow"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            style="width: 100%;"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="courierVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAssign">确认分配</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Check } from '@element-plus/icons-vue'
import db from '@/api/db'
import { getReturnStatusLabel, formatDateTime, generateWaybillNo } from '@/utils'

const activeTab = ref('list')
const returns = ref([])
const loading = ref(false)
const statusFilter = ref('')

const couriers = ref([])
const courierVisible = ref(false)
const currentReturn = ref(null)
const selectedCourierId = ref(null)
const courierWindow = ref([])

const applyForm = reactive({
  original_waybill: '',
  user_name: '',
  user_phone: '',
  pickup_address: '',
  reason: '',
  window: []
})

function getReturnStatusType(status) {
  const map = {
    'pending': 'warning',
    'picked': 'primary',
    'shipped': 'info',
    'completed': 'success',
    'cancelled': 'danger'
  }
  return map[status] || 'info'
}

async function loadReturns() {
  loading.value = true
  let where = ['1=1']
  let params = []
  if (statusFilter.value) {
    where.push('r.status = ?')
    params.push(statusFilter.value)
  }
  const sql = `
    SELECT r.*, c.name as courier_name, c.phone as courier_phone, c.company as courier_company
    FROM return_orders r
    LEFT JOIN couriers c ON r.courier_id = c.id
    WHERE ${where.join(' AND ')}
    ORDER BY r.created_at DESC
  `
  const r = await db.query(sql, params)
  if (r.success) returns.value = r.data
  loading.value = false
}

async function loadCouriers() {
  const r = await db.query('SELECT * FROM couriers ORDER BY name')
  if (r.success) couriers.value = r.data
}

async function submitReturn() {
  if (!applyForm.original_waybill || !applyForm.user_name || !applyForm.user_phone || !applyForm.reason) {
    ElMessage.warning('请填写必要信息')
    return
  }
  const returnWaybill = 'RT' + generateWaybillNo().slice(2)
  const fee = 8

  let windowStart = null, windowEnd = null
  if (applyForm.window && applyForm.window.length === 2) {
    windowStart = applyForm.window[0].toISOString().replace('T', ' ').slice(0, 19)
    windowEnd = applyForm.window[1].toISOString().replace('T', ' ').slice(0, 19)
  }

  const r = await db.query(`
    INSERT INTO return_orders
    (original_waybill, return_waybill, user_name, user_phone, reason, pickup_address, pickup_window_start, pickup_window_end, fee)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [applyForm.original_waybill, returnWaybill, applyForm.user_name, applyForm.user_phone, applyForm.reason, applyForm.pickup_address, windowStart, windowEnd, fee])

  if (r.success) {
    ElMessage.success('申请已提交，退件单号：' + returnWaybill)
    Object.assign(applyForm, {
      original_waybill: '', user_name: '', user_phone: '', pickup_address: '', reason: '', window: []
    })
    activeTab.value = 'list'
    loadReturns()
  } else {
    ElMessage.error('提交失败：' + r.error)
  }
}

function assignCourier(row) {
  currentReturn.value = row
  selectedCourierId.value = null
  courierWindow.value = []
  courierVisible.value = true
}

async function confirmAssign() {
  if (!selectedCourierId.value) {
    ElMessage.warning('请选择快递员')
    return
  }
  let windowStart = null, windowEnd = null
  if (courierWindow.value && courierWindow.value.length === 2) {
    windowStart = courierWindow.value[0].toISOString().replace('T', ' ').slice(0, 19)
    windowEnd = courierWindow.value[1].toISOString().replace('T', ' ').slice(0, 19)
  }
  const r = await db.query(
    'UPDATE return_orders SET courier_id = ?, pickup_window_start = ?, pickup_window_end = ? WHERE id = ?',
    [selectedCourierId.value, windowStart, windowEnd, currentReturn.value.id]
  )
  if (r.success) {
    ElMessage.success('已分配快递员')
    courierVisible.value = false
    loadReturns()
  } else {
    ElMessage.error('分配失败：' + r.error)
  }
}

async function markStatus(row, status) {
  const r = await db.query('UPDATE return_orders SET status = ? WHERE id = ?', [status, row.id])
  if (r.success) {
    if (status === 'completed') {
      await db.query(`
        INSERT INTO financial_records (order_id, type, amount, description)
        VALUES (?, 'return_fee', ?, '退件费收入')
      `, [row.id, row.fee])
    }
    ElMessage.success('状态已更新')
    loadReturns()
  } else {
    ElMessage.error('操作失败：' + r.error)
  }
}

onMounted(async () => {
  await loadReturns()
  await loadCouriers()
})
</script>
