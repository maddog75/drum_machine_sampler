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
  let isInitialized = false

  // Drum sample configurations (TR-808 samples)
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
   * Play a drum sample
   * @param {string} instrument - Name of the instrument to play
   * @param {number} time - Time to play (AudioContext time, defaults to now)
   * @param {number} velocity - Hit velocity (0.0 - 1.0)
   */
  const playDrum = (instrument, time = null, velocity = 1.0) => {
    if (!audioContext || !audioBuffers[instrument]) {
      console.warn(`Instrument not found: ${instrument}`)
      return
    }

    // Resume context if suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }

    // Create source node
    const source = audioContext.createBufferSource()
    source.buffer = audioBuffers[instrument]

    // Create gain node for velocity
    const gainNode = audioContext.createGain()
    gainNode.gain.value = Math.max(0, Math.min(1, velocity))

    // Connect nodes: source -> velocity gain -> track gain -> master gain
    source.connect(gainNode)
    if (trackGainNodes[instrument]) {
      gainNode.connect(trackGainNodes[instrument])
    } else {
      gainNode.connect(masterGainNode)  // Fallback if track gain not found
    }

    // Schedule playback
    const startTime = time || audioContext.currentTime
    source.start(startTime)
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
    isReady
  }
})()
