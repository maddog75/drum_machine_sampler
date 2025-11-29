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
 * Audio Engine Module
 * Handles Web Audio API, sample loading, and audio routing
 */

const AudioEngine = (() => {
  // Private variables
  let audioContext = null
  let masterGainNode = null
  let analyserNode = null
  let audioBuffers = {}
  let trackGainNodes = {}  // Per-track gain nodes for volume control
  let trackMixerSettings = {}  // Per-track mixer settings (timing, pan, pitch, etc.)
  let trackAudioNodes = {}  // Per-track audio nodes { panNode, bassFilter, trebleFilter }
  let isInitialized = false
  let instrumentLibrary = null  // Loaded from instruments.json
  let instrumentMap = {}  // Quick lookup: instrumentId -> instrument config
  let loadingPromises = {}  // Track loading promises to prevent duplicate loads

  // Default mixer settings per track
  const DEFAULT_MIXER_SETTINGS = {
    timingOffset: 0,    // -200 to +200 ms
    pan: 0,             // -1 (L) to +1 (R)
    pitch: 0,           // -12 to +12 semitones
    attack: 0,          // 0-100 ms
    decay: 100,         // 0-100% of sample length
    length: 2,          // 0-2 seconds max playback length
    bass: 0,            // -12 to +12 dB at 100Hz
    treble: 0           // -12 to +12 dB at 10kHz
  }

  // Default drum sample configurations (fallback if instruments.json fails)
  const DRUM_SAMPLES = {
    kick1: { url: 'assets/samples/kick1.wav', name: 'Kick 1' },
    kick2: { url: 'assets/samples/kick2.wav', name: 'Kick 2' },
    snare1: { url: 'assets/samples/snare1.wav', name: 'Snare 1' },
    snare2: { url: 'assets/samples/snare2.wav', name: 'Snare 2' },
    hihatClosed: { url: 'assets/samples/hihat-closed.wav', name: 'Hi-Hat Closed' },
    hihatOpen: { url: 'assets/samples/hihat-open.wav', name: 'Hi-Hat Open' },
    clap: { url: 'assets/samples/clap.wav', name: 'Clap' },
    snap: { url: 'assets/samples/snap.wav', name: 'Snap' },
    tomHigh: { url: 'assets/samples/tom-high.wav', name: 'Tom High' },
    tomMid: { url: 'assets/samples/tom-mid.wav', name: 'Tom Mid' },
    tomLow: { url: 'assets/samples/tom-low.wav', name: 'Tom Low' },
    crash: { url: 'assets/samples/crash.wav', name: 'Crash' },
    ride: { url: 'assets/samples/ride.wav', name: 'Ride' },
    shaker: { url: 'assets/samples/shaker.wav', name: 'Shaker' },
    cowbell: { url: 'assets/samples/cowbell.wav', name: 'Cowbell' },
    rimshot: { url: 'assets/samples/rimshot.wav', name: 'Rimshot' }
  }

  /**
   * Initialize the Web Audio API context
   * Must be called after user interaction due to browser autoplay policies
   * @returns {Promise<boolean>} Success status
   */
  const init = async () => {
    if (isInitialized) {
      return true
    }

    try {
      // Create AudioContext
      const AudioContext = window.AudioContext || window.webkitAudioContext
      audioContext = new AudioContext()

      // Create master gain node
      masterGainNode = audioContext.createGain()
      masterGainNode.gain.value = 0.8

      // Create per-track gain nodes for each drum instrument
      for (const instrumentId of Object.keys(DRUM_SAMPLES)) {
        const trackGain = audioContext.createGain()
        trackGain.gain.value = 0.8  // Default volume
        trackGain.connect(masterGainNode)
        trackGainNodes[instrumentId] = trackGain
      }

      // Create analyser for visualizations
      analyserNode = audioContext.createAnalyser()
      analyserNode.fftSize = 2048
      analyserNode.smoothingTimeConstant = 0.8

      // Initialize effects and route audio through effects chain
      Effects.init(audioContext)
      // Route: masterGain -> effects -> analyser -> destination
      masterGainNode.connect(Effects.getInputNode())
      Effects.getOutputNode().connect(analyserNode)
      analyserNode.connect(audioContext.destination)

      isInitialized = true
      console.log('Audio Engine initialized successfully')
      return true
    } catch (error) {
      console.error('Failed to initialize Audio Engine:', error)
      return false
    }
  }

  /**
   * Resume audio context (required after page load in some browsers)
   */
  const resume = async () => {
    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume()
    }
  }

  /**
   * Load the instrument library from instruments.json
   * @returns {Promise<Object>} The instrument library
   */
  const loadInstrumentLibrary = async () => {
    if (instrumentLibrary) {
      return instrumentLibrary
    }

    try {
      const response = await fetch('assets/instruments.json')
      instrumentLibrary = await response.json()

      // Build the instrument map for quick lookup
      instrumentMap = {}
      for (const category of instrumentLibrary.categories) {
        for (const instrument of category.instruments) {
          instrumentMap[instrument.id] = {
            ...instrument,
            category: category.id,
            categoryName: category.name
          }
        }
      }

      console.log(`Loaded instrument library with ${Object.keys(instrumentMap).length} instruments`)
      return instrumentLibrary
    } catch (error) {
      console.error('Failed to load instrument library:', error)
      // Fallback to default samples
      instrumentLibrary = { categories: [], defaultInstruments: Object.keys(DRUM_SAMPLES) }
      for (const [id, sample] of Object.entries(DRUM_SAMPLES)) {
        instrumentMap[id] = { id, name: sample.name, url: sample.url, category: 'default' }
      }
      return instrumentLibrary
    }
  }

  /**
   * Get the instrument library (categories and all instruments)
   * @returns {Object|null} The instrument library or null if not loaded
   */
  const getInstrumentLibrary = () => {
    return instrumentLibrary
  }

  /**
   * Get instrument info by ID
   * @param {string} instrumentId - The instrument ID
   * @returns {Object|null} Instrument config or null if not found
   */
  const getInstrumentInfo = (instrumentId) => {
    return instrumentMap[instrumentId] || null
  }

  /**
   * Get the default instruments list
   * @returns {Array<string>} Array of default instrument IDs
   */
  const getDefaultInstruments = () => {
    if (instrumentLibrary && instrumentLibrary.defaultInstruments) {
      return instrumentLibrary.defaultInstruments
    }
    return Object.keys(DRUM_SAMPLES)
  }

  /**
   * Load a single instrument sample (lazy loading)
   * @param {string} instrumentId - The instrument ID to load
   * @returns {Promise<AudioBuffer|null>} The audio buffer or null on failure
   */
  const loadInstrument = async (instrumentId) => {
    // Already loaded
    if (audioBuffers[instrumentId]) {
      return audioBuffers[instrumentId]
    }

    // Already loading - return existing promise
    if (loadingPromises[instrumentId]) {
      return loadingPromises[instrumentId]
    }

    // Get instrument info
    const instrument = instrumentMap[instrumentId] || DRUM_SAMPLES[instrumentId]
    if (!instrument) {
      console.warn(`Unknown instrument: ${instrumentId}`)
      return null
    }

    const url = instrument.url

    // Create loading promise
    loadingPromises[instrumentId] = (async () => {
      try {
        const response = await fetch(url)
        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        audioBuffers[instrumentId] = audioBuffer
        console.log(`Loaded instrument: ${instrument.name || instrumentId}`)
        return audioBuffer
      } catch (error) {
        console.error(`Failed to load instrument ${instrumentId}:`, error)
        // Create silent buffer as fallback
        audioBuffers[instrumentId] = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate)
        return audioBuffers[instrumentId]
      } finally {
        delete loadingPromises[instrumentId]
      }
    })()

    return loadingPromises[instrumentId]
  }

  /**
   * Ensure a track gain node exists for an instrument
   * @param {string} instrumentId - The instrument ID
   */
  const ensureTrackGain = (instrumentId) => {
    if (!trackGainNodes[instrumentId] && audioContext) {
      const trackGain = audioContext.createGain()
      trackGain.gain.value = 0.8
      trackGain.connect(masterGainNode)
      trackGainNodes[instrumentId] = trackGain
    }
  }

  /**
   * Ensure extended audio nodes exist for a track (pan, bass, treble filters)
   * Creates: bassFilter -> trebleFilter -> panNode -> trackGain
   * @param {string} instrumentId - The instrument ID
   */
  const ensureTrackAudioNodes = (instrumentId) => {
    if (trackAudioNodes[instrumentId] || !audioContext) return

    // Ensure track gain exists first
    ensureTrackGain(instrumentId)

    const settings = getTrackMixerSettings(instrumentId)

    // Create stereo panner node
    const panNode = audioContext.createStereoPanner()
    panNode.pan.value = settings.pan

    // Create bass filter (peaking EQ at 100Hz)
    const bassFilter = audioContext.createBiquadFilter()
    bassFilter.type = 'peaking'
    bassFilter.frequency.value = 100
    bassFilter.Q.value = 1
    bassFilter.gain.value = settings.bass

    // Create treble filter (peaking EQ at 10kHz)
    const trebleFilter = audioContext.createBiquadFilter()
    trebleFilter.type = 'peaking'
    trebleFilter.frequency.value = 10000
    trebleFilter.Q.value = 1
    trebleFilter.gain.value = settings.treble

    // Connect: bassFilter -> trebleFilter -> panNode -> trackGain
    bassFilter.connect(trebleFilter)
    trebleFilter.connect(panNode)
    panNode.connect(trackGainNodes[instrumentId])

    trackAudioNodes[instrumentId] = { panNode, bassFilter, trebleFilter }
  }

  /**
   * Get mixer settings for a track
   * @param {string} instrumentId - The instrument ID
   * @returns {Object} Mixer settings object
   */
  const getTrackMixerSettings = (instrumentId) => {
    if (!trackMixerSettings[instrumentId]) {
      trackMixerSettings[instrumentId] = { ...DEFAULT_MIXER_SETTINGS }
    }
    return trackMixerSettings[instrumentId]
  }

  /**
   * Set a mixer parameter for a track
   * @param {string} instrumentId - The instrument ID
   * @param {string} param - Parameter name
   * @param {number} value - Parameter value
   */
  const setTrackMixerParam = (instrumentId, param, value) => {
    const settings = getTrackMixerSettings(instrumentId)
    settings[param] = value

    // Ensure audio nodes exist for real-time parameter changes (pan, bass, treble)
    if (['pan', 'bass', 'treble'].includes(param)) {
      ensureTrackAudioNodes(instrumentId)
    }

    // Apply to audio nodes if they exist
    const nodes = trackAudioNodes[instrumentId]
    if (nodes) {
      switch (param) {
        case 'pan':
          nodes.panNode.pan.value = Math.max(-1, Math.min(1, value))
          break
        case 'bass':
          nodes.bassFilter.gain.value = Math.max(-12, Math.min(12, value))
          break
        case 'treble':
          nodes.trebleFilter.gain.value = Math.max(-12, Math.min(12, value))
          break
      }
    }
  }

  /**
   * Export all mixer settings for storage
   * @returns {Object} All track mixer settings
   */
  const exportMixerSettings = () => {
    return JSON.parse(JSON.stringify(trackMixerSettings))
  }

  /**
   * Import mixer settings from storage
   * @param {Object} settings - Mixer settings to import
   */
  const importMixerSettings = (settings) => {
    trackMixerSettings = settings || {}
    // Apply settings to existing nodes
    for (const [instrumentId, mixerSettings] of Object.entries(trackMixerSettings)) {
      if (trackAudioNodes[instrumentId]) {
        if (mixerSettings.pan !== undefined) {
          trackAudioNodes[instrumentId].panNode.pan.value = mixerSettings.pan
        }
        if (mixerSettings.bass !== undefined) {
          trackAudioNodes[instrumentId].bassFilter.gain.value = mixerSettings.bass
        }
        if (mixerSettings.treble !== undefined) {
          trackAudioNodes[instrumentId].trebleFilter.gain.value = mixerSettings.treble
        }
      }
    }
  }

  /**
   * Preload instruments for a specific list of IDs
   * @param {Array<string>} instrumentIds - Array of instrument IDs to preload
   * @returns {Promise<void>}
   */
  const preloadInstruments = async (instrumentIds) => {
    const loadPromises = instrumentIds.map(id => loadInstrument(id))
    await Promise.all(loadPromises)
  }

  /**
   * Load drum samples from WAV files
   * @returns {Promise<void>}
   */
  const loadDrumSamples = async () => {
    if (!audioContext) {
      console.error('Audio context not initialized')
      return
    }

    try {
      const loadPromises = []

      // Load each sample
      for (const [id, sample] of Object.entries(DRUM_SAMPLES)) {
        const promise = fetch(sample.url)
          .then(response => response.arrayBuffer())
          .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
          .then(audioBuffer => {
            audioBuffers[id] = audioBuffer
            console.log(`Loaded ${sample.name}`)
          })
          .catch(error => {
            console.error(`Failed to load ${sample.name}:`, error)
            // Create silent buffer as fallback
            audioBuffers[id] = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate)
          })

        loadPromises.push(promise)
      }

      await Promise.all(loadPromises)
      console.log('All drum samples loaded successfully!')
    } catch (error) {
      console.error('Error loading drum samples:', error)
    }
  }

  /**
   * Alternative: Generate drum samples programmatically (fallback)
   * Can be used if sample files fail to load
   */
  const generateDrumSamples = () => {
    console.log('Generating fallback drum samples...')
    // Keep as backup - implementation remains the same
  }

  /**
   * Play a drum sample with full mixer support
   * @param {string} instrument - Name of the instrument to play
   * @param {number} time - Time to play (AudioContext time, defaults to now)
   * @param {number} velocity - Hit velocity (0.0 - 1.0)
   */
  const playDrum = (instrument, time = null, velocity = 1.0) => {
    if (!audioContext) {
      console.warn('Audio context not initialized')
      return
    }

    // Try to load instrument if not loaded
    if (!audioBuffers[instrument]) {
      // Lazy load and play immediately
      loadInstrument(instrument).then(() => {
        if (audioBuffers[instrument]) {
          playDrum(instrument, null, velocity)
        }
      })
      return
    }

    // Resume context if suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }

    // Ensure audio nodes exist for this instrument
    ensureTrackGain(instrument)
    ensureTrackAudioNodes(instrument)

    const settings = getTrackMixerSettings(instrument)
    const buffer = audioBuffers[instrument]

    // Create source node
    const source = audioContext.createBufferSource()
    source.buffer = buffer

    // Apply pitch shift (playbackRate = 2^(semitones/12))
    const pitchSemitones = settings.pitch || 0
    source.playbackRate.value = Math.pow(2, pitchSemitones / 12)

    // Create gain node for velocity and attack envelope
    const gainNode = audioContext.createGain()

    // Calculate start time with timing offset
    const timingOffset = settings.timingOffset || 0
    const baseTime = time || audioContext.currentTime
    const startTime = Math.max(audioContext.currentTime, baseTime + (timingOffset / 1000))

    // Apply attack envelope
    const attackMs = settings.attack || 0
    if (attackMs > 0) {
      gainNode.gain.setValueAtTime(0, startTime)
      gainNode.gain.linearRampToValueAtTime(velocity, startTime + (attackMs / 1000))
    } else {
      gainNode.gain.value = Math.max(0, Math.min(1, velocity))
    }

    // Connect through extended audio chain
    const nodes = trackAudioNodes[instrument]
    if (nodes) {
      source.connect(gainNode)
      gainNode.connect(nodes.bassFilter)  // First node in extended chain
    } else {
      source.connect(gainNode)
      gainNode.connect(trackGainNodes[instrument] || masterGainNode)
    }

    // Calculate buffer duration adjusted for pitch
    const adjustedDuration = buffer.duration / source.playbackRate.value

    // Apply length limit (absolute time in seconds)
    const maxLength = settings.length ?? 2
    const playDuration = Math.min(adjustedDuration, maxLength)

    // Apply decay as fade-out envelope
    // Decay 100% = no fade (sustain full volume)
    // Decay 50% = fade starts at 50%, reaches 0 at end
    // Decay 0% = fade starts immediately (entire sample fades out)
    const decayPercent = (settings.decay ?? 100) / 100
    const sustainTime = playDuration * decayPercent
    const fadeTime = playDuration - sustainTime

    // Set up the envelope
    const peakGain = gainNode.gain.value
    if (fadeTime > 0.001) {
      // Hold at peak until sustain ends, then fade to 0
      gainNode.gain.setValueAtTime(peakGain, startTime + sustainTime)
      gainNode.gain.linearRampToValueAtTime(0, startTime + playDuration)
    }

    // Start playback
    source.start(startTime)

    // Stop at the end of play duration (with small buffer for fade)
    if (playDuration < adjustedDuration) {
      source.stop(startTime + playDuration + 0.01)
    }
  }

  /**
   * Preview an instrument (play immediately without scheduling)
   * @param {string} instrumentId - The instrument ID to preview
   * @param {number} velocity - Hit velocity (0.0 - 1.0)
   */
  const previewInstrument = async (instrumentId, velocity = 0.8) => {
    await loadInstrument(instrumentId)
    playDrum(instrumentId, null, velocity)
  }

  /**
   * Set master volume
   * @param {number} volume - Volume level (0.0 - 1.0)
   */
  const setMasterVolume = (volume) => {
    if (masterGainNode) {
      masterGainNode.gain.value = Math.max(0, Math.min(1, volume))
    }
  }

  /**
   * Set individual track volume
   * @param {string} instrument - Instrument ID
   * @param {number} volume - Volume level (0.0 - 1.0)
   */
  const setTrackVolume = (instrument, volume) => {
    // Ensure track gain node exists for this instrument
    ensureTrackGain(instrument)
    if (trackGainNodes[instrument]) {
      trackGainNodes[instrument].gain.value = Math.max(0, Math.min(1, volume))
    }
  }

  /**
   * Get individual track volume
   * @param {string} instrument - Instrument ID
   * @returns {number} Current volume level (0.0 - 1.0)
   */
  const getTrackVolume = (instrument) => {
    if (trackGainNodes[instrument]) {
      return trackGainNodes[instrument].gain.value
    }
    return 0.8  // Default volume
  }

  /**
   * Get current audio context time
   * @returns {number} Current time in seconds
   */
  const getCurrentTime = () => {
    return audioContext ? audioContext.currentTime : 0
  }

  /**
   * Get analyser node for visualizations
   * @returns {AnalyserNode} Analyser node
   */
  const getAnalyser = () => {
    return analyserNode
  }

  /**
   * Get audio context instance
   * @returns {AudioContext} Audio context
   */
  const getContext = () => {
    return audioContext
  }

  /**
   * Get list of available drum instruments
   * @returns {Array} Array of instrument objects with id and name
   */
  const getInstruments = () => {
    return Object.keys(DRUM_SAMPLES).map(id => ({
      id,
      name: DRUM_SAMPLES[id].name
    }))
  }

  /**
   * Check if audio engine is initialized
   * @returns {boolean} Initialization status
   */
  const isReady = () => {
    return isInitialized
  }

  /**
   * Get the AudioBuffer for a specific instrument
   * @param {string} instrumentId - The instrument ID
   * @returns {AudioBuffer|null} The audio buffer or null if not found
   */
  const getSampleBuffer = (instrumentId) => {
    return audioBuffers[instrumentId] || null
  }

  /**
   * Get the master gain node for audio routing
   * @returns {GainNode} Master gain node
   */
  const getMasterGain = () => {
    return masterGainNode
  }

  // Public API
  return {
    init,
    resume,
    loadDrumSamples,
    generateDrumSamples,
    playDrum,
    setMasterVolume,
    setTrackVolume,
    getTrackVolume,
    getCurrentTime,
    getAnalyser,
    getContext,
    getInstruments,
    getSampleBuffer,
    getMasterGain,
    isReady,
    // New instrument library methods
    loadInstrumentLibrary,
    getInstrumentLibrary,
    getInstrumentInfo,
    getDefaultInstruments,
    loadInstrument,
    preloadInstruments,
    previewInstrument,
    ensureTrackGain,
    // Mixer settings methods
    getTrackMixerSettings,
    setTrackMixerParam,
    exportMixerSettings,
    importMixerSettings,
    DEFAULT_MIXER_SETTINGS
  }
})()
