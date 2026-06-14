<template>
  <div>
    <h2 class="page-title">用户管理</h2>

    <div class="toolbar">
      <el-input v-model="searchKey" placeholder="用户名/姓名/电话" clearable style="width: 240px;" @input="loadList" />
      <el-select v-model="roleFilter" placeholder="角色筛选" clearable style="width: 140px;" @change="loadList">
        <el-option label="管理员" value="admin" />
        <el-option label="快递员" value="courier" />
        <el-option label="普通用户" value="user" />
      </el-select>
      <el-button type="primary" @click="showEdit(null)">
        <el-icon><Plus /></el-icon>
        新增用户
      </el-button>
      <el-button @click="loadList">刷新</el-button>
    </div>

    <div class="table-container">
      <el-table :data="users" border stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" width="140" />
        <el-table-column prop="real_name" label="姓名" width="120" />
        <el-table-column prop="phone" label="联系电话" width="140" />
        <el-table-column label="角色" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="getRoleType(row.role)">{{ getRoleLabel(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="showEdit(row)">编辑</el-button>
            <el-button link type="warning" size="small" @click="resetPwd(row)">重置密码</el-button>
            <el-button v-if="row.username !== 'admin'" link type="danger" size="small" @click="deleteUser(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="editVisible" :title="form.id ? '编辑用户' : '新增用户'" width="480px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="用户名">
          <el-input v-model="form.username" :disabled="!!form.id" />
        </el-form-item>
        <el-form-item v-if="!form.id" label="初始密码">
          <el-input v-model="form.password" type="password" placeholder="默认123456" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="form.real_name" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width: 100%;">
            <el-option label="管理员" value="admin" />
            <el-option label="快递员" value="courier" />
            <el-option label="普通用户" value="user" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import db from '@/api/db'
import { getRoleLabel, getRoleType, formatDateTime } from '@/utils'

const users = ref([])
const loading = ref(false)
const searchKey = ref('')
const roleFilter = ref('')

const editVisible = ref(false)
const form = reactive({})

async function loadList() {
  loading.value = true
  let where = ['1=1']
  let params = []
  if (searchKey.value.trim()) {
    where.push('(username LIKE ? OR real_name LIKE ? OR phone LIKE ?)')
    const key = '%' + searchKey.value.trim() + '%'
    params.push(key, key, key)
  }
  if (roleFilter.value) {
    where.push('role = ?')
    params.push(roleFilter.value)
  }

  const r = await db.query(
    `SELECT id, username, real_name, phone, role, created_at FROM users WHERE ${where.join(' AND ')} ORDER BY id`,
    params
  )
  if (r.success) users.value = r.data
  loading.value = false
}

function showEdit(row) {
  Object.assign(form, row || {
    id: null, username: '', password: '123456', real_name: '', phone: '', role: 'user'
  })
  editVisible.value = true
}

async function saveUser() {
  if (!form.username || !form.real_name) {
    ElMessage.warning('请填写必要信息')
    return
  }
  let r
  if (form.id) {
    r = await db.query(
      'UPDATE users SET real_name = ?, phone = ?, role = ? WHERE id = ?',
      [form.real_name, form.phone, form.role, form.id]
    )
  } else {
    r = await db.query(
      'INSERT INTO users (username, password, real_name, phone, role) VALUES (?, ?, ?, ?, ?)',
      [form.username, form.password || '123456', form.real_name, form.phone, form.role]
    )
  }
  if (r.success) {
    ElMessage.success('保存成功')
    editVisible.value = false
    loadList()
  } else {
    ElMessage.error('保存失败：' + r.error)
  }
}

async function resetPwd(row) {
  try {
    await ElMessageBox.confirm(`确定将用户 ${row.username} 的密码重置为 123456 吗？`, '重置密码', { type: 'warning' })
    const r = await db.query('UPDATE users SET password = ? WHERE id = ?', ['123456', row.id])
    if (r.success) ElMessage.success('密码已重置为 123456')
  } catch {}
}

async function deleteUser(row) {
  try {
    await ElMessageBox.confirm(`确定删除用户 ${row.username} 吗？`, '删除用户', { type: 'warning' })
    const r = await db.query('DELETE FROM users WHERE id = ?', [row.id])
    if (r.success) {
      ElMessage.success('已删除')
      loadList()
    }
  } catch {}
}

onMounted(loadList)
</script>
