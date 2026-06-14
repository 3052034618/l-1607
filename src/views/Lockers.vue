<template>
  <div>
    <h2 class="page-title">格口管理</h2>

    <el-row :gutter="16">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">总格口数</div>
          <div class="stat-value">{{ totalLockers }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">空闲格口</div>
          <div class="stat-value" style="color: #67c23a;">{{ emptyCount }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">占用格口</div>
          <div class="stat-value" style="color: #e6a23c;">{{ occupiedCount }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">占用率</div>
          <div class="stat-value">{{ occupancyRate }}%</div>
        </div>
      </el-col>
    </el-row>

    <div class="toolbar" style="margin-top: 16px;">
      <el-select v-model="zoneFilter" placeholder="按区域筛选" clearable style="width: 140px;" @change="loadLockers">
        <el-option label="A区" value="A区" />
        <el-option label="B区" value="B区" />
      </el-select>
      <el-select v-model="typeFilter" placeholder="按类型筛选" clearable style="width: 140px;" @change="loadLockers">
        <el-option label="普通柜" value="normal" />
        <el-option label="冷藏柜" value="refrigerated" />
      </el-select>
      <el-select v-model="sizeFilter" placeholder="按尺寸筛选" clearable style="width: 140px;" @change="loadLockers">
        <el-option label="小号" value="small" />
        <el-option label="中号" value="medium" />
        <el-option label="大号" value="large" />
        <el-option label="超大号" value="xlarge" />
      </el-select>
      <el-select v-model="statusFilter" placeholder="按状态筛选" clearable style="width: 140px;" @change="loadLockers">
        <el-option label="空闲" value="empty" />
        <el-option label="占用" value="occupied" />
      </el-select>
      <el-button type="primary" @click="showAdd">
        <el-icon><Plus /></el-icon>
        新增格口
      </el-button>
      <el-button @click="loadLockers">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <div class="table-container">
      <div class="locker-grid" style="grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));">
        <div
          v-for="locker in lockers"
          :key="locker.id"
          class="locker-cell"
          :class="getLockerClass(locker)"
          style="padding: 8px;"
          @click="showEdit(locker)"
        >
          <div style="font-weight: 700; font-size: 14px;">{{ locker.code }}</div>
          <div style="font-size: 11px; margin-top: 2px;">{{ getSizeLabel(locker.size) }}</div>
          <div style="font-size: 11px;">{{ locker.zone }} · {{ locker.type === 'refrigerated' ? '冷藏' : '普通' }}</div>
          <el-tag v-if="locker.order_id" size="small" type="warning" style="margin-top: 4px; font-size: 10px;">
            已占用
          </el-tag>
          <el-tag v-else size="small" type="success" style="margin-top: 4px; font-size: 10px;">
            空闲
          </el-tag>
        </div>
      </div>
    </div>

    <el-divider />

    <div class="table-container">
      <h3 style="font-size: 16px; margin-bottom: 16px;">格口列表</h3>
      <el-table :data="lockers" border stripe>
        <el-table-column prop="code" label="格口编号" width="120" />
        <el-table-column prop="zone" label="区域" width="80" />
        <el-table-column prop="shelf_no" label="货架号" width="80" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.type === 'refrigerated'" size="small" type="primary">
              ❄ 冷藏柜
            </el-tag>
            <el-tag v-else size="small">普通柜</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="尺寸" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="getSizeType(row.size)">{{ getSizeLabel(row.size) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'empty'" size="small" type="success">空闲</el-tag>
            <el-tag v-else size="small" type="warning">占用</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="占用运单" width="160">
          <template #default="{ row }">
            <span v-if="row.waybill_no">{{ row.waybill_no }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="收件人" width="100">
          <template #default="{ row }">
            <span v-if="row.receiver_name">{{ row.receiver_name }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="入库时间" width="170">
          <template #default="{ row }">
            <span v-if="row.in_time">{{ formatDateTime(row.in_time) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="showEdit(row)">编辑</el-button>
            <el-button v-if="row.status === 'occupied'" link type="danger" size="small" @click="forceRelease(row)">强制释放</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="editVisible" :title="form.id ? '编辑格口' : '新增格口'" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="格口编号">
          <el-input v-model="form.code" placeholder="例如：L001" :disabled="!!form.id" />
        </el-form-item>
        <el-form-item label="所属区域">
          <el-select v-model="form.zone" style="width: 100%;">
            <el-option label="A区" value="A区" />
            <el-option label="B区" value="B区" />
            <el-option label="C区" value="C区" />
          </el-select>
        </el-form-item>
        <el-form-item label="货架号">
          <el-input v-model="form.shelf_no" placeholder="例如：S1" />
        </el-form-item>
        <el-form-item label="柜格类型">
          <el-radio-group v-model="form.type">
            <el-radio value="normal">普通柜</el-radio>
            <el-radio value="refrigerated">冷藏柜</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="尺寸">
          <el-radio-group v-model="form.size">
            <el-radio value="small">小号</el-radio>
            <el-radio value="medium">中号</el-radio>
            <el-radio value="large">大号</el-radio>
            <el-radio value="xlarge">超大号</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="saveLocker">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import db from '@/api/db'
import { getSizeLabel, getSizeType, formatDateTime } from '@/utils'

const lockers = ref([])
const zoneFilter = ref('')
const typeFilter = ref('')
const sizeFilter = ref('')
const statusFilter = ref('')

const editVisible = ref(false)
const form = ref({})

const totalLockers = computed(() => lockers.value.length)
const emptyCount = computed(() => lockers.value.filter(l => l.status === 'empty').length)
const occupiedCount = computed(() => lockers.value.filter(l => l.status === 'occupied').length)
const occupancyRate = computed(() => {
  if (totalLockers.value === 0) return 0
  return Math.round((occupiedCount.value / totalLockers.value) * 100)
})

function getLockerClass(locker) {
  if (locker.type === 'refrigerated' && locker.status === 'empty') return 'locker-refrigerated'
  if (locker.status === 'empty') return 'locker-empty'
  return 'locker-occupied'
}

async function loadLockers() {
  let where = ['1=1']
  let params = []
  if (zoneFilter.value) { where.push('l.zone = ?'); params.push(zoneFilter.value) }
  if (typeFilter.value) { where.push('l.type = ?'); params.push(typeFilter.value) }
  if (sizeFilter.value) { where.push('l.size = ?'); params.push(sizeFilter.value) }
  if (statusFilter.value) { where.push('l.status = ?'); params.push(statusFilter.value) }

  const sql = `
    SELECT l.*, o.waybill_no, o.receiver_name, o.in_time, o.id as order_id
    FROM lockers l 
    LEFT JOIN express_orders o ON l.id = o.locker_id AND o.status = 'arrived'
    WHERE ${where.join(' AND ')}
    ORDER BY l.code
  `
  const r = await db.query(sql, params)
  if (r.success) lockers.value = r.data
}

function showAdd() {
  form.value = {
    id: null, code: '', zone: 'A区', shelf_no: 'S1', type: 'normal', size: 'medium', status: 'empty'
  }
  editVisible.value = true
}

function showEdit(locker) {
  form.value = { ...locker }
  editVisible.value = true
}

async function saveLocker() {
  const f = form.value
  if (!f.code) {
    ElMessage.warning('请输入格口编号')
    return
  }
  let r
  if (f.id) {
    r = await db.query(
      'UPDATE lockers SET code=?, zone=?, shelf_no=?, type=?, size=? WHERE id=?',
      [f.code, f.zone, f.shelf_no, f.type, f.size, f.id]
    )
  } else {
    r = await db.query(
      'INSERT INTO lockers (code, zone, shelf_no, type, size, status) VALUES (?, ?, ?, ?, ?, ?)',
      [f.code, f.zone, f.shelf_no, f.type, f.size, 'empty']
    )
  }
  if (r.success) {
    ElMessage.success('保存成功')
    editVisible.value = false
    loadLockers()
  } else {
    ElMessage.error('保存失败：' + r.error)
  }
}

async function forceRelease(locker) {
  try {
    await ElMessageBox.confirm(
      `确定强制释放格口 ${locker.code}？将同时清空关联包裹。`,
      '强制释放',
      { type: 'warning' }
    )
    await db.query("UPDATE lockers SET status = 'empty' WHERE id = ?", [locker.id])
    if (locker.order_id) {
      await db.query("UPDATE express_orders SET status = 'returned', locker_id = NULL WHERE id = ?", [locker.order_id])
    }
    ElMessage.success('已释放')
    loadLockers()
  } catch {}
}

onMounted(loadLockers)
</script>
