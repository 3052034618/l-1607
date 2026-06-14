import mockDB from './mockDB'

const hasElectron = typeof window !== 'undefined' && window.electronAPI

async function queryWithFallback(sql, params = []) {
  if (hasElectron) {
    try {
      const result = await window.electronAPI.query(sql, params)
      if (result && result.useFallback) {
        return mockDB.query(sql, params)
      }
      if (!result.success) {
        console.warn('Electron DB query warning:', result.error, '\nSQL:', sql, '\nParams:', params)
      }
      return result
    } catch (e) {
      console.warn('Electron DB call failed, falling back to mockDB:', e.message)
      return mockDB.query(sql, params)
    }
  }
  return mockDB.query(sql, params)
}

async function execWithFallback(sql) {
  if (hasElectron) {
    try {
      const result = await window.electronAPI.exec(sql)
      if (result && result.useFallback) {
        return mockDB.exec(sql)
      }
      return result
    } catch (e) {
      console.warn('Electron DB exec failed, falling back to mockDB:', e.message)
      return mockDB.exec(sql)
    }
  }
  return mockDB.exec(sql)
}

export default {
  async query(sql, params = []) {
    return queryWithFallback(sql, params)
  },
  async exec(sql) {
    return execWithFallback(sql)
  }
}
