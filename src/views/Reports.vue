<template>
  <div>
    <h2 class="page-title">统计报表</h2>

    <div class="toolbar">
      <el-radio-group v-model="reportType" size="large">
        <el-radio-button value="daily">日报</el-radio-button>
        <el-radio-button value="monthly">月报</el-radio-button>
      </el-radio-group>
      <el-date-picker
        v-model="reportDate"
        :type="reportType === 'monthly' ? 'month' : 'date'"
        :placeholder="reportType === 'monthly' ? '选择月份' : '选择日期'"
        size="large"
        @change="loadReport"
      />
      <el-button type="primary" size="large" @click="loadReport">
        <el-icon><Search /></el-icon>
        查询
      </el-button>
      <el-button type="success" size="large" @click="exportPDF">
        <el-icon><Download /></el-icon>
        导出PDF报表
      </el-button>
    </div>

    <el-row :gutter="16">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">入库总量</div>
          <div class="stat-value" style="color: #409eff;">{{ stats.inCount }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">出库总量</div>
          <div class="stat-value" style="color: #67c23a;">{{ stats.outCount }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">滞留件数</div>
          <div class="stat-value" style="color: #e6a23c;">{{ stats.stayCount }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">超时率</div>
          <div class="stat-value" style="color: #f56c6c;">{{ stats.overdueRate }}%</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px;">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">滞留率</div>
          <div class="stat-value">{{ stats.stayRate }}%</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">平均取件时长</div>
          <div class="stat-value">{{ stats.avgPickupHours }}h</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">派费收入</div>
          <div class="stat-value" style="color: #67c23a;">¥{{ stats.deliveryFee }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">总营收</div>
          <div class="stat-value" style="color: #f56c6c;">¥{{ stats.totalRevenue }}</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px;">
      <el-col :span="12">
        <div class="chart-card">
          <div class="chart-title">{{ reportType === 'monthly' ? '月度' : '每日' }}出入库趋势</div>
          <div ref="trendChart" style="height: 340px;"></div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="chart-card">
          <div class="chart-title">快递公司业务占比</div>
          <div ref="pieChart" style="height: 340px;"></div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px;">
      <el-col :span="12">
        <div class="chart-card">
          <div class="chart-title">包裹尺寸分布</div>
          <div ref="sizeChart" style="height: 300px;"></div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="chart-card">
          <div class="chart-title">超时率与滞留率对比</div>
          <div ref="rateChart" style="height: 300px;"></div>
        </div>
      </el-col>
    </el-row>

    <el-divider />

    <div class="table-container">
      <h3 style="font-size: 16px; margin-bottom: 16px;">快递公司详细统计</h3>
      <el-table :data="companyStats" border stripe show-summary :summary-method="getSummaries">
        <el-table-column prop="company" label="快递公司" width="140" />
        <el-table-column label="入库量" width="100">
          <template #default="{ row }">{{ row.in_count }}</template>
        </el-table-column>
        <el-table-column label="出库量" width="100">
          <template #default="{ row }">{{ row.out_count }}</template>
        </el-table-column>
        <el-table-column label="在库量" width="100">
          <template #default="{ row }">{{ row.stay_count }}</template>
        </el-table-column>
        <el-table-column label="超时件" width="100">
          <template #default="{ row }">{{ row.overdue_count }}</template>
        </el-table-column>
        <el-table-column label="超时率(%)" width="100">
          <template #default="{ row }">
            <span :style="{ color: row.overdue_rate > 10 ? '#f56c6c' : '#67c23a' }">
              {{ row.overdue_rate.toFixed(1) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="滞留率(%)" width="100">
          <template #default="{ row }">{{ row.stay_rate.toFixed(1) }}</template>
        </el-table-column>
        <el-table-column label="营收(¥)" width="120">
          <template #default="{ row }">
            <span style="color: #67c23a; font-weight: 600;">{{ row.revenue.toFixed(2) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import { Search, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import db from '@/api/db'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const reportType = ref('monthly')
const reportDate = ref(new Date())
const stats = reactive({
  inCount: 0, outCount: 0, stayCount: 0, overdueRate: 0,
  stayRate: 0, avgPickupHours: 0, deliveryFee: 0, totalRevenue: 0
})
const companyStats = ref([])
const sizeStats = reactive({ small: 0, medium: 0, large: 0, xlarge: 0 })
const trendData = reactive({ inData: [], outData: [] })

const trendChart = ref(null)
const pieChart = ref(null)
const sizeChart = ref(null)
const rateChart = ref(null)

let trendChartInst = null, pieChartInst = null, sizeChartInst = null, rateChartInst = null

function getSummaries(param) {
  const { columns, data } = param
  const sums = []
  columns.forEach((column, index) => {
    if (index === 0) { sums[index] = '合计'; return }
    const keys = { 1: 'in_count', 2: 'out_count', 3: 'stay_count', 4: 'overdue_count', 7: 'revenue' }
    if (keys[index]) {
      sums[index] = data.reduce((s, x) => s + (Number(x[keys[index]]) || 0), 0)
      if (keys[index] === 'revenue') sums[index] = sums[index].toFixed(2)
    } else if (index === 5) {
      const total = data.reduce((s, x) => s + x.in_count, 0)
      const overdue = data.reduce((s, x) => s + x.overdue_count, 0)
      sums[index] = total ? ((overdue / total) * 100).toFixed(1) + '%' : '0%'
    } else if (index === 6) {
      const total = data.reduce((s, x) => s + x.in_count, 0)
      const stay = data.reduce((s, x) => s + x.stay_count, 0)
      sums[index] = total ? ((stay / total) * 100).toFixed(1) + '%' : '0%'
    } else {
      sums[index] = ''
    }
  })
  return sums
}

function initCharts() {
  if (trendChart.value && !trendChartInst) trendChartInst = echarts.init(trendChart.value)
  if (pieChart.value && !pieChartInst) pieChartInst = echarts.init(pieChart.value)
  if (sizeChart.value && !sizeChartInst) sizeChartInst = echarts.init(sizeChart.value)
  if (rateChart.value && !rateChartInst) rateChartInst = echarts.init(rateChart.value)
}

async function loadReport() {
  initCharts()
  
  let dateStart, dateEnd, xLabels = []
  if (reportType.value === 'monthly') {
    const d = new Date(reportDate.value)
    const year = d.getFullYear()
    const month = d.getMonth()
    dateStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    dateEnd = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`
    for (let i = 1; i <= lastDay; i++) xLabels.push(`${i}日`)
  } else {
    const d = new Date(reportDate.value)
    const dateStr = d.toISOString().split('T')[0]
    dateStart = dateStr
    dateEnd = dateStr
    for (let i = 0; i < 24; i++) xLabels.push(`${i}时`)
  }

  const inRange = (dateStr) => {
    if (!dateStr) return false
    const d = dateStr.split(' ')[0]
    return d >= dateStart && d <= dateEnd
  }
  const hoursDiff = (t1, t2) => {
    if (!t1 || !t2) return 0
    return (new Date(t2) - new Date(t1)) / (1000 * 60 * 60)
  }
  const isOverdue = (inTime) => {
    if (!inTime) return false
    return hoursDiff(inTime, new Date().toISOString()) > 48
  }

  const ordersSQL = `SELECT * FROM express_orders WHERE company IS NOT NULL`
  const rOrders = await db.query(ordersSQL)
  const orders = rOrders.success && rOrders.data ? rOrders.data : []

  let inCount = 0, outCount = 0, overdueCount = 0, totalHours = 0, pickedCount = 0
  for (const o of orders) {
    if (inRange(o.in_time)) inCount++
    if (inRange(o.pickup_time)) {
      outCount++
      const h = hoursDiff(o.in_time, o.pickup_time)
      if (h > 0) { totalHours += h; pickedCount++ }
    }
    if (o.status === 'arrived' && isOverdue(o.in_time)) overdueCount++
  }

  stats.inCount = inCount
  stats.outCount = outCount
  stats.stayCount = Math.max(0, inCount - outCount)
  stats.stayRate = inCount ? ((stats.stayCount / inCount) * 100).toFixed(1) : 0
  stats.overdueRate = inCount ? ((overdueCount / inCount) * 100).toFixed(1) : 0
  stats.avgPickupHours = pickedCount ? (totalHours / pickedCount).toFixed(1) : 0

  const finSQL = `SELECT * FROM financial_records WHERE DATE(created_at) BETWEEN ? AND ?`
  const rFin = await db.query(finSQL, [dateStart, dateEnd])
  const finRecords = rFin.success && rFin.data ? rFin.data : []
  let deliveryFee = 0, totalRevenue = 0
  for (const f of finRecords) {
    if (f.type === 'delivery') deliveryFee += Number(f.amount || 0)
    totalRevenue += Number(f.amount || 0)
  }
  stats.deliveryFee = deliveryFee.toFixed(2)
  stats.totalRevenue = totalRevenue.toFixed(2)

  const companyMap = {}
  for (const o of orders) {
    const key = o.company
    if (!companyMap[key]) companyMap[key] = { company: key, in_count: 0, out_count: 0, stay_count: 0, overdue_count: 0, revenue: 0 }
    if (inRange(o.in_time)) companyMap[key].in_count++
    if (inRange(o.pickup_time)) companyMap[key].out_count++
    if (o.status === 'arrived') companyMap[key].stay_count++
    if (o.status === 'arrived' && isOverdue(o.in_time)) companyMap[key].overdue_count++
  }
  for (const f of finRecords) {
    if (f.company && companyMap[f.company]) {
      companyMap[f.company].revenue += Number(f.amount || 0)
    }
  }
  companyStats.value = Object.values(companyMap)
    .sort((a, b) => b.in_count - a.in_count)
    .map(x => ({
      ...x,
      overdue_rate: x.in_count ? (x.overdue_count / x.in_count) * 100 : 0,
      stay_rate: x.in_count ? (x.stay_count / x.in_count) * 100 : 0
    }))

  trendData.inData = xLabels.map((_, idx) => {
    if (reportType.value === 'monthly') {
      const dayStr = dateStart.slice(0, 8) + String(idx + 1).padStart(2, '0')
      return orders.filter(o => inRange(o.in_time) && o.in_time && o.in_time.split(' ')[0] === dayStr).length
    } else {
      return orders.filter(o => inRange(o.in_time) && o.in_time && parseInt(o.in_time.split(' ')[1] || '0') === idx).length
    }
  })
  trendData.outData = xLabels.map((_, idx) => {
    if (reportType.value === 'monthly') {
      const dayStr = dateStart.slice(0, 8) + String(idx + 1).padStart(2, '0')
      return orders.filter(o => inRange(o.pickup_time) && o.pickup_time && o.pickup_time.split(' ')[0] === dayStr).length
    } else {
      return orders.filter(o => inRange(o.pickup_time) && o.pickup_time && parseInt(o.pickup_time.split(' ')[1] || '0') === idx).length
    }
  })

  sizeStats.small = orders.filter(o => inRange(o.in_time) && o.size === 'small').length
  sizeStats.medium = orders.filter(o => inRange(o.in_time) && o.size === 'medium').length
  sizeStats.large = orders.filter(o => inRange(o.in_time) && o.size === 'large').length
  sizeStats.xlarge = orders.filter(o => inRange(o.in_time) && o.size === 'xlarge').length

  renderCharts(xLabels)
}

function renderCharts(xLabels) {
  const inData = trendData.inData.length > 0 ? trendData.inData : xLabels.map(() => 0)
  const outData = trendData.outData.length > 0 ? trendData.outData : xLabels.map(() => 0)
  trendChartInst?.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['入库', '出库'] },
    grid: { left: 40, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: xLabels },
    yAxis: { type: 'value' },
    series: [
      { name: '入库', type: 'bar', data: inData, itemStyle: { color: '#409eff' } },
      { name: '出库', type: 'bar', data: outData, itemStyle: { color: '#67c23a' } }
    ]
  })

  pieChartInst?.setOption({
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', right: 10, top: 20 },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['40%', '50%'],
      data: companyStats.value.length > 0
        ? companyStats.value.map(x => ({ name: x.company, value: x.in_count }))
        : [{ name: '暂无数据', value: 1 }]
    }]
  })

  sizeChartInst?.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ['小号', '中号', '大号', '超大号'] },
    yAxis: { type: 'value' },
    series: [{
      type: 'bar',
      data: [
        { value: sizeStats.small || 0, itemStyle: { color: '#67c23a' } },
        { value: sizeStats.medium || 0, itemStyle: { color: '#409eff' } },
        { value: sizeStats.large || 0, itemStyle: { color: '#e6a23c' } },
        { value: sizeStats.xlarge || 0, itemStyle: { color: '#f56c6c' } }
      ],
      label: { show: true, position: 'top' }
    }]
  })

  const validCompanies = companyStats.value.filter(x => x.company)
  rateChartInst?.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: validCompanies.length > 0 ? validCompanies.map(x => x.company) : ['暂无数据'] },
    yAxis: { type: 'value', axisLabel: { formatter: '{value}%' }, max: 100 },
    series: [
      { name: '超时率', type: 'line', smooth: true,
        data: validCompanies.length > 0 ? validCompanies.map(x => Number(x.overdue_rate.toFixed(1))) : [0],
        itemStyle: { color: '#f56c6c' } },
      { name: '滞留率', type: 'line', smooth: true,
        data: validCompanies.length > 0 ? validCompanies.map(x => Number(x.stay_rate.toFixed(1))) : [0],
        itemStyle: { color: '#e6a23c' } }
    ],
    legend: { data: ['超时率', '滞留率'], top: 0 }
  })
}

function exportPDF() {
  const doc = new jsPDF()
  doc.setFontSize(20)
  doc.text(`${reportType.value === 'monthly' ? '月度' : '每日'}运营分析报表`, 105, 20, { align: 'center' })
  doc.setFontSize(11)
  const dateStr = typeof reportDate.value === 'string' ? reportDate.value : new Date(reportDate.value).toLocaleDateString()
  doc.text(`统计周期：${dateStr}`, 14, 32)
  doc.text(`生成时间：${new Date().toLocaleString()}`, 14, 40)

  doc.setFontSize(12)
  doc.text('一、核心运营指标', 14, 52)
  autoTable(doc, {
    startY: 58,
    head: [['指标', '数值', '指标', '数值']],
    body: [
      ['入库总量', stats.inCount, '出库总量', stats.outCount],
      ['滞留件数', stats.stayCount, '超时率', stats.overdueRate + '%'],
      ['滞留率', stats.stayRate + '%', '平均取件时长', stats.avgPickupHours + 'h'],
      ['派费收入', '¥' + stats.deliveryFee, '总营收', '¥' + stats.totalRevenue]
    ],
    headStyles: { fillColor: [64, 158, 255] }
  })

  const finalY = (doc.lastAutoTable?.finalY || 120) + 10
  doc.text('二、快递公司统计明细', 14, finalY)
  autoTable(doc, {
    startY: finalY + 6,
    head: [['快递公司', '入库', '出库', '在库', '超时', '超时率%', '滞留率%', '营收¥']],
    body: companyStats.value.map(x => [
      x.company, x.in_count, x.out_count, x.stay_count, x.overdue_count,
      x.overdue_rate.toFixed(1), x.stay_rate.toFixed(1), x.revenue.toFixed(2)
    ]),
    headStyles: { fillColor: [103, 194, 58] }
  })

  doc.save(`运营报表_${dateStr.replace(/\//g, '-')}.pdf`)
  ElMessage.success('PDF报表导出成功')
}

onMounted(async () => {
  await nextTick()
  loadReport()
})
</script>
