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
   * Mixes sequencer pattern and loop pedal tracks into a single WAV file
   */
  const exportAudioMix = async () => {
    try {
      const audioContext = AudioEngine.getContext()
      if (!audioContext) {
        alert('Audio engine not initialized. Please click somewhere on the page first.')
        return false
      }

      // Show progress message
      const originalText = 'Rendering audio mix...'
      console.log(originalText)

      // Collect all audio buffers to mix
      const buffersToMix = []

      // 1. Render current sequencer pattern (4 bars)
      const pattern = Sequencer.getPattern()
      const tempo = Sequencer.getTempo()

      if (pattern) {
        try {
          const patternBuffer = await WAVEncoder.renderPattern(audioContext, pattern, tempo, 4)
          if (patternBuffer) {
            buffersToMix.push(patternBuffer)
          }
        } catch (error) {
          console.warn('Failed to render pattern:', error)
        }
      }

      // 2. Get loop pedal tracks
      const loopTracks = LoopPedal.getAllTracksInfo()
      loopTracks.forEach(track => {
        if (track.buffer && !track.isMuted) {
          buffersToMix.push(track.buffer)
        }
      })

      // Check if we have anything to export
      if (buffersToMix.length === 0) {
        alert('Nothing to export! Create a drum pattern or record some loops first.')
        return false
      }

      // 3. Mix all buffers together
      const mixedBuffer = WAVEncoder.mixBuffers(audioContext, buffersToMix)

      // 4. Encode to WAV
      const wavBlob = WAVEncoder.encodeWAV(mixedBuffer, 16)

      // 5. Download the file
      const url = URL.createObjectURL(wavBlob)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `drum-machine-mix-${timestamp}.wav`

      downloadFile(url, filename)
      URL.revokeObjectURL(url)

      console.log('Audio mix exported successfully')
      alert('Audio mix exported successfully!')
      return true
    } catch (error) {
      console.error('Failed to export audio:', error)
      alert('Failed to export audio mix. Check console for details.')
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
