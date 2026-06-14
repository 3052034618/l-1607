<template>
  <div>
    <h2 class="page-title">运单管理</h2>

    <div class="toolbar">
      <el-input v-model="searchKey" placeholder="运单号/收件人/手机号" clearable style="width: 240px;" @input="loadList" />
      <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 140px;" @change="loadList">
        <el-option label="运输中" value="in_transit" />
        <el-option label="已入库" value="arrived" />
        <el-option label="已取件" value="picked_up" />
        <el-option label="已退件" value="returned" />
        <el-option label="已锁定" value="locked" />
      </el-select>
      <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" @change="loadList" />
      <el-button type="primary" @click="loadList">
        <el-icon><Search /></el-icon>
        查询
      </el-button>
      <el-button @click="resetFilters">重置</el-button>
      <el-button type="success" @click="showDetail(null)">
        <el-icon><Plus /></el-icon>
        新增运单
      </el-button>
    </div>

    <div class="table-container">
      <el-table :data="orders" border stripe v-loading="loading">
        <el-table-column prop="waybill_no" label="运单号" width="160" />
        <el-table-column prop="company" label="快递公司" width="110" />
        <el-table-column prop="receiver_name" label="收件人" width="100" />
        <el-table-column prop="receiver_phone" label="联系电话" width="130" />
        <el-table-column label="尺寸" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="getSizeType(row.size)">{{ getSizeLabel(row.size) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="冷藏" width="70">
          <template #default="{ row }">
            <el-tag v-if="row.refrigerated" size="small" type="primary">是</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="格口位置" width="140">
          <template #default="{ row }">
            <span v-if="row.locker_code">{{ row.zone }} - {{ row.locker_code }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="pickup_code" label="取件码" width="90">
          <template #default="{ row }">
            <span v-if="row.pickup_code" style="letter-spacing: 2px; font-weight: 600;">{{ row.pickup_code }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="保管费" width="90">
          <template #default="{ row }">
            <span v-if="row.storage_fee > 0" style="color: #f56c6c; font-weight: 600;">¥{{ row.storage_fee.toFixed(2) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.locked" size="small" type="danger">已锁定</el-tag>
            <el-tag v-else size="small" :type="getOrderStatusType(row.status)">{{ getOrderStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="in_time" label="入库时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.in_time) }}</template>
        </el-table-column>
        <el-table-column prop="pickup_time" label="取件时间" width="170">
          <template #default="{ row }">{{ row.pickup_time ? formatDateTime(row.pickup_time) : '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="showDetail(row)">详情</el-button>
            <el-button v-if="row.status === 'arrived' && !row.locked" link type="warning" size="small" @click="lockOrder(row)">锁定</el-button>
            <el-button v-if="row.locked && isAdmin" link type="success" size="small" @click="unlockOrder(row)">解锁</el-button>
            <el-button v-if="row.status === 'arrived'" link type="danger" size="small" @click="returnOrder(row)">退件</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        style="margin-top: 16px; justify-content: flex-end; display: flex;"
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadList"
        @current-change="loadList"
      />
    </div>

    <el-dialog v-model="detailVisible" :title="isEdit ? '编辑运单' : '运单详情'" width="680px">
      <el-form :model="detailForm" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="运单号">
              <el-input v-model="detailForm.waybill_no" :disabled="!isEdit" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="快递公司">
              <el-select v-model="detailForm.company" style="width: 100%;" :disabled="!isEdit">
                <el-option v-for="c in companies" :key="c" :label="c" :value="c" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="收件人">
              <el-input v-model="detailForm.receiver_name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="detailForm.receiver_phone" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="收件地址">
          <el-input v-model="detailForm.receiver_address" type="textarea" :rows="2" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="包裹尺寸">
              <el-select v-model="detailForm.size" style="width: 100%;">
                <el-option label="小号" value="small" />
                <el-option label="中号" value="medium" />
                <el-option label="大号" value="large" />
                <el-option label="超大号" value="xlarge" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="是否冷藏">
              <el-switch v-model="detailForm.refrigerated" :active-value="1" :inactive-value="0" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="重量(kg)">
              <el-input-number v-model="detailForm.weight" :min="0" :precision="2" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="detailVisible = false">取消</el-button>
        <el-button v-if="isEdit" type="primary" @click="saveDetail">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus } from '@element-plus/icons-vue'
import db from '@/api/db'
import { getSizeLabel, getSizeType, getOrderStatusLabel, getOrderStatusType, formatDateTime, generatePickupCode } from '@/utils'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const isAdmin = computed(() => userStore.isAdmin)

const orders = ref([])
const loading = ref(false)
const searchKey = ref('')
const statusFilter = ref('')
const dateRange = ref([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const detailVisible = ref(false)
const isEdit = ref(false)
const detailForm = reactive({})

const companies = ['顺丰速运', '圆通速递', '中通快递', '韵达快递', '申通快递', '京东物流', '极兔速递']

async function loadList() {
  loading.value = true
  try {
    let where = ['1=1']
    let params = []

    if (searchKey.value.trim()) {
      where.push('(o.waybill_no LIKE ? OR o.receiver_name LIKE ? OR o.receiver_phone LIKE ?)')
      const key = '%' + searchKey.value.trim() + '%'
      params.push(key, key, key)
    }
    if (statusFilter.value) {
      where.push('o.status = ?')
      params.push(statusFilter.value)
    }
    if (dateRange.value && dateRange.value.length === 2) {
      where.push('DATE(o.created_at) BETWEEN ? AND ?')
      params.push(dateRange.value[0].toISOString().split('T')[0], dateRange.value[1].toISOString().split('T')[0])
    }

    const countSql = `SELECT COUNT(*) as cnt FROM express_orders o WHERE ${where.join(' AND ')}`
    const countR = await db.query(countSql, params)
    if (countR.success) total.value = countR.data[0].cnt

    const offset = (page.value - 1) * pageSize.value
    const sql = `
      SELECT o.*, l.code as locker_code, l.zone 
      FROM express_orders o 
      LEFT JOIN lockers l ON o.locker_id = l.id 
      WHERE ${where.join(' AND ')} 
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `
    params.push(pageSize.value, offset)
    const r = await db.query(sql, params)
    if (r.success) orders.value = r.data
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  searchKey.value = ''
  statusFilter.value = ''
  dateRange.value = []
  page.value = 1
  loadList()
}

function showDetail(row) {
  isEdit.value = !row
  Object.assign(detailForm, row || {
    waybill_no: '',
    company: '顺丰速运',
    receiver_name: '',
    receiver_phone: '',
    receiver_address: '',
    size: 'medium',
    refrigerated: 0,
    weight: 1,
    pickup_code: ''
  })
  detailVisible.value = true
}

async function saveDetail() {
  if (!detailForm.waybill_no) {
    ElMessage.warning('请输入运单号')
    return
  }
  if (!detailForm.pickup_code) detailForm.pickup_code = generatePickupCode()

  const r = await db.query(`
    INSERT INTO express_orders (waybill_no, company, receiver_name, receiver_phone, receiver_address, size, refrigerated, weight, pickup_code, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_transit')
  `, [detailForm.waybill_no, detailForm.company, detailForm.receiver_name, detailForm.receiver_phone, detailForm.receiver_address, detailForm.size, detailForm.refrigerated, detailForm.weight, detailForm.pickup_code])

  if (r.success) {
    ElMessage.success('保存成功')
    detailVisible.value = false
    loadList()
  } else {
    ElMessage.error('保存失败：' + r.error)
  }
}

async function lockOrder(row) {
  try {
    await ElMessageBox.confirm('确定要锁定该包裹吗？锁定后用户将无法自助取件。', '提示', { type: 'warning' })
    await db.query('UPDATE express_orders SET locked = 1 WHERE id = ?', [row.id])
    ElMessage.success('已锁定')
    loadList()
  } catch {}
}

async function unlockOrder(row) {
  try {
    await ElMessageBox.confirm('确定要解锁该包裹吗？', '提示', { type: 'warning' })
    await db.query('UPDATE express_orders SET locked = 0, failed_attempts = 0 WHERE id = ?', [row.id])
    ElMessage.success('已解锁')
    loadList()
  } catch {}
}

async function returnOrder(row) {
  try {
    await ElMessageBox.confirm(`确定将运单 ${row.waybill_no} 标记为退件吗？`, '退件处理', { type: 'warning' })
    await db.query("UPDATE express_orders SET status = 'returned' WHERE id = ?", [row.id])
    if (row.locker_id) {
      await db.query("UPDATE lockers SET status = 'empty' WHERE id = ?", [row.locker_id])
    }
    ElMessage.success('已标记为退件')
    loadList()
  } catch {}
}

onMounted(loadList)
</script>
