<template>
  <div>
    <h2 class="page-title">扫描入库</h2>

    <el-row :gutter="16">
      <el-col :span="14">
        <div class="table-container">
          <el-form :model="form" label-width="100px">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="运单号">
                  <el-input v-model="form.waybillNo" placeholder="请扫描或输入运单号" size="large" ref="waybillInput">
                    <template #append>
                      <el-button type="primary" @click="scanCode" :loading="scanning">
                        {{ scanning ? '模拟扫描中...' : '模拟扫描' }}
                      </el-button>
                    </template>
                  </el-input>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="快递公司">
                  <el-select v-model="form.company" placeholder="请选择" size="large" style="width: 100%">
                    <el-option label="顺丰速运" value="顺丰速运" />
                    <el-option label="圆通速递" value="圆通速递" />
                    <el-option label="中通快递" value="中通快递" />
                    <el-option label="韵达快递" value="韵达快递" />
                    <el-option label="申通快递" value="申通快递" />
                    <el-option label="京东物流" value="京东物流" />
                    <el-option label="极兔速递" value="极兔速递" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="8">
                <el-form-item label="收件人">
                  <el-input v-model="form.receiverName" placeholder="收件人姓名" size="large" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="联系电话">
                  <el-input v-model="form.receiverPhone" placeholder="收件人手机号" size="large" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="收件地址">
                  <el-input v-model="form.receiverAddress" placeholder="收件地址" size="large" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="8">
                <el-form-item label="包裹尺寸">
                  <el-radio-group v-model="form.size" size="large">
                    <el-radio-button value="small">小号</el-radio-button>
                    <el-radio-button value="medium">中号</el-radio-button>
                    <el-radio-button value="large">大号</el-radio-button>
                    <el-radio-button value="xlarge">超大</el-radio-button>
                  </el-radio-group>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="是否冷藏">
                  <el-switch v-model="form.refrigerated" size="large" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="包裹重量(kg)">
                  <el-input-number v-model="form.weight" :min="0" :precision="2" size="large" style="width: 100%" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item>
              <el-button type="primary" size="large" @click="autoAssign" :loading="assigning">
                <el-icon><Search /></el-icon>
                智能分配格口
              </el-button>
              <el-button type="success" size="large" @click="confirmInbound" :disabled="!form.lockerId" :loading="inbounding">
                <el-icon><Check /></el-icon>
                确认入库
              </el-button>
              <el-button size="large" @click="resetForm">
                <el-icon><Refresh /></el-icon>
                重置
              </el-button>
            </el-form-item>
          </el-form>

          <el-divider />

          <div v-if="assignedLocker">
            <el-alert type="success" show-icon :closable="false">
              <template #title>
                <div style="display: flex; align-items: center; gap: 24px;">
                  <div>
                    <strong>已分配格口：</strong>
                    <el-tag size="large" type="success" effect="dark" style="margin-left: 8px;">
                      {{ assignedLocker.zone }} - {{ assignedLocker.code }} ({{ getSizeLabel(assignedLocker.size) }})
                    </el-tag>
                  </div>
                  <div v-if="assignedLocker.type === 'refrigerated'">
                    <el-tag size="large" type="primary" effect="dark">
                      ❄ 冷藏柜
                    </el-tag>
                  </div>
                  <div>
                    <strong>取件码：</strong>
                    <el-tag size="large" type="warning" effect="dark" style="margin-left: 8px; letter-spacing: 4px; font-weight: 700;">
                      {{ form.pickupCode }}
                    </el-tag>
                  </div>
                </div>
              </template>
            </el-alert>
          </div>
        </div>
      </el-col>

      <el-col :span="10">
        <div class="table-container">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="font-size: 16px;">格口实时状态</h3>
            <el-radio-group v-model="filterType" size="small">
              <el-radio-button value="all">全部</el-radio-button>
              <el-radio-button value="normal">普通</el-radio-button>
              <el-radio-button value="refrigerated">冷藏</el-radio-button>
            </el-radio-group>
          </div>
          <div class="locker-grid">
            <div
              v-for="locker in filteredLockers"
              :key="locker.id"
              class="locker-cell"
              :class="getLockerClass(locker)"
              @click="selectLocker(locker)"
            >
              <div style="font-weight: 600;">{{ locker.code }}</div>
              <div style="font-size: 10px; margin-top: 2px;">{{ getSizeLabel(locker.size) }}</div>
              <div style="font-size: 10px;">{{ locker.status === 'empty' ? '空闲' : '占用' }}</div>
            </div>
          </div>
          <div style="display: flex; gap: 16px; margin-top: 16px; font-size: 12px;">
            <span><span style="display: inline-block; width: 12px; height: 12px; background: #f0f9eb; border: 2px solid #e1f3d8; vertical-align: middle;"></span> 空闲</span>
            <span><span style="display: inline-block; width: 12px; height: 12px; background: #fdf6ec; border: 2px solid #faecd8; vertical-align: middle;"></span> 占用</span>
            <span><span style="display: inline-block; width: 12px; height: 12px; background: #ecf5ff; border: 2px solid #d9ecff; vertical-align: middle;"></span> 冷藏</span>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-divider />

    <div class="table-container">
      <h3 style="font-size: 16px; margin-bottom: 16px;">今日入库记录</h3>
      <el-table :data="todayList" border stripe>
        <el-table-column prop="waybill_no" label="运单号" width="160" />
        <el-table-column prop="company" label="快递公司" width="110" />
        <el-table-column prop="receiver_name" label="收件人" width="100" />
        <el-table-column prop="receiver_phone" label="电话" width="120" />
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
            <span>{{ row.zone ? row.zone + ' - ' + row.locker_code : '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="pickup_code" label="取件码" width="100">
          <template #default="{ row }">
            <span style="letter-spacing: 2px; font-weight: 600;">{{ row.pickup_code }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="getOrderStatusType(row.status)">{{ getOrderStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="in_time" label="入库时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.in_time) }}</template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { Search, Check, Refresh } from '@element-plus/icons-vue'
import db from '@/api/db'
import { generatePickupCode, getSizeLabel, getSizeType, getOrderStatusLabel, getOrderStatusType, formatDateTime, generateWaybillNo } from '@/utils'

const form = reactive({
  waybillNo: '',
  company: '顺丰速运',
  receiverName: '',
  receiverPhone: '',
  receiverAddress: '',
  size: 'medium',
  refrigerated: false,
  weight: 1,
  lockerId: null,
  pickupCode: ''
})

const scanning = ref(false)
const assigning = ref(false)
const inbounding = ref(false)
const assignedLocker = ref(null)
const lockers = ref([])
const todayList = ref([])
const filterType = ref('all')
const waybillInput = ref(null)

const filteredLockers = computed(() => {
  if (filterType.value === 'all') return lockers.value
  return lockers.value.filter(l => l.type === filterType.value)
})

function getLockerClass(locker) {
  if (locker.type === 'refrigerated' && locker.status === 'empty') return 'locker-refrigerated'
  if (locker.status === 'empty') return 'locker-empty'
  return 'locker-occupied'
}

async function loadLockers() {
  const r = await db.query('SELECT * FROM lockers ORDER BY code')
  if (r.success) lockers.value = r.data
}

async function loadTodayList() {
  const today = new Date().toISOString().split('T')[0]
  const r = await db.query(`
    SELECT o.*, l.code as locker_code, l.zone 
    FROM express_orders o 
    LEFT JOIN lockers l ON o.locker_id = l.id 
    ORDER BY o.in_time DESC
  `)
  if (r.success && r.data) {
    todayList.value = r.data.filter(x => x.in_time && x.in_time.split(' ')[0] === today)
  }
}

async function scanCode() {
  scanning.value = true
  setTimeout(() => {
    form.waybillNo = generateWaybillNo()
    form.receiverName = '测试用户' + Math.floor(Math.random() * 100)
    form.receiverPhone = '139' + Math.floor(10000000 + Math.random() * 89999999)
    form.receiverAddress = '测试地址XX街道XX号'
    form.size = ['small', 'medium', 'large', 'xlarge'][Math.floor(Math.random() * 4)]
    form.refrigerated = Math.random() > 0.8
    scanning.value = false
    ElMessage.success('扫描成功')
    nextTick(() => waybillInput.value?.focus())
  }, 800)
}

async function autoAssign() {
  if (!form.waybillNo) {
    ElMessage.warning('请先扫描或输入运单号')
    return
  }
  assigning.value = true
  
  try {
    const sizeOrder = { small: 0, medium: 1, large: 2, xlarge: 3 }
    const targetSize = sizeOrder[form.size]
    
    const emptyLockers = lockers.value.filter(l => {
      if (l.status !== 'empty') return false
      if (form.refrigerated && l.type !== 'refrigerated') return false
      if (!form.refrigerated && l.type === 'refrigerated') return false
      return true
    })
    
    const sortedLockers = emptyLockers.sort((a, b) => {
      const sa = sizeOrder[a.size]
      const sb = sizeOrder[b.size]
      return Math.abs(sa - targetSize) - Math.abs(sb - targetSize)
    })
    
    if (sortedLockers.length === 0) {
      ElMessage.error('没有可用的格口，请先释放空间或调整筛选条件')
      assigning.value = false
      return
    }
    
    assignedLocker.value = sortedLockers[0]
    form.lockerId = sortedLockers[0].id
    form.pickupCode = generatePickupCode()
    
    ElNotification({
      title: '智能分配成功',
      message: `已为您分配最佳格口 ${sortedLockers[0].code}`,
      type: 'success',
      duration: 2500
    })
  } catch (e) {
    ElMessage.error('分配失败：' + e.message)
  } finally {
    assigning.value = false
  }
}

function selectLocker(locker) {
  if (locker.status !== 'empty') {
    ElMessage.warning('该格口已被占用')
    return
  }
  if (form.refrigerated && locker.type !== 'refrigerated') {
    ElMessage.warning('冷藏包裹必须放入冷藏格口')
    return
  }
  assignedLocker.value = locker
  form.lockerId = locker.id
  if (!form.pickupCode) form.pickupCode = generatePickupCode()
  ElMessage.success(`已选择格口 ${locker.code}`)
}

async function confirmInbound() {
  if (!form.waybillNo || !form.lockerId || !form.pickupCode) {
    ElMessage.warning('请完成所有必要信息')
    return
  }
  inbounding.value = true
  
  try {
    const check = await db.query('SELECT id FROM express_orders WHERE waybill_no = ?', [form.waybillNo])
    if (check.success && check.data.length > 0) {
      ElMessage.error('该运单号已存在')
      inbounding.value = false
      return
    }
    
    const insertResult = await db.query(`
      INSERT INTO express_orders 
      (waybill_no, company, receiver_name, receiver_phone, receiver_address, size, refrigerated, weight, locker_id, pickup_code, status, in_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'arrived', datetime('now'))
    `, [
      form.waybillNo, form.company, form.receiverName, form.receiverPhone, form.receiverAddress,
      form.size, form.refrigerated ? 1 : 0, form.weight, form.lockerId, form.pickupCode
    ])
    
    if (insertResult.success) {
      await db.query("UPDATE lockers SET status = 'occupied' WHERE id = ?", [form.lockerId])
      
      await db.query(`
        INSERT INTO notifications (order_id, phone, content, type)
        VALUES (?, ?, ?, 'pickup')
      `, [insertResult.data.lastInsertRowid, form.receiverPhone, 
          `【驿站通知】您的包裹${form.waybillNo}已到达${assignedLocker.value.zone}${assignedLocker.value.code}，取件码${form.pickupCode}，请及时取件！`])
      
      await db.query(`
        INSERT INTO financial_records (order_id, type, company, amount, description)
        VALUES (?, 'delivery', ?, 1.5, '派费收入')
      `, [insertResult.data.lastInsertRowid, form.company])
      
      ElNotification({
        title: '入库成功',
        message: `取件码已模拟推送至 ${form.receiverPhone}`,
        type: 'success'
      })
      
      await loadLockers()
      await loadTodayList()
      resetForm()
    } else {
      ElMessage.error('入库失败：' + insertResult.error)
    }
  } catch (e) {
    ElMessage.error('操作异常：' + e.message)
  } finally {
    inbounding.value = false
  }
}

function resetForm() {
  form.waybillNo = ''
  form.company = '顺丰速运'
  form.receiverName = ''
  form.receiverPhone = ''
  form.receiverAddress = ''
  form.size = 'medium'
  form.refrigerated = false
  form.weight = 1
  form.lockerId = null
  form.pickupCode = ''
  assignedLocker.value = null
}

onMounted(async () => {
  await loadLockers()
  await loadTodayList()
})
</script>
