<template>
  <div>
    <h2 class="page-title">财务结算</h2>

    <el-row :gutter="16">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">派费总收入</div>
          <div class="stat-value" style="color: #67c23a;">¥{{ summary.delivery.toFixed(2) }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">超时保管费</div>
          <div class="stat-value" style="color: #e6a23c;">¥{{ summary.storage.toFixed(2) }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">退件费收入</div>
          <div class="stat-value" style="color: #409eff;">¥{{ summary.return.toFixed(2) }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">总营收</div>
          <div class="stat-value" style="color: #f56c6c;">¥{{ summary.total.toFixed(2) }}</div>
        </div>
      </el-col>
    </el-row>

    <el-divider />

    <el-tabs v-model="activeTab">
      <el-tab-pane label="按快递公司汇总" name="company">
        <div class="toolbar">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            @change="loadSummary"
          />
          <el-button type="primary" @click="exportSettlement">
            <el-icon><Download /></el-icon>
            导出对账单
          </el-button>
          <el-button type="success" @click="batchSettle">
            <el-icon><Setting /></el-icon>
            批量结算
          </el-button>
        </div>

        <div class="table-container">
          <el-table :data="companySummary" border stripe show-summary :summary-method="getSummaries">
            <el-table-column prop="company" label="快递公司" width="140" />
            <el-table-column label="派件数" width="100">
              <template #default="{ row }">{{ row.delivery_count }}</template>
            </el-table-column>
            <el-table-column label="派费收入(¥)" prop="delivery_amount" width="130">
              <template #default="{ row }">{{ row.delivery_amount.toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="超时件数" width="100">
              <template #default="{ row }">{{ row.storage_count }}</template>
            </el-table-column>
            <el-table-column label="保管费收入(¥)" prop="storage_amount" width="130">
              <template #default="{ row }">{{ row.storage_amount.toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="退件数" width="90">
              <template #default="{ row }">{{ row.return_count }}</template>
            </el-table-column>
            <el-table-column label="退件费收入(¥)" prop="return_amount" width="130">
              <template #default="{ row }">{{ row.return_amount.toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="合计(¥)" width="120">
              <template #default="{ row }">
                <span style="font-weight: 700; color: #f56c6c;">¥{{ (row.delivery_amount + row.storage_amount + row.return_amount).toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="已结算" width="90">
              <template #default="{ row }">
                <el-tag size="small" :type="row.settled ? 'success' : 'warning'">{{ row.settled ? '是' : '否' }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane label="收支明细" name="detail">
        <div class="toolbar">
          <el-select v-model="typeFilter" placeholder="收支类型" clearable style="width: 140px;" @change="loadRecords">
            <el-option label="派费收入" value="delivery" />
            <el-option label="保管费收入" value="storage" />
            <el-option label="退件费收入" value="return_fee" />
          </el-select>
          <el-input v-model="searchKey" placeholder="运单号搜索" clearable style="width: 200px;" @input="loadRecords" />
          <el-date-picker v-model="detailDate" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" @change="loadRecords" />
        </div>

        <div class="table-container">
          <el-table :data="records" border stripe>
            <el-table-column prop="created_at" label="时间" width="170">
              <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="类型" width="120">
              <template #default="{ row }">
                <el-tag v-if="row.type === 'delivery'" size="small" type="success">派费收入</el-tag>
                <el-tag v-else-if="row.type === 'storage'" size="small" type="warning">保管费</el-tag>
                <el-tag v-else size="small" type="primary">退件费</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="company" label="快递公司" width="120" />
            <el-table-column prop="order_id" label="关联单号" width="100" />
            <el-table-column prop="description" label="说明" />
            <el-table-column label="金额(¥)" width="110">
              <template #default="{ row }">
                <span style="color: #67c23a; font-weight: 600;">+{{ row.amount.toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag v-if="row.settled" size="small" type="success">已结算</el-tag>
                <el-tag v-else size="small" type="info">待结算</el-tag>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            style="margin-top: 16px; justify-content: flex-end; display: flex;"
            v-model:current-page="page"
            v-model:page-size="pageSize"
            :total="total"
            layout="total, prev, pager, next"
            @current-change="loadRecords"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Setting } from '@element-plus/icons-vue'
import db from '@/api/db'
import { formatDateTime } from '@/utils'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const activeTab = ref('company')
const dateRange = ref([])
const summary = reactive({ delivery: 0, storage: 0, return: 0, total: 0 })
const companySummary = ref([])

const records = ref([])
const typeFilter = ref('')
const searchKey = ref('')
const detailDate = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

async function loadSummary() {
  let where = ['1=1']
  let params = []
  if (dateRange.value && dateRange.value.length === 2) {
    where.push('DATE(created_at) BETWEEN ? AND ?')
    params.push(dateRange.value[0].toISOString().split('T')[0], dateRange.value[1].toISOString().split('T')[0])
  }

  const sql = `SELECT * FROM financial_records WHERE ${where.join(' AND ')}`
  const r = await db.query(sql, params)
  if (r.success && r.data) {
    const map = {}
    for (const item of r.data) {
      const key = item.company || '退件费'
      if (!map[key]) {
        map[key] = {
          company: key, delivery_amount: 0, delivery_count: 0, storage_amount: 0, storage_count: 0, return_amount: 0, return_count: 0, settled: 0 }
      }
      if (item.type === 'delivery') {
        map[key].delivery_amount += Number(item.amount || 0)
        map[key].delivery_count++
      } else if (item.type === 'storage') {
        map[key].storage_amount += Number(item.amount || 0)
        map[key].storage_count++
      } else if (item.type === 'return_fee') {
        map[key].return_amount += Number(item.amount || 0)
        map[key].return_count++
      }
      if (item.settled) map[key].settled = 1
    }
    companySummary.value = Object.values(map).sort((a, b) => a.company.localeCompare(b.company))
    summary.delivery = companySummary.value.reduce((s, x) => s + (x.delivery_amount || 0), 0)
    summary.storage = companySummary.value.reduce((s, x) => s + (x.storage_amount || 0), 0)
    summary.return = companySummary.value.reduce((s, x) => s + (x.return_amount || 0), 0)
    summary.total = summary.delivery + summary.storage + summary.return
  }
}

function getSummaries(param) {
  const { columns, data } = param
  const sums = []
  columns.forEach((column, index) => {
    if (index === 0) {
      sums[index] = '合计'
      return
    }
    const valueKeyMap = { 2: 'delivery_amount', 4: 'storage_amount', 6: 'return_amount' }
    if (valueKeyMap[index]) {
      const values = data.map(item => Number(item[valueKeyMap[index]]))
      sums[index] = values.reduce((prev, curr) => {
        const value = Number(curr)
        if (!isNaN(value)) return prev + curr
        else return prev
      }, 0).toFixed(2)
    } else if (index === 7) {
      const total = data.reduce((s, x) => s + (x.delivery_amount || 0) + (x.storage_amount || 0) + (x.return_amount || 0), 0)
      sums[index] = '¥' + total.toFixed(2)
    } else {
      sums[index] = ''
    }
  })
  return sums
}

async function loadRecords() {
  let where = ['1=1']
  let params = []
  if (typeFilter.value) { where.push('type = ?'); params.push(typeFilter.value) }
  if (searchKey.value.trim()) {
    where.push('(order_id IN (SELECT id FROM express_orders WHERE waybill_no LIKE ?))')
    params.push('%' + searchKey.value.trim() + '%')
  }
  if (detailDate.value && detailDate.value.length === 2) {
    where.push('DATE(created_at) BETWEEN ? AND ?')
    params.push(detailDate.value[0].toISOString().split('T')[0], detailDate.value[1].toISOString().split('T')[0])
  }

  const countSql = `SELECT COUNT(*) as cnt FROM financial_records WHERE ${where.join(' AND ')}`
  const cr = await db.query(countSql, params)
  if (cr.success) total.value = cr.data[0].cnt

  const offset = (page.value - 1) * pageSize.value
  const sql = `SELECT * FROM financial_records WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  params.push(pageSize.value, offset)
  const r = await db.query(sql, params)
  if (r.success) records.value = r.data
}

async function exportSettlement() {
  const doc = new jsPDF()
  doc.setFontSize(18)
  doc.text('财务对账结算单', 105, 22, { align: 'center' })
  doc.setFontSize(10)
  doc.text(`生成日期：${new Date().toLocaleDateString()}`, 14, 32)

  const head = [['快递公司', '派件数', '派费', '超时件', '保管费', '退件数', '退件费', '合计']]
  const body = companySummary.value.map(x => [
    x.company,
    x.delivery_count,
    x.delivery_amount.toFixed(2),
    x.storage_count,
    x.storage_amount.toFixed(2),
    x.return_count,
    x.return_amount.toFixed(2),
    (x.delivery_amount + x.storage_amount + x.return_amount).toFixed(2)
  ])
  body.push([
    '总计',
    companySummary.value.reduce((s, x) => s + x.delivery_count, 0),
    summary.delivery.toFixed(2),
    companySummary.value.reduce((s, x) => s + x.storage_count, 0),
    summary.storage.toFixed(2),
    companySummary.value.reduce((s, x) => s + x.return_count, 0),
    summary.return.toFixed(2),
    summary.total.toFixed(2)
  ])

  autoTable(doc, {
    head, body, startY: 40,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [64, 158, 255] }
  })

  doc.save(`对账单_${new Date().toISOString().split('T')[0]}.pdf`)
  ElMessage.success('导出成功')
}

async function batchSettle() {
  const today = new Date().toISOString().split('T')[0]
  const r = await db.query(
    `UPDATE financial_records SET settled = 1, settlement_date = ? WHERE settled = 0`,
    [today]
  )
  if (r.success) {
    ElMessage.success(`已结算 ${r.data.changes} 条记录`)
    loadSummary()
  }
}

onMounted(async () => {
  await loadSummary()
  await loadRecords()
})
</script>
