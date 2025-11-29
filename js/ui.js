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
 * UI Module
 * Handles all UI rendering, canvas visualizations, and user interactions
 */

const UI = (() => {
  // DOM elements
  let sequencerCanvas = null
  let waveformCanvas = null
  let sequencerContext = null
  let waveformContext = null
  let trackNamesContainer = null
  let presetListContainer = null
  let loopTracksContainer = null

  // Canvas state
  let gridCellWidth = 0
  let gridCellHeight = 0
  let currentHighlightedStep = -1

  // Theme colors (will be updated based on current theme)
  let colors = {
    background: '#1a1a1a',
    grid: '#3a3a3a',
    groupHighlight: '#252525',  // Slightly lighter for group starts
    active: '#00bcd4',
    highlight: '#00acc1',
    text: '#ffffff'
  }

  /**
   * Initialize the UI
   */
  const init = () => {
    // Get DOM elements
    sequencerCanvas = document.getElementById('sequencerCanvas')
    waveformCanvas = document.getElementById('waveformCanvas')
    trackNamesContainer = document.getElementById('trackNames')
    presetListContainer = document.getElementById('presetList')
    loopTracksContainer = document.getElementById('loopTracks')

    if (sequencerCanvas) {
      sequencerContext = sequencerCanvas.getContext('2d')
      setupSequencerCanvas()
    }

    if (waveformCanvas) {
      waveformContext = waveformCanvas.getContext('2d')
      setupWaveformCanvas()
    }

    // Update colors from current theme
    updateThemeColors()

    // Render initial UI
    renderTrackNames()
    renderPresetList()
    renderLoopTracks()
    renderSequencerGrid()
    renderPatternSlots()

    // Set up event listeners
    setupEventListeners()
    setupPatternSelectorListeners()

    // Start visualization loop
    requestAnimationFrame(animationLoop)
  }

  /**
   * Setup sequencer canvas
   */
  const setupSequencerCanvas = () => {
    const resizeCanvas = () => {
      const container = sequencerCanvas.parentElement
      const rect = container.getBoundingClientRect()

      // Set canvas size to match container
      sequencerCanvas.width = rect.width
      sequencerCanvas.height = rect.height

      // Calculate grid dimensions based on current step count
      const stepCount = Sequencer.getStepCount()
      gridCellWidth = sequencerCanvas.width / stepCount
      gridCellHeight = sequencerCanvas.height / 16 // Always 16 tracks (8 drums + 8 loops)

      renderSequencerGrid()
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
  }

  /**
   * Setup waveform canvas
   */
  const setupWaveformCanvas = () => {
    const resizeCanvas = () => {
      const rect = waveformCanvas.getBoundingClientRect()
      waveformCanvas.width = rect.width
      waveformCanvas.height = rect.height
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
  }

  /**
   * Update theme colors from CSS custom properties
   */
  const updateThemeColors = () => {
    // Read from body since that's where [data-theme] is applied
    const computedStyle = getComputedStyle(document.body)

    colors.background = computedStyle.getPropertyValue('--color-bg-primary').trim() || '#1a1a1a'
    colors.grid = computedStyle.getPropertyValue('--color-bg-tertiary').trim() || '#3a3a3a'
    colors.groupHighlight = computedStyle.getPropertyValue('--color-bg-secondary').trim() || '#2a2a2a'
    colors.active = computedStyle.getPropertyValue('--color-accent').trim() || '#00bcd4'
    colors.highlight = computedStyle.getPropertyValue('--color-accent-hover').trim() || '#00acc1'
    colors.text = computedStyle.getPropertyValue('--color-text-primary').trim() || '#ffffff'

    console.log('Theme colors updated:', colors)
  }

  /**
   * Volume knob drag handling
   */
  let draggedKnob = null
  let dragStartY = 0
  let dragStartVolume = 0

  const setupVolumeKnobHandlers = () => {
    const knobs = document.querySelectorAll('.volume-knob-container')

    knobs.forEach(knob => {
      knob.addEventListener('mousedown', handleKnobMouseDown)
    })
  }

  const handleKnobMouseDown = (e) => {
    e.preventDefault()

    const knob = e.currentTarget
    const instrument = knob.dataset.instrument
    const loopTrack = knob.dataset.loopTrack

    draggedKnob = knob
    dragStartY = e.clientY

    // Get initial volume from appropriate source
    if (loopTrack !== undefined) {
      const trackInfo = LoopPedal.getTrackInfo(parseInt(loopTrack, 10))
      dragStartVolume = trackInfo ? trackInfo.volume : 0.8
    } else {
      dragStartVolume = AudioEngine.getTrackVolume(instrument)
    }

    document.addEventListener('mousemove', handleKnobMouseMove)
    document.addEventListener('mouseup', handleKnobMouseUp)
  }

  const handleKnobMouseMove = (e) => {
    if (!draggedKnob) return

    const instrument = draggedKnob.dataset.instrument
    const loopTrack = draggedKnob.dataset.loopTrack
    const deltaY = dragStartY - e.clientY  // Inverted: up = increase
    const volumeChange = deltaY / 100       // 100px = full range (0 to 1)
    const newVolume = Math.max(0, Math.min(1, dragStartVolume + volumeChange))

    if (loopTrack !== undefined) {
      // Loop track - update LoopPedal and sync with sample recorder slider
      const trackIndex = parseInt(loopTrack, 10)
      LoopPedal.setTrackVolume(trackIndex, newVolume)
      updateSampleRecorderVolumeSlider(trackIndex, newVolume)
    } else {
      // Drum track - update AudioEngine
      AudioEngine.setTrackVolume(instrument, newVolume)
    }

    updateKnobRotation(draggedKnob, newVolume)
  }

  const handleKnobMouseUp = () => {
    draggedKnob = null

    document.removeEventListener('mousemove', handleKnobMouseMove)
    document.removeEventListener('mouseup', handleKnobMouseUp)
  }

  const updateKnobRotation = (knobContainer, volume) => {
    const rotation = -135 + (volume * 270) // -135° to +135° = 270° range
    const indicator = knobContainer.querySelector('.volume-knob__indicator')
    if (indicator) {
      indicator.style.transform = `rotate(${rotation}deg)`
    }
  }

  /**
   * Update sample recorder volume slider to match sequencer knob
   * @param {number} trackIndex - Loop track index (0-7)
   * @param {number} volume - Volume value (0-1)
   */
  const updateSampleRecorderVolumeSlider = (trackIndex, volume) => {
    if (!loopTracksContainer) return

    const trackDiv = loopTracksContainer.querySelector(`.loop-track[data-track-index="${trackIndex}"]`)
    if (trackDiv) {
      const slider = trackDiv.querySelector('.track-volume')
      const valueSpan = slider?.parentElement?.querySelector('.control__value')

      if (slider) {
        slider.value = Math.round(volume * 100)
      }
      if (valueSpan) {
        valueSpan.textContent = `${Math.round(volume * 100)}%`
      }
    }
  }

  /**
   * Update sequencer volume knob to match sample recorder slider
   * @param {number} trackIndex - Loop track index (0-7)
   * @param {number} volume - Volume value (0-1)
   */
  const updateSequencerVolumeKnob = (trackIndex, volume) => {
    if (!trackNamesContainer) return

    const knobContainer = trackNamesContainer.querySelector(`.volume-knob-container[data-loop-track="${trackIndex}"]`)
    if (knobContainer) {
      updateKnobRotation(knobContainer, volume)
    }
  }

  // Mixer knob configuration
  const MIXER_KNOB_CONFIGS = [
    { param: 'volume', label: 'Vol', min: 0, max: 1, default: 0.8, color: 'volume' },
    { param: 'timingOffset', label: 'Ofs', min: -200, max: 200, default: 0, color: 'offset' },
    { param: 'pan', label: 'Pan', min: -1, max: 1, default: 0, color: 'pan' },
    { param: 'pitch', label: 'Pit', min: -12, max: 12, default: 0, color: 'pitch' },
    { param: 'attack', label: 'Atk', min: 0, max: 100, default: 0, color: 'attack' },
    { param: 'decay', label: 'Dec', min: 0, max: 100, default: 100, color: 'decay' },
    { param: 'length', label: 'Len', min: 0, max: 2, default: 2, color: 'length' },
    { param: 'bass', label: 'Bas', min: -12, max: 12, default: 0, color: 'bass' },
    { param: 'treble', label: 'Trb', min: -12, max: 12, default: 0, color: 'treble' }
  ]

  /**
   * Format knob value for tooltip display
   */
  const formatKnobValue = (param, value) => {
    switch (param) {
      case 'volume': return `${Math.round(value * 100)}%`
      case 'timingOffset': return `${value > 0 ? '+' : ''}${Math.round(value)}ms`
      case 'pan': return value === 0 ? 'C' : (value < 0 ? `L${Math.abs(Math.round(value * 100))}` : `R${Math.round(value * 100)}`)
      case 'pitch': return `${value > 0 ? '+' : ''}${Math.round(value)}st`
      case 'attack': return `${Math.round(value)}ms`
      case 'decay': return `${Math.round(value)}%`
      case 'length': return `${value.toFixed(2)}s`
      case 'bass':
      case 'treble': return `${value > 0 ? '+' : ''}${Math.round(value)}dB`
      default: return value.toString()
    }
  }

  /**
   * Create a single mixer knob element
   */
  const createMixerKnob = (trackId, config, value, isLoopTrack, loopTrackIndex) => {
    const container = document.createElement('div')
    container.className = `mixer-knob mixer-knob--${config.color}`
    container.dataset.instrument = trackId
    container.dataset.param = config.param
    container.dataset.min = config.min
    container.dataset.max = config.max
    if (isLoopTrack) {
      container.dataset.isLoop = 'true'
      container.dataset.loopTrack = loopTrackIndex
    }
    container.title = `${config.label}: ${formatKnobValue(config.param, value)}`

    const normalizedValue = (value - config.min) / (config.max - config.min)
    const rotation = -135 + normalizedValue * 270

    container.innerHTML = `
      <svg class="mixer-knob__svg" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" class="mixer-knob__bg"/>
        <line x1="12" y1="12" x2="12" y2="4"
              class="mixer-knob__indicator"
              style="transform: rotate(${rotation}deg)"/>
      </svg>
      <span class="mixer-knob__label">${config.label}</span>
    `

    return container
  }

  /**
   * Render track names with 8 mixer knobs each
   */
  const renderTrackNames = () => {
    if (!trackNamesContainer) return

    const allTracks = Sequencer.getAllTracks()
    trackNamesContainer.innerHTML = ''

    allTracks.forEach(track => {
      const nameDiv = document.createElement('div')
      nameDiv.className = 'track-name'
      nameDiv.dataset.instrument = track.id

      // Add special styling for loop tracks
      if (track.id.startsWith('loop')) {
        nameDiv.classList.add('track-name--loop')
      }

      // Create label
      const label = document.createElement('span')
      label.className = 'track-name__label'
      label.textContent = track.name

      // Add click handler for changeable tracks (drum tracks)
      if (track.isChangeable) {
        label.classList.add('track-name__label--changeable')
        label.dataset.trackIndex = track.trackIndex
        label.addEventListener('click', (e) => {
          e.stopPropagation()
          showInstrumentPicker(track.trackIndex, track.instrumentId)
        })
      }

      nameDiv.appendChild(label)

      // Determine if this is a loop track and get mixer settings
      const isLoopTrack = track.id.startsWith('loop')
      let mixerSettings, currentVolume, loopTrackIndex

      if (isLoopTrack) {
        loopTrackIndex = parseInt(track.id.replace('loop', ''), 10) - 1
        const trackInfo = LoopPedal.getTrackInfo(loopTrackIndex)
        mixerSettings = trackInfo?.mixerSettings || {}
        currentVolume = trackInfo ? trackInfo.volume : 0.8
      } else {
        // Use the assigned instrument ID for mixer settings (not the default track ID)
        // This ensures knobs affect the correct instrument when a different sample is loaded
        mixerSettings = AudioEngine.getTrackMixerSettings(track.instrumentId) || {}
        currentVolume = AudioEngine.getTrackVolume(track.instrumentId)
      }

      // Create mixer knobs - use instrumentId for drum tracks so settings apply to the assigned instrument
      const knobInstrumentId = isLoopTrack ? track.id : track.instrumentId
      MIXER_KNOB_CONFIGS.forEach(config => {
        const value = config.param === 'volume'
          ? currentVolume
          : (mixerSettings[config.param] ?? config.default)

        const knobContainer = createMixerKnob(knobInstrumentId, config, value, isLoopTrack, loopTrackIndex)
        nameDiv.appendChild(knobContainer)
      })

      trackNamesContainer.appendChild(nameDiv)
    })

    // Add mixer knob drag handlers
    setupMixerKnobHandlers()
  }

  /**
   * Mixer knob drag handling
   */
  let draggedMixerKnob = null
  let mixerDragStartY = 0
  let mixerDragStartValue = 0

  const setupMixerKnobHandlers = () => {
    const knobs = document.querySelectorAll('.mixer-knob')
    knobs.forEach(knob => {
      knob.addEventListener('mousedown', handleMixerKnobMouseDown)
    })
  }

  const handleMixerKnobMouseDown = (e) => {
    e.preventDefault()
    const knob = e.currentTarget

    draggedMixerKnob = knob
    mixerDragStartY = e.clientY

    const param = knob.dataset.param
    const min = parseFloat(knob.dataset.min)
    const max = parseFloat(knob.dataset.max)
    const instrumentId = knob.dataset.instrument
    const isLoop = knob.dataset.isLoop === 'true'

    // Get current value
    if (isLoop) {
      const trackIndex = parseInt(knob.dataset.loopTrack, 10)
      if (param === 'volume') {
        const trackInfo = LoopPedal.getTrackInfo(trackIndex)
        mixerDragStartValue = trackInfo ? trackInfo.volume : 0.8
      } else {
        const settings = LoopPedal.getTrackMixerSettings(trackIndex)
        mixerDragStartValue = settings?.[param] ?? ((min + max) / 2)
      }
    } else {
      if (param === 'volume') {
        mixerDragStartValue = AudioEngine.getTrackVolume(instrumentId)
      } else {
        const settings = AudioEngine.getTrackMixerSettings(instrumentId)
        mixerDragStartValue = settings?.[param] ?? ((min + max) / 2)
      }
    }

    document.addEventListener('mousemove', handleMixerKnobMouseMove)
    document.addEventListener('mouseup', handleMixerKnobMouseUp)
  }

  const handleMixerKnobMouseMove = (e) => {
    if (!draggedMixerKnob) return

    const param = draggedMixerKnob.dataset.param
    const min = parseFloat(draggedMixerKnob.dataset.min)
    const max = parseFloat(draggedMixerKnob.dataset.max)
    const instrumentId = draggedMixerKnob.dataset.instrument
    const isLoop = draggedMixerKnob.dataset.isLoop === 'true'

    const deltaY = mixerDragStartY - e.clientY  // Up = increase
    const range = max - min
    const sensitivity = range / 100  // 100px for full range
    const newValue = Math.max(min, Math.min(max, mixerDragStartValue + deltaY * sensitivity))

    // Apply value
    if (isLoop) {
      const trackIndex = parseInt(draggedMixerKnob.dataset.loopTrack, 10)
      if (param === 'volume') {
        LoopPedal.setTrackVolume(trackIndex, newValue)
        updateSampleRecorderVolumeSlider(trackIndex, newValue)
      } else {
        LoopPedal.setTrackMixerParam(trackIndex, param, newValue)
      }
    } else {
      if (param === 'volume') {
        AudioEngine.setTrackVolume(instrumentId, newValue)
      } else {
        AudioEngine.setTrackMixerParam(instrumentId, param, newValue)
      }
    }

    // Update knob rotation
    const normalizedValue = (newValue - min) / (max - min)
    const rotation = -135 + normalizedValue * 270
    const indicator = draggedMixerKnob.querySelector('.mixer-knob__indicator')
    if (indicator) {
      indicator.style.transform = `rotate(${rotation}deg)`
    }

    // Update tooltip
    const config = MIXER_KNOB_CONFIGS.find(c => c.param === param)
    draggedMixerKnob.title = `${config?.label || param}: ${formatKnobValue(param, newValue)}`
  }

  const handleMixerKnobMouseUp = () => {
    draggedMixerKnob = null
    document.removeEventListener('mousemove', handleMixerKnobMouseMove)
    document.removeEventListener('mouseup', handleMixerKnobMouseUp)
  }

  /**
   * Render preset list
   */
  const renderPresetList = () => {
    if (!presetListContainer) return

    const patterns = Presets.getDrumPatterns()
    presetListContainer.innerHTML = ''

    patterns.forEach((pattern, index) => {
      const btn = document.createElement('button')
      btn.className = 'preset-btn'
      btn.dataset.presetId = pattern.id

      btn.innerHTML = `
        <div class="preset-btn__name">${pattern.name} - ${pattern.tempo} BPM</div>
      `

      btn.addEventListener('click', () => {
        Sequencer.loadPattern(pattern)
        renderSequencerGrid()

        // Update active state
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('is-active'))
        btn.classList.add('is-active')
      })

      presetListContainer.appendChild(btn)
    })

    // Set first preset as active
    if (presetListContainer.firstChild) {
      presetListContainer.firstChild.classList.add('is-active')
    }
  }

  /**
   * Render loop tracks
   */
  const renderLoopTracks = () => {
    if (!loopTracksContainer) return

    loopTracksContainer.innerHTML = ''

    for (let i = 0; i < 8; i++) {
      const trackDiv = document.createElement('div')
      trackDiv.className = 'loop-track'
      trackDiv.dataset.trackIndex = i

      // Determine if this is a global sample (first 4) or pattern-specific
      const isGlobal = i < 4
      const sampleName = isGlobal ? `Global Sample ${i + 1}` : `Sample ${i - 3}`

      trackDiv.innerHTML = `
        <div class="loop-track__header">
          <span class="loop-track__name">${sampleName}</span>
          <span class="loop-track__duration">0.0s</span>
        </div>
        <div class="loop-track__controls">
          <button class="btn btn--primary btn--small btn-record" data-action="record" style="height: 24px; padding: 2px 8px;">● Rec</button>
          <button class="btn btn--secondary btn--small btn-play" data-action="play" style="height: 24px; padding: 2px 8px;">▶ Play</button>
          <label class="control control--compact" style="margin-left: 8px;" title="Trim start of sample">
            <input type="range" class="control__slider track-trim" min="0" max="5" step="0.1" value="0">
            <span class="control__value trim-value">0.0s</span>
          </label>
          <label class="control control--compact" style="margin-left: 4px;">
            <input type="range" class="control__slider track-volume" min="0" max="100" value="80">
            <span class="control__value">80%</span>
          </label>
        </div>
      `

      loopTracksContainer.appendChild(trackDiv)
    }

    // Update durations initially
    updateLoopTrackDurations()
  }

  /**
   * Update loop track duration displays and trim slider values
   */
  const updateLoopTrackDurations = () => {
    if (!loopTracksContainer) return

    const trackDivs = loopTracksContainer.querySelectorAll('.loop-track')
    trackDivs.forEach((trackDiv, index) => {
      const durationSpan = trackDiv.querySelector('.loop-track__duration')
      const trimSlider = trackDiv.querySelector('.track-trim')
      const trimValueSpan = trackDiv.querySelector('.trim-value')

      const trackInfo = LoopPedal.getTrackInfo(index)

      if (durationSpan) {
        if (trackInfo && trackInfo.hasAudio) {
          // Show effective duration (total - startTrim)
          const effectiveDuration = Math.max(0, trackInfo.duration - trackInfo.startTrim)
          durationSpan.textContent = `${effectiveDuration.toFixed(1)}s`
        } else {
          durationSpan.textContent = '0.0s'
        }
      }

      // Update trim slider value (for when loading sessions)
      if (trimSlider && trackInfo) {
        trimSlider.value = trackInfo.startTrim || 0
      }
      if (trimValueSpan && trackInfo) {
        const trimValue = trackInfo.startTrim || 0
        trimValueSpan.textContent = `${trimValue.toFixed(1)}s`
      }
    })
  }

  /**
   * Render sequencer grid on canvas
   */
  const renderSequencerGrid = () => {
    if (!sequencerContext) return

    const ctx = sequencerContext
    const width = sequencerCanvas.width
    const height = sequencerCanvas.height

    // Clear canvas
    ctx.fillStyle = colors.background
    ctx.fillRect(0, 0, width, height)

    const pattern = Sequencer.getPattern()
    if (!pattern) return

    const allTracks = Sequencer.getAllTracks()
    const numTracks = allTracks.length
    const numSteps = Sequencer.getStepCount()

    gridCellWidth = width / numSteps
    gridCellHeight = height / numTracks

    // Get time signature to determine group highlighting
    const timeSignature = Sequencer.getTimeSignature()
    let groupSize = 4 // Default to 4/4
    if (timeSignature === '3/4' || timeSignature === '12/8') {
      groupSize = 3
    }

    // Draw grid and steps
    allTracks.forEach((track, row) => {
      for (let col = 0; col < numSteps; col++) {
        const x = col * gridCellWidth
        const y = row * gridCellHeight

        // Check if this is the first column of a group
        const isGroupStart = col % groupSize === 0

        // Check if step is active
        const isActive = pattern.pattern[track.id]?.[col] === 1

        // Highlight current step
        const isHighlighted = col === currentHighlightedStep

        // Draw cell background (group highlight, playhead highlight, or normal)
        if (isHighlighted && !isActive) {
          ctx.fillStyle = colors.grid
        } else if (isGroupStart) {
          ctx.fillStyle = colors.groupHighlight
        } else {
          ctx.fillStyle = colors.background
        }
        ctx.fillRect(x + 1, y + 1, gridCellWidth - 2, gridCellHeight - 2)

        // Draw pill shape for active cells
        if (isActive) {
          const margin = 4
          const pillX = x + margin
          const pillY = y + margin
          const pillWidth = gridCellWidth - margin * 2
          const pillHeight = gridCellHeight - margin * 2
          const radius = Math.min(pillWidth, pillHeight) / 2

          ctx.fillStyle = isHighlighted ? colors.highlight : colors.active
          ctx.beginPath()
          ctx.roundRect(pillX, pillY, pillWidth, pillHeight, radius)
          ctx.fill()
        }

        // Draw grid lines
        ctx.strokeStyle = colors.grid
        ctx.strokeRect(x, y, gridCellWidth, gridCellHeight)
      }
    })
  }

  /**
   * Render waveform visualization
   */
  const renderWaveform = () => {
    if (!waveformContext) return

    const ctx = waveformContext
    const width = waveformCanvas.width
    const height = waveformCanvas.height

    // Clear canvas
    ctx.fillStyle = colors.background
    ctx.fillRect(0, 0, width, height)

    const analyser = AudioEngine.getAnalyser()
    if (!analyser) return

    // Get waveform data
    const bufferLength = analyser.fftSize
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteTimeDomainData(dataArray)

    // Draw waveform
    ctx.lineWidth = 2
    ctx.strokeStyle = colors.active
    ctx.beginPath()

    const sliceWidth = width / bufferLength
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0
      const y = (v * height) / 2

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }

      x += sliceWidth
    }

    ctx.lineTo(width, height / 2)
    ctx.stroke()
  }

  /**
   * Animation loop for real-time visualizations
   */
  const animationLoop = () => {
    renderWaveform()
    requestAnimationFrame(animationLoop)
  }

  /**
   * Setup all event listeners
   */
  const setupEventListeners = () => {
    // Sequencer canvas click
    if (sequencerCanvas) {
      sequencerCanvas.addEventListener('click', handleSequencerClick)
    }

    // Transport controls
    const playPauseBtn = document.getElementById('playPauseBtn')
    const stopBtn = document.getElementById('stopBtn')
    const rewindBtn = document.getElementById('rewindBtn')

    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        // If chain mode is enabled and not playing, start chain mode
        if (SongMode.getChainMode() && !Sequencer.getIsPlaying()) {
          SongMode.startChainMode()
        } else {
          Sequencer.togglePlayPause()
        }
        updatePlayButton()
      })
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        Sequencer.stop()
        updatePlayButton()
      })
    }

    if (rewindBtn) {
      rewindBtn.addEventListener('click', () => {
        Sequencer.stop()
        updatePlayButton()
      })
    }

    // Tempo slider
    const tempoSlider = document.getElementById('tempoSlider')
    const tempoValue = document.getElementById('tempoValue')
    if (tempoSlider) {
      tempoSlider.addEventListener('input', (e) => {
        const tempo = parseInt(e.target.value, 10)
        Sequencer.setTempo(tempo)
        if (tempoValue) {
          tempoValue.textContent = tempo
        }
        updateTempoDisplay()
      })
    }

    // Time signature selector
    const timeSignature = document.getElementById('timeSignature')
    if (timeSignature) {
      timeSignature.addEventListener('change', (e) => {
        Sequencer.setTimeSignature(e.target.value)
        renderSequencerGrid()  // Re-render to update group highlighting
      })
    }

    // Step count slider
    const stepCountSlider = document.getElementById('stepCountSlider')
    const stepCountValue = document.getElementById('stepCountValue')
    if (stepCountSlider) {
      stepCountSlider.addEventListener('input', (e) => {
        const stepCount = parseInt(e.target.value, 10)
        Sequencer.setStepCount(stepCount)
        if (stepCountValue) {
          stepCountValue.textContent = stepCount
        }
        renderSequencerGrid()
      })
    }

    // Clear sequencer button (double-click to clear current pattern)
    const clearSequencerBtn = document.getElementById('clearSequencerBtn')
    if (clearSequencerBtn) {
      let lastClickTime = 0
      const DOUBLE_CLICK_THRESHOLD = 500 // ms

      clearSequencerBtn.addEventListener('click', async () => {
        const now = Date.now()
        const timeSinceLastClick = now - lastClickTime
        lastClickTime = now

        if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD) {
          // Double-click detected - clear current pattern only
          await SongMode.clearCurrentPattern()
          renderSequencerGrid()
          updateSongSections()
        } else {
          // Single click - show hint
          clearSequencerBtn.textContent = '✕ Double-click to clear'
          setTimeout(() => {
            clearSequencerBtn.innerHTML = '<span class="btn__icon">✕</span>Clear'
          }, 1500)
        }
      })
    }

    // Theme button
    const themeBtn = document.getElementById('themeBtn')
    if (themeBtn) {
      themeBtn.addEventListener('click', cycleTheme)
    }

    // Help button
    const helpBtn = document.getElementById('helpBtn')
    const helpOverlay = document.getElementById('help')
    const helpClose = helpOverlay?.querySelector('.help__close')

    if (helpBtn && helpOverlay) {
      helpBtn.addEventListener('click', () => {
        helpOverlay.classList.remove('hidden')
      })
    }

    if (helpClose && helpOverlay) {
      helpClose.addEventListener('click', () => {
        helpOverlay.classList.add('hidden')
      })
    }

    // Visualizations button
    const vizBtn = document.getElementById('vizBtn')
    const vizMenu = document.getElementById('viz-menu')
    if (vizBtn && vizMenu) {
      vizBtn.addEventListener('click', () => {
        vizMenu.classList.remove('hidden')
      })
    }

    // Visualization window buttons
    const openWaveformBtn = document.getElementById('openWaveformBtn')
    const openFrequencyBtn = document.getElementById('openFrequencyBtn')
    const openMeterBtn = document.getElementById('openMeterBtn')
    const openKaleidoscopeBtn = document.getElementById('openKaleidoscopeBtn')
    const openTunnelBtn = document.getElementById('openTunnelBtn')
    const closeAllVizBtn = document.getElementById('closeAllVizBtn')

    if (openWaveformBtn) openWaveformBtn.addEventListener('click', () => Visualizations.createWindow(Visualizations.TYPES.WAVEFORM))
    if (openFrequencyBtn) openFrequencyBtn.addEventListener('click', () => Visualizations.createWindow(Visualizations.TYPES.FREQUENCY))
    if (openMeterBtn) openMeterBtn.addEventListener('click', () => Visualizations.createWindow(Visualizations.TYPES.METER))
    if (openKaleidoscopeBtn) openKaleidoscopeBtn.addEventListener('click', () => Visualizations.createWindow(Visualizations.TYPES.KALEIDOSCOPE))
    if (openTunnelBtn) openTunnelBtn.addEventListener('click', () => Visualizations.createWindow(Visualizations.TYPES.TUNNEL))
    if (closeAllVizBtn) closeAllVizBtn.addEventListener('click', () => Visualizations.closeAll())

    // Effects button
    const effectsBtn = document.getElementById('effectsBtn')
    const effectsPanel = document.getElementById('effects-panel')
    if (effectsBtn && effectsPanel) {
      effectsBtn.addEventListener('click', () => {
        effectsPanel.classList.remove('hidden')
      })
    }

    // Effects controls
    setupEffectsControls()

    // Song Mode button
    const songModeBtn = document.getElementById('songModeBtn')
    const songModePanel = document.getElementById('song-mode-panel')
    if (songModeBtn && songModePanel) {
      songModeBtn.addEventListener('click', () => {
        songModePanel.classList.remove('hidden')
      })
    }

    // Song Mode controls
    setupSongModeControls()

    // Save/Load buttons
    const saveBtn = document.getElementById('saveBtn')
    const loadBtn = document.getElementById('loadBtn')
    const exportWavBtn = document.getElementById('exportWavBtn')

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        Storage.exportSessionFile()
      })
    }

    if (loadBtn) {
      loadBtn.addEventListener('click', () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = (e) => {
          const file = e.target.files[0]
          if (file) {
            Storage.importSessionFile(file)
          }
        }
        input.click()
      })
    }

    if (exportWavBtn) {
      exportWavBtn.addEventListener('click', () => {
        Storage.exportAudioMix()
      })
    }

    // Microphone button
    const micBtn = document.getElementById('micBtn')
    if (micBtn) {
      micBtn.addEventListener('click', async () => {
        const enabled = await LoopPedal.enableMicrophone()
        if (enabled) {
          micBtn.textContent = '🎤 Mic Enabled'
          micBtn.classList.add('btn--success')
        }
      })
    }

    // Loop track controls
    if (loopTracksContainer) {
      loopTracksContainer.addEventListener('click', handleLoopTrackAction)

      // Handle trim slider changes
      loopTracksContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('track-trim')) {
          const trackDiv = e.target.closest('.loop-track')
          if (trackDiv) {
            const trackIndex = parseInt(trackDiv.dataset.trackIndex, 10)
            const trimValue = parseFloat(e.target.value)
            LoopPedal.setTrackStartTrim(trackIndex, trimValue)

            // Update display
            const valueSpan = e.target.parentElement.querySelector('.trim-value')
            if (valueSpan) {
              valueSpan.textContent = `${trimValue.toFixed(1)}s`
            }

            // Update duration display to show effective duration
            updateLoopTrackDurations()
          }
        }

        // Handle volume slider changes
        if (e.target.classList.contains('track-volume')) {
          const trackDiv = e.target.closest('.loop-track')
          if (trackDiv) {
            const trackIndex = parseInt(trackDiv.dataset.trackIndex, 10)
            const volume = parseInt(e.target.value, 10) / 100
            LoopPedal.setTrackVolume(trackIndex, volume)

            // Update display
            const valueSpan = e.target.parentElement.querySelector('.control__value')
            if (valueSpan) {
              valueSpan.textContent = `${e.target.value}%`
            }

            // Sync with sequencer volume knob
            updateSequencerVolumeKnob(trackIndex, volume)
          }
        }
      })
    }

    // Master volume
    const masterVolume = document.getElementById('masterVolume')
    const masterVolumeValue = document.getElementById('masterVolumeValue')

    if (masterVolume) {
      masterVolume.addEventListener('input', (e) => {
        const volume = parseInt(e.target.value, 10) / 100
        AudioEngine.setMasterVolume(volume)
        if (masterVolumeValue) {
          masterVolumeValue.textContent = `${e.target.value}%`
        }
      })
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard)

    // Listen to sequencer events
    Sequencer.on('stepTriggered', handleStepTriggered)
    Sequencer.on('tempoChanged', updateTempoDisplay)
    Sequencer.on('stepCountChanged', (stepCount) => {
      const stepCountValue = document.getElementById('stepCountValue')
      const stepCountSlider = document.getElementById('stepCountSlider')
      if (stepCountValue) {
        stepCountValue.textContent = stepCount
      }
      if (stepCountSlider) {
        stepCountSlider.value = stepCount
      }
      renderSequencerGrid()
    })

    // Listen for track instrument changes to update track names
    Sequencer.on('trackInstrumentChanged', () => {
      renderTrackNames()
    })
    Sequencer.on('trackInstrumentsLoaded', () => {
      renderTrackNames()
    })
  }

  /**
   * Handle sequencer canvas click
   */
  const handleSequencerClick = async (e) => {
    const rect = sequencerCanvas.getBoundingClientRect()

    // Use more precise coordinate calculation
    // Account for any CSS scaling by using canvas dimensions
    const scaleX = sequencerCanvas.width / rect.width
    const scaleY = sequencerCanvas.height / rect.height

    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const col = Math.floor(x / gridCellWidth)
    const row = Math.floor(y / gridCellHeight)

    const allTracks = Sequencer.getAllTracks()
    if (row >= 0 && row < allTracks.length && col >= 0 && col < Sequencer.getStepCount()) {
      const track = allTracks[row]

      // Check if we're adding (0 -> 1) or removing (1 -> 0)
      const wasActive = Sequencer.getStep(track.id, col)

      Sequencer.toggleStep(track.id, col)
      renderSequencerGrid()

      // Save the modified pattern to the pattern bank
      // This ensures edits are preserved when chain mode switches patterns
      await SongMode.saveCurrentPattern()

      // Only preview sound when ADDING a step (not when removing)
      if (!wasActive) {
        if (track.id.startsWith('loop')) {
          // Preview loop sample (one-shot playback)
          const loopNumber = parseInt(track.id.replace('loop', ''), 10)
          const trackIndex = loopNumber - 1 // Convert loop1-8 to 0-7
          LoopPedal.playTrack(trackIndex, false) // false = one-shot, not looping
        } else {
          // Preview drum sound - use assigned instrument instead of default
          const assignedInstrument = Sequencer.getTrackInstrument(row)
          AudioEngine.playDrum(assignedInstrument || track.id)
        }
      }
    }
  }

  /**
   * Handle step triggered event
   */
  const handleStepTriggered = (step) => {
    currentHighlightedStep = step
    renderSequencerGrid()
    updateBeatDisplay()
  }

  /**
   * Handle loop track actions
   */
  const handleLoopTrackAction = (e) => {
    const btn = e.target.closest('button')
    if (!btn) return

    const trackDiv = btn.closest('.loop-track')
    if (!trackDiv) return

    const trackIndex = parseInt(trackDiv.dataset.trackIndex, 10)
    const action = btn.dataset.action

    switch (action) {
      case 'record':
        const trackInfo = LoopPedal.getTrackInfo(trackIndex)
        if (trackInfo.isRecording) {
          LoopPedal.stopRecording()
          btn.textContent = '● Rec'
          btn.classList.remove('is-recording')
          // Update duration after recording stops
          setTimeout(() => updateLoopTrackDurations(), 100)
        } else {
          LoopPedal.startRecording(trackIndex)
          btn.textContent = '■ Stop Rec'
          btn.classList.add('is-recording')
        }
        break
      case 'play':
        // Play sample once (one-shot, not looping)
        LoopPedal.playTrack(trackIndex, false)
        break
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyboard = (e) => {
    switch (e.key.toLowerCase()) {
      case ' ':
        e.preventDefault()
        Sequencer.togglePlayPause()
        updatePlayButton()
        break
      case 'escape':
        e.preventDefault()
        Sequencer.stop()
        updatePlayButton()
        break
      case 's':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          Storage.saveSession()
        }
        break
      case 'h':
        e.preventDefault()
        document.getElementById('help')?.classList.toggle('hidden')
        break
      case 't':
        e.preventDefault()
        cycleTheme()
        break
      case '+':
      case '=':
        e.preventDefault()
        Sequencer.setTempo(Sequencer.getTempo() + 5)
        const sliderPlus = document.getElementById('tempoSlider')
        const valuePlus = document.getElementById('tempoValue')
        if (sliderPlus) sliderPlus.value = Sequencer.getTempo()
        if (valuePlus) valuePlus.textContent = Sequencer.getTempo()
        updateTempoDisplay()
        break
      case '-':
      case '_':
        e.preventDefault()
        Sequencer.setTempo(Sequencer.getTempo() - 5)
        const sliderMinus = document.getElementById('tempoSlider')
        const valueMinus = document.getElementById('tempoValue')
        if (sliderMinus) sliderMinus.value = Sequencer.getTempo()
        if (valueMinus) valueMinus.textContent = Sequencer.getTempo()
        updateTempoDisplay()
        break
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        e.preventDefault()
        const presetIndex = parseInt(e.key, 10) - 1
        const patterns = Presets.getDrumPatterns()
        if (patterns[presetIndex]) {
          Sequencer.loadPattern(patterns[presetIndex])
          renderSequencerGrid()
        }
        break
    }
  }

  /**
   * Cycle through themes
   */
  const cycleTheme = () => {
    const themes = ['spectrum', 'dark', 'matrix', 'vivid']
    const currentTheme = document.body.dataset.theme || 'spectrum'
    const currentIndex = themes.indexOf(currentTheme)
    const nextIndex = (currentIndex + 1) % themes.length

    document.body.dataset.theme = themes[nextIndex]

    // Force browser to recalculate styles by reading offsetHeight
    // This ensures CSS changes are applied before we read computed styles
    document.body.offsetHeight

    // Use setTimeout to ensure styles are fully computed
    setTimeout(() => {
      updateThemeColors()
      renderSequencerGrid()
    }, 50)
  }

  /**
   * Update play button state
   */
  const updatePlayButton = () => {
    const playPauseBtn = document.getElementById('playPauseBtn')
    if (!playPauseBtn) return

    const playIcon = playPauseBtn.querySelector('.icon--play')
    const pauseIcon = playPauseBtn.querySelector('.icon--pause')

    if (Sequencer.getIsPlaying()) {
      playPauseBtn.classList.add('is-playing')
      playPauseBtn.setAttribute('aria-label', 'Pause')
      if (playIcon) playIcon.classList.add('hidden')
      if (pauseIcon) pauseIcon.classList.remove('hidden')
    } else {
      playPauseBtn.classList.remove('is-playing')
      playPauseBtn.setAttribute('aria-label', 'Play')
      if (playIcon) playIcon.classList.remove('hidden')
      if (pauseIcon) pauseIcon.classList.add('hidden')
    }
  }

  /**
   * Update tempo display
   */
  const updateTempoDisplay = () => {
    const tempoDisplay = document.getElementById('tempoDisplay')
    if (tempoDisplay) {
      tempoDisplay.textContent = `${Sequencer.getTempo()} BPM`
    }
  }

  /**
   * Update beat display
   */
  const updateBeatDisplay = () => {
    const beatDisplay = document.getElementById('beatDisplay')
    if (beatDisplay) {
      beatDisplay.textContent = Sequencer.getBeatPosition()
    }
  }

  /**
   * Setup effects controls
   */
  const setupEffectsControls = () => {
    // Reverb controls
    const reverbEnabled = document.getElementById('reverbEnabled')
    const reverbWetDry = document.getElementById('reverbWetDry')
    const reverbWetDryValue = document.getElementById('reverbWetDryValue')
    const reverbDecay = document.getElementById('reverbDecay')
    const reverbDecayValue = document.getElementById('reverbDecayValue')

    if (reverbEnabled) {
      reverbEnabled.addEventListener('change', (e) => {
        Effects.setReverb({ enabled: e.target.checked })
      })
    }

    if (reverbWetDry) {
      reverbWetDry.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) / 100
        Effects.setReverb({ wetDry: value })
        if (reverbWetDryValue) reverbWetDryValue.textContent = `${e.target.value}%`
      })
    }

    if (reverbDecay) {
      reverbDecay.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) / 10
        Effects.setReverb({ decayTime: value })
        if (reverbDecayValue) reverbDecayValue.textContent = `${value.toFixed(1)}s`
      })
    }

    // Delay controls
    const delayEnabled = document.getElementById('delayEnabled')
    const delayWetDry = document.getElementById('delayWetDry')
    const delayWetDryValue = document.getElementById('delayWetDryValue')
    const delayTime = document.getElementById('delayTime')
    const delayTimeValue = document.getElementById('delayTimeValue')
    const delayFeedback = document.getElementById('delayFeedback')
    const delayFeedbackValue = document.getElementById('delayFeedbackValue')

    if (delayEnabled) {
      delayEnabled.addEventListener('change', (e) => {
        Effects.setDelay({ enabled: e.target.checked })
      })
    }

    if (delayWetDry) {
      delayWetDry.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) / 100
        Effects.setDelay({ wetDry: value })
        if (delayWetDryValue) delayWetDryValue.textContent = `${e.target.value}%`
      })
    }

    if (delayTime) {
      delayTime.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) / 100
        Effects.setDelay({ delayTime: value })
        if (delayTimeValue) delayTimeValue.textContent = `${value.toFixed(3)}s`
      })
    }

    if (delayFeedback) {
      delayFeedback.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) / 100
        Effects.setDelay({ feedback: value })
        if (delayFeedbackValue) delayFeedbackValue.textContent = `${e.target.value}%`
      })
    }

    // Distortion controls
    const distortionEnabled = document.getElementById('distortionEnabled')
    const distortionAmount = document.getElementById('distortionAmount')
    const distortionAmountValue = document.getElementById('distortionAmountValue')
    const distortionTone = document.getElementById('distortionTone')
    const distortionToneValue = document.getElementById('distortionToneValue')

    if (distortionEnabled) {
      distortionEnabled.addEventListener('change', (e) => {
        Effects.setDistortion({ enabled: e.target.checked })
      })
    }

    if (distortionAmount) {
      distortionAmount.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) / 100
        Effects.setDistortion({ amount: value })
        if (distortionAmountValue) distortionAmountValue.textContent = `${e.target.value}%`
      })
    }

    if (distortionTone) {
      distortionTone.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) / 100
        Effects.setDistortion({ tone: value })
        if (distortionToneValue) distortionToneValue.textContent = `${e.target.value}%`
      })
    }

    // Compressor controls
    const compressorEnabled = document.getElementById('compressorEnabled')
    const compressorThreshold = document.getElementById('compressorThreshold')
    const compressorThresholdValue = document.getElementById('compressorThresholdValue')
    const compressorRatio = document.getElementById('compressorRatio')
    const compressorRatioValue = document.getElementById('compressorRatioValue')

    if (compressorEnabled) {
      compressorEnabled.addEventListener('change', (e) => {
        Effects.setCompressor({ enabled: e.target.checked })
      })
    }

    if (compressorThreshold) {
      compressorThreshold.addEventListener('input', (e) => {
        const value = -100 + parseInt(e.target.value) // 0-100 -> -100 to 0 dB
        Effects.setCompressor({ threshold: value })
        if (compressorThresholdValue) compressorThresholdValue.textContent = `${value}dB`
      })
    }

    if (compressorRatio) {
      compressorRatio.addEventListener('input', (e) => {
        const value = parseInt(e.target.value)
        Effects.setCompressor({ ratio: value })
        if (compressorRatioValue) compressorRatioValue.textContent = `${value}:1`
      })
    }

    // EQ controls
    const eqEnabled = document.getElementById('eqEnabled')
    const eqLow = document.getElementById('eqLow')
    const eqLowValue = document.getElementById('eqLowValue')
    const eqMid = document.getElementById('eqMid')
    const eqMidValue = document.getElementById('eqMidValue')
    const eqHigh = document.getElementById('eqHigh')
    const eqHighValue = document.getElementById('eqHighValue')

    if (eqEnabled) {
      eqEnabled.addEventListener('change', (e) => {
        Effects.setEQ({ enabled: e.target.checked })
      })
    }

    if (eqLow) {
      eqLow.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value)
        Effects.setEQ({ low: value })
        if (eqLowValue) eqLowValue.textContent = `${value >= 0 ? '+' : ''}${value.toFixed(1)}dB`
      })
    }

    if (eqMid) {
      eqMid.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value)
        Effects.setEQ({ mid: value })
        if (eqMidValue) eqMidValue.textContent = `${value >= 0 ? '+' : ''}${value.toFixed(1)}dB`
      })
    }

    if (eqHigh) {
      eqHigh.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value)
        Effects.setEQ({ high: value })
        if (eqHighValue) eqHighValue.textContent = `${value >= 0 ? '+' : ''}${value.toFixed(1)}dB`
      })
    }

    // Filter controls
    const filterEnabled = document.getElementById('filterEnabled')
    const filterType = document.getElementById('filterType')
    const filterFrequency = document.getElementById('filterFrequency')
    const filterFrequencyValue = document.getElementById('filterFrequencyValue')
    const filterResonance = document.getElementById('filterResonance')
    const filterResonanceValue = document.getElementById('filterResonanceValue')

    if (filterEnabled) {
      filterEnabled.addEventListener('change', (e) => {
        Effects.setFilter({ enabled: e.target.checked })
      })
    }

    if (filterType) {
      filterType.addEventListener('change', (e) => {
        Effects.setFilter({ type: e.target.value })
      })
    }

    if (filterFrequency) {
      filterFrequency.addEventListener('input', (e) => {
        const value = parseInt(e.target.value)
        Effects.setFilter({ frequency: value })
        if (filterFrequencyValue) filterFrequencyValue.textContent = `${value}Hz`
      })
    }

    if (filterResonance) {
      filterResonance.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) / 10  // 0-100 -> 0-10
        Effects.setFilter({ resonance: value })
        if (filterResonanceValue) filterResonanceValue.textContent = value.toFixed(1)
      })
    }

    // Chorus controls
    const chorusEnabled = document.getElementById('chorusEnabled')
    const chorusRate = document.getElementById('chorusRate')
    const chorusRateValue = document.getElementById('chorusRateValue')
    const chorusDepth = document.getElementById('chorusDepth')
    const chorusDepthValue = document.getElementById('chorusDepthValue')
    const chorusMix = document.getElementById('chorusMix')
    const chorusMixValue = document.getElementById('chorusMixValue')

    if (chorusEnabled) {
      chorusEnabled.addEventListener('change', (e) => {
        Effects.setChorus({ enabled: e.target.checked })
      })
    }

    if (chorusRate) {
      chorusRate.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) / 10  // 1-100 -> 0.1-10 Hz
        Effects.setChorus({ rate: value })
        if (chorusRateValue) chorusRateValue.textContent = `${value.toFixed(1)}Hz`
      })
    }

    if (chorusDepth) {
      chorusDepth.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) / 10000  // 0-100 -> 0-0.01
        Effects.setChorus({ depth: value })
        if (chorusDepthValue) chorusDepthValue.textContent = `${e.target.value}%`
      })
    }

    if (chorusMix) {
      chorusMix.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) / 100
        Effects.setChorus({ mix: value })
        if (chorusMixValue) chorusMixValue.textContent = `${e.target.value}%`
      })
    }

    // Phaser controls
    const phaserEnabled = document.getElementById('phaserEnabled')
    const phaserRate = document.getElementById('phaserRate')
    const phaserRateValue = document.getElementById('phaserRateValue')
    const phaserDepth = document.getElementById('phaserDepth')
    const phaserDepthValue = document.getElementById('phaserDepthValue')
    const phaserFeedback = document.getElementById('phaserFeedback')
    const phaserFeedbackValue = document.getElementById('phaserFeedbackValue')

    if (phaserEnabled) {
      phaserEnabled.addEventListener('change', (e) => {
        Effects.setPhaser({ enabled: e.target.checked })
      })
    }

    if (phaserRate) {
      phaserRate.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) / 10  // 1-100 -> 0.1-10 Hz
        Effects.setPhaser({ rate: value })
        if (phaserRateValue) phaserRateValue.textContent = `${value.toFixed(1)}Hz`
      })
    }

    if (phaserDepth) {
      phaserDepth.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) / 100  // 0-100 -> 0-1
        Effects.setPhaser({ depth: value })
        if (phaserDepthValue) phaserDepthValue.textContent = `${e.target.value}%`
      })
    }

    if (phaserFeedback) {
      phaserFeedback.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) / 100  // 0-95 -> 0-0.95
        Effects.setPhaser({ feedback: value })
        if (phaserFeedbackValue) phaserFeedbackValue.textContent = `${e.target.value}%`
      })
    }
  }

  /**
   * Update chain mode UI and pattern selection
   */
  const updateChainModeUI = () => {
    // Update chain mode toggle
    const chainModeToggle = document.getElementById('chainModeToggle')
    if (chainModeToggle) {
      chainModeToggle.checked = SongMode.getChainMode()
    }

    // Update pattern button selection
    const currentIndex = SongMode.getCurrentPatternIndex()
    const buttons = document.querySelectorAll('.pattern-slot__button')
    buttons.forEach((btn, idx) => {
      if (idx === currentIndex) {
        btn.classList.add('is-active')
      } else {
        btn.classList.remove('is-active')
      }
    })
  }

  /**
   * Update effects UI elements to match current settings
   */
  const updateEffectsUI = () => {
    const settings = Effects.getSettings()

    // Reverb
    const reverbEnabled = document.getElementById('reverbEnabled')
    const reverbWetDry = document.getElementById('reverbWetDry')
    const reverbWetDryValue = document.getElementById('reverbWetDryValue')
    const reverbDecay = document.getElementById('reverbDecay')
    const reverbDecayValue = document.getElementById('reverbDecayValue')

    if (reverbEnabled) reverbEnabled.checked = settings.reverb.enabled
    if (reverbWetDry) reverbWetDry.value = Math.round(settings.reverb.wetDry * 100)
    if (reverbWetDryValue) reverbWetDryValue.textContent = `${Math.round(settings.reverb.wetDry * 100)}%`
    if (reverbDecay) reverbDecay.value = Math.round(settings.reverb.decayTime * 10)
    if (reverbDecayValue) reverbDecayValue.textContent = `${settings.reverb.decayTime.toFixed(1)}s`

    // Delay
    const delayEnabled = document.getElementById('delayEnabled')
    const delayWetDry = document.getElementById('delayWetDry')
    const delayWetDryValue = document.getElementById('delayWetDryValue')
    const delayTime = document.getElementById('delayTime')
    const delayTimeValue = document.getElementById('delayTimeValue')
    const delayFeedback = document.getElementById('delayFeedback')
    const delayFeedbackValue = document.getElementById('delayFeedbackValue')

    if (delayEnabled) delayEnabled.checked = settings.delay.enabled
    if (delayWetDry) delayWetDry.value = Math.round(settings.delay.wetDry * 100)
    if (delayWetDryValue) delayWetDryValue.textContent = `${Math.round(settings.delay.wetDry * 100)}%`
    if (delayTime) delayTime.value = Math.round(settings.delay.delayTime * 100)
    if (delayTimeValue) delayTimeValue.textContent = `${settings.delay.delayTime.toFixed(3)}s`
    if (delayFeedback) delayFeedback.value = Math.round(settings.delay.feedback * 100)
    if (delayFeedbackValue) delayFeedbackValue.textContent = `${Math.round(settings.delay.feedback * 100)}%`

    // Distortion
    const distortionEnabled = document.getElementById('distortionEnabled')
    const distortionAmount = document.getElementById('distortionAmount')
    const distortionAmountValue = document.getElementById('distortionAmountValue')
    const distortionTone = document.getElementById('distortionTone')
    const distortionToneValue = document.getElementById('distortionToneValue')

    if (distortionEnabled) distortionEnabled.checked = settings.distortion.enabled
    if (distortionAmount) distortionAmount.value = Math.round(settings.distortion.amount * 100)
    if (distortionAmountValue) distortionAmountValue.textContent = `${Math.round(settings.distortion.amount * 100)}%`
    if (distortionTone) distortionTone.value = Math.round(settings.distortion.tone * 100)
    if (distortionToneValue) distortionToneValue.textContent = `${Math.round(settings.distortion.tone * 100)}%`

    // Compressor
    const compressorEnabled = document.getElementById('compressorEnabled')
    const compressorThreshold = document.getElementById('compressorThreshold')
    const compressorThresholdValue = document.getElementById('compressorThresholdValue')
    const compressorRatio = document.getElementById('compressorRatio')
    const compressorRatioValue = document.getElementById('compressorRatioValue')

    if (compressorEnabled) compressorEnabled.checked = settings.compressor.enabled
    if (compressorThreshold) compressorThreshold.value = settings.compressor.threshold + 100
    if (compressorThresholdValue) compressorThresholdValue.textContent = `${settings.compressor.threshold}dB`
    if (compressorRatio) compressorRatio.value = settings.compressor.ratio
    if (compressorRatioValue) compressorRatioValue.textContent = `${settings.compressor.ratio}:1`

    // EQ
    const eqEnabled = document.getElementById('eqEnabled')
    const eqLow = document.getElementById('eqLow')
    const eqLowValue = document.getElementById('eqLowValue')
    const eqMid = document.getElementById('eqMid')
    const eqMidValue = document.getElementById('eqMidValue')
    const eqHigh = document.getElementById('eqHigh')
    const eqHighValue = document.getElementById('eqHighValue')

    if (eqEnabled) eqEnabled.checked = settings.eq.enabled
    if (eqLow) eqLow.value = settings.eq.low
    if (eqLowValue) eqLowValue.textContent = `${settings.eq.low >= 0 ? '+' : ''}${settings.eq.low.toFixed(1)}dB`
    if (eqMid) eqMid.value = settings.eq.mid
    if (eqMidValue) eqMidValue.textContent = `${settings.eq.mid >= 0 ? '+' : ''}${settings.eq.mid.toFixed(1)}dB`
    if (eqHigh) eqHigh.value = settings.eq.high
    if (eqHighValue) eqHighValue.textContent = `${settings.eq.high >= 0 ? '+' : ''}${settings.eq.high.toFixed(1)}dB`

    // Filter
    const filterEnabled = document.getElementById('filterEnabled')
    const filterType = document.getElementById('filterType')
    const filterFrequency = document.getElementById('filterFrequency')
    const filterFrequencyValue = document.getElementById('filterFrequencyValue')
    const filterResonance = document.getElementById('filterResonance')
    const filterResonanceValue = document.getElementById('filterResonanceValue')

    if (filterEnabled) filterEnabled.checked = settings.filter.enabled
    if (filterType) filterType.value = settings.filter.type
    if (filterFrequency) filterFrequency.value = settings.filter.frequency
    if (filterFrequencyValue) filterFrequencyValue.textContent = `${settings.filter.frequency}Hz`
    if (filterResonance) filterResonance.value = Math.round(settings.filter.resonance * 10)
    if (filterResonanceValue) filterResonanceValue.textContent = settings.filter.resonance.toFixed(1)

    // Chorus
    const chorusEnabled = document.getElementById('chorusEnabled')
    const chorusRate = document.getElementById('chorusRate')
    const chorusRateValue = document.getElementById('chorusRateValue')
    const chorusDepth = document.getElementById('chorusDepth')
    const chorusDepthValue = document.getElementById('chorusDepthValue')
    const chorusMix = document.getElementById('chorusMix')
    const chorusMixValue = document.getElementById('chorusMixValue')

    if (chorusEnabled) chorusEnabled.checked = settings.chorus.enabled
    if (chorusRate) chorusRate.value = Math.round(settings.chorus.rate * 10)
    if (chorusRateValue) chorusRateValue.textContent = `${settings.chorus.rate.toFixed(1)}Hz`
    if (chorusDepth) chorusDepth.value = Math.round(settings.chorus.depth * 10000)
    if (chorusDepthValue) chorusDepthValue.textContent = `${Math.round(settings.chorus.depth * 10000)}%`
    if (chorusMix) chorusMix.value = Math.round(settings.chorus.mix * 100)
    if (chorusMixValue) chorusMixValue.textContent = `${Math.round(settings.chorus.mix * 100)}%`

    // Phaser
    const phaserEnabled = document.getElementById('phaserEnabled')
    const phaserRate = document.getElementById('phaserRate')
    const phaserRateValue = document.getElementById('phaserRateValue')
    const phaserDepth = document.getElementById('phaserDepth')
    const phaserDepthValue = document.getElementById('phaserDepthValue')
    const phaserFeedback = document.getElementById('phaserFeedback')
    const phaserFeedbackValue = document.getElementById('phaserFeedbackValue')

    if (phaserEnabled) phaserEnabled.checked = settings.phaser.enabled
    if (phaserRate) phaserRate.value = Math.round(settings.phaser.rate * 10)
    if (phaserRateValue) phaserRateValue.textContent = `${settings.phaser.rate.toFixed(1)}Hz`
    if (phaserDepth) phaserDepth.value = Math.round(settings.phaser.depth * 100)
    if (phaserDepthValue) phaserDepthValue.textContent = `${Math.round(settings.phaser.depth * 100)}%`
    if (phaserFeedback) phaserFeedback.value = Math.round(settings.phaser.feedback * 100)
    if (phaserFeedbackValue) phaserFeedbackValue.textContent = `${Math.round(settings.phaser.feedback * 100)}%`
  }

  /**
   * Setup song mode controls
   */
  const setupSongModeControls = () => {
    const addSectionBtn = document.getElementById('addSectionBtn')
    const playSongBtn = document.getElementById('playSongBtn')
    const stopSongBtn = document.getElementById('stopSongBtn')
    const clearSongBtn = document.getElementById('clearSongBtn')
    const songSections = document.getElementById('songSections')

    if (addSectionBtn) {
      addSectionBtn.addEventListener('click', () => {
        const name = prompt('Section name:', `Section ${SongMode.getSong().length + 1}`)
        if (name) {
          const section = SongMode.createSectionFromCurrent(name, 1)
          SongMode.addSection(section)
          updateSongSections()
        }
      })
    }

    if (playSongBtn) {
      playSongBtn.addEventListener('click', () => {
        SongMode.play()
      })
    }

    if (stopSongBtn) {
      stopSongBtn.addEventListener('click', () => {
        SongMode.stop()
      })
    }

    if (clearSongBtn) {
      clearSongBtn.addEventListener('click', () => {
        if (confirm('Clear entire song?')) {
          SongMode.clearSong()
          updateSongSections()
        }
      })
    }

    // Listen to song mode events
    SongMode.on('sectionAdded', () => updateSongSections())
    SongMode.on('sectionRemoved', () => updateSongSections())
    SongMode.on('songCleared', () => updateSongSections())
  }

  /**
   * Update song sections display
   */
  const updateSongSections = () => {
    const songSections = document.getElementById('songSections')
    if (!songSections) return

    const sections = SongMode.getSong()

    if (sections.length === 0) {
      songSections.innerHTML = '<p style="color: var(--color-text-secondary); font-style: italic;">No sections added yet</p>'
      return
    }

    songSections.innerHTML = sections.map((section, index) => `
      <div class="song-section" style="
        padding: 8px;
        margin: 8px 0;
        background: var(--color-bg-tertiary);
        border: 1px solid var(--color-border);
        border-radius: 4px;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${section.name}</strong><br>
            <small style="color: var(--color-text-secondary);">${section.tempo} BPM × ${section.repeats}</small>
          </div>
          <button class="btn btn--danger" onclick="SongMode.removeSection(${index}); UI.updateSongSections()" style="padding: 4px 8px;">×</button>
        </div>
      </div>
    `).join('')
  }

  /**
   * Pattern Selector - Render pattern slots with rotary knobs
   */
  const renderPatternSlots = () => {
    const container = document.getElementById('patternSlots')
    if (!container) return

    container.innerHTML = ''
    const patternBank = SongMode.getPatternBank()
    const currentIndex = SongMode.getCurrentPatternIndex()

    patternBank.forEach((slot, index) => {
      const slotDiv = document.createElement('div')
      slotDiv.className = 'pattern-slot'
      slotDiv.dataset.patternIndex = index

      // Pattern button
      const button = document.createElement('button')
      button.className = 'pattern-slot__button'
      button.dataset.patternIndex = index
      button.textContent = index + 1

      if (index === currentIndex) {
        button.classList.add('is-active')
      }
      if (slot.isEmpty) {
        button.classList.add('is-empty')
      }

      button.addEventListener('click', async () => {
        // Allow switching to any pattern (empty or not)
        SongMode.switchToPattern(index)
      })

      slotDiv.appendChild(button)

      // Rotary knob for repeat count
      const repeats = slot.repeats || 1
      const rotation = -135 + ((repeats - 1) / 15) * 270 // Map 1-16 to -135° to +135°

      const knobSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      knobSVG.classList.add('pattern-slot__knob')
      knobSVG.setAttribute('viewBox', '0 0 50 50')
      knobSVG.dataset.patternIndex = index

      knobSVG.innerHTML = `
        <circle cx="25" cy="25" r="20" class="pattern-slot__knob-bg"/>
        <line
          x1="25"
          y1="25"
          x2="25"
          y2="10"
          class="pattern-slot__knob-indicator"
          style="transform: rotate(${rotation}deg)"
        />
      `

      slotDiv.appendChild(knobSVG)

      // Repeat count label
      const repeatLabel = document.createElement('div')
      repeatLabel.className = 'pattern-slot__repeats'
      repeatLabel.textContent = `×${repeats}`
      slotDiv.appendChild(repeatLabel)

      container.appendChild(slotDiv)
    })

    // Setup knob drag handlers
    setupPatternKnobHandlers()
  }

  /**
   * Pattern knob drag handling
   */
  let draggedPatternKnob = null
  let dragStartPatternY = 0
  let dragStartRepeats = 1

  const setupPatternKnobHandlers = () => {
    const knobs = document.querySelectorAll('.pattern-slot__knob')

    knobs.forEach(knob => {
      knob.addEventListener('mousedown', handlePatternKnobMouseDown)
    })
  }

  const handlePatternKnobMouseDown = (e) => {
    e.preventDefault()

    const knob = e.currentTarget
    const patternIndex = parseInt(knob.dataset.patternIndex, 10)
    const slot = SongMode.getPatternSlot(patternIndex)

    draggedPatternKnob = knob
    dragStartPatternY = e.clientY
    dragStartRepeats = slot.repeats

    document.addEventListener('mousemove', handlePatternKnobMouseMove)
    document.addEventListener('mouseup', handlePatternKnobMouseUp)
  }

  const handlePatternKnobMouseMove = (e) => {
    if (!draggedPatternKnob) return

    const patternIndex = parseInt(draggedPatternKnob.dataset.patternIndex, 10)
    const deltaY = dragStartPatternY - e.clientY  // Inverted: up = increase
    const repeatsChange = Math.floor(deltaY / 10)  // 10px = 1 repeat
    const newRepeats = Math.max(1, Math.min(16, dragStartRepeats + repeatsChange))

    SongMode.setPatternRepeats(patternIndex, newRepeats)
    updatePatternKnobRotation(draggedPatternKnob, patternIndex, newRepeats)
  }

  const handlePatternKnobMouseUp = () => {
    draggedPatternKnob = null

    document.removeEventListener('mousemove', handlePatternKnobMouseMove)
    document.removeEventListener('mouseup', handlePatternKnobMouseUp)
  }

  const updatePatternKnobRotation = (knobSVG, patternIndex, repeats) => {
    const rotation = -135 + ((repeats - 1) / 15) * 270 // Map 1-16 to -135° to +135°
    const indicator = knobSVG.querySelector('.pattern-slot__knob-indicator')
    if (indicator) {
      indicator.style.transform = `rotate(${rotation}deg)`
    }

    // Update repeat label
    const slotDiv = knobSVG.closest('.pattern-slot')
    const repeatLabel = slotDiv.querySelector('.pattern-slot__repeats')
    if (repeatLabel) {
      repeatLabel.textContent = `×${repeats}`
    }
  }

  /**
   * Setup pattern selector event listeners
   */
  const setupPatternSelectorListeners = () => {
    // Chain mode toggle
    const chainModeToggle = document.getElementById('chainModeToggle')
    if (chainModeToggle) {
      chainModeToggle.addEventListener('change', (e) => {
        SongMode.setChainMode(e.target.checked)
      })
    }

    // Listen to SongMode events
    SongMode.on('patternSwitched', handlePatternSwitched)
    SongMode.on('patternSwitchQueued', handlePatternSwitchQueued)
    SongMode.on('patternSlotUpdated', handlePatternSlotUpdated)
    SongMode.on('patternBankInitialized', renderPatternSlots)
    SongMode.on('patternBankRestored', () => {
      renderPatternSlots()
      updateChainModeUI()
    })
  }

  /**
   * Handle pattern switched event
   */
  const handlePatternSwitched = (data) => {
    // Update button states
    const buttons = document.querySelectorAll('.pattern-slot__button')
    buttons.forEach((btn, index) => {
      btn.classList.remove('is-active', 'is-queued')
      if (index === data.index) {
        btn.classList.add('is-active')
      }
    })

    // Re-render sequencer grid with new pattern
    renderSequencerGrid()

    // Re-render track names to update mixer knobs with pattern's mixer settings
    renderTrackNames()
  }

  /**
   * Handle pattern switch queued event
   */
  const handlePatternSwitchQueued = (data) => {
    // Show queued pattern
    const buttons = document.querySelectorAll('.pattern-slot__button')
    buttons.forEach((btn, index) => {
      btn.classList.remove('is-queued')
      if (index === data.index) {
        btn.classList.add('is-queued')
      }
    })
  }

  /**
   * Handle pattern slot updated event
   */
  const handlePatternSlotUpdated = (data) => {
    // Update button state (empty vs filled)
    const button = document.querySelector(`.pattern-slot__button[data-pattern-index="${data.index}"]`)
    if (button) {
      if (data.slot.isEmpty) {
        button.classList.add('is-empty')
      } else {
        button.classList.remove('is-empty')
      }
    }
  }

  // Track the currently editing track for instrument picker
  let currentPickerTrackIndex = null

  /**
   * Show the instrument picker modal
   * @param {number} trackIndex - Track index (0-15)
   * @param {string} currentInstrumentId - Current instrument ID
   */
  const showInstrumentPicker = (trackIndex, currentInstrumentId) => {
    currentPickerTrackIndex = trackIndex

    // Get or create the modal element
    let modal = document.getElementById('instrumentPickerModal')
    if (!modal) {
      modal = createInstrumentPickerModal()
      document.body.appendChild(modal)
    }

    // Populate the modal with instrument categories
    populateInstrumentPicker(currentInstrumentId)

    // Show the modal
    modal.classList.add('is-visible')
    modal.setAttribute('aria-hidden', 'false')
  }

  /**
   * Hide the instrument picker modal
   */
  const hideInstrumentPicker = () => {
    const modal = document.getElementById('instrumentPickerModal')
    if (modal) {
      modal.classList.remove('is-visible')
      modal.setAttribute('aria-hidden', 'true')
    }
    currentPickerTrackIndex = null
  }

  /**
   * Create the instrument picker modal HTML
   * @returns {HTMLElement} The modal element
   */
  const createInstrumentPickerModal = () => {
    const modal = document.createElement('div')
    modal.id = 'instrumentPickerModal'
    modal.className = 'instrument-picker-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-label', 'Select Instrument')
    modal.setAttribute('aria-hidden', 'true')

    modal.innerHTML = `
      <div class="instrument-picker-modal__backdrop"></div>
      <div class="instrument-picker-modal__content">
        <div class="instrument-picker-modal__header">
          <h3>Select Instrument</h3>
          <button class="instrument-picker-modal__close" aria-label="Close">&times;</button>
        </div>
        <div class="instrument-picker-modal__body">
          <div class="instrument-picker-modal__categories" id="instrumentCategories"></div>
        </div>
      </div>
    `

    // Add event listeners
    const backdrop = modal.querySelector('.instrument-picker-modal__backdrop')
    const closeBtn = modal.querySelector('.instrument-picker-modal__close')

    backdrop.addEventListener('click', hideInstrumentPicker)
    closeBtn.addEventListener('click', hideInstrumentPicker)

    // Close on escape key
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideInstrumentPicker()
      }
    })

    return modal
  }

  /**
   * Populate the instrument picker with categories and instruments
   * @param {string} currentInstrumentId - Current instrument ID to highlight
   */
  const populateInstrumentPicker = (currentInstrumentId) => {
    const categoriesContainer = document.getElementById('instrumentCategories')
    if (!categoriesContainer) return

    const library = AudioEngine.getInstrumentLibrary()
    if (!library || !library.categories) return

    categoriesContainer.innerHTML = ''

    library.categories.forEach(category => {
      const categoryDiv = document.createElement('div')
      categoryDiv.className = 'instrument-picker__category'

      const categoryHeader = document.createElement('div')
      categoryHeader.className = 'instrument-picker__category-header'
      categoryHeader.innerHTML = `
        <span class="instrument-picker__category-name">${category.name}</span>
        <span class="instrument-picker__category-toggle">▼</span>
      `
      categoryHeader.addEventListener('click', () => {
        categoryDiv.classList.toggle('is-collapsed')
      })

      const instrumentList = document.createElement('div')
      instrumentList.className = 'instrument-picker__instruments'

      category.instruments.forEach(instrument => {
        const instrumentItem = document.createElement('div')
        instrumentItem.className = 'instrument-picker__instrument'
        if (instrument.id === currentInstrumentId) {
          instrumentItem.classList.add('is-selected')
        }
        instrumentItem.dataset.instrumentId = instrument.id

        instrumentItem.innerHTML = `
          <button class="instrument-picker__preview" title="Preview">▶</button>
          <span class="instrument-picker__name">${instrument.name}</span>
        `

        // Preview button click
        const previewBtn = instrumentItem.querySelector('.instrument-picker__preview')
        previewBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          AudioEngine.previewInstrument(instrument.id)
        })

        // Select instrument on name click
        instrumentItem.addEventListener('click', () => {
          selectInstrument(instrument.id)
        })

        instrumentList.appendChild(instrumentItem)
      })

      categoryDiv.appendChild(categoryHeader)
      categoryDiv.appendChild(instrumentList)
      categoriesContainer.appendChild(categoryDiv)
    })
  }

  /**
   * Handle instrument selection from the picker
   * @param {string} instrumentId - Selected instrument ID
   */
  const selectInstrument = (instrumentId) => {
    if (currentPickerTrackIndex === null) return

    // Update the sequencer's track instrument
    Sequencer.setTrackInstrument(currentPickerTrackIndex, instrumentId)

    // Re-render track names to show the new instrument name
    renderTrackNames()

    // Hide the modal
    hideInstrumentPicker()
  }

  // Public API
  return {
    init,
    renderSequencerGrid,
    renderTrackNames,
    updateThemeColors,
    updateSongSections,
    updateLoopTrackDurations,
    updateEffectsUI,
    updateChainModeUI,
    showInstrumentPicker,
    hideInstrumentPicker
  }
})()
