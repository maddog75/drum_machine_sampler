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
 * Sequencer Module
 * Implements the drum machine, 16-step sequencer, and two-layer scheduling
 */

const Sequencer = (() => {
  // Private variables
  let currentPattern = null
  let tempo = 120
  let timeSignature = '4/4'
  let stepCount = 16 // Number of steps in the sequence (4-48)
  let currentStep = 0
  let isPlaying = false
  let isPaused = false  // Track if paused (vs stopped) for resume functionality
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

    // Add 8 loop tracks if they don't exist (4 global + 4 pattern-specific)
    // Always create with max size (48 steps)
    for (let i = 1; i <= 8; i++) {
      const loopId = `loop${i}`
      if (!currentPattern.pattern[loopId]) {
        currentPattern.pattern[loopId] = new Array(48).fill(0)
      } else {
        // Ensure existing arrays are at least 48 steps
        while (currentPattern.pattern[loopId].length < 48) {
          currentPattern.pattern[loopId].push(0)
        }
      }
    }
  }

  /**
   * Load a pattern into the sequencer
   * @param {Object} pattern - Pattern object from presets (can be null for empty patterns)
   */
  const loadPattern = (pattern) => {
    // Handle null patterns (empty slots)
    if (!pattern) {
      // Create empty pattern structure
      const instruments = AudioEngine.getInstruments()
      currentPattern = {
        name: 'Empty Pattern',
        tempo: tempo, // Keep current tempo
        pattern: {}
      }

      // Initialize all instrument tracks with empty 48-step arrays
      instruments.forEach(instrument => {
        currentPattern.pattern[instrument.id] = new Array(48).fill(0)
      })

      // Initialize loop tracks
      initializeLoopTracks()

      emit('patternLoaded', currentPattern)
      return
    }

    currentPattern = JSON.parse(JSON.stringify(pattern)) // Deep clone
    tempo = pattern.tempo

    // Extend all instrument tracks to 48 steps (max size)
    const instruments = AudioEngine.getInstruments()
    instruments.forEach(instrument => {
      if (currentPattern.pattern[instrument.id]) {
        while (currentPattern.pattern[instrument.id].length < 48) {
          currentPattern.pattern[instrument.id].push(0)
        }
      }
    })

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
    return JSON.parse(JSON.stringify(currentPattern))
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
   * Set step count
   * @param {number} newStepCount - Number of steps (4-48)
   */
  const setStepCount = (newStepCount) => {
    stepCount = Math.max(4, Math.min(48, newStepCount))
    emit('stepCountChanged', stepCount)
  }

  /**
   * Get current step count
   * @returns {number} Current step count
   */
  const getStepCount = () => {
    return stepCount
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
    for (let i = 1; i <= 8; i++) {
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
    if (currentStep >= stepCount) {
      currentStep = 0
      emit('barCompleted')  // Emit event when bar completes
    }
  }

  /**
   * Start playback (or resume if paused)
   */
  const play = () => {
    if (isPlaying) return

    // Ensure audio context is running
    AudioEngine.resume()

    isPlaying = true

    // Only reset to beginning if not resuming from pause
    if (!isPaused) {
      currentStep = 0
    }
    isPaused = false

    nextNoteTime = AudioEngine.getCurrentTime()

    // Start the JavaScript scheduler
    schedulerInterval = setInterval(scheduler, lookAhead)

    emit('playbackStarted')
  }

  /**
   * Pause playback (preserves position for resume)
   */
  const pause = () => {
    if (!isPlaying) return

    isPlaying = false
    isPaused = true  // Mark as paused so play() will resume

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
    isPaused = false  // Clear paused state so next play starts from beginning
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

    // Also clear all loop/sample tracks (loop1-loop8)
    for (let i = 1; i <= 8; i++) {
      const loopTrackId = `loop${i}`
      if (currentPattern.pattern[loopTrackId]) {
        currentPattern.pattern[loopTrackId].fill(0)
      }
    }

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
        for (let i = 0; i < stepCount; i++) {
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
   * @returns {string} Beat position (e.g., "1.1.1", "2.3.4") - pattern.beat.subdivision
   */
  const getBeatPosition = () => {
    const pattern = (SongMode.getCurrentPatternIndex() + 1) // 1-based pattern number
    const beat = Math.floor(currentStep / 4) + 1
    const subdivision = (currentStep % 4) + 1
    return `${pattern}.${beat}.${subdivision}`
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
    const stepsUntilNextBar = currentStep === 0 ? stepCount : (stepCount - currentStep)

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

    // Add loop tracks (8 total: 4 global + 4 pattern-specific)
    for (let i = 1; i <= 8; i++) {
      const isGlobal = i <= 4
      const name = isGlobal ? `Global Sample ${i}` : `Sample ${i - 4}`
      tracks.push({
        id: `loop${i}`,
        name: name
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
      stepCount,
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
      currentPattern = JSON.parse(JSON.stringify(data.pattern)) // Deep clone

      // Extend all instrument tracks to 48 steps (max size)
      const instruments = AudioEngine.getInstruments()
      instruments.forEach(instrument => {
        if (currentPattern.pattern[instrument.id]) {
          while (currentPattern.pattern[instrument.id].length < 48) {
            currentPattern.pattern[instrument.id].push(0)
          }
        }
      })

      // Ensure loop tracks exist in the imported pattern
      initializeLoopTracks()

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
    if (data.stepCount !== undefined) {
      stepCount = data.stepCount
      emit('stepCountChanged', stepCount)
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
    setStepCount,
    getStepCount,
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
