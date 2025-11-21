/**
 * Main Application
 * Orchestrates all modules and manages application lifecycle
 */

(async () => {
  // Tutorial state
  let tutorialStep = 0
  const tutorialSteps = [
    {
      title: 'Welcome to Drum Machine & Loop Pedal!',
      text: 'Let\'s learn how to make awesome music! Click Next to continue, or Skip to start creating right away.',
      highlight: null
    },
    {
      title: 'The Drum Sequencer',
      text: 'Click on the grid to add or remove drum beats. Each row is a different drum sound, and each column is a step in time.',
      highlight: '#sequencerCanvas'
    },
    {
      title: 'Try a Preset',
      text: 'Choose from our pre-made beat patterns on the left to get started quickly!',
      highlight: '.presets'
    },
    {
      title: 'Press Play!',
      text: 'Click the play button (or press Space) to hear your rhythm come to life!',
      highlight: '#playPauseBtn'
    },
    {
      title: 'Loop Pedal',
      text: 'Enable your microphone to record your own loops and layer them with the drums!',
      highlight: '.loop-pedal'
    },
    {
      title: 'Save Your Work',
      text: 'Don\'t forget to save your creations! Click the Save button when you\'re done.',
      highlight: '#saveBtn'
    },
    {
      title: 'You\'re Ready!',
      text: 'Now go make some amazing music! Press H anytime for help.',
      highlight: null
    }
  ]

  /**
   * Initialize the application
   */
  const init = async () => {
    console.log('Initializing Drum Machine & Loop Pedal...')

    // Initialize audio engine first (requires user interaction)
    setupFirstInteraction()

    // Initialize all modules
    Sequencer.init()
    LoopPedal.init()
    UI.init()

    // Enable auto-save
    Storage.enableAutoSave()

    // Check for existing session
    if (Storage.hasSession()) {
      const loadSession = confirm('Load your previous session?')
      if (loadSession) {
        await Storage.loadSession()
        UI.renderSequencerGrid()
      }
    }

    // Show tutorial for first-time users
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial')
    if (!hasSeenTutorial) {
      showTutorial()
    }

    console.log('Application initialized successfully!')
  }

  /**
   * Setup first user interaction to initialize audio context
   * Required by browser autoplay policies
   */
  const setupFirstInteraction = () => {
    const initAudio = async () => {
      await AudioEngine.init()
      AudioEngine.generateDrumSamples()
      console.log('Audio engine initialized')

      // Remove event listeners after first interaction
      document.removeEventListener('click', initAudio)
      document.removeEventListener('keydown', initAudio)
      document.removeEventListener('touchstart', initAudio)
    }

    // Listen for any user interaction
    document.addEventListener('click', initAudio, { once: true })
    document.addEventListener('keydown', initAudio, { once: true })
    document.addEventListener('touchstart', initAudio, { once: true })
  }

  /**
   * Show tutorial overlay
   */
  const showTutorial = () => {
    const tutorialOverlay = document.getElementById('tutorial')
    if (!tutorialOverlay) return

    tutorialStep = 0
    updateTutorialStep()
    tutorialOverlay.classList.remove('hidden')

    // Setup tutorial navigation
    const skipBtn = tutorialOverlay.querySelector('.tutorial__skip')
    const nextBtn = tutorialOverlay.querySelector('.tutorial__next')

    if (skipBtn) {
      skipBtn.addEventListener('click', closeTutorial)
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        tutorialStep++
        if (tutorialStep >= tutorialSteps.length) {
          closeTutorial()
        } else {
          updateTutorialStep()
        }
      })
    }
  }

  /**
   * Update tutorial step
   */
  const updateTutorialStep = () => {
    const tutorialOverlay = document.getElementById('tutorial')
    if (!tutorialOverlay) return

    const step = tutorialSteps[tutorialStep]

    const titleEl = tutorialOverlay.querySelector('.tutorial__title')
    const textEl = tutorialOverlay.querySelector('.tutorial__text')
    const nextBtn = tutorialOverlay.querySelector('.tutorial__next')

    if (titleEl) titleEl.textContent = step.title
    if (textEl) textEl.textContent = step.text

    // Update button text on last step
    if (nextBtn) {
      nextBtn.textContent = tutorialStep === tutorialSteps.length - 1 ? 'Start Creating!' : 'Next'
    }

    // Remove previous highlights
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
      el.classList.remove('tutorial-highlight')
    })

    // Add highlight to current element
    if (step.highlight) {
      const highlightEl = document.querySelector(step.highlight)
      if (highlightEl) {
        highlightEl.classList.add('tutorial-highlight')
      }
    }
  }

  /**
   * Close tutorial
   */
  const closeTutorial = () => {
    const tutorialOverlay = document.getElementById('tutorial')
    if (tutorialOverlay) {
      tutorialOverlay.classList.add('hidden')
    }

    // Remove highlights
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
      el.classList.remove('tutorial-highlight')
    })

    // Mark tutorial as seen
    localStorage.setItem('hasSeenTutorial', 'true')
  }

  /**
   * Handle application errors
   */
  const handleError = (error) => {
    console.error('Application error:', error)

    // Show user-friendly error message
    const errorMessage = document.createElement('div')
    errorMessage.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 300px;
    `
    errorMessage.innerHTML = `
      <strong>Oops!</strong><br>
      Something went wrong. Please refresh the page.
      <button onclick="this.parentElement.remove()" style="
        float: right;
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        margin-top: -8px;
      ">×</button>
    `
    document.body.appendChild(errorMessage)

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (errorMessage.parentElement) {
        errorMessage.remove()
      }
    }, 5000)
  }

  /**
   * Handle window beforeunload (save on exit)
   */
  window.addEventListener('beforeunload', (e) => {
    // Save session before closing
    Storage.saveSession()
  })

  /**
   * Handle visibility change (save when tab hidden)
   */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      Storage.saveSession()
    }
  })

  /**
   * Global error handler
   */
  window.addEventListener('error', (e) => {
    handleError(e.error)
  })

  window.addEventListener('unhandledrejection', (e) => {
    handleError(e.reason)
  })

  // Start the application
  try {
    await init()
  } catch (error) {
    handleError(error)
  }
})()
