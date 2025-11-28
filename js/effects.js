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
  let compressorNode = null
  let eqNode = null
  let filterNode = null
  let chorusNode = null
  let phaserNode = null
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
    },
    compressor: {
      enabled: false,
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.25
    },
    eq: {
      enabled: false,
      low: 0,      // -15 to +15 dB
      mid: 0,      // -15 to +15 dB
      high: 0      // -15 to +15 dB
    },
    filter: {
      enabled: false,
      type: 'lowpass',
      frequency: 1000,
      resonance: 1
    },
    chorus: {
      enabled: false,
      rate: 1.5,
      depth: 0.002,
      mix: 0.5
    },
    phaser: {
      enabled: false,
      rate: 0.5,
      depth: 0.5,
      feedback: 0.5
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
    initCompressor()
    initEQ()
    initFilter()
    initChorus()
    initPhaser()

    // Build the default effects chain (all bypassed initially)
    buildEffectsChain()

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
   * Initialize compressor effect
   */
  const initCompressor = () => {
    compressorNode = audioContext.createDynamicsCompressor()
    compressorNode.threshold.value = effectsSettings.compressor.threshold
    compressorNode.ratio.value = effectsSettings.compressor.ratio
    compressorNode.attack.value = effectsSettings.compressor.attack
    compressorNode.release.value = effectsSettings.compressor.release
  }

  /**
   * Initialize 3-band EQ effect
   */
  const initEQ = () => {
    eqNode = {
      input: audioContext.createGain(),
      output: audioContext.createGain(),
      lowBand: audioContext.createBiquadFilter(),
      midBand: audioContext.createBiquadFilter(),
      highBand: audioContext.createBiquadFilter()
    }

    // Configure low band (100 Hz peaking filter)
    eqNode.lowBand.type = 'peaking'
    eqNode.lowBand.frequency.value = 100
    eqNode.lowBand.Q.value = 1.0
    eqNode.lowBand.gain.value = effectsSettings.eq.low

    // Configure mid band (1000 Hz peaking filter)
    eqNode.midBand.type = 'peaking'
    eqNode.midBand.frequency.value = 1000
    eqNode.midBand.Q.value = 1.0
    eqNode.midBand.gain.value = effectsSettings.eq.mid

    // Configure high band (10000 Hz peaking filter)
    eqNode.highBand.type = 'peaking'
    eqNode.highBand.frequency.value = 10000
    eqNode.highBand.Q.value = 1.0
    eqNode.highBand.gain.value = effectsSettings.eq.high

    // Connect EQ chain: input -> low -> mid -> high -> output
    eqNode.input.connect(eqNode.lowBand)
    eqNode.lowBand.connect(eqNode.midBand)
    eqNode.midBand.connect(eqNode.highBand)
    eqNode.highBand.connect(eqNode.output)
  }

  /**
   * Initialize filter effect
   */
  const initFilter = () => {
    filterNode = audioContext.createBiquadFilter()
    filterNode.type = effectsSettings.filter.type
    filterNode.frequency.value = effectsSettings.filter.frequency
    filterNode.Q.value = effectsSettings.filter.resonance
  }

  /**
   * Initialize chorus effect
   */
  const initChorus = () => {
    chorusNode = {
      input: audioContext.createGain(),
      output: audioContext.createGain(),
      delay: audioContext.createDelay(1.0),
      lfo: audioContext.createOscillator(),
      depth: audioContext.createGain(),
      wetGain: audioContext.createGain(),
      dryGain: audioContext.createGain()
    }

    // Set default values
    chorusNode.lfo.frequency.value = effectsSettings.chorus.rate
    chorusNode.depth.gain.value = effectsSettings.chorus.depth
    chorusNode.delay.delayTime.value = 0.02  // Base delay 20ms
    chorusNode.wetGain.gain.value = effectsSettings.chorus.mix
    chorusNode.dryGain.gain.value = 1 - effectsSettings.chorus.mix

    // Connect chorus chain
    chorusNode.lfo.connect(chorusNode.depth)
    chorusNode.depth.connect(chorusNode.delay.delayTime)
    chorusNode.input.connect(chorusNode.delay)
    chorusNode.delay.connect(chorusNode.wetGain)
    chorusNode.wetGain.connect(chorusNode.output)
    chorusNode.input.connect(chorusNode.dryGain)
    chorusNode.dryGain.connect(chorusNode.output)

    // Start LFO
    chorusNode.lfo.start()
  }

  /**
   * Initialize phaser effect
   */
  const initPhaser = () => {
    phaserNode = {
      input: audioContext.createGain(),
      output: audioContext.createGain(),
      filters: [],
      lfo: audioContext.createOscillator(),
      depth: audioContext.createGain(),
      feedback: audioContext.createGain(),
      wetGain: audioContext.createGain(),
      dryGain: audioContext.createGain()
    }

    // Create 6 all-pass filters for more pronounced phasing
    // Spread across a wider frequency range for more dramatic effect
    const baseFrequencies = [200, 400, 800, 1600, 3200, 6400]
    for (let i = 0; i < 6; i++) {
      const filter = audioContext.createBiquadFilter()
      filter.type = 'allpass'
      filter.frequency.value = baseFrequencies[i]
      filter.Q.value = 1.0
      phaserNode.filters.push(filter)
    }

    // Set default values with more wet signal for dramatic effect
    phaserNode.lfo.frequency.value = effectsSettings.phaser.rate
    phaserNode.depth.gain.value = 2000 * effectsSettings.phaser.depth  // Increased from 1000
    phaserNode.feedback.gain.value = 0  // Start with no feedback, controlled separately
    phaserNode.wetGain.gain.value = 0.7  // More wet signal
    phaserNode.dryGain.gain.value = 0.3  // Less dry signal

    // Connect phaser chain with wet/dry mix
    phaserNode.lfo.connect(phaserNode.depth)

    // Wet path: Connect filters in series
    let currentNode = phaserNode.input
    for (const filter of phaserNode.filters) {
      currentNode.connect(filter)
      phaserNode.depth.connect(filter.frequency)
      currentNode = filter
    }

    // Connect filtered signal to wet gain and output
    currentNode.connect(phaserNode.wetGain)
    phaserNode.wetGain.connect(phaserNode.output)

    // Dry path: Direct connection from input to output
    phaserNode.input.connect(phaserNode.dryGain)
    phaserNode.dryGain.connect(phaserNode.output)

    // Feedback path: Add resonance (controlled by feedback parameter)
    currentNode.connect(phaserNode.feedback)
    phaserNode.feedback.connect(phaserNode.filters[0])

    // Start LFO
    phaserNode.lfo.start()
  }

  /**
   * Build/rebuild the effects chain based on current settings
   */
  const buildEffectsChain = () => {
    if (!audioContext) return

    // Disconnect everything first
    try {
      inputGain.disconnect()
      // Note: Don't disconnect outputGain - it's connected externally to analyser/destination
      if (reverbNode) {
        reverbNode.disconnect()
        if (reverbNode.wetGain) reverbNode.wetGain.disconnect()
        if (reverbNode.dryGain) reverbNode.dryGain.disconnect()
      }
      if (delayNode) {
        delayNode.output.disconnect()
      }
      if (distortionNode) {
        distortionNode.output.disconnect()
      }
      if (compressorNode) {
        compressorNode.disconnect()
      }
      if (eqNode) {
        eqNode.output.disconnect()
      }
      if (filterNode) {
        filterNode.disconnect()
      }
      if (chorusNode) {
        chorusNode.output.disconnect()
      }
      if (phaserNode) {
        phaserNode.output.disconnect()
      }
    } catch (e) {
      // Ignore errors from disconnecting already disconnected nodes
    }

    // Build chain: input -> [effects] -> output
    let currentNode = inputGain

    // Add compressor first (dynamics control)
    if (effectsSettings.compressor.enabled) {
      currentNode.connect(compressorNode)
      currentNode = compressorNode
    }

    // Add EQ second (tone shaping)
    if (effectsSettings.eq.enabled) {
      currentNode.connect(eqNode.input)
      currentNode = eqNode.output
    }

    // Add distortion third
    if (effectsSettings.distortion.enabled) {
      currentNode.connect(distortionNode.input)
      currentNode = distortionNode.output
    }

    // Add filter fourth
    if (effectsSettings.filter.enabled) {
      currentNode.connect(filterNode)
      currentNode = filterNode
    }

    // Add chorus fourth
    if (effectsSettings.chorus.enabled) {
      currentNode.connect(chorusNode.input)
      currentNode = chorusNode.output
    }

    // Add phaser fifth
    if (effectsSettings.phaser.enabled) {
      currentNode.connect(phaserNode.input)
      currentNode = phaserNode.output
    }

    // Add delay sixth
    if (effectsSettings.delay.enabled) {
      currentNode.connect(delayNode.input)
      currentNode = delayNode.output
    }

    // Add reverb last (always connect output)
    if (effectsSettings.reverb.enabled) {
      currentNode.connect(reverbNode)
      currentNode.connect(reverbNode.dryGain)
      reverbNode.connect(reverbNode.wetGain)
      reverbNode.wetGain.connect(outputGain)
      reverbNode.dryGain.connect(outputGain)
    } else {
      // If reverb not enabled, connect current node to output
      currentNode.connect(outputGain)
    }

    // If no effects are enabled, ensure direct connection
    const anyEffectEnabled = Object.values(effectsSettings).some(effect => effect.enabled)
    if (!anyEffectEnabled) {
      inputGain.connect(outputGain)
    }
  }

  /**
   * Set reverb parameters
   * @param {Object} params - Reverb parameters {wetDry, decayTime}
   */
  const setReverb = (params) => {
    if (!reverbNode) return // Not initialized yet

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
      buildEffectsChain() // Rebuild chain when enabling/disabling
    }
  }

  /**
   * Set delay parameters
   * @param {Object} params - Delay parameters {wetDry, delayTime, feedback}
   */
  const setDelay = (params) => {
    if (!delayNode) return // Not initialized yet

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
      buildEffectsChain() // Rebuild chain when enabling/disabling
    }
  }

  /**
   * Set distortion parameters
   * @param {Object} params - Distortion parameters {amount, tone}
   */
  const setDistortion = (params) => {
    if (!distortionNode) return // Not initialized yet

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
      buildEffectsChain() // Rebuild chain when enabling/disabling
    }
  }

  /**
   * Set compressor parameters
   * @param {Object} params - Compressor parameters {threshold, ratio, attack, release}
   */
  const setCompressor = (params) => {
    if (!compressorNode) return // Not initialized yet

    if (params.threshold !== undefined) {
      effectsSettings.compressor.threshold = Math.max(-100, Math.min(0, params.threshold))
      compressorNode.threshold.value = effectsSettings.compressor.threshold
    }

    if (params.ratio !== undefined) {
      effectsSettings.compressor.ratio = Math.max(1, Math.min(20, params.ratio))
      compressorNode.ratio.value = effectsSettings.compressor.ratio
    }

    if (params.attack !== undefined) {
      effectsSettings.compressor.attack = Math.max(0, Math.min(1, params.attack))
      compressorNode.attack.value = effectsSettings.compressor.attack
    }

    if (params.release !== undefined) {
      effectsSettings.compressor.release = Math.max(0, Math.min(1, params.release))
      compressorNode.release.value = effectsSettings.compressor.release
    }

    if (params.enabled !== undefined) {
      effectsSettings.compressor.enabled = params.enabled
      buildEffectsChain() // Rebuild chain when enabling/disabling
    }
  }

  /**
   * Set 3-band EQ parameters
   * @param {Object} params - EQ parameters {low, mid, high} in dB (-15 to +15)
   */
  const setEQ = (params) => {
    if (!eqNode) return // Not initialized yet

    if (params.low !== undefined) {
      effectsSettings.eq.low = Math.max(-15, Math.min(15, params.low))
      eqNode.lowBand.gain.value = effectsSettings.eq.low
    }

    if (params.mid !== undefined) {
      effectsSettings.eq.mid = Math.max(-15, Math.min(15, params.mid))
      eqNode.midBand.gain.value = effectsSettings.eq.mid
    }

    if (params.high !== undefined) {
      effectsSettings.eq.high = Math.max(-15, Math.min(15, params.high))
      eqNode.highBand.gain.value = effectsSettings.eq.high
    }

    if (params.enabled !== undefined) {
      effectsSettings.eq.enabled = params.enabled
      buildEffectsChain() // Rebuild chain when enabling/disabling
    }
  }

  /**
   * Set filter parameters
   * @param {Object} params - Filter parameters {type, frequency, resonance}
   */
  const setFilter = (params) => {
    if (!filterNode) return // Not initialized yet

    if (params.type !== undefined) {
      effectsSettings.filter.type = params.type
      filterNode.type = params.type
    }

    if (params.frequency !== undefined) {
      effectsSettings.filter.frequency = Math.max(20, Math.min(20000, params.frequency))
      filterNode.frequency.value = effectsSettings.filter.frequency
    }

    if (params.resonance !== undefined) {
      effectsSettings.filter.resonance = Math.max(0.0001, Math.min(100, params.resonance))
      filterNode.Q.value = effectsSettings.filter.resonance
    }

    if (params.enabled !== undefined) {
      effectsSettings.filter.enabled = params.enabled
      buildEffectsChain() // Rebuild chain when enabling/disabling
    }
  }

  /**
   * Set chorus parameters
   * @param {Object} params - Chorus parameters {rate, depth, mix}
   */
  const setChorus = (params) => {
    if (!chorusNode) return // Not initialized yet

    if (params.rate !== undefined) {
      effectsSettings.chorus.rate = Math.max(0.1, Math.min(10, params.rate))
      chorusNode.lfo.frequency.value = effectsSettings.chorus.rate
    }

    if (params.depth !== undefined) {
      effectsSettings.chorus.depth = Math.max(0, Math.min(0.01, params.depth))
      chorusNode.depth.gain.value = effectsSettings.chorus.depth
    }

    if (params.mix !== undefined) {
      effectsSettings.chorus.mix = Math.max(0, Math.min(1, params.mix))
      chorusNode.wetGain.gain.value = effectsSettings.chorus.mix
      chorusNode.dryGain.gain.value = 1 - effectsSettings.chorus.mix
    }

    if (params.enabled !== undefined) {
      effectsSettings.chorus.enabled = params.enabled
      buildEffectsChain() // Rebuild chain when enabling/disabling
    }
  }

  /**
   * Set phaser parameters
   * @param {Object} params - Phaser parameters {rate, depth, feedback}
   */
  const setPhaser = (params) => {
    if (!phaserNode) return // Not initialized yet

    if (params.rate !== undefined) {
      effectsSettings.phaser.rate = Math.max(0.1, Math.min(10, params.rate))
      phaserNode.lfo.frequency.value = effectsSettings.phaser.rate
    }

    if (params.depth !== undefined) {
      effectsSettings.phaser.depth = Math.max(0, Math.min(1, params.depth))
      phaserNode.depth.gain.value = 2000 * effectsSettings.phaser.depth
    }

    if (params.feedback !== undefined) {
      effectsSettings.phaser.feedback = Math.max(0, Math.min(0.95, params.feedback))
      phaserNode.feedback.gain.value = effectsSettings.phaser.feedback
    }

    if (params.enabled !== undefined) {
      effectsSettings.phaser.enabled = params.enabled
      buildEffectsChain() // Rebuild chain when enabling/disabling
    }
  }

  /**
   * Toggle effect on/off
   * @param {string} effectName - Name of effect ('reverb', 'delay', 'distortion', etc.)
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
    if (settings.compressor) setCompressor(settings.compressor)
    if (settings.eq) setEQ(settings.eq)
    if (settings.filter) setFilter(settings.filter)
    if (settings.chorus) setChorus(settings.chorus)
    if (settings.phaser) setPhaser(settings.phaser)
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
    setReverb,
    setDelay,
    setDistortion,
    setCompressor,
    setEQ,
    setFilter,
    setChorus,
    setPhaser,
    toggleEffect,
    getSettings,
    loadSettings,
    setBypass,
    getInputNode,
    getOutputNode
  }
})()
