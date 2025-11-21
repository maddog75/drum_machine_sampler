/**
 * Storage Module
 * Handles session save/load and export functionality
 */

const Storage = (() => {
  const SESSION_KEY = 'drumMachineSession'
  const AUTO_SAVE_INTERVAL = 30000 // 30 seconds
  let autoSaveTimer = null

  /**
   * Save current session to localStorage
   * @returns {boolean} Success status
   */
  const saveSession = async () => {
    try {
      const session = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        theme: document.body.dataset.theme || 'dark',
        sequencer: Sequencer.exportPattern(),
        loopPedal: await LoopPedal.exportData()
      }

      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      console.log('Session saved successfully')
      return true
    } catch (error) {
      console.error('Failed to save session:', error)
      return false
    }
  }

  /**
   * Load session from localStorage
   * @returns {Promise<boolean>} Success status
   */
  const loadSession = async () => {
    try {
      const sessionData = localStorage.getItem(SESSION_KEY)
      if (!sessionData) {
        console.log('No saved session found')
        return false
      }

      const session = JSON.parse(sessionData)

      // Restore theme
      if (session.theme) {
        document.body.dataset.theme = session.theme
      }

      // Restore sequencer
      if (session.sequencer) {
        Sequencer.importPattern(session.sequencer)
      }

      // Restore loop pedal
      if (session.loopPedal) {
        await LoopPedal.importData(session.loopPedal)
      }

      console.log('Session loaded successfully')
      return true
    } catch (error) {
      console.error('Failed to load session:', error)
      return false
    }
  }

  /**
   * Export session as downloadable JSON file
   */
  const exportSessionFile = async () => {
    try {
      const session = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        theme: document.body.dataset.theme || 'dark',
        sequencer: Sequencer.exportPattern(),
        loopPedal: await LoopPedal.exportData()
      }

      const json = JSON.stringify(session, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `drum-machine-session-${timestamp}.json`

      downloadFile(url, filename)
      URL.revokeObjectURL(url)

      return true
    } catch (error) {
      console.error('Failed to export session:', error)
      return false
    }
  }

  /**
   * Import session from JSON file
   * @param {File} file - JSON file to import
   * @returns {Promise<boolean>} Success status
   */
  const importSessionFile = async (file) => {
    try {
      const text = await file.text()
      const session = JSON.parse(text)

      // Validate session data
      if (!session.version || !session.sequencer) {
        throw new Error('Invalid session file format')
      }

      // Restore theme
      if (session.theme) {
        document.body.dataset.theme = session.theme
      }

      // Restore sequencer
      if (session.sequencer) {
        Sequencer.importPattern(session.sequencer)
      }

      // Restore loop pedal
      if (session.loopPedal) {
        await LoopPedal.importData(session.loopPedal)
      }

      console.log('Session imported successfully')
      return true
    } catch (error) {
      console.error('Failed to import session:', error)
      return false
    }
  }

  /**
   * Export audio mix as WAV file
   * Note: This is a placeholder - proper implementation would require
   * mixing all tracks and exporting as WAV
   */
  const exportAudioMix = async () => {
    try {
      // TODO: Implement proper audio mixing and WAV export
      console.log('Audio export not yet implemented')
      alert('Audio export feature coming soon!')
      return false
    } catch (error) {
      console.error('Failed to export audio:', error)
      return false
    }
  }

  /**
   * Helper function to trigger file download
   * @param {string} url - Blob URL
   * @param {string} filename - Filename for download
   */
  const downloadFile = (url, filename) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  /**
   * Enable auto-save
   */
  const enableAutoSave = () => {
    if (autoSaveTimer) return

    autoSaveTimer = setInterval(() => {
      saveSession()
    }, AUTO_SAVE_INTERVAL)

    console.log('Auto-save enabled')
  }

  /**
   * Disable auto-save
   */
  const disableAutoSave = () => {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer)
      autoSaveTimer = null
    }

    console.log('Auto-save disabled')
  }

  /**
   * Clear saved session
   */
  const clearSession = () => {
    localStorage.removeItem(SESSION_KEY)
    console.log('Session cleared')
  }

  /**
   * Check if saved session exists
   * @returns {boolean} True if session exists
   */
  const hasSession = () => {
    return !!localStorage.getItem(SESSION_KEY)
  }

  // Public API
  return {
    saveSession,
    loadSession,
    exportSessionFile,
    importSessionFile,
    exportAudioMix,
    enableAutoSave,
    disableAutoSave,
    clearSession,
    hasSession
  }
})()
