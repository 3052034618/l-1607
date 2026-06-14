import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '@/store/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    meta: { requiresAuth: true },
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '首页概览', icon: 'HomeFilled' }
      },
      {
        path: 'scan-in',
        name: 'ScanIn',
        component: () => import('@/views/ScanIn.vue'),
        meta: { title: '扫描入库', icon: 'Box', roles: ['admin', 'courier'] }
      },
      {
        path: 'pickup',
        name: 'Pickup',
        component: () => import('@/views/Pickup.vue'),
        meta: { title: '取件核验', icon: 'Tickets' }
      },
      {
        path: 'orders',
        name: 'Orders',
        component: () => import('@/views/Orders.vue'),
        meta: { title: '运单管理', icon: 'Document' }
      },
      {
        path: 'lockers',
        name: 'Lockers',
        component: () => import('@/views/Lockers.vue'),
        meta: { title: '格口管理', icon: 'Grid' }
      },
      {
        path: 'return',
        name: 'Return',
        component: () => import('@/views/Return.vue'),
        meta: { title: '退件管理', icon: 'RefreshLeft' }
      },
      {
        path: 'finance',
        name: 'Finance',
        component: () => import('@/views/Finance.vue'),
        meta: { title: '财务结算', icon: 'Money', roles: ['admin'] }
      },
      {
        path: 'reports',
        name: 'Reports',
        component: () => import('@/views/Reports.vue'),
        meta: { title: '统计报表', icon: 'DataAnalysis', roles: ['admin'] }
      },
      {
        path: 'workorders',
        name: 'WorkOrders',
        component: () => import('@/views/WorkOrders.vue'),
        meta: { title: '异常工单', icon: 'Warning', roles: ['admin'] }
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/Users.vue'),
        meta: { title: '用户管理', icon: 'User', roles: ['admin'] }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  
  if (to.meta.requiresAuth !== false && !userStore.user) {
    next('/login')
  } else if (to.path === '/login' && userStore.user) {
    next('/')
  } else if (to.meta.roles && !to.meta.roles.includes(userStore.user?.role)) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
