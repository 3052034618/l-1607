<template>
  <div>
    <el-row :gutter="16">
      <el-col :span="6">
        <div class="stat-card">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div class="stat-label">今日入库</div>
              <div class="stat-value">{{ stats.todayIn }}</div>
            </div>
            <el-icon class="stat-icon" style="color: #409eff;"><Plus /></el-icon>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div class="stat-label">今日出库</div>
              <div class="stat-value">{{ stats.todayOut }}</div>
            </div>
            <el-icon class="stat-icon" style="color: #67c23a;"><Check /></el-icon>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div class="stat-label">在库包裹</div>
              <div class="stat-value">{{ stats.inStock }}</div>
            </div>
            <el-icon class="stat-icon" style="color: #e6a23c;"><Menu /></el-icon>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div class="stat-label">超时滞留</div>
              <div class="stat-value" style="color: #f56c6c;">{{ stats.overdue }}</div>
            </div>
            <el-icon class="stat-icon" style="color: #f56c6c;"><Warning /></el-icon>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px;">
      <el-col :span="12">
        <div class="chart-card">
          <div class="chart-title">近7天入库出库趋势</div>
          <div ref="trendChart" style="height: 320px;"></div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="chart-card">
          <div class="chart-title">快递公司入库分布</div>
          <div ref="companyChart" style="height: 320px;"></div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px;">
      <el-col :span="12">
        <div class="chart-card">
          <div class="chart-title">格口使用情况</div>
          <div ref="lockerChart" style="height: 260px;"></div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="chart-card">
          <div class="chart-title">最近入库记录</div>
          <el-table :data="recentOrders" size="small">
            <el-table-column prop="waybill_no" label="运单号" width="140" />
            <el-table-column prop="company" label="快递公司" />
            <el-table-column prop="receiver_name" label="收件人" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag size="small" :type="getOrderStatusType(row.status)">{{ getOrderStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import db from '@/api/db'
import { Plus, Check, Menu, Warning } from '@element-plus/icons-vue'
import { getOrderStatusLabel, getOrderStatusType } from '@/utils'

const stats = reactive({
  todayIn: 0,
  todayOut: 0,
  inStock: 0,
  overdue: 0
})
const recentOrders = ref([])
const trendChart = ref(null)
const companyChart = ref(null)
const lockerChart = ref(null)

async function loadStats() {
  const today = new Date().toISOString().split('T')[0]
  
  const r1 = await db.query("SELECT COUNT(*) as cnt FROM express_orders WHERE DATE(in_time) = ?", [today])
  if (r1.success && r1.data && r1.data.length > 0) stats.todayIn = r1.data[0].cnt || 0
  
  const r2 = await db.query("SELECT COUNT(*) as cnt FROM express_orders WHERE DATE(pickup_time) = ?", [today])
  if (r2.success && r2.data && r2.data.length > 0) stats.todayOut = r2.data[0].cnt || 0
  
  const r3 = await db.query("SELECT COUNT(*) as cnt FROM express_orders WHERE status = 'arrived'")
  if (r3.success && r3.data && r3.data.length > 0) stats.inStock = r3.data[0].cnt || 0
  
  const r4 = await db.query("SELECT in_time FROM express_orders WHERE status = 'arrived' AND in_time IS NOT NULL")
  if (r4.success && r4.data) {
    const now = new Date()
    stats.overdue = r4.data.filter(x => {
      const diffHrs = (now - new Date(x.in_time)) / (1000 * 60 * 60)
      return diffHrs > 48
    }).length
  }

  const r5 = await db.query("SELECT * FROM express_orders ORDER BY created_at DESC LIMIT 8")
  if (r5.success && r5.data) recentOrders.value = r5.data
}

function initTrendChart() {
  const chart = echarts.init(trendChart.value)
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().split('T')[0])
  }
  
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['入库', '出库'] },
    grid: { left: 40, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: days },
    yAxis: { type: 'value' },
    series: [
      { name: '入库', type: 'line', smooth: true, data: [12, 18, 25, 22, 30, 28, 35], itemStyle: { color: '#409eff' } },
      { name: '出库', type: 'line', smooth: true, data: [10, 15, 20, 24, 28, 25, 30], itemStyle: { color: '#67c23a' } }
    ]
  })
}

function initCompanyChart() {
  const chart = echarts.init(companyChart.value)
  chart.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: [
        { value: 35, name: '顺丰速运' },
        { value: 28, name: '圆通速递' },
        { value: 25, name: '中通快递' },
        { value: 20, name: '韵达快递' },
        { value: 15, name: '其他' }
      ]
    }]
  })
}

function initLockerChart() {
  const chart = echarts.init(lockerChart.value)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ['小号', '中号', '大号', '超大号'] },
    yAxis: { type: 'value' },
    series: [{
      type: 'bar',
      data: [
        { value: 8, itemStyle: { color: '#67c23a' } },
        { value: 14, itemStyle: { color: '#e6a23c' } },
        { value: 10, itemStyle: { color: '#f56c6c' } },
        { value: 5, itemStyle: { color: '#909399' } }
      ],
      label: { show: true, position: 'top' }
    }]
  })
}

onMounted(async () => {
  await loadStats()
  await nextTick()
  initTrendChart()
  initCompanyChart()
  initLockerChart()
})
</script>
