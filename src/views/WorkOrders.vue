<template>
  <div>
    <h2 class="page-title">异常工单</h2>

    <div class="toolbar">
      <el-select v-model="statusFilter" placeholder="工单状态" clearable style="width: 140px;" @change="loadList">
        <el-option label="待处理" value="pending" />
        <el-option label="处理中" value="processing" />
        <el-option label="已完成" value="handled" />
      </el-select>
      <el-select v-model="typeFilter" placeholder="工单类型" clearable style="width: 140px;" @change="loadList">
        <el-option label="取件解锁" value="unlock" />
        <el-option label="包裹破损" value="damaged" />
        <el-option label="投诉建议" value="complaint" />
        <el-option label="设备故障" value="device" />
        <el-option label="其他异常" value="other" />
      </el-select>
      <el-button type="primary" @click="showCreate">
        <el-icon><Plus /></el-icon>
        新建工单
      </el-button>
      <el-button @click="loadList">刷新</el-button>
    </div>

    <div class="table-container">
      <el-table :data="list" border stripe v-loading="loading">
        <el-table-column prop="id" label="工单号" width="80">
          <template #default="{ row }">#{{ String(row.id).padStart(4, '0') }}</template>
        </el-table-column>
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="getTypeTag(row.type)">{{ getTypeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="related_id" label="关联ID" width="100" />
        <el-table-column prop="description" label="问题描述" min-width="200" />
        <el-table-column label="处理人" width="100">
          <template #default="{ row }">
            <span v-if="row.handler_name">{{ row.handler_name }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'pending'" size="small" type="danger">待处理</el-tag>
            <el-tag v-else-if="row.status === 'processing'" size="small" type="warning">处理中</el-tag>
            <el-tag v-else size="small" type="success">已完成</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="处理时间" width="170">
          <template #default="{ row }">
            <span v-if="row.handled_at">{{ formatDateTime(row.handled_at) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status !== 'handled'" link type="primary" size="small" @click="handleWork(row)">处理</el-button>
            <el-button link type="info" size="small" @click="viewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="createVisible" title="新建工单" width="520px">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="工单类型">
          <el-select v-model="createForm.type" style="width: 100%;">
            <el-option label="取件解锁" value="unlock" />
            <el-option label="包裹破损" value="damaged" />
            <el-option label="投诉建议" value="complaint" />
            <el-option label="设备故障" value="device" />
            <el-option label="其他异常" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联单号/ID">
          <el-input v-model="createForm.related_id" placeholder="运单号或格口号等" />
        </el-form-item>
        <el-form-item label="问题描述">
          <el-input v-model="createForm.description" type="textarea" :rows="4" placeholder="请详细描述问题" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="handleVisible" title="处理工单" width="520px">
      <el-descriptions :column="1" size="small" border style="margin-bottom: 16px;">
        <el-descriptions-item label="工单号">#{{ String(currentWork?.id || '').padStart(4, '0') }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ getTypeLabel(currentWork?.type) }}</el-descriptions-item>
        <el-descriptions-item label="问题描述">{{ currentWork?.description }}</el-descriptions-item>
      </el-descriptions>
      <el-form label-width="100px">
        <el-form-item label="处理结果">
          <el-input v-model="handleNote" type="textarea" :rows="3" placeholder="请填写处理结果和备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleVisible = false">取消</el-button>
        <el-button type="primary" @click="submitHandle">标记完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import db from '@/api/db'
import { formatDateTime } from '@/utils'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()

const list = ref([])
const loading = ref(false)
const statusFilter = ref('')
const typeFilter = ref('')

const createVisible = ref(false)
const createForm = reactive({ type: 'other', related_id: '', description: '' })

const handleVisible = ref(false)
const currentWork = ref(null)
const handleNote = ref('')

function getTypeLabel(type) {
  const map = { unlock: '取件解锁', damaged: '包裹破损', complaint: '投诉建议', device: '设备故障', other: '其他异常' }
  return map[type] || type
}

function getTypeTag(type) {
  const map = { unlock: 'primary', damaged: 'danger', complaint: 'warning', device: 'info', other: '' }
  return map[type] || ''
}

async function loadList() {
  loading.value = true
  let where = ['1=1']
  let params = []
  if (statusFilter.value) { where.push('w.status = ?'); params.push(statusFilter.value) }
  if (typeFilter.value) { where.push('w.type = ?'); params.push(typeFilter.value) }

  const sql = `
    SELECT w.*, u.real_name as handler_name
    FROM work_orders w
    LEFT JOIN users u ON w.handler_id = u.id
    WHERE ${where.join(' AND ')}
    ORDER BY w.created_at DESC
  `
  const r = await db.query(sql, params)
  if (r.success) list.value = r.data
  loading.value = false
}

function showCreate() {
  Object.assign(createForm, { type: 'other', related_id: '', description: '' })
  createVisible.value = true
}

async function submitCreate() {
  if (!createForm.description.trim()) {
    ElMessage.warning('请填写问题描述')
    return
  }
  const r = await db.query(
    'INSERT INTO work_orders (type, related_id, description, status) VALUES (?, ?, ?, ?)',
    [createForm.type, createForm.related_id || null, createForm.description, 'pending']
  )
  if (r.success) {
    ElMessage.success('工单创建成功')
    createVisible.value = false
    loadList()
  } else {
    ElMessage.error('创建失败：' + r.error)
  }
}

function handleWork(row) {
  currentWork.value = row
  handleNote.value = ''
  handleVisible.value = true
}

async function submitHandle() {
  const r = await db.query(
    `UPDATE work_orders SET status = 'handled', handler_id = ?, handled_at = datetime('now') WHERE id = ?`,
    [userStore.user.id, currentWork.value.id]
  )
  if (r.success) {
    ElMessage.success('处理完成')
    handleVisible.value = false
    loadList()
  } else {
    ElMessage.error('操作失败：' + r.error)
  }
}

function viewDetail(row) {
  currentWork.value = row
  handleNote.value = row.description
  handleVisible.value = true
}

onMounted(loadList)
</script>
