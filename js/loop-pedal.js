/**
 * Loop Pedal Module
 * Handles microphone recording, loop playback, and overdubbing
 */

const LoopPedal = (() => {
  // Private variables
  const NUM_TRACKS = 6
  let tracks = []
  let mediaStream = null
  let mediaRecorder = null
  let micEnabled = false
  let recordingTrackIndex = -1
  let audioChunks = []
  let listeners = {}

  // Track structure
  class LoopTrack {
    constructor(index) {
      this.index = index
      this.name = `Loop ${index + 1}`
      this.audioBuffer = null
      this.source = null
      this.gainNode = null
      this.volume = 0.8
      this.muted = false
      this.solo = false
      this.isPlaying = false
      this.isRecording = false
    }

    /**
     * Initialize audio nodes (call after AudioContext is ready)
     */
    initAudioNodes() {
      if (this.gainNode) return // Already initialized

      const context = AudioEngine.getContext()
      const masterGain = AudioEngine.getMasterGain()
      if (context && masterGain) {
        this.gainNode = context.createGain()
        this.gainNode.gain.value = this.muted ? 0 : this.volume
        // Connect to master gain instead of destination to route through effects
        this.gainNode.connect(masterGain)
      }
    }

    setVolume(volume) {
      this.volume = Math.max(0, Math.min(1, volume))
      if (this.gainNode) {
        this.gainNode.gain.value = this.muted ? 0 : this.volume
      }
    }

    setMuted(muted) {
      this.muted = muted
      if (this.gainNode) {
        this.gainNode.gain.value = this.muted ? 0 : this.volume
      }
    }

    setSolo(solo) {
      this.solo = solo
    }

    clear() {
      this.stop()
      this.audioBuffer = null
      this.isRecording = false
    }

    play(startTime = null, loop = true) {
      // Allow one-shot playback (loop=false) to always play, even if already playing
      if (!this.audioBuffer) return
      if (loop && this.isPlaying) return // Only skip if looping and already playing

      const context = AudioEngine.getContext()
      if (!context) return

      // Ensure audio nodes are initialized
      this.initAudioNodes()
      if (!this.gainNode) return

      // Stop previous source if playing (for one-shot mode)
      if (this.source && !loop) {
        try {
          this.source.stop()
        } catch (e) {
          // Ignore if already stopped
        }
      }

      this.source = context.createBufferSource()
      this.source.buffer = this.audioBuffer
      this.source.loop = loop
      this.source.connect(this.gainNode)

      // Handle one-shot playback
      if (!loop) {
        this.source.onended = () => {
          this.source = null
          this.isPlaying = false
        }
      }

      const time = startTime || context.currentTime
      this.source.start(time)
      this.isPlaying = loop // Only mark as playing if looping
    }

    stop() {
      if (this.source && this.isPlaying) {
        try {
          this.source.stop()
        } catch (e) {
          // Ignore if already stopped
        }
        this.source = null
        this.isPlaying = false
      }
    }
  }

  /**
   * Initialize the loop pedal
   */
  const init = () => {
    // Create tracks
    for (let i = 0; i < NUM_TRACKS; i++) {
      tracks.push(new LoopTrack(i))
    }
  }

  /**
   * Request microphone access
   * @returns {Promise<boolean>} Success status
   */
  const enableMicrophone = async () => {
    console.log('Attempting to enable microphone...')

    try {
      // Check if mediaDevices is available (requires HTTPS or localhost)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMsg = 'Microphone access requires HTTPS or localhost. Please access this page via https:// or http://localhost/'
        console.error(errorMsg)
        alert(errorMsg)
        emit('microphoneEnabled', false)
        return false
      }

      console.log('Requesting microphone permission...')
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      micEnabled = true
      console.log('Microphone enabled successfully!')
      emit('microphoneEnabled', true)
      return true
    } catch (error) {
      console.error('Microphone access denied:', error)
      alert('Microphone access was denied. Please allow microphone access in your browser settings.')
      emit('microphoneEnabled', false)
      return false
    }
  }

  /**
   * Disable microphone
   */
  const disableMicrophone = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop())
      mediaStream = null
    }
    micEnabled = false
    emit('microphoneDisabled')
  }

  /**
   * Get microphone enabled status
   * @returns {boolean} True if microphone is enabled
   */
  const isMicrophoneEnabled = () => {
    return micEnabled
  }

  /**
   * Start recording on a track
   * @param {number} trackIndex - Track index (0-5)
   */
  const startRecording = (trackIndex) => {
    if (!micEnabled || !mediaStream) {
      console.error('Microphone not enabled')
      return
    }

    if (trackIndex < 0 || trackIndex >= NUM_TRACKS) {
      console.error('Invalid track index')
      return
    }

    if (recordingTrackIndex !== -1) {
      console.error('Already recording on another track')
      return
    }

    audioChunks = []
    recordingTrackIndex = trackIndex
    tracks[trackIndex].isRecording = true

    // Create MediaRecorder
    try {
      mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
        await processRecording(trackIndex, audioBlob)
        recordingTrackIndex = -1
        tracks[trackIndex].isRecording = false
      }

      mediaRecorder.start()
      emit('recordingStarted', trackIndex)
    } catch (error) {
      console.error('Failed to start recording:', error)
      recordingTrackIndex = -1
      tracks[trackIndex].isRecording = false
    }
  }

  /**
   * Stop recording on current track
   */
  const stopRecording = () => {
    if (recordingTrackIndex === -1 || !mediaRecorder) {
      return
    }

    mediaRecorder.stop()
    emit('recordingStopped', recordingTrackIndex)
  }

  /**
   * Trim silence from the beginning of an audio buffer
   * @param {AudioBuffer} buffer - Original audio buffer
   * @returns {AudioBuffer} Trimmed audio buffer
   */
  const trimSilence = (buffer) => {
    const threshold = 0.01 // Silence threshold (1% of max amplitude)
    const sampleRate = buffer.sampleRate
    const numChannels = buffer.numberOfChannels

    // Find the first sample that exceeds the threshold on any channel
    let startSample = 0
    let foundStart = false

    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.abs(buffer.getChannelData(channel)[i])
        if (sample > threshold) {
          startSample = i
          foundStart = true
          break
        }
      }
      if (foundStart) break
    }

    // If entire buffer is silent, return original
    if (startSample === 0 && !foundStart) {
      return buffer
    }

    // Create new buffer with trimmed data
    const context = AudioEngine.getContext()
    const newLength = buffer.length - startSample
    const newBuffer = context.createBuffer(numChannels, newLength, sampleRate)

    // Copy data from start sample to end
    for (let channel = 0; channel < numChannels; channel++) {
      const sourceData = buffer.getChannelData(channel)
      const destData = newBuffer.getChannelData(channel)
      for (let i = 0; i < newLength; i++) {
        destData[i] = sourceData[i + startSample]
      }
    }

    return newBuffer
  }

  /**
   * Process recorded audio blob
   * @param {number} trackIndex - Track index
   * @param {Blob} audioBlob - Recorded audio blob
   */
  const processRecording = async (trackIndex, audioBlob) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer()
      const context = AudioEngine.getContext()
      let audioBuffer = await context.decodeAudioData(arrayBuffer)

      // Trim silence from the beginning
      audioBuffer = trimSilence(audioBuffer)

      // Store audio buffer in track
      tracks[trackIndex].audioBuffer = audioBuffer

      emit('recordingProcessed', {
        trackIndex,
        duration: audioBuffer.duration
      })
    } catch (error) {
      console.error('Failed to process recording:', error)
      emit('recordingError', { trackIndex, error })
    }
  }

  /**
   * Play a loop track
   * @param {number} trackIndex - Track index (0-5)
   * @param {boolean} loop - Whether to loop continuously (default: true)
   * @param {number} time - Optional start time (AudioContext time)
   */
  const playTrack = (trackIndex, loop = true, time = null) => {
    if (trackIndex < 0 || trackIndex >= NUM_TRACKS) return

    const track = tracks[trackIndex]
    if (!track.audioBuffer) return

    // Use provided time, or quantize to next bar for looping playback
    let startTime = time
    if (!startTime) {
      startTime = loop ? Sequencer.getNextBarTime() : null
    }

    track.play(startTime, loop)
    emit('trackPlaying', trackIndex)
  }

  /**
   * Stop a loop track
   * @param {number} trackIndex - Track index (0-5)
   */
  const stopTrack = (trackIndex) => {
    if (trackIndex < 0 || trackIndex >= NUM_TRACKS) return

    tracks[trackIndex].stop()
    emit('trackStopped', trackIndex)
  }

  /**
   * Play all tracks (quantized to next bar)
   */
  const playAllTracks = () => {
    // Quantize all tracks to start at the next bar
    const startTime = Sequencer.getNextBarTime()

    tracks.forEach((track, index) => {
      if (track.audioBuffer && !track.muted) {
        track.play(startTime)
      }
    })

    emit('allTracksPlaying')
  }

  /**
   * Stop all tracks
   */
  const stopAllTracks = () => {
    tracks.forEach((track, index) => {
      track.stop()
    })

    emit('allTracksStopped')
  }

  /**
   * Clear a track
   * @param {number} trackIndex - Track index (0-5)
   */
  const clearTrack = (trackIndex) => {
    if (trackIndex < 0 || trackIndex >= NUM_TRACKS) return

    tracks[trackIndex].clear()
    emit('trackCleared', trackIndex)
  }

  /**
   * Clear all tracks
   */
  const clearAllTracks = () => {
    tracks.forEach((track, index) => {
      track.clear()
    })

    emit('allTracksCleared')
  }

  /**
   * Set track volume
   * @param {number} trackIndex - Track index (0-5)
   * @param {number} volume - Volume (0.0 - 1.0)
   */
  const setTrackVolume = (trackIndex, volume) => {
    if (trackIndex < 0 || trackIndex >= NUM_TRACKS) return

    tracks[trackIndex].setVolume(volume)
    emit('trackVolumeChanged', { trackIndex, volume })
  }

  /**
   * Set track mute
   * @param {number} trackIndex - Track index (0-5)
   * @param {boolean} muted - Mute status
   */
  const setTrackMuted = (trackIndex, muted) => {
    if (trackIndex < 0 || trackIndex >= NUM_TRACKS) return

    tracks[trackIndex].setMuted(muted)
    emit('trackMutedChanged', { trackIndex, muted })
  }

  /**
   * Set track solo
   * @param {number} trackIndex - Track index (0-5)
   * @param {boolean} solo - Solo status
   */
  const setTrackSolo = (trackIndex, solo) => {
    if (trackIndex < 0 || trackIndex >= NUM_TRACKS) return

    tracks[trackIndex].setSolo(solo)

    // Apply solo logic to all tracks
    const hasSolo = tracks.some(t => t.solo)
    tracks.forEach((track, index) => {
      if (hasSolo) {
        track.setMuted(!track.solo)
      } else {
        track.setMuted(false)
      }
    })

    emit('trackSoloChanged', { trackIndex, solo })
  }

  /**
   * Get track info
   * @param {number} trackIndex - Track index (0-5)
   * @returns {Object} Track information
   */
  const getTrackInfo = (trackIndex) => {
    if (trackIndex < 0 || trackIndex >= NUM_TRACKS) return null

    const track = tracks[trackIndex]
    return {
      index: track.index,
      name: track.name,
      hasAudio: !!track.audioBuffer,
      duration: track.audioBuffer ? track.audioBuffer.duration : 0,
      volume: track.volume,
      muted: track.muted,
      solo: track.solo,
      isPlaying: track.isPlaying,
      isRecording: track.isRecording
    }
  }

  /**
   * Get all tracks info
   * @returns {Array} Array of track information objects
   */
  const getAllTracksInfo = () => {
    return tracks.map((track, index) => getTrackInfo(index))
  }

  /**
   * Get microphone input level (for visualization)
   * @returns {number} Input level (0.0 - 1.0)
   */
  const getMicInputLevel = () => {
    if (!mediaStream) return 0

    // This would require an analyser node connected to the mic input
    // For now, return a placeholder
    return 0
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
   * Export loop pedal data for session save
   * @returns {Promise<Object>} Loop pedal data
   */
  const exportData = async () => {
    const tracksData = []

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i]
      if (track.audioBuffer) {
        // Convert AudioBuffer to base64-encoded WAV
        const wavData = await audioBufferToWav(track.audioBuffer)
        tracksData.push({
          index: i,
          name: track.name,
          audioData: wavData,
          volume: track.volume,
          muted: track.muted,
          solo: track.solo
        })
      }
    }

    return { tracks: tracksData }
  }

  /**
   * Import loop pedal data from session load
   * @param {Object} data - Loop pedal data
   */
  const importData = async (data) => {
    if (!data || !data.tracks) return

    // Clear all tracks first
    clearAllTracks()

    // Load tracks
    for (const trackData of data.tracks) {
      if (trackData.audioData) {
        const audioBuffer = await wavToAudioBuffer(trackData.audioData)
        const track = tracks[trackData.index]

        track.audioBuffer = audioBuffer
        track.name = trackData.name || track.name
        track.setVolume(trackData.volume || 0.8)
        track.setMuted(trackData.muted || false)
        track.setSolo(trackData.solo || false)
      }
    }

    emit('dataImported')
  }

  /**
   * Convert AudioBuffer to WAV format (base64)
   * @param {AudioBuffer} audioBuffer - Audio buffer to convert
   * @returns {Promise<string>} Base64-encoded WAV data
   */
  const audioBufferToWav = async (audioBuffer) => {
    // Simplified WAV conversion (would need a proper implementation)
    // For now, return placeholder
    return btoa('WAV_PLACEHOLDER')
  }

  /**
   * Convert WAV data (base64) to AudioBuffer
   * @param {string} wavData - Base64-encoded WAV data
   * @returns {Promise<AudioBuffer>} Audio buffer
   */
  const wavToAudioBuffer = async (wavData) => {
    // Simplified WAV conversion (would need a proper implementation)
    // For now, return null
    return null
  }

  // Public API
  return {
    init,
    enableMicrophone,
    disableMicrophone,
    isMicrophoneEnabled,
    startRecording,
    stopRecording,
    playTrack,
    stopTrack,
    playAllTracks,
    stopAllTracks,
    clearTrack,
    clearAllTracks,
    setTrackVolume,
    setTrackMuted,
    setTrackSolo,
    getTrackInfo,
    getAllTracksInfo,
    getMicInputLevel,
    on,
    off,
    exportData,
    importData
  }
})()
