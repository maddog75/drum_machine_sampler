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
    })

    console.log('Song Mode initialized')
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
    on,
    off
  }
})()
