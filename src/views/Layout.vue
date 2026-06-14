<template>
  <el-container class="main-layout">
    <el-aside :width="collapsed ? '64px' : '220px'">
      <div style="height: 60px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 16px; font-weight: 600; border-bottom: 1px solid #1f2d3d;">
        <span v-show="!collapsed">驿站调度系统</span>
        <span v-show="collapsed">驿站</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        background-color="#001529"
        text-color="#b8c4cf"
        active-text-color="#409eff"
        router
        :collapse="collapsed"
      >
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="layout-header">
        <div style="display: flex; align-items: center; gap: 16px;">
          <el-button :icon="collapsed ? ArrowRight : ArrowLeft" circle @click="collapsed = !collapsed" />
          <span style="font-size: 16px; font-weight: 600;">{{ currentTitle }}</span>
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
              <el-avatar :size="32">{{ userStore.user?.real_name?.charAt(0) }}</el-avatar>
              <span>{{ userStore.user?.real_name }}</span>
              <el-tag size="small" :type="getRoleType(userStore.user?.role)">{{ getRoleLabel(userStore.user?.role) }}</el-tag>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人中心</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, ArrowRight, Setting, Menu, Refresh, Warning, User } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/user'
import { getRoleLabel, getRoleType } from '@/utils'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const collapsed = ref(false)

const allMenus = [
  { path: '/dashboard', title: '首页概览', icon: 'Menu', roles: ['admin', 'courier', 'user'] },
  { path: '/scan-in', title: '扫描入库', icon: 'Plus', roles: ['admin', 'courier'] },
  { path: '/pickup', title: '取件核验', icon: 'Check', roles: ['admin', 'courier', 'user'] },
  { path: '/orders', title: '运单管理', icon: 'Search', roles: ['admin', 'courier', 'user'] },
  { path: '/lockers', title: '格口管理', icon: 'Menu', roles: ['admin', 'courier'] },
  { path: '/return', title: '退件管理', icon: 'Refresh', roles: ['admin', 'courier', 'user'] },
  { path: '/finance', title: '财务结算', icon: 'Setting', roles: ['admin'] },
  { path: '/reports', title: '统计报表', icon: 'Download', roles: ['admin'] },
  { path: '/workorders', title: '异常工单', icon: 'Warning', roles: ['admin'] },
  { path: '/users', title: '用户管理', icon: 'User', roles: ['admin'] }
]

const menuItems = computed(() => {
  return allMenus.filter(m => m.roles.includes(userStore.user?.role))
})

const activeMenu = computed(() => route.path)

const currentTitle = computed(() => route.meta.title || '')

function handleCommand(cmd) {
  if (cmd === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', { type: 'warning' }).then(() => {
      userStore.logout()
      router.push('/login')
      ElMessage.success('已退出登录')
    }).catch(() => {})
  }
}
</script>
