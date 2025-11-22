/**
 * Sequencer Module
 * Implements the drum machine, 16-step sequencer, and two-layer scheduling
 */

const Sequencer = (() => {
  // Private variables
  let currentPattern = null
  let tempo = 120
  let timeSignature = '4/4'
  let currentStep = 0
  let isPlaying = false
  let schedulerInterval = null
  let nextNoteTime = 0
  let scheduleAheadTime = 0.1 // How far ahead to schedule (100ms)
  let lookAhead = 25 // How often to check for notes to schedule (25ms)
  let listeners = {}

  /**
   * Initialize the sequencer
   */
  const init = () => {
    // Load first preset as default
    const patterns = Presets.getDrumPatterns()
    if (patterns.length > 0) {
      loadPattern(patterns[0])
    }

    // Initialize loop tracks in pattern
    initializeLoopTracks()
  }

  /**
   * Initialize loop pedal tracks in the current pattern
   */
  const initializeLoopTracks = () => {
    if (!currentPattern) return

    // Add 6 loop tracks if they don't exist
    for (let i = 1; i <= 6; i++) {
      const loopId = `loop${i}`
      if (!currentPattern.pattern[loopId]) {
        currentPattern.pattern[loopId] = new Array(16).fill(0)
      }
    }
  }

  /**
   * Load a pattern into the sequencer
   * @param {Object} pattern - Pattern object from presets
   */
  const loadPattern = (pattern) => {
    currentPattern = JSON.parse(JSON.stringify(pattern)) // Deep clone
    tempo = pattern.tempo

    // Ensure loop tracks exist in the loaded pattern
    initializeLoopTracks()

    emit('patternLoaded', currentPattern)
    emit('tempoChanged', tempo)
  }

  /**
   * Get current pattern
   * @returns {Object} Current pattern
   */
  const getPattern = () => {
    return currentPattern
  }

  /**
   * Set tempo
   * @param {number} newTempo - Tempo in BPM (60-180)
   */
  const setTempo = (newTempo) => {
    tempo = Math.max(60, Math.min(180, newTempo))
    emit('tempoChanged', tempo)
  }

  /**
   * Get current tempo
   * @returns {number} Current tempo in BPM
   */
  const getTempo = () => {
    return tempo
  }

  /**
   * Set time signature
   * @param {string} newTimeSignature - Time signature ('4/4', '3/4', '12/8')
   */
  const setTimeSignature = (newTimeSignature) => {
    if (['4/4', '3/4', '12/8'].includes(newTimeSignature)) {
      timeSignature = newTimeSignature
      emit('timeSignatureChanged', timeSignature)
    }
  }

  /**
   * Get current time signature
   * @returns {string} Current time signature
   */
  const getTimeSignature = () => {
    return timeSignature
  }

  /**
   * Toggle a step in the pattern
   * @param {string} instrument - Instrument ID
   * @param {number} step - Step number (0-15)
   */
  const toggleStep = (instrument, step) => {
    if (!currentPattern || !currentPattern.pattern[instrument]) {
      return
    }

    const currentValue = currentPattern.pattern[instrument][step]
    currentPattern.pattern[instrument][step] = currentValue ? 0 : 1

    emit('patternChanged', {
      instrument,
      step,
      value: currentPattern.pattern[instrument][step]
    })
  }

  /**
   * Set a step value directly
   * @param {string} instrument - Instrument ID
   * @param {number} step - Step number (0-15)
   * @param {number} value - Value (0 or 1)
   */
  const setStep = (instrument, step, value) => {
    if (!currentPattern || !currentPattern.pattern[instrument]) {
      return
    }

    currentPattern.pattern[instrument][step] = value ? 1 : 0

    emit('patternChanged', {
      instrument,
      step,
      value: currentPattern.pattern[instrument][step]
    })
  }

  /**
   * Get step value
   * @param {string} instrument - Instrument ID
   * @param {number} step - Step number (0-15)
   * @returns {number} Step value (0 or 1)
   */
  const getStep = (instrument, step) => {
    if (!currentPattern || !currentPattern.pattern[instrument]) {
      return 0
    }
    return currentPattern.pattern[instrument][step]
  }

  /**
   * Two-layer scheduling system
   * JavaScript scheduler runs every 25ms and looks ahead 100ms
   * Web Audio scheduler gets precise timing
   */
  const scheduler = () => {
    // Look ahead and schedule notes
    while (nextNoteTime < AudioEngine.getCurrentTime() + scheduleAheadTime) {
      scheduleNote(currentStep, nextNoteTime)
      nextNote()
    }
  }

  /**
   * Schedule a single step
   * @param {number} step - Step to schedule (0-15)
   * @param {number} time - AudioContext time to play
   */
  const scheduleNote = (step, time) => {
    if (!currentPattern) return

    // Play all drum instruments for this step
    const instruments = AudioEngine.getInstruments()
    instruments.forEach(instrument => {
      const value = currentPattern.pattern[instrument.id]?.[step]
      if (value) {
        // Play the drum hit with Web Audio API precise timing
        AudioEngine.playDrum(instrument.id, time, value)
      }
    })

    // Play all loop tracks for this step (one-shot, not looping)
    for (let i = 1; i <= 6; i++) {
      const loopId = `loop${i}`
      const value = currentPattern.pattern[loopId]?.[step]
      if (value) {
        // Trigger one-shot loop playback (loop tracks are 0-indexed)
        const loopTrackIndex = i - 1
        // Play loop as one-shot with precise timing, like a drum sample
        LoopPedal.playTrack(loopTrackIndex, false, time)
      }
    }

    // Emit event for UI update (on main thread)
    emit('stepTriggered', step)
  }

  /**
   * Advance to next note
   */
  const nextNote = () => {
    // Calculate note length in seconds (quarter note)
    const secondsPerBeat = 60.0 / tempo
    const noteDuration = secondsPerBeat / 4 // 16th note

    nextNoteTime += noteDuration

    currentStep++
    if (currentStep >= 16) {
      currentStep = 0
    }
  }

  /**
   * Start playback
   */
  const play = () => {
    if (isPlaying) return

    // Ensure audio context is running
    AudioEngine.resume()

    isPlaying = true
    currentStep = 0
    nextNoteTime = AudioEngine.getCurrentTime()

    // Start the JavaScript scheduler
    schedulerInterval = setInterval(scheduler, lookAhead)

    emit('playbackStarted')
  }

  /**
   * Pause playback
   */
  const pause = () => {
    if (!isPlaying) return

    isPlaying = false

    // Stop the scheduler
    if (schedulerInterval) {
      clearInterval(schedulerInterval)
      schedulerInterval = null
    }

    emit('playbackPaused')
  }

  /**
   * Stop playback and reset to beginning
   */
  const stop = () => {
    pause()
    currentStep = 0
    emit('playbackStopped')
  }

  /**
   * Toggle play/pause
   */
  const togglePlayPause = () => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }

  /**
   * Get playback state
   * @returns {boolean} True if playing
   */
  const getIsPlaying = () => {
    return isPlaying
  }

  /**
   * Get current step
   * @returns {number} Current step (0-15)
   */
  const getCurrentStep = () => {
    return currentStep
  }

  /**
   * Clear entire pattern
   */
  const clearPattern = () => {
    if (!currentPattern) return

    const instruments = AudioEngine.getInstruments()
    instruments.forEach(instrument => {
      if (currentPattern.pattern[instrument.id]) {
        currentPattern.pattern[instrument.id].fill(0)
      }
    })

    emit('patternCleared')
  }

  /**
   * Clear a single track
   * @param {string} instrument - Instrument ID
   */
  const clearTrack = (instrument) => {
    if (!currentPattern || !currentPattern.pattern[instrument]) return

    currentPattern.pattern[instrument].fill(0)

    emit('trackCleared', instrument)
  }

  /**
   * Randomize pattern
   */
  const randomizePattern = () => {
    if (!currentPattern) return

    const instruments = AudioEngine.getInstruments()
    instruments.forEach(instrument => {
      if (currentPattern.pattern[instrument.id]) {
        for (let i = 0; i < 16; i++) {
          // 30% chance of a hit
          currentPattern.pattern[instrument.id][i] = Math.random() < 0.3 ? 1 : 0
        }
      }
    })

    emit('patternRandomized')
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

  /**
   * Get beat position for display
   * @returns {string} Beat position (e.g., "1.1", "2.3")
   */
  const getBeatPosition = () => {
    const bar = 1 // We only have 1 bar (16 steps)
    const beat = Math.floor(currentStep / 4) + 1
    const subdivision = (currentStep % 4) + 1
    return `${bar}.${beat}.${subdivision}`
  }

  /**
   * Get the AudioContext time when the next bar will start
   * Useful for quantizing loop playback to bar boundaries
   * @returns {number} AudioContext time for next bar start
   */
  const getNextBarTime = () => {
    if (!isPlaying) {
      // If not playing, return current time (immediate playback)
      return AudioEngine.getCurrentTime()
    }

    // Calculate how many steps until next bar (step 0)
    // If we're at step 0 and very close to nextNoteTime, wait for the NEXT bar
    const stepsUntilNextBar = currentStep === 0 ? 16 : (16 - currentStep)

    // Calculate note duration
    const secondsPerBeat = 60.0 / tempo
    const noteDuration = secondsPerBeat / 4 // 16th note

    // Calculate time until next bar
    const timeUntilNextBar = stepsUntilNextBar * noteDuration

    // nextNoteTime is when currentStep will play
    return nextNoteTime + timeUntilNextBar
  }

  /**
   * Get all tracks (drums + loops) for UI rendering
   * @returns {Array} Array of track objects with id and name
   */
  const getAllTracks = () => {
    const tracks = []

    // Add drum instruments
    const drumInstruments = AudioEngine.getInstruments()
    tracks.push(...drumInstruments)

    // Add loop tracks
    for (let i = 1; i <= 6; i++) {
      tracks.push({
        id: `loop${i}`,
        name: `Loop ${i}`
      })
    }

    return tracks
  }

  /**
   * Export pattern data for session save
   * @returns {Object} Pattern data
   */
  const exportPattern = () => {
    return {
      pattern: currentPattern,
      tempo,
      timeSignature,
      currentStep,
      isPlaying
    }
  }

  /**
   * Import pattern data from session load
   * @param {Object} data - Pattern data
   */
  const importPattern = (data) => {
    if (data.pattern) {
      currentPattern = data.pattern
      emit('patternLoaded', currentPattern)
    }
    if (data.tempo) {
      tempo = data.tempo
      emit('tempoChanged', tempo)
    }
    if (data.timeSignature) {
      timeSignature = data.timeSignature
      emit('timeSignatureChanged', timeSignature)
    }
  }

  // Public API
  return {
    init,
    loadPattern,
    getPattern,
    setTempo,
    getTempo,
    setTimeSignature,
    getTimeSignature,
    toggleStep,
    setStep,
    getStep,
    play,
    pause,
    stop,
    togglePlayPause,
    getIsPlaying,
    getCurrentStep,
    clearPattern,
    clearTrack,
    randomizePattern,
    on,
    off,
    getBeatPosition,
    getNextBarTime,
    getAllTracks,
    exportPattern,
    importPattern
  }
})()
