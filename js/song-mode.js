/**
 * Web Drum Machine & Sample Recorder
 * Copyright (C) 2025 maddog75
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Song Mode Module
 * Allows chaining patterns together to create complete songs
 */

const SongMode = (() => {
  // Private variables
  let song = []
  let currentSection = 0
  let isPlaying = false
  let sectionLoopCount = 0
  let listeners = {}

  // Pattern Bank variables (10 fixed slots)
  let patternBank = []
  let currentPatternIndex = 0
  let queuedPatternIndex = null
  let chainMode = false

  // Chain mode playback state
  let chainModeActive = false
  let chainCurrentPattern = 0
  let chainCurrentRepeat = 0

  /**
   * Song section structure:
   * {
   *   patternId: string,
   *   pattern: object,
   *   tempo: number,
   *   repeats: number,
   *   name: string
   * }
   */

  /**
   * Initialize song mode
   */
  const init = () => {
    // Listen to sequencer events
    Sequencer.on('playbackStopped', () => {
      if (isPlaying) {
        stop()
      }
      stopChainMode()
    })

    Sequencer.on('barCompleted', handleBarCompleted)

    // Initialize pattern bank with 10 empty slots
    initializePatternBank()

    console.log('Song Mode initialized')
  }

  /**
   * Initialize pattern bank with 10 empty slots
   */
  const initializePatternBank = () => {
    patternBank = []
    for (let i = 0; i < 10; i++) {
      patternBank.push({
        index: i,
        name: `Pattern ${i + 1}`,
        pattern: null,
        tempo: 120,
        timeSignature: '4/4',
        stepCount: 16,
        repeats: 1,
        loopTracks: null, // Pattern-specific loop tracks (4-7)
        isEmpty: true
      })
    }

    // Load default pattern into slot 0
    const defaultPattern = Sequencer.getPattern()
    if (defaultPattern) {
      loadPatternToSlot(0, defaultPattern, Sequencer.getTempo(), Sequencer.getTimeSignature(), Sequencer.getStepCount())
    }

    currentPatternIndex = 0
    emit('patternBankInitialized')
  }

  /**
   * Load a pattern into a specific slot
   * @param {number} index - Slot index (0-9)
   * @param {Object} pattern - Pattern data
   * @param {number} tempo - Optional tempo (defaults to current)
   * @param {string} timeSignature - Optional time signature
   */
  const loadPatternToSlot = async (index, pattern, tempo = null, timeSignature = null, stepCount = null) => {
    if (index < 0 || index >= 10) return

    // Export pattern-specific loop tracks (4-7)
    const loopTracks = await LoopPedal.exportPatternTracks()

    patternBank[index] = {
      index,
      name: pattern.name || `Pattern ${index + 1}`,
      pattern: JSON.parse(JSON.stringify(pattern)), // Deep clone
      tempo: tempo || Sequencer.getTempo(),
      timeSignature: timeSignature || Sequencer.getTimeSignature(),
      stepCount: stepCount || Sequencer.getStepCount(),
      repeats: patternBank[index].repeats || 1, // Preserve repeat count
      loopTracks,
      isEmpty: false
    }

    emit('patternSlotUpdated', { index, slot: patternBank[index] })
  }

  /**
   * Get pattern from a specific slot
   * @param {number} index - Slot index (0-9)
   * @returns {Object} Pattern slot data
   */
  const getPatternSlot = (index) => {
    if (index < 0 || index >= 10) return null
    return patternBank[index]
  }

  /**
   * Clear a pattern slot
   * @param {number} index - Slot index (0-9)
   */
  const clearPatternSlot = (index) => {
    if (index < 0 || index >= 10) return

    patternBank[index] = {
      index,
      name: `Pattern ${index + 1}`,
      pattern: null,
      tempo: 120,
      timeSignature: '4/4',
      stepCount: 16,
      repeats: 1,
      loopTracks: null,
      isEmpty: true
    }

    emit('patternSlotCleared', { index })
  }

  /**
   * Check if a pattern has any drum hits or sample triggers
   * @param {Object} patternSlot - Pattern slot object from pattern bank
   * @returns {boolean} True if pattern is empty (no hits)
   */
  const isPatternEmpty = (patternSlot) => {
    // Pattern slot structure: { index, name, pattern: {...}, tempo, ... }
    // The actual beat data is in pattern.pattern.pattern
    if (!patternSlot || !patternSlot.pattern || !patternSlot.pattern.pattern) return true

    const beatPattern = patternSlot.pattern.pattern

    // Check all tracks in the beat pattern
    for (const trackId in beatPattern) {
      const track = beatPattern[trackId]
      if (Array.isArray(track)) {
        // Check if any step has a hit (value of 1)
        if (track.some(step => step === 1)) {
          return false
        }
      }
    }

    return true
  }

  /**
   * Clear the current pattern slot (marks it as empty)
   */
  const clearCurrentPattern = async () => {
    // Clear the sequencer
    Sequencer.clearPattern()

    // Save the empty pattern to the current slot
    const emptyPattern = Sequencer.getPattern()
    const tempo = Sequencer.getTempo()
    const timeSignature = Sequencer.getTimeSignature()
    const stepCount = Sequencer.getStepCount()
    const loopTracks = await LoopPedal.exportPatternTracks()

    patternBank[currentPatternIndex] = {
      index: currentPatternIndex,
      name: `Pattern ${currentPatternIndex + 1}`,
      pattern: JSON.parse(JSON.stringify(emptyPattern)),
      tempo,
      timeSignature,
      stepCount,
      repeats: patternBank[currentPatternIndex].repeats || 1,
      loopTracks,
      isEmpty: true // Mark as empty so it's skipped in chain mode
    }

    emit('patternSlotUpdated', { index: currentPatternIndex, slot: patternBank[currentPatternIndex] })
  }

  /**
   * Set repeat count for a pattern slot
   * @param {number} index - Slot index (0-9)
   * @param {number} repeats - Repeat count (1-16)
   */
  const setPatternRepeats = (index, repeats) => {
    if (index < 0 || index >= 10) return

    patternBank[index].repeats = Math.max(1, Math.min(16, repeats))
    emit('patternRepeatsChanged', { index, repeats: patternBank[index].repeats })
  }

  /**
   * Switch to a different pattern (with quantization if playing)
   * @param {number} index - Slot index (0-9)
   */
  const switchToPattern = async (index) => {
    if (index < 0 || index >= 10) return
    if (index === currentPatternIndex) return

    const slot = patternBank[index]

    // Save current pattern before switching
    await saveCurrentPattern()

    // If playing, queue the switch for the next bar
    if (Sequencer.getIsPlaying()) {
      queuedPatternIndex = index
      emit('patternSwitchQueued', { index })

      // Schedule the switch at the next bar
      const nextBarTime = Sequencer.getNextBarTime()
      const currentTime = AudioEngine.getCurrentTime()
      const delay = (nextBarTime - currentTime) * 1000

      setTimeout(() => {
        if (queuedPatternIndex === index) {
          applyPatternSwitch(index)
          queuedPatternIndex = null
        }
      }, delay)
    } else {
      // Immediate switch when not playing
      applyPatternSwitch(index)
    }
  }

  /**
   * Save current pattern to its slot
   */
  const saveCurrentPattern = async () => {
    const currentPattern = Sequencer.getPattern()
    const currentTempo = Sequencer.getTempo()
    const currentTimeSignature = Sequencer.getTimeSignature()
    const currentStepCount = Sequencer.getStepCount()

    await loadPatternToSlot(currentPatternIndex, currentPattern, currentTempo, currentTimeSignature, currentStepCount)
  }

  /**
   * Apply pattern switch (internal)
   * @param {number} index - Slot index
   */
  const applyPatternSwitch = async (index) => {
    const slot = patternBank[index]
    if (!slot) return

    // If switching to an empty slot, copy the current pattern as a starting point
    if (slot.isEmpty || !slot.pattern) {
      const currentPattern = Sequencer.getPattern()
      const currentTempo = Sequencer.getTempo()
      const currentTimeSignature = Sequencer.getTimeSignature()
      const currentStepCount = Sequencer.getStepCount()

      await loadPatternToSlot(index, currentPattern, currentTempo, currentTimeSignature, currentStepCount)

      // Refresh slot reference after loading
      const updatedSlot = patternBank[index]

      // Load the copied pattern
      Sequencer.loadPattern(updatedSlot.pattern)
      Sequencer.setTempo(updatedSlot.tempo)
      Sequencer.setTimeSignature(updatedSlot.timeSignature)
      Sequencer.setStepCount(updatedSlot.stepCount)
    } else {
      // Load existing pattern
      Sequencer.loadPattern(slot.pattern)
      Sequencer.setTempo(slot.tempo)
      Sequencer.setTimeSignature(slot.timeSignature)

      // Restore step count
      if (slot.stepCount !== undefined) {
        Sequencer.setStepCount(slot.stepCount)
      }
    }

    // Load pattern-specific loop tracks (4-7)
    if (slot.loopTracks) {
      await LoopPedal.importPatternTracks(slot.loopTracks)
    } else {
      // Clear pattern-specific tracks if switching to empty slot
      await LoopPedal.importPatternTracks(null)
    }

    currentPatternIndex = index
    emit('patternSwitched', { index, slot })
  }

  /**
   * Get all pattern slots info
   * @returns {Array} Array of pattern slot data
   */
  const getPatternBank = () => {
    return patternBank.map(slot => ({
      index: slot.index,
      name: slot.name,
      isEmpty: slot.isEmpty,
      repeats: slot.repeats,
      tempo: slot.tempo
    }))
  }

  /**
   * Get current pattern index
   * @returns {number} Current pattern index
   */
  const getCurrentPatternIndex = () => {
    return currentPatternIndex
  }

  /**
   * Set chain mode
   * @param {boolean} enabled - Enable/disable chain mode
   */
  const setChainMode = (enabled) => {
    chainMode = enabled

    // If enabling during playback, start chain mode
    if (enabled && Sequencer.getIsPlaying() && !chainModeActive) {
      startChainMode()
    }
    // If disabling, stop chain mode
    else if (!enabled && chainModeActive) {
      stopChainMode()
    }

    emit('chainModeChanged', { enabled })
  }

  /**
   * Get chain mode state
   * @returns {boolean} Chain mode enabled
   */
  const getChainMode = () => {
    return chainMode
  }

  /**
   * Add section to song
   * @param {Object} section - Song section
   * @param {number} index - Index to insert at (optional, adds to end if not specified)
   */
  const addSection = (section, index = null) => {
    const newSection = {
      patternId: section.patternId || 'custom',
      pattern: section.pattern,
      tempo: section.tempo || 120,
      repeats: section.repeats || 1,
      name: section.name || `Section ${song.length + 1}`
    }

    if (index !== null && index >= 0 && index <= song.length) {
      song.splice(index, 0, newSection)
    } else {
      song.push(newSection)
    }

    emit('sectionAdded', { section: newSection, index: index || song.length - 1 })
  }

  /**
   * Remove section from song
   * @param {number} index - Section index
   */
  const removeSection = (index) => {
    if (index >= 0 && index < song.length) {
      const removed = song.splice(index, 1)[0]
      emit('sectionRemoved', { section: removed, index })

      // Adjust current section if needed
      if (currentSection >= song.length) {
        currentSection = Math.max(0, song.length - 1)
      }
    }
  }

  /**
   * Move section to new position
   * @param {number} fromIndex - Current index
   * @param {number} toIndex - New index
   */
  const moveSection = (fromIndex, toIndex) => {
    if (fromIndex >= 0 && fromIndex < song.length && toIndex >= 0 && toIndex < song.length) {
      const section = song.splice(fromIndex, 1)[0]
      song.splice(toIndex, 0, section)
      emit('sectionMoved', { fromIndex, toIndex })
    }
  }

  /**
   * Update section
   * @param {number} index - Section index
   * @param {Object} updates - Fields to update
   */
  const updateSection = (index, updates) => {
    if (index >= 0 && index < song.length) {
      Object.assign(song[index], updates)
      emit('sectionUpdated', { index, section: song[index] })
    }
  }

  /**
   * Get section
   * @param {number} index - Section index
   * @returns {Object} Section
   */
  const getSection = (index) => {
    return song[index] || null
  }

  /**
   * Get all sections
   * @returns {Array} Song sections
   */
  const getSong = () => {
    return [...song]
  }

  /**
   * Clear all sections
   */
  const clearSong = () => {
    song = []
    currentSection = 0
    sectionLoopCount = 0
    emit('songCleared')
  }

  /**
   * Load song
   * @param {Array} newSong - Array of sections
   */
  const loadSong = (newSong) => {
    song = newSong.map(section => ({ ...section }))
    currentSection = 0
    sectionLoopCount = 0
    emit('songLoaded', { song })
  }

  /**
   * Play song from beginning
   */
  const play = () => {
    if (song.length === 0) {
      console.warn('Song is empty')
      return
    }

    isPlaying = true
    currentSection = 0
    sectionLoopCount = 0
    playSection(currentSection)
    emit('songStarted')
  }

  /**
   * Play specific section
   * @param {number} index - Section index
   */
  const playSection = (index) => {
    if (index < 0 || index >= song.length) {
      stop()
      return
    }

    const section = song[index]

    // Load pattern and tempo
    Sequencer.loadPattern(section.pattern)
    Sequencer.setTempo(section.tempo)

    // Start playback if not already playing
    if (!Sequencer.getIsPlaying()) {
      Sequencer.play()
    }

    emit('sectionStarted', { index, section })

    // Set up section loop counter
    sectionLoopCount++

    // Check if section is complete
    if (sectionLoopCount >= section.repeats) {
      // Move to next section
      sectionLoopCount = 0
      setTimeout(() => {
        if (isPlaying) {
          const nextSection = index + 1
          if (nextSection < song.length) {
            currentSection = nextSection
            playSection(nextSection)
          } else {
            // Song complete
            stop()
            emit('songCompleted')
          }
        }
      }, calculateSectionDuration(section))
    } else {
      // Repeat this section
      setTimeout(() => {
        if (isPlaying) {
          playSection(index)
        }
      }, calculateSectionDuration(section))
    }
  }

  /**
   * Calculate section duration in milliseconds
   * @param {Object} section - Song section
   * @returns {number} Duration in ms
   */
  const calculateSectionDuration = (section) => {
    const beatsPerBar = 4
    const barsPerPattern = 1
    const totalBeats = beatsPerBar * barsPerPattern
    const secondsPerBeat = 60 / section.tempo
    const duration = totalBeats * secondsPerBeat
    return duration * 1000
  }

  /**
   * Stop song playback
   */
  const stop = () => {
    if (isPlaying) {
      isPlaying = false
      currentSection = 0
      sectionLoopCount = 0
      Sequencer.stop()
      emit('songStopped')
    }
  }

  /**
   * Pause song playback
   */
  const pause = () => {
    if (isPlaying) {
      isPlaying = false
      Sequencer.pause()
      emit('songPaused')
    }
  }

  /**
   * Resume song playback
   */
  const resume = () => {
    if (!isPlaying && song.length > 0) {
      isPlaying = true
      playSection(currentSection)
      emit('songResumed')
    }
  }

  /**
   * Get current section index
   * @returns {number} Current section index
   */
  const getCurrentSection = () => {
    return currentSection
  }

  /**
   * Check if song is playing
   * @returns {boolean} Playing state
   */
  const getIsPlaying = () => {
    return isPlaying
  }

  /**
   * Get song duration in seconds
   * @returns {number} Total duration
   */
  const getSongDuration = () => {
    return song.reduce((total, section) => {
      return total + (calculateSectionDuration(section) / 1000) * section.repeats
    }, 0)
  }

  /**
   * Create section from current sequencer state
   * @param {string} name - Section name
   * @param {number} repeats - Number of repeats
   * @returns {Object} New section
   */
  const createSectionFromCurrent = (name = null, repeats = 1) => {
    const pattern = Sequencer.getPattern()
    const tempo = Sequencer.getTempo()

    return {
      patternId: pattern.id,
      pattern: JSON.parse(JSON.stringify(pattern)),
      tempo,
      repeats,
      name: name || `Section ${song.length + 1}`
    }
  }

  /**
   * Duplicate section
   * @param {number} index - Section index to duplicate
   */
  const duplicateSection = (index) => {
    if (index >= 0 && index < song.length) {
      const section = JSON.parse(JSON.stringify(song[index]))
      section.name = `${section.name} (copy)`
      song.splice(index + 1, 0, section)
      emit('sectionDuplicated', { index, newIndex: index + 1 })
    }
  }

  /**
   * Export song data
   * @returns {Object} Song data
   */
  const exportSong = () => {
    return {
      sections: song.map(s => ({ ...s })),
      currentSection,
      isPlaying
    }
  }

  /**
   * Import song data
   * @param {Object} data - Song data
   */
  const importSong = (data) => {
    if (data.sections) {
      loadSong(data.sections)
    }
  }

  /**
   * Export pattern bank data
   * @returns {Object} Pattern bank data
   */
  const exportPatternBank = () => {
    return {
      patternBank: patternBank.map(slot => ({
        index: slot.index,
        name: slot.name,
        pattern: slot.pattern ? JSON.parse(JSON.stringify(slot.pattern)) : null,
        tempo: slot.tempo,
        timeSignature: slot.timeSignature,
        stepCount: slot.stepCount,
        repeats: slot.repeats,
        loopTracks: slot.loopTracks, // Pattern-specific loop tracks (already base64)
        isEmpty: slot.isEmpty
      })),
      currentPatternIndex,
      chainMode
    }
  }

  /**
   * Import pattern bank data
   * @param {Object} data - Pattern bank data
   */
  const importPatternBank = async (data) => {
    if (!data || !data.patternBank) return

    // Restore pattern bank
    patternBank = data.patternBank.map(slot => ({
      index: slot.index,
      name: slot.name || `Pattern ${slot.index + 1}`,
      pattern: slot.pattern ? JSON.parse(JSON.stringify(slot.pattern)) : null,
      tempo: slot.tempo || 120,
      timeSignature: slot.timeSignature || '4/4',
      stepCount: slot.stepCount || 16,
      repeats: slot.repeats || 1,
      loopTracks: slot.loopTracks || null,
      isEmpty: slot.isEmpty !== false ? true : false
    }))

    // Restore current pattern index
    if (data.currentPatternIndex !== undefined) {
      currentPatternIndex = data.currentPatternIndex
    }

    // Restore chain mode
    if (data.chainMode !== undefined) {
      chainMode = data.chainMode
    }

    // Load the current pattern into the sequencer
    const currentSlot = patternBank[currentPatternIndex]
    if (currentSlot && !currentSlot.isEmpty && currentSlot.pattern) {
      Sequencer.loadPattern(currentSlot.pattern)
      Sequencer.setTempo(currentSlot.tempo)
      Sequencer.setTimeSignature(currentSlot.timeSignature)

      // Restore step count
      if (currentSlot.stepCount !== undefined) {
        Sequencer.setStepCount(currentSlot.stepCount)
      }

      // Load pattern-specific loop tracks (4-7)
      if (currentSlot.loopTracks) {
        await LoopPedal.importPatternTracks(currentSlot.loopTracks)
      }
    }

    emit('patternBankRestored')
  }

  /**
   * Start chain mode playback
   */
  const startChainMode = () => {
    if (!chainMode) return

    chainModeActive = true
    chainCurrentPattern = 0
    chainCurrentRepeat = 0

    // Find first non-empty pattern (check actual content, not just isEmpty flag)
    while (chainCurrentPattern < 10 && isPatternEmpty(patternBank[chainCurrentPattern])) {
      chainCurrentPattern++
    }

    if (chainCurrentPattern >= 10) {
      // No patterns to play
      console.warn('No patterns in chain mode')
      stopChainMode()
      return
    }

    // Load and play first pattern
    applyPatternSwitch(chainCurrentPattern)

    if (!Sequencer.getIsPlaying()) {
      Sequencer.play()
    }

    emit('chainModeStarted', { pattern: chainCurrentPattern })
  }

  /**
   * Stop chain mode playback
   */
  const stopChainMode = () => {
    if (chainModeActive) {
      chainModeActive = false
      chainCurrentPattern = 0
      chainCurrentRepeat = 0
      emit('chainModeStopped')
    }
  }

  /**
   * Handle bar completed event from sequencer
   */
  const handleBarCompleted = () => {
    if (!chainModeActive || !Sequencer.getIsPlaying()) return

    const slot = patternBank[chainCurrentPattern]
    chainCurrentRepeat++

    // Check if we've completed all repeats for this pattern
    if (chainCurrentRepeat >= slot.repeats) {
      advanceChainPattern()
    }
  }

  /**
   * Advance to next pattern in chain mode
   */
  const advanceChainPattern = () => {
    chainCurrentRepeat = 0
    chainCurrentPattern++

    // Find next non-empty pattern (check actual content, not just isEmpty flag)
    while (chainCurrentPattern < 10 && isPatternEmpty(patternBank[chainCurrentPattern])) {
      chainCurrentPattern++
    }

    // Check if we've reached the end
    if (chainCurrentPattern >= 10) {
      // Loop back to the beginning
      chainCurrentPattern = 0

      // Find first non-empty pattern (check actual content, not just isEmpty flag)
      while (chainCurrentPattern < 10 && isPatternEmpty(patternBank[chainCurrentPattern])) {
        chainCurrentPattern++
      }

      // If still no pattern found, stop (shouldn't happen if we started)
      if (chainCurrentPattern >= 10) {
        stopChainMode()
        Sequencer.stop()
        emit('chainModeCompleted')
        return
      }

      emit('chainModeLooped')
    }

    // Switch to next pattern
    applyPatternSwitch(chainCurrentPattern)
    emit('chainModePatternChanged', { pattern: chainCurrentPattern })
  }

  /**
   * Event listener system
   */
  const on = (event, callback) => {
    if (!listeners[event]) {
      listeners[event] = []
    }
    listeners[event].push(callback)
  }

  const off = (event, callback) => {
    if (!listeners[event]) return

    listeners[event] = listeners[event].filter(cb => cb !== callback)
  }

  const emit = (event, data) => {
    if (!listeners[event]) return

    listeners[event].forEach(callback => {
      callback(data)
    })
  }

  // Public API
  return {
    init,
    addSection,
    removeSection,
    moveSection,
    updateSection,
    getSection,
    getSong,
    clearSong,
    loadSong,
    play,
    stop,
    pause,
    resume,
    getCurrentSection,
    getIsPlaying,
    getSongDuration,
    createSectionFromCurrent,
    duplicateSection,
    exportSong,
    importSong,
    // Pattern Bank methods
    loadPatternToSlot,
    getPatternSlot,
    clearPatternSlot,
    clearCurrentPattern,
    setPatternRepeats,
    switchToPattern,
    saveCurrentPattern,
    getPatternBank,
    getCurrentPatternIndex,
    setChainMode,
    getChainMode,
    startChainMode,
    stopChainMode,
    exportPatternBank,
    importPatternBank,
    on,
    off
  }
})()
