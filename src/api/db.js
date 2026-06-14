import mockDB from './mockDB'

const hasElectron = typeof window !== 'undefined' && window.electronAPI

const api = hasElectron ? window.electronAPI : mockDB

export default {
  async query(sql, params = []) {
    const result = await api.query(sql, params)
    if (!result.success) {
      console.warn('DB query warning:', result.error, '\nSQL:', sql, '\nParams:', params)
    }
    return result
  },
  async exec(sql) {
    return api.exec(sql)
  }
}
