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

    // Set up event listeners
    setupEventListeners()

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
    const root = document.documentElement
    const computedStyle = getComputedStyle(root)

    colors.background = computedStyle.getPropertyValue('--color-bg-primary').trim() || '#1a1a1a'
    colors.grid = computedStyle.getPropertyValue('--color-bg-tertiary').trim() || '#3a3a3a'
    colors.active = computedStyle.getPropertyValue('--color-accent').trim() || '#00bcd4'
    colors.highlight = computedStyle.getPropertyValue('--color-accent-hover').trim() || '#00acc1'
    colors.text = computedStyle.getPropertyValue('--color-text-primary').trim() || '#ffffff'

    console.log('Theme colors updated:', colors)
  }

  /**
   * Render track names
   */
  const renderTrackNames = () => {
    if (!trackNamesContainer) return

    const instruments = AudioEngine.getInstruments()
    trackNamesContainer.innerHTML = ''

    instruments.forEach(instrument => {
      const nameDiv = document.createElement('div')
      nameDiv.className = 'track-name'
      nameDiv.textContent = instrument.name
      nameDiv.dataset.instrument = instrument.id
      trackNamesContainer.appendChild(nameDiv)
    })
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

    for (let i = 0; i < 6; i++) {
      const trackDiv = document.createElement('div')
      trackDiv.className = 'loop-track'
      trackDiv.dataset.trackIndex = i

      trackDiv.innerHTML = `
        <div class="loop-track__header">
          <span class="loop-track__name">Loop ${i + 1}</span>
        </div>
        <div class="loop-track__controls">
          <button class="btn btn--primary btn-record" data-action="record">● Rec</button>
          <button class="btn btn--secondary btn-play" data-action="play">▶ Play</button>
          <button class="btn btn--secondary btn-stop" data-action="stop">■ Stop</button>
          <button class="btn btn--secondary btn-clear" data-action="clear">✕ Clear</button>
        </div>
        <div class="loop-track__waveform"></div>
        <label class="control">
          <span class="control__label">Volume</span>
          <input type="range" class="control__slider track-volume" min="0" max="100" value="80">
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

    const instruments = AudioEngine.getInstruments()
    const numInstruments = instruments.length
    const numSteps = 16

    gridCellWidth = width / numSteps
    gridCellHeight = height / numInstruments

    // Draw grid and steps
    instruments.forEach((instrument, row) => {
      for (let col = 0; col < numSteps; col++) {
        const x = col * gridCellWidth
        const y = row * gridCellHeight

        // Check if step is active
        const isActive = pattern.pattern[instrument.id]?.[col] === 1

        // Highlight current step
        const isHighlighted = col === currentHighlightedStep

        // Draw cell background
        if (isActive) {
          ctx.fillStyle = isHighlighted ? colors.highlight : colors.active
        } else {
          ctx.fillStyle = isHighlighted ? colors.grid : colors.background
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
        Sequencer.togglePlayPause()
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

    // Tempo input
    const tempoInput = document.getElementById('tempoInput')
    if (tempoInput) {
      tempoInput.addEventListener('input', (e) => {
        const tempo = parseInt(e.target.value, 10)
        Sequencer.setTempo(tempo)
        updateTempoDisplay()
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
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const col = Math.floor(x / gridCellWidth)
    const row = Math.floor(y / gridCellHeight)

    const instruments = AudioEngine.getInstruments()
    if (row >= 0 && row < instruments.length && col >= 0 && col < 16) {
      const instrument = instruments[row]
      Sequencer.toggleStep(instrument.id, col)
      renderSequencerGrid()

      // Preview sound
      AudioEngine.playDrum(instrument.id)
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
        document.getElementById('tempoInput').value = Sequencer.getTempo()
        updateTempoDisplay()
        break
      case '-':
      case '_':
        e.preventDefault()
        Sequencer.setTempo(Sequencer.getTempo() - 5)
        document.getElementById('tempoInput').value = Sequencer.getTempo()
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
    updateThemeColors()
    renderSequencerGrid()
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

  // Public API
  return {
    init,
    renderSequencerGrid,
    updateThemeColors,
    updateSongSections
  }
})()
