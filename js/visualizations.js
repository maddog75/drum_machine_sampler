/**
 * Visualizations Module
 * Creates draggable, resizable, and zoomable visualization windows
 */

const Visualizations = (() => {
  // Private variables
  let windows = []
  let nextWindowId = 1
  let activeWindow = null
  let zIndexCounter = 1000

  // Visualization types
  const TYPES = {
    WAVEFORM: 'waveform',
    FREQUENCY: 'frequency',
    OSCILLOSCOPE: 'oscilloscope',
    SPECTRUM: 'spectrum',
    METER: 'meter'
  }

  /**
   * Initialize visualizations
   */
  const init = () => {
    console.log('Visualizations module initialized')
  }

  /**
   * Create a new visualization window
   * @param {string} type - Visualization type
   * @param {Object} options - Window options
   * @returns {Object} Window object
   */
  const createWindow = (type, options = {}) => {
    const windowId = `viz-window-${nextWindowId++}`

    const defaultOptions = {
      title: getDefaultTitle(type),
      x: 100 + (windows.length * 30),
      y: 100 + (windows.length * 30),
      width: 400,
      height: 300,
      minWidth: 200,
      minHeight: 150,
      zoom: 1.0,
      backgroundColor: '#1a1a1a'
    }

    const windowOptions = { ...defaultOptions, ...options }

    // Create window element
    const windowEl = createWindowElement(windowId, type, windowOptions)
    document.body.appendChild(windowEl)

    // Create canvas for visualization
    const canvas = windowEl.querySelector('.viz-canvas')
    const context = canvas.getContext('2d')

    // Set canvas size
    canvas.width = windowOptions.width
    canvas.height = windowOptions.height - 40 // Subtract title bar height

    // Create window object
    const windowObj = {
      id: windowId,
      type,
      element: windowEl,
      canvas,
      context,
      options: windowOptions,
      isMinimized: false,
      isDragging: false,
      isResizing: false,
      dragOffset: { x: 0, y: 0 },
      animationId: null
    }

    windows.push(windowObj)

    // Set up event listeners
    setupWindowEvents(windowObj)

    // Start visualization
    startVisualization(windowObj)

    return windowObj
  }

  /**
   * Create window DOM element
   * @param {string} id - Window ID
   * @param {string} type - Visualization type
   * @param {Object} options - Window options
   * @returns {HTMLElement} Window element
   */
  const createWindowElement = (id, type, options) => {
    const div = document.createElement('div')
    div.id = id
    div.className = 'viz-window'
    div.style.cssText = `
      position: fixed;
      left: ${options.x}px;
      top: ${options.y}px;
      width: ${options.width}px;
      height: ${options.height}px;
      background: var(--color-bg-secondary);
      border: 2px solid var(--color-border);
      border-radius: 8px;
      box-shadow: 0 8px 16px rgba(0,0,0,0.4);
      z-index: ${zIndexCounter++};
      overflow: hidden;
    `

    div.innerHTML = `
      <div class="viz-titlebar" style="
        height: 40px;
        background: var(--color-bg-tertiary);
        border-bottom: 1px solid var(--color-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px;
        cursor: move;
        user-select: none;
      ">
        <span class="viz-title" style="
          color: var(--color-text-primary);
          font-weight: 600;
          font-size: 0.9rem;
        ">${options.title}</span>
        <div class="viz-controls" style="display: flex; gap: 8px;">
          <button class="viz-btn viz-zoom-out" title="Zoom Out" style="
            background: none;
            border: none;
            color: var(--color-text-secondary);
            cursor: pointer;
            font-size: 1.2rem;
            padding: 4px 8px;
          ">−</button>
          <button class="viz-btn viz-zoom-in" title="Zoom In" style="
            background: none;
            border: none;
            color: var(--color-text-secondary);
            cursor: pointer;
            font-size: 1.2rem;
            padding: 4px 8px;
          ">+</button>
          <button class="viz-btn viz-minimize" title="Minimize" style="
            background: none;
            border: none;
            color: var(--color-text-secondary);
            cursor: pointer;
            font-size: 1rem;
            padding: 4px 8px;
          ">_</button>
          <button class="viz-btn viz-close" title="Close" style="
            background: none;
            border: none;
            color: var(--color-danger);
            cursor: pointer;
            font-size: 1.2rem;
            padding: 4px 8px;
          ">×</button>
        </div>
      </div>
      <div class="viz-content" style="
        width: 100%;
        height: calc(100% - 40px);
        overflow: hidden;
      ">
        <canvas class="viz-canvas" style="
          display: block;
          width: 100%;
          height: 100%;
        "></canvas>
      </div>
      <div class="viz-resize-handle" style="
        position: absolute;
        right: 0;
        bottom: 0;
        width: 20px;
        height: 20px;
        cursor: nwse-resize;
        background: linear-gradient(135deg, transparent 50%, var(--color-border) 50%);
      "></div>
    `

    return div
  }

  /**
   * Set up window event listeners
   * @param {Object} window - Window object
   */
  const setupWindowEvents = (window) => {
    const titleBar = window.element.querySelector('.viz-titlebar')
    const resizeHandle = window.element.querySelector('.viz-resize-handle')
    const closeBtn = window.element.querySelector('.viz-close')
    const minimizeBtn = window.element.querySelector('.viz-minimize')
    const zoomInBtn = window.element.querySelector('.viz-zoom-in')
    const zoomOutBtn = window.element.querySelector('.viz-zoom-out')

    // Dragging
    titleBar.addEventListener('mousedown', (e) => {
      if (e.target.closest('.viz-btn')) return

      window.isDragging = true
      activeWindow = window
      window.element.style.zIndex = zIndexCounter++

      const rect = window.element.getBoundingClientRect()
      window.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }

      e.preventDefault()
    })

    // Resizing
    resizeHandle.addEventListener('mousedown', (e) => {
      window.isResizing = true
      activeWindow = window
      window.element.style.zIndex = zIndexCounter++
      e.preventDefault()
      e.stopPropagation()
    })

    // Close
    closeBtn.addEventListener('click', () => {
      closeWindow(window.id)
    })

    // Minimize
    minimizeBtn.addEventListener('click', () => {
      toggleMinimize(window.id)
    })

    // Zoom
    zoomInBtn.addEventListener('click', () => {
      adjustZoom(window.id, 0.1)
    })

    zoomOutBtn.addEventListener('click', () => {
      adjustZoom(window.id, -0.1)
    })

    // Bring to front on click
    window.element.addEventListener('mousedown', () => {
      window.element.style.zIndex = zIndexCounter++
    })
  }

  /**
   * Global mouse move handler
   */
  document.addEventListener('mousemove', (e) => {
    if (!activeWindow) return

    if (activeWindow.isDragging) {
      activeWindow.element.style.left = (e.clientX - activeWindow.dragOffset.x) + 'px'
      activeWindow.element.style.top = (e.clientY - activeWindow.dragOffset.y) + 'px'
    }

    if (activeWindow.isResizing) {
      const rect = activeWindow.element.getBoundingClientRect()
      const newWidth = Math.max(activeWindow.options.minWidth, e.clientX - rect.left)
      const newHeight = Math.max(activeWindow.options.minHeight, e.clientY - rect.top)

      activeWindow.element.style.width = newWidth + 'px'
      activeWindow.element.style.height = newHeight + 'px'

      // Update canvas size
      activeWindow.canvas.width = newWidth
      activeWindow.canvas.height = newHeight - 40
    }
  })

  /**
   * Global mouse up handler
   */
  document.addEventListener('mouseup', () => {
    if (activeWindow) {
      activeWindow.isDragging = false
      activeWindow.isResizing = false
      activeWindow = null
    }
  })

  /**
   * Start visualization rendering
   * @param {Object} window - Window object
   */
  const startVisualization = (window) => {
    const render = () => {
      if (!window.element.parentElement || window.isMinimized) {
        return // Window closed or minimized
      }

      switch (window.type) {
        case TYPES.WAVEFORM:
          renderWaveform(window)
          break
        case TYPES.FREQUENCY:
          renderFrequency(window)
          break
        case TYPES.OSCILLOSCOPE:
          renderOscilloscope(window)
          break
        case TYPES.SPECTRUM:
          renderSpectrum(window)
          break
        case TYPES.METER:
          renderMeter(window)
          break
      }

      window.animationId = requestAnimationFrame(render)
    }

    render()
  }

  /**
   * Render waveform visualization
   * @param {Object} window - Window object
   */
  const renderWaveform = (window) => {
    const ctx = window.context
    const width = window.canvas.width
    const height = window.canvas.height
    const analyser = AudioEngine.getAnalyser()

    if (!analyser) return

    // Clear canvas
    ctx.fillStyle = window.options.backgroundColor
    ctx.fillRect(0, 0, width, height)

    // Get waveform data
    const bufferLength = analyser.fftSize
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteTimeDomainData(dataArray)

    // Draw waveform
    ctx.lineWidth = 2 * window.options.zoom
    ctx.strokeStyle = 'var(--color-accent)'
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

    // Draw center line
    ctx.strokeStyle = 'var(--color-border)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()
  }

  /**
   * Render frequency spectrum visualization
   * @param {Object} window - Window object
   */
  const renderFrequency = (window) => {
    const ctx = window.context
    const width = window.canvas.width
    const height = window.canvas.height
    const analyser = AudioEngine.getAnalyser()

    if (!analyser) return

    // Clear canvas
    ctx.fillStyle = window.options.backgroundColor
    ctx.fillRect(0, 0, width, height)

    // Get frequency data
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteFrequencyData(dataArray)

    const barWidth = (width / bufferLength) * 2.5
    let barHeight
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * height * window.options.zoom

      const hue = (i / bufferLength) * 360
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`

      ctx.fillRect(x, height - barHeight, barWidth, barHeight)

      x += barWidth + 1
    }
  }

  /**
   * Render oscilloscope visualization
   * @param {Object} window - Window object
   */
  const renderOscilloscope = (window) => {
    renderWaveform(window) // Similar to waveform for now
  }

  /**
   * Render spectrum analyzer visualization
   * @param {Object} window - Window object
   */
  const renderSpectrum = (window) => {
    renderFrequency(window) // Similar to frequency for now
  }

  /**
   * Render VU meter visualization
   * @param {Object} window - Window object
   */
  const renderMeter = (window) => {
    const ctx = window.context
    const width = window.canvas.width
    const height = window.canvas.height
    const analyser = AudioEngine.getAnalyser()

    if (!analyser) return

    // Clear canvas
    ctx.fillStyle = window.options.backgroundColor
    ctx.fillRect(0, 0, width, height)

    // Get level
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteFrequencyData(dataArray)

    const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength
    const level = average / 255

    // Draw meter
    const meterHeight = height * level * window.options.zoom

    // Gradient
    const gradient = ctx.createLinearGradient(0, height, 0, 0)
    gradient.addColorStop(0, '#4caf50')
    gradient.addColorStop(0.7, '#ff9800')
    gradient.addColorStop(1, '#f44336')

    ctx.fillStyle = gradient
    ctx.fillRect(0, height - meterHeight, width, meterHeight)

    // Draw scale
    for (let i = 0; i <= 10; i++) {
      const y = (height / 10) * i
      ctx.strokeStyle = 'var(--color-border)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  }

  /**
   * Close window
   * @param {string} id - Window ID
   */
  const closeWindow = (id) => {
    const index = windows.findIndex(w => w.id === id)
    if (index !== -1) {
      const window = windows[index]

      // Stop animation
      if (window.animationId) {
        cancelAnimationFrame(window.animationId)
      }

      // Remove element
      if (window.element.parentElement) {
        window.element.parentElement.removeChild(window.element)
      }

      // Remove from array
      windows.splice(index, 1)
    }
  }

  /**
   * Toggle window minimize
   * @param {string} id - Window ID
   */
  const toggleMinimize = (id) => {
    const window = windows.find(w => w.id === id)
    if (window) {
      window.isMinimized = !window.isMinimized

      if (window.isMinimized) {
        window.element.querySelector('.viz-content').style.display = 'none'
        window.element.style.height = '40px'
      } else {
        window.element.querySelector('.viz-content').style.display = 'block'
        window.element.style.height = window.options.height + 'px'
      }
    }
  }

  /**
   * Adjust window zoom
   * @param {string} id - Window ID
   * @param {number} delta - Zoom delta
   */
  const adjustZoom = (id, delta) => {
    const window = windows.find(w => w.id === id)
    if (window) {
      window.options.zoom = Math.max(0.5, Math.min(3.0, window.options.zoom + delta))
    }
  }

  /**
   * Get default title for visualization type
   * @param {string} type - Visualization type
   * @returns {string} Title
   */
  const getDefaultTitle = (type) => {
    const titles = {
      [TYPES.WAVEFORM]: 'Waveform',
      [TYPES.FREQUENCY]: 'Frequency Spectrum',
      [TYPES.OSCILLOSCOPE]: 'Oscilloscope',
      [TYPES.SPECTRUM]: 'Spectrum Analyzer',
      [TYPES.METER]: 'VU Meter'
    }
    return titles[type] || 'Visualization'
  }

  /**
   * Get all windows
   * @returns {Array} Windows
   */
  const getWindows = () => {
    return [...windows]
  }

  /**
   * Close all windows
   */
  const closeAll = () => {
    [...windows].forEach(w => closeWindow(w.id))
  }

  // Public API
  return {
    init,
    createWindow,
    closeWindow,
    toggleMinimize,
    adjustZoom,
    getWindows,
    closeAll,
    TYPES
  }
})()
