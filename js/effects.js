/**
 * Effects Module
 * Provides audio effects: reverb, delay, and distortion
 */

const Effects = (() => {
  // Private variables
  let audioContext = null
  let effectsChain = []
  let bypassAll = false

  // Effect nodes
  let reverbNode = null
  let delayNode = null
  let distortionNode = null
  let inputGain = null
  let outputGain = null

  // Effect parameters
  let effectsSettings = {
    reverb: {
      enabled: false,
      wetDry: 0.3,
      decayTime: 2.0,
      preDelay: 0.03
    },
    delay: {
      enabled: false,
      wetDry: 0.5,
      delayTime: 0.375,
      feedback: 0.4
    },
    distortion: {
      enabled: false,
      amount: 0.5,
      tone: 0.5
    }
  }

  /**
   * Initialize effects
   * @param {AudioContext} context - Audio context
   */
  const init = (context) => {
    audioContext = context

    // Create input and output gains
    inputGain = audioContext.createGain()
    outputGain = audioContext.createGain()

    // Initialize all effects
    initReverb()
    initDelay()
    initDistortion()

    console.log('Effects initialized')
  }

  /**
   * Initialize reverb effect
   */
  const initReverb = () => {
    reverbNode = audioContext.createConvolver()
    reverbNode.wetGain = audioContext.createGain()
    reverbNode.dryGain = audioContext.createGain()

    // Generate impulse response for reverb
    generateReverbImpulse(2.0)

    reverbNode.wetGain.gain.value = effectsSettings.reverb.wetDry
    reverbNode.dryGain.gain.value = 1 - effectsSettings.reverb.wetDry
  }

  /**
   * Generate impulse response for reverb
   * @param {number} duration - Duration in seconds
   */
  const generateReverbImpulse = (duration) => {
    const sampleRate = audioContext.sampleRate
    const length = sampleRate * duration
    const impulse = audioContext.createBuffer(2, length, sampleRate)
    const leftChannel = impulse.getChannelData(0)
    const rightChannel = impulse.getChannelData(1)

    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (sampleRate * (duration / 4)))
      leftChannel[i] = (Math.random() * 2 - 1) * decay
      rightChannel[i] = (Math.random() * 2 - 1) * decay
    }

    reverbNode.buffer = impulse
  }

  /**
   * Initialize delay effect
   */
  const initDelay = () => {
    delayNode = {
      input: audioContext.createGain(),
      output: audioContext.createGain(),
      delay: audioContext.createDelay(5.0),
      feedback: audioContext.createGain(),
      wetGain: audioContext.createGain(),
      dryGain: audioContext.createGain()
    }

    // Set default values
    delayNode.delay.delayTime.value = effectsSettings.delay.delayTime
    delayNode.feedback.gain.value = effectsSettings.delay.feedback
    delayNode.wetGain.gain.value = effectsSettings.delay.wetDry
    delayNode.dryGain.gain.value = 1 - effectsSettings.delay.wetDry

    // Connect delay chain
    delayNode.input.connect(delayNode.delay)
    delayNode.delay.connect(delayNode.feedback)
    delayNode.feedback.connect(delayNode.delay)
    delayNode.delay.connect(delayNode.wetGain)
    delayNode.wetGain.connect(delayNode.output)
    delayNode.input.connect(delayNode.dryGain)
    delayNode.dryGain.connect(delayNode.output)
  }

  /**
   * Initialize distortion effect
   */
  const initDistortion = () => {
    distortionNode = {
      input: audioContext.createGain(),
      output: audioContext.createGain(),
      waveshaper: audioContext.createWaveShaper(),
      lowpass: audioContext.createBiquadFilter()
    }

    distortionNode.lowpass.type = 'lowpass'
    distortionNode.lowpass.frequency.value = 2000

    // Generate distortion curve
    generateDistortionCurve(effectsSettings.distortion.amount)

    // Connect distortion chain
    distortionNode.input.connect(distortionNode.waveshaper)
    distortionNode.waveshaper.connect(distortionNode.lowpass)
    distortionNode.lowpass.connect(distortionNode.output)
  }

  /**
   * Generate distortion curve
   * @param {number} amount - Distortion amount (0-1)
   */
  const generateDistortionCurve = (amount) => {
    const samples = 44100
    const curve = new Float32Array(samples)
    const k = amount * 100

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x))
    }

    distortionNode.waveshaper.curve = curve
  }

  /**
   * Connect effects chain
   * @param {AudioNode} source - Source node
   * @param {AudioNode} destination - Destination node
   */
  const connect = (source, destination) => {
    if (!audioContext) {
      console.error('Effects not initialized')
      return
    }

    // Connect source to input
    source.connect(inputGain)

    // Build effects chain
    let currentNode = inputGain

    if (effectsSettings.reverb.enabled) {
      currentNode.connect(reverbNode)
      currentNode.connect(reverbNode.dryGain)
      reverbNode.connect(reverbNode.wetGain)
      reverbNode.wetGain.connect(outputGain)
      reverbNode.dryGain.connect(outputGain)
      currentNode = outputGain
    }

    if (effectsSettings.delay.enabled) {
      const prevNode = currentNode
      currentNode = delayNode.output
      prevNode.connect(delayNode.input)
    }

    if (effectsSettings.distortion.enabled) {
      const prevNode = currentNode
      currentNode = distortionNode.output
      prevNode.connect(distortionNode.input)
    }

    // Connect to final destination
    currentNode.connect(destination)

    // If no effects enabled, direct connection
    if (!effectsSettings.reverb.enabled && !effectsSettings.delay.enabled && !effectsSettings.distortion.enabled) {
      inputGain.connect(destination)
    }
  }

  /**
   * Set reverb parameters
   * @param {Object} params - Reverb parameters {wetDry, decayTime}
   */
  const setReverb = (params) => {
    if (params.wetDry !== undefined) {
      effectsSettings.reverb.wetDry = Math.max(0, Math.min(1, params.wetDry))
      if (reverbNode.wetGain) reverbNode.wetGain.gain.value = effectsSettings.reverb.wetDry
      if (reverbNode.dryGain) reverbNode.dryGain.gain.value = 1 - effectsSettings.reverb.wetDry
    }

    if (params.decayTime !== undefined) {
      effectsSettings.reverb.decayTime = Math.max(0.1, Math.min(10, params.decayTime))
      generateReverbImpulse(effectsSettings.reverb.decayTime)
    }

    if (params.enabled !== undefined) {
      effectsSettings.reverb.enabled = params.enabled
    }
  }

  /**
   * Set delay parameters
   * @param {Object} params - Delay parameters {wetDry, delayTime, feedback}
   */
  const setDelay = (params) => {
    if (params.wetDry !== undefined) {
      effectsSettings.delay.wetDry = Math.max(0, Math.min(1, params.wetDry))
      delayNode.wetGain.gain.value = effectsSettings.delay.wetDry
      delayNode.dryGain.gain.value = 1 - effectsSettings.delay.wetDry
    }

    if (params.delayTime !== undefined) {
      effectsSettings.delay.delayTime = Math.max(0.001, Math.min(5, params.delayTime))
      delayNode.delay.delayTime.value = effectsSettings.delay.delayTime
    }

    if (params.feedback !== undefined) {
      effectsSettings.delay.feedback = Math.max(0, Math.min(0.9, params.feedback))
      delayNode.feedback.gain.value = effectsSettings.delay.feedback
    }

    if (params.enabled !== undefined) {
      effectsSettings.delay.enabled = params.enabled
    }
  }

  /**
   * Set distortion parameters
   * @param {Object} params - Distortion parameters {amount, tone}
   */
  const setDistortion = (params) => {
    if (params.amount !== undefined) {
      effectsSettings.distortion.amount = Math.max(0, Math.min(1, params.amount))
      generateDistortionCurve(effectsSettings.distortion.amount)
    }

    if (params.tone !== undefined) {
      effectsSettings.distortion.tone = Math.max(0, Math.min(1, params.tone))
      const frequency = 500 + (effectsSettings.distortion.tone * 4500)
      distortionNode.lowpass.frequency.value = frequency
    }

    if (params.enabled !== undefined) {
      effectsSettings.distortion.enabled = params.enabled
    }
  }

  /**
   * Toggle effect on/off
   * @param {string} effectName - Name of effect ('reverb', 'delay', 'distortion')
   * @param {boolean} enabled - Enable/disable
   */
  const toggleEffect = (effectName, enabled) => {
    if (effectsSettings[effectName]) {
      effectsSettings[effectName].enabled = enabled
    }
  }

  /**
   * Get current effects settings
   * @returns {Object} Effects settings
   */
  const getSettings = () => {
    return JSON.parse(JSON.stringify(effectsSettings))
  }

  /**
   * Load effects settings
   * @param {Object} settings - Effects settings
   */
  const loadSettings = (settings) => {
    if (settings.reverb) setReverb(settings.reverb)
    if (settings.delay) setDelay(settings.delay)
    if (settings.distortion) setDistortion(settings.distortion)
  }

  /**
   * Bypass all effects
   * @param {boolean} bypass - Bypass state
   */
  const setBypass = (bypass) => {
    bypassAll = bypass
  }

  /**
   * Get input gain node
   * @returns {GainNode} Input gain node
   */
  const getInputNode = () => {
    return inputGain
  }

  /**
   * Get output gain node
   * @returns {GainNode} Output gain node
   */
  const getOutputNode = () => {
    return outputGain
  }

  // Public API
  return {
    init,
    connect,
    setReverb,
    setDelay,
    setDistortion,
    toggleEffect,
    getSettings,
    loadSettings,
    setBypass,
    getInputNode,
    getOutputNode
  }
})()
