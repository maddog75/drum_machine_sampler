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
  let isInitialized = false

  // Drum sample configurations
  const DRUM_SAMPLES = {
    kick1: { url: null, name: 'Kick 1' },
    kick2: { url: null, name: 'Kick 2' },
    snare1: { url: null, name: 'Snare 1' },
    snare2: { url: null, name: 'Snare 2' },
    hihatClosed: { url: null, name: 'Hi-Hat Closed' },
    hihatOpen: { url: null, name: 'Hi-Hat Open' },
    clap: { url: null, name: 'Clap' },
    snap: { url: null, name: 'Snap' },
    tomHigh: { url: null, name: 'Tom High' },
    tomMid: { url: null, name: 'Tom Mid' },
    tomLow: { url: null, name: 'Tom Low' },
    crash: { url: null, name: 'Crash' },
    ride: { url: null, name: 'Ride' },
    shaker: { url: null, name: 'Shaker' },
    cowbell: { url: null, name: 'Cowbell' },
    rimshot: { url: null, name: 'Rimshot' }
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
      masterGainNode.connect(audioContext.destination)

      // Create analyser for visualizations
      analyserNode = audioContext.createAnalyser()
      analyserNode.fftSize = 2048
      analyserNode.smoothingTimeConstant = 0.8
      masterGainNode.connect(analyserNode)

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
   * Generate drum samples programmatically using Web Audio API
   * This avoids the need for external audio files
   */
  const generateDrumSamples = () => {
    if (!audioContext) return

    // Helper function to create noise buffer
    const createNoiseBuffer = (duration, decay = 0.3) => {
      const sampleRate = audioContext.sampleRate
      const length = sampleRate * duration
      const buffer = audioContext.createBuffer(1, length, sampleRate)
      const data = buffer.getChannelData(0)

      for (let i = 0; i < length; i++) {
        const envelope = Math.exp(-i / (sampleRate * decay))
        data[i] = (Math.random() * 2 - 1) * envelope
      }

      return buffer
    }

    // Helper function to create tone buffer
    const createToneBuffer = (frequency, duration, decay = 0.3) => {
      const sampleRate = audioContext.sampleRate
      const length = sampleRate * duration
      const buffer = audioContext.createBuffer(1, length, sampleRate)
      const data = buffer.getChannelData(0)

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate
        const envelope = Math.exp(-i / (sampleRate * decay))
        data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope
      }

      return buffer
    }

    // Helper function to create kick drum
    const createKick = (frequency = 150, pitchDecay = 0.5) => {
      const sampleRate = audioContext.sampleRate
      const length = sampleRate * 0.5
      const buffer = audioContext.createBuffer(1, length, sampleRate)
      const data = buffer.getChannelData(0)

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate
        const envelope = Math.exp(-t * 6)
        const pitch = frequency * Math.exp(-t / pitchDecay)
        data[i] = Math.sin(2 * Math.PI * pitch * t) * envelope
      }

      return buffer
    }

    // Generate all drum samples
    audioBuffers.kick1 = createKick(150, 0.5)
    audioBuffers.kick2 = createKick(100, 0.4)
    audioBuffers.snare1 = createNoiseBuffer(0.2, 0.1)
    audioBuffers.snare2 = createToneBuffer(200, 0.15, 0.08)
    audioBuffers.hihatClosed = createNoiseBuffer(0.05, 0.02)
    audioBuffers.hihatOpen = createNoiseBuffer(0.3, 0.1)
    audioBuffers.clap = createNoiseBuffer(0.1, 0.05)
    audioBuffers.snap = createNoiseBuffer(0.05, 0.03)
    audioBuffers.tomHigh = createToneBuffer(400, 0.3, 0.2)
    audioBuffers.tomMid = createToneBuffer(250, 0.35, 0.25)
    audioBuffers.tomLow = createToneBuffer(150, 0.4, 0.3)
    audioBuffers.crash = createNoiseBuffer(1.0, 0.5)
    audioBuffers.ride = createNoiseBuffer(0.8, 0.4)
    audioBuffers.shaker = createNoiseBuffer(0.1, 0.05)
    audioBuffers.cowbell = createToneBuffer(800, 0.15, 0.1)
    audioBuffers.rimshot = createNoiseBuffer(0.05, 0.02)

    console.log('Drum samples generated successfully')
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

    // Connect nodes
    source.connect(gainNode)
    gainNode.connect(masterGainNode)

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

  // Public API
  return {
    init,
    resume,
    generateDrumSamples,
    playDrum,
    setMasterVolume,
    getCurrentTime,
    getAnalyser,
    getContext,
    getInstruments,
    isReady
  }
})()
