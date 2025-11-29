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
    METER: 'meter',
    KALEIDOSCOPE: 'kaleidoscope',
    TUNNEL: 'tunnel'
  }

  // State for animated visualizations
  const vizState = {
    kaleidoscope: {
      rotation: 0,
      hueOffset: 0
    },
    tunnel: {
      z: 0,
      particles: [],
      hueOffset: 0
    }
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
        case TYPES.METER:
          renderMeter(window)
          break
        case TYPES.KALEIDOSCOPE:
          renderKaleidoscope(window)
          break
        case TYPES.TUNNEL:
          renderTunnel(window)
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
   * Render kaleidoscope visualization
   * @param {Object} window - Window object
   */
  const renderKaleidoscope = (window) => {
    const ctx = window.context
    const width = window.canvas.width
    const height = window.canvas.height
    const analyser = AudioEngine.getAnalyser()

    if (!analyser) return

    // Get frequency data for reactivity
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteFrequencyData(dataArray)

    // Calculate audio intensity
    const bass = dataArray.slice(0, 10).reduce((a, b) => a + b, 0) / 10 / 255
    const mid = dataArray.slice(10, 100).reduce((a, b) => a + b, 0) / 90 / 255
    const high = dataArray.slice(100, 200).reduce((a, b) => a + b, 0) / 100 / 255
    const overall = (bass + mid + high) / 3

    // Clear with fade effect for trails
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
    ctx.fillRect(0, 0, width, height)

    const centerX = width / 2
    const centerY = height / 2
    const segments = 8 // Number of kaleidoscope segments
    const maxRadius = Math.min(width, height) / 2

    // Update rotation based on audio
    vizState.kaleidoscope.rotation += 0.01 + bass * 0.05
    vizState.kaleidoscope.hueOffset += 0.5 + overall * 2

    ctx.save()
    ctx.translate(centerX, centerY)

    // Draw kaleidoscope segments
    for (let seg = 0; seg < segments; seg++) {
      ctx.save()
      ctx.rotate((seg * Math.PI * 2) / segments + vizState.kaleidoscope.rotation)

      // Draw shapes based on frequency data
      for (let i = 0; i < 32; i++) {
        const freqIndex = Math.floor((i / 32) * bufferLength * 0.5)
        const amplitude = dataArray[freqIndex] / 255
        const radius = 20 + i * 8 * window.options.zoom
        const size = 5 + amplitude * 20 * window.options.zoom

        if (radius > maxRadius) continue

        const angle = (i * 0.2) + vizState.kaleidoscope.rotation * 0.5
        const x = Math.cos(angle) * radius * (0.5 + amplitude * 0.5)
        const y = Math.sin(angle) * radius * 0.3

        const hue = (vizState.kaleidoscope.hueOffset + i * 10 + seg * 45) % 360
        const lightness = 40 + amplitude * 30

        ctx.beginPath()
        ctx.fillStyle = `hsla(${hue}, 80%, ${lightness}%, ${0.3 + amplitude * 0.5})`

        // Alternate between circles and polygons
        if (i % 3 === 0) {
          ctx.arc(x, y, size, 0, Math.PI * 2)
        } else if (i % 3 === 1) {
          // Triangle
          ctx.moveTo(x, y - size)
          ctx.lineTo(x - size * 0.866, y + size * 0.5)
          ctx.lineTo(x + size * 0.866, y + size * 0.5)
          ctx.closePath()
        } else {
          // Diamond
          ctx.moveTo(x, y - size)
          ctx.lineTo(x + size, y)
          ctx.lineTo(x, y + size)
          ctx.lineTo(x - size, y)
          ctx.closePath()
        }
        ctx.fill()
      }

      // Mirror effect
      ctx.scale(1, -1)
      for (let i = 0; i < 16; i++) {
        const freqIndex = Math.floor((i / 16) * bufferLength * 0.3)
        const amplitude = dataArray[freqIndex] / 255
        const radius = 30 + i * 12 * window.options.zoom
        const size = 3 + amplitude * 15

        if (radius > maxRadius) continue

        const x = radius * (0.3 + amplitude * 0.4)
        const y = i * 5

        const hue = (vizState.kaleidoscope.hueOffset + i * 15 + seg * 45 + 180) % 360

        ctx.beginPath()
        ctx.fillStyle = `hsla(${hue}, 70%, 50%, ${0.2 + amplitude * 0.4})`
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
    }

    ctx.restore()
  }

  /**
   * Render tunnel/starfield visualization - flying through sound
   * @param {Object} window - Window object
   */
  const renderTunnel = (window) => {
    const ctx = window.context
    const width = window.canvas.width
    const height = window.canvas.height
    const analyser = AudioEngine.getAnalyser()

    if (!analyser) return

    // Get frequency data
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteFrequencyData(dataArray)

    // Calculate audio intensity
    const bass = dataArray.slice(0, 10).reduce((a, b) => a + b, 0) / 10 / 255
    const mid = dataArray.slice(10, 100).reduce((a, b) => a + b, 0) / 90 / 255
    const overall = (bass * 0.6 + mid * 0.4)

    // Clear with motion blur effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
    ctx.fillRect(0, 0, width, height)

    const centerX = width / 2
    const centerY = height / 2

    // Update tunnel state
    vizState.tunnel.z += 2 + overall * 10
    vizState.tunnel.hueOffset += 0.3 + bass * 2

    // Initialize particles if empty
    if (vizState.tunnel.particles.length < 150) {
      for (let i = vizState.tunnel.particles.length; i < 150; i++) {
        vizState.tunnel.particles.push({
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
          z: Math.random() * 1000,
          size: Math.random() * 2 + 1,
          hue: Math.random() * 360
        })
      }
    }

    // Sort particles by z for proper depth rendering
    vizState.tunnel.particles.sort((a, b) => b.z - a.z)

    // Update and draw particles (stars flying past)
    vizState.tunnel.particles.forEach((particle, index) => {
      // Move particle toward viewer
      particle.z -= 5 + overall * 20 * window.options.zoom

      // Reset particle if it's passed the viewer
      if (particle.z <= 0) {
        particle.z = 1000
        particle.x = (Math.random() - 0.5) * 2
        particle.y = (Math.random() - 0.5) * 2
        particle.hue = (vizState.tunnel.hueOffset + Math.random() * 60) % 360
      }

      // Calculate screen position with perspective
      const perspective = 300 / particle.z
      const screenX = centerX + particle.x * width * perspective
      const screenY = centerY + particle.y * height * perspective
      const size = particle.size * perspective * 10 * window.options.zoom

      // Only draw if on screen
      if (screenX >= 0 && screenX <= width && screenY >= 0 && screenY <= height) {
        // Color based on depth and audio
        const freqIndex = Math.floor((index / 150) * bufferLength * 0.5)
        const amplitude = dataArray[freqIndex] / 255

        const hue = (particle.hue + vizState.tunnel.hueOffset) % 360
        const lightness = 50 + amplitude * 30
        const alpha = Math.min(1, (1000 - particle.z) / 500) * (0.5 + amplitude * 0.5)

        // Draw star with glow
        ctx.beginPath()
        ctx.fillStyle = `hsla(${hue}, 80%, ${lightness}%, ${alpha})`
        ctx.arc(screenX, screenY, size, 0, Math.PI * 2)
        ctx.fill()

        // Draw motion trail
        if (size > 2) {
          const trailLength = size * 3 * (1 + overall)
          const gradient = ctx.createLinearGradient(
            screenX, screenY,
            screenX - (screenX - centerX) * 0.1,
            screenY - (screenY - centerY) * 0.1
          )
          gradient.addColorStop(0, `hsla(${hue}, 80%, ${lightness}%, ${alpha * 0.8})`)
          gradient.addColorStop(1, `hsla(${hue}, 80%, ${lightness}%, 0)`)

          ctx.beginPath()
          ctx.strokeStyle = gradient
          ctx.lineWidth = size * 0.5
          ctx.moveTo(screenX, screenY)
          ctx.lineTo(
            screenX - (screenX - centerX) * trailLength / 100,
            screenY - (screenY - centerY) * trailLength / 100
          )
          ctx.stroke()
        }
      }
    })

    // Draw tunnel rings based on frequency
    for (let i = 0; i < 8; i++) {
      const freqIndex = Math.floor((i / 8) * bufferLength * 0.3)
      const amplitude = dataArray[freqIndex] / 255
      const ringZ = ((vizState.tunnel.z * 2 + i * 125) % 1000)
      const perspective = 300 / Math.max(ringZ, 1)
      const radius = 400 * perspective * (1 + amplitude * 0.5)

      if (radius > 5 && radius < Math.max(width, height)) {
        const hue = (vizState.tunnel.hueOffset + i * 45) % 360
        const alpha = Math.min(0.6, (1000 - ringZ) / 1000) * amplitude

        ctx.beginPath()
        ctx.strokeStyle = `hsla(${hue}, 70%, 60%, ${alpha})`
        ctx.lineWidth = 2 + amplitude * 4
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
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
      [TYPES.METER]: 'VU Meter',
      [TYPES.KALEIDOSCOPE]: 'Kaleidoscope',
      [TYPES.TUNNEL]: 'Starfield Tunnel'
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
