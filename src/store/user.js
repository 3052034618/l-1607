import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import db from '@/api/db'

export const useUserStore = defineStore('user', () => {
  const user = ref(JSON.parse(localStorage.getItem('station_user') || 'null'))

  const isAdmin = computed(() => user.value?.role === 'admin')
  const isCourier = computed(() => user.value?.role === 'courier')

  async function login(username, password) {
    const result = await db.query(
      'SELECT id, username, real_name, phone, role FROM users WHERE username = ? AND password = ?',
      [username, password]
    )
    if (result.success && result.data.length > 0) {
      user.value = result.data[0]
      localStorage.setItem('station_user', JSON.stringify(user.value))
      return true
    }
    return false
  }

  function logout() {
    user.value = null
    localStorage.removeItem('station_user')
  }

  return { user, isAdmin, isCourier, login, logout }
})
