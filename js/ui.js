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

      // Calculate grid dimensions
      gridCellWidth = sequencerCanvas.width / 16
      gridCellHeight = sequencerCanvas.height / 16

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

    draggedKnob = knob
    dragStartY = e.clientY
    dragStartVolume = AudioEngine.getTrackVolume(instrument)

    document.addEventListener('mousemove', handleKnobMouseMove)
    document.addEventListener('mouseup', handleKnobMouseUp)
  }

  const handleKnobMouseMove = (e) => {
    if (!draggedKnob) return

    const instrument = draggedKnob.dataset.instrument
    const deltaY = dragStartY - e.clientY  // Inverted: up = increase
    const volumeChange = deltaY / 100       // 100px = full range (0 to 1)
    const newVolume = Math.max(0, Math.min(1, dragStartVolume + volumeChange))

    AudioEngine.setTrackVolume(instrument, newVolume)
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
   * Render track names
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
      nameDiv.appendChild(label)

      // Add volume knob for drum tracks (not loop tracks)
      if (!track.id.startsWith('loop')) {
        const knobContainer = document.createElement('div')
        knobContainer.className = 'volume-knob-container'
        knobContainer.dataset.instrument = track.id

        const volume = AudioEngine.getTrackVolume(track.id)
        const rotation = -135 + (volume * 270) // -135° to +135° = 270° range

        knobContainer.innerHTML = `
          <svg class="volume-knob" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" class="volume-knob__bg"/>
            <line
              x1="25"
              y1="25"
              x2="25"
              y2="10"
              class="volume-knob__indicator"
              style="transform: rotate(${rotation}deg)"
            />
          </svg>
        `

        nameDiv.appendChild(knobContainer)
      }

      trackNamesContainer.appendChild(nameDiv)
    })

    // Add knob drag handlers
    setupVolumeKnobHandlers()
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
        <div class="preset-btn__name">${pattern.name}</div>
        <div class="preset-btn__info">${pattern.genre} • ${pattern.tempo} BPM</div>
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

      trackDiv.innerHTML = `
        <div class="loop-track__header">
          <span class="loop-track__name">Loop ${i + 1}</span>
        </div>
        <div class="loop-track__controls">
          <button class="btn btn--primary btn--small btn-record" data-action="record">● Rec</button>
          <button class="btn btn--secondary btn--small btn-play" data-action="play">▶ Play</button>
          <button class="btn btn--secondary btn--small btn-stop" data-action="stop">■ Stop</button>
          <button class="btn btn--secondary btn--small btn-clear" data-action="clear">✕ Clear</button>
        </div>
        <div class="loop-track__waveform"></div>
        <label class="control control--compact">
          <span class="control__label">Vol</span>
          <input type="range" class="control__slider track-volume" min="0" max="100" value="80">
          <span class="control__value">80%</span>
        </label>
      `

      loopTracksContainer.appendChild(trackDiv)
    }
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
    const numSteps = 16

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

        // Draw cell background with group highlighting
        if (isActive) {
          ctx.fillStyle = isHighlighted ? colors.highlight : colors.active
        } else if (isHighlighted) {
          ctx.fillStyle = colors.grid
        } else if (isGroupStart) {
          // Lighter background for first column of each group
          ctx.fillStyle = colors.groupHighlight
        } else {
          ctx.fillStyle = colors.background
        }
        ctx.fillRect(x + 2, y + 2, gridCellWidth - 4, gridCellHeight - 4)

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

    // Clear sequencer button
    const clearSequencerBtn = document.getElementById('clearSequencerBtn')
    if (clearSequencerBtn) {
      clearSequencerBtn.addEventListener('click', () => {
        if (confirm('Clear all drum patterns? This cannot be undone.')) {
          Sequencer.clearPattern()
          renderSequencerGrid()
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
    const openOscilloscopeBtn = document.getElementById('openOscilloscopeBtn')
    const openSpectrumBtn = document.getElementById('openSpectrumBtn')
    const openMeterBtn = document.getElementById('openMeterBtn')
    const closeAllVizBtn = document.getElementById('closeAllVizBtn')

    if (openWaveformBtn) openWaveformBtn.addEventListener('click', () => Visualizations.createWindow(Visualizations.TYPES.WAVEFORM))
    if (openFrequencyBtn) openFrequencyBtn.addEventListener('click', () => Visualizations.createWindow(Visualizations.TYPES.FREQUENCY))
    if (openOscilloscopeBtn) openOscilloscopeBtn.addEventListener('click', () => Visualizations.createWindow(Visualizations.TYPES.OSCILLOSCOPE))
    if (openSpectrumBtn) openSpectrumBtn.addEventListener('click', () => Visualizations.createWindow(Visualizations.TYPES.SPECTRUM))
    if (openMeterBtn) openMeterBtn.addEventListener('click', () => Visualizations.createWindow(Visualizations.TYPES.METER))
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
  }

  /**
   * Handle sequencer canvas click
   */
  const handleSequencerClick = (e) => {
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
    if (row >= 0 && row < allTracks.length && col >= 0 && col < 16) {
      const track = allTracks[row]
      Sequencer.toggleStep(track.id, col)
      renderSequencerGrid()

      // Preview sound (only for drum tracks)
      if (!track.id.startsWith('loop')) {
        AudioEngine.playDrum(track.id)
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
        } else {
          LoopPedal.startRecording(trackIndex)
          btn.textContent = '■ Stop Rec'
          btn.classList.add('is-recording')
        }
        break
      case 'play':
        LoopPedal.playTrack(trackIndex)
        break
      case 'stop':
        LoopPedal.stopTrack(trackIndex)
        break
      case 'clear':
        if (confirm('Clear this loop track?')) {
          LoopPedal.clearTrack(trackIndex)
        }
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
    const themes = ['dark', 'matrix', 'vivid']
    const currentTheme = document.body.dataset.theme || 'dark'
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

    if (Sequencer.getIsPlaying()) {
      playPauseBtn.classList.add('is-playing')
      playPauseBtn.setAttribute('aria-label', 'Pause')
    } else {
      playPauseBtn.classList.remove('is-playing')
      playPauseBtn.setAttribute('aria-label', 'Play')
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
        // If clicking an empty slot, save current pattern to it
        if (slot.isEmpty && index !== currentIndex) {
          const currentPattern = Sequencer.getPattern()
          const currentTempo = Sequencer.getTempo()
          const currentTimeSignature = Sequencer.getTimeSignature()

          await SongMode.loadPatternToSlot(index, currentPattern, currentTempo, currentTimeSignature)
          await SongMode.switchToPattern(index)
        }
        // If clicking a non-empty slot, switch to it
        else if (!slot.isEmpty || index === 0) {
          SongMode.switchToPattern(index)
        }
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

  // Public API
  return {
    init,
    renderSequencerGrid,
    updateThemeColors,
    updateSongSections
  }
})()
