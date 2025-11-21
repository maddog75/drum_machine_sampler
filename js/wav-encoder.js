/**
 * WAV Encoder Module
 * Encodes audio buffers to WAV format for export
 */

const WAVEncoder = (() => {
  /**
   * Convert AudioBuffer to WAV file blob
   * @param {AudioBuffer} audioBuffer - Audio buffer to encode
   * @param {number} bitDepth - Bit depth (16 or 32, defaults to 16)
   * @returns {Blob} WAV file blob
   */
  const encodeWAV = (audioBuffer, bitDepth = 16) => {
    const numberOfChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const format = bitDepth === 32 ? 3 : 1 // 3 = IEEE float, 1 = PCM
    const bytesPerSample = bitDepth / 8

    // Interleave channels
    const length = audioBuffer.length * numberOfChannels * bytesPerSample
    const buffer = new ArrayBuffer(44 + length)
    const view = new DataView(buffer)

    // Write WAV header
    writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + length, true)
    writeString(view, 8, 'WAVE')
    writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true) // fmt chunk size
    view.setUint16(20, format, true) // format
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true) // byte rate
    view.setUint16(32, numberOfChannels * bytesPerSample, true) // block align
    view.setUint16(34, bitDepth, true)
    writeString(view, 36, 'data')
    view.setUint32(40, length, true)

    // Write audio data
    const channels = []
    for (let i = 0; i < numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i))
    }

    let offset = 44
    if (bitDepth === 16) {
      for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const sample = Math.max(-1, Math.min(1, channels[channel][i]))
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
          offset += 2
        }
      }
    } else {
      for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
          view.setFloat32(offset, channels[channel][i], true)
          offset += 4
        }
      }
    }

    return new Blob([buffer], { type: 'audio/wav' })
  }

  /**
   * Write string to DataView
   * @param {DataView} view - DataView to write to
   * @param {number} offset - Byte offset
   * @param {string} string - String to write
   */
  const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  /**
   * Convert AudioBuffer to base64-encoded WAV
   * @param {AudioBuffer} audioBuffer - Audio buffer to encode
   * @returns {Promise<string>} Base64-encoded WAV data
   */
  const encodeWAVBase64 = async (audioBuffer) => {
    const blob = encodeWAV(audioBuffer)
    const arrayBuffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * Decode base64 WAV to AudioBuffer
   * @param {string} base64Data - Base64-encoded WAV data
   * @param {AudioContext} audioContext - Audio context for decoding
   * @returns {Promise<AudioBuffer>} Decoded audio buffer
   */
  const decodeWAVBase64 = async (base64Data, audioContext) => {
    try {
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const arrayBuffer = bytes.buffer
      return await audioContext.decodeAudioData(arrayBuffer)
    } catch (error) {
      console.error('Failed to decode WAV:', error)
      return null
    }
  }

  /**
   * Mix multiple audio buffers into one
   * @param {AudioContext} audioContext - Audio context
   * @param {Array<AudioBuffer>} buffers - Array of audio buffers to mix
   * @param {number} duration - Duration of the mix in seconds (optional, auto-detected if not provided)
   * @returns {AudioBuffer} Mixed audio buffer
   */
  const mixBuffers = (audioContext, buffers, duration = null) => {
    if (!buffers || buffers.length === 0) {
      return audioContext.createBuffer(2, audioContext.sampleRate, audioContext.sampleRate)
    }

    // Determine output duration
    const outputDuration = duration || Math.max(...buffers.map(b => b.duration))
    const outputLength = Math.ceil(outputDuration * audioContext.sampleRate)

    // Create output buffer (stereo)
    const outputBuffer = audioContext.createBuffer(2, outputLength, audioContext.sampleRate)
    const leftChannel = outputBuffer.getChannelData(0)
    const rightChannel = outputBuffer.getChannelData(1)

    // Mix all buffers
    buffers.forEach(buffer => {
      const bufferLeft = buffer.getChannelData(0)
      const bufferRight = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : bufferLeft

      for (let i = 0; i < Math.min(buffer.length, outputLength); i++) {
        leftChannel[i] += bufferLeft[i]
        rightChannel[i] += bufferRight[i]
      }
    })

    // Normalize to prevent clipping
    const maxAmplitude = Math.max(
      Math.max(...leftChannel.map(Math.abs)),
      Math.max(...rightChannel.map(Math.abs))
    )

    if (maxAmplitude > 1) {
      for (let i = 0; i < outputLength; i++) {
        leftChannel[i] /= maxAmplitude
        rightChannel[i] /= maxAmplitude
      }
    }

    return outputBuffer
  }

  /**
   * Render sequencer pattern to audio buffer
   * @param {AudioContext} audioContext - Audio context
   * @param {Object} pattern - Sequencer pattern
   * @param {number} tempo - BPM
   * @param {number} bars - Number of bars to render (default 4)
   * @returns {Promise<AudioBuffer>} Rendered audio buffer
   */
  const renderPattern = async (audioContext, pattern, tempo, bars = 4) => {
    const beatsPerBar = 4
    const stepsPerBeat = 4
    const totalBeats = bars * beatsPerBar
    const totalSteps = totalBeats * stepsPerBeat
    const secondsPerBeat = 60 / tempo
    const duration = totalBeats * secondsPerBeat

    // Create offline audio context for rendering
    const offlineContext = new OfflineAudioContext(
      2, // stereo
      duration * audioContext.sampleRate,
      audioContext.sampleRate
    )

    // Schedule all notes
    const instruments = Object.keys(pattern.pattern)
    const stepDuration = secondsPerBeat / stepsPerBeat

    for (let step = 0; step < totalSteps; step++) {
      const patternStep = step % 16
      const time = step * stepDuration

      instruments.forEach(instrument => {
        if (pattern.pattern[instrument][patternStep]) {
          // Get the audio buffer for this instrument
          const buffer = AudioEngine.getInstruments().find(i => i.id === instrument)
          if (buffer) {
            const source = offlineContext.createBufferSource()
            source.buffer = buffer
            source.connect(offlineContext.destination)
            source.start(time)
          }
        }
      })
    }

    // Render offline context
    return await offlineContext.startRendering()
  }

  // Public API
  return {
    encodeWAV,
    encodeWAVBase64,
    decodeWAVBase64,
    mixBuffers,
    renderPattern
  }
})()
