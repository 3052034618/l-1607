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
  
  const r1 = await db.query("SELECT in_time FROM express_orders")
  if (r1.success && r1.data) {
    stats.todayIn = r1.data.filter(x => x.in_time && x.in_time.split(' ')[0] === today).length
  }
  
  const r2 = await db.query("SELECT pickup_time FROM express_orders")
  if (r2.success && r2.data) {
    stats.todayOut = r2.data.filter(x => x.pickup_time && x.pickup_time.split(' ')[0] === today).length
  }
  
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

async function initTrendChart() {
  const chart = echarts.init(trendChart.value)
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().split('T')[0])
  }

  const rAll = await db.query('SELECT in_time, pickup_time FROM express_orders WHERE in_time IS NOT NULL')
  const allOrders = rAll.success && rAll.data ? rAll.data : []
  const inData = days.map(d => allOrders.filter(o => o.in_time && o.in_time.split(' ')[0] === d).length)
  const outData = days.map(d => allOrders.filter(o => o.pickup_time && o.pickup_time.split(' ')[0] === d).length)
  
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['入库', '出库'] },
    grid: { left: 40, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: days.map(d => d.slice(5)) },
    yAxis: { type: 'value' },
    series: [
      { name: '入库', type: 'line', smooth: true, data: inData, itemStyle: { color: '#409eff' } },
      { name: '出库', type: 'line', smooth: true, data: outData, itemStyle: { color: '#67c23a' } }
    ]
  })
}

async function initCompanyChart() {
  const chart = echarts.init(companyChart.value)
  const r = await db.query('SELECT company, COUNT(*) as cnt FROM express_orders WHERE company IS NOT NULL GROUP BY company ORDER BY cnt DESC')
  let data = []
  if (r.success && r.data) {
    data = r.data.map(x => ({ name: x.company, value: x.cnt }))
  }
  if (data.length === 0) {
    data = [{ name: '暂无数据', value: 1 }]
  }
  chart.setOption({
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', right: 10, top: 20 },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: data
    }]
  })
}

async function initLockerChart() {
  const chart = echarts.init(lockerChart.value)
  const r = await db.query("SELECT size, COUNT(*) as cnt FROM lockers WHERE status = 'occupied' GROUP BY size")
  const sizeMap = { small: 0, medium: 0, large: 0, xlarge: 0 }
  if (r.success && r.data) {
    r.data.forEach(x => { sizeMap[x.size] = x.cnt })
  }
  
  chart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ['小号', '中号', '大号', '超大号'] },
    yAxis: { type: 'value' },
    series: [{
      type: 'bar',
      data: [
        { value: sizeMap.small, itemStyle: { color: '#67c23a' } },
        { value: sizeMap.medium, itemStyle: { color: '#e6a23c' } },
        { value: sizeMap.large, itemStyle: { color: '#f56c6c' } },
        { value: sizeMap.xlarge, itemStyle: { color: '#909399' } }
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
