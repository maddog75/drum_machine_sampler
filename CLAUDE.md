# CLAUDE.md - Web Drum Machine & Loop Pedal

## Project Overview

A browser-based music creation tool designed for children ages 8-12, featuring a drum machine with sequencer and a loop pedal for microphone recording. The application emphasizes simplicity, visual appeal, and immediate creative gratification.

## Target Audience

- **Primary**: Children ages 8-12
- **Use Cases**: Music exploration, rhythm learning, creative expression, fun
- **Skill Level**: Beginner-friendly with no prior music experience required

## Core Objectives

1. **Simplicity**: Maximum 3 clicks to start making music
2. **Engagement**: Modern, sleek design with multiple color schemes
3. **Feature-Rich**: Full drum sequencer + multi-track loop pedal
4. **Accessibility**: Full-screen responsive design, keyboard navigation, touch-friendly
5. **Persistence**: Save and export complete sessions with audio recordings

## Technical Stack

### Core Technologies
- **Vanilla JavaScript (ES6+)**: No frameworks for maximum performance
- **Web Audio API**: Professional-grade audio processing
- **HTML5 Canvas**: High-performance visualizations (waveforms, VU meters)
- **CSS Grid/Flexbox**: Responsive full-screen layout
- **CSS Custom Properties**: Theme system implementation

### Audio Libraries
- **MediaRecorder API**: Native browser recording (primary)
- **Recorder.js**: Fallback for WAV export if needed
- **No external audio frameworks**: Keep bundle size minimal

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Architecture

### Module Structure

```
js/
├── main.js           # Application entry, initialization, orchestration
├── audio-engine.js   # Web Audio API wrapper, AudioContext management
├── sequencer.js      # Drum machine, variable-step sequencer, scheduling
├── loop-pedal.js     # 8-track sample recording with start trim, playback
├── ui.js             # UI rendering, canvas drawing, DOM updates
├── storage.js        # Session save/load, WAV export, localStorage
├── presets.js        # 100+ drum patterns across multiple genres
├── effects.js        # Audio effects chain (reverb, delay, distortion, etc.)
├── song-mode.js      # Pattern bank (10 slots) and chain mode playback
├── visualizations.js # Real-time audio waveform and VU meter visualizations
└── wav-encoder.js    # WAV file encoding for audio export
```

### Audio Architecture

#### AudioContext Graph
```
[Drum Samples] → AudioBufferSourceNode → GainNode →
[Microphone] → MediaStreamAudioSourceNode → GainNode →
[Loop Tracks] → AudioBufferSourceNode → GainNode →
                                                      ↓
                                              MasterGainNode →
                                              AudioContext.destination
```

#### Two-Layer Scheduling System
```
JavaScript Scheduler (25ms interval)
├─ Looks ahead 100ms
├─ Schedules notes to Web Audio
└─ Updates UI

Web Audio Scheduler (sample-accurate)
├─ Uses AudioContext.currentTime
├─ Precise timing (no drift)
└─ Handles audio playback
```

### UI Architecture

#### Layout Strategy
```
Landscape (Desktop/Tablet):
┌────────────────────────────────────────────────────┐
│ [Theme] [Help] [Save]          [BPM: 120] [Master] │
├──────────────┬──────────────────────┬──────────────┤
│              │   DRUM SEQUENCER     │              │
│   PRESETS    │   16-Step Grid       │  LOOP PEDAL  │
│   (10-15     │   12-16 Tracks       │  (4-6 Tracks)│
│   patterns)  │   [Waveform Visual]  │  + Controls  │
│              │                      │              │
├──────────────┴──────────────────────┴──────────────┤
│  [◄◄] [▶/❚❚] [■] [▶▶]     Transport Controls      │
└────────────────────────────────────────────────────┘

Portrait (Mobile/Tablet):
┌──────────────────┐
│ [Theme] [Help]   │
├──────────────────┤
│ DRUM SEQUENCER   │
│ 16-Step Grid     │
│ (Scrollable)     │
├──────────────────┤
│ [▶/❚❚] [■] [BPM] │
├──────────────────┤
│ LOOP PEDAL       │
│ Track 1-6        │
│ (Scrollable)     │
└──────────────────┘
```

## Features Specification

### 1. Drum Machine

#### Specifications
- **Instruments**: 16 drum sounds
  - Kick 1, Kick 2
  - Snare 1, Snare 2
  - Hi-Hat Closed, Hi-Hat Open
  - Clap, Snap
  - Tom High, Tom Mid, Tom Low
  - Crash, Ride
  - Shaker, Cowbell, Rimshot
- **Sequencer**: Variable step grid (4-48 steps, default 16)
- **Time Signatures**: 4/4, 3/4, 12/8
- **Tracks**: 16 drum tracks + 8 sample tracks (24 total)
- **Tempo Range**: 60-200 BPM
- **Presets**: 100+ drum patterns (2 variations each across 50+ genres)
- **Pattern Bank**: 10 pattern slots with chain mode for song arrangement

#### Transport Controls
- **Play/Pause**: Toggle with resume from paused position
- **Stop**: Reset to beginning
- **Rewind/Fast Forward**: Navigate patterns

#### Preset Pattern Genres
Basic Rock, Pop Beat, Hip-Hop, House, Funk Groove, Disco, Reggae, Trap, Jazz Swing, Latin, Dubstep, Drum & Bass, Techno, Breakbeat, Chill Hop, Trance, Punk Rock, Afrobeat, Samba, Bossa Nova, UK Garage, Grunge, Moombahton, Future Bass, Waltz, Metal, Shuffle, Minimal, Progressive House, Electro, Deep House, Industrial, Jungle, Ballad, Hardcore, Ambient, Breakcore, Country, Ska, Trip-Hop, Cumbia, Salsa, R&B, Synthwave, Grime, Boom Bap, Acid House, Hard Rock, New Wave, Post-Rock, Footwork, Vaporwave, Downtempo, UK Bass, Juke, Lo-Fi, Bassline, Indie Rock, EDM Big Room, Psytrance, Experimental (and more)

### 2. Sample Recorder (Loop Pedal)

#### Specifications
- **Tracks**: 8 sample tracks
  - 4 Global samples (shared across all patterns)
  - 4 Pattern-specific samples (unique per pattern slot)
- **Input**: Microphone recording with auto gap removal
- **Features**:
  - Record, Play, Clear per track
  - **Start Trim slider** (0-5 seconds) for trimming sample intro
  - Individual volume control per track
  - Samples can be triggered from the sequencer grid
  - Visual duration display (shows effective duration after trim)
  - Samples saved/loaded with sessions (WebM compressed format)

#### Start Trim Feature
- Slider control (0.0s - 5.0s, step 0.1s) to trim unwanted audio from sample start
- Applied during preview playback and sequencer triggering
- Persisted with session save/load
- Duration display shows effective length after trim

#### Recording Pipeline
```
Microphone → getUserMedia() →
MediaStreamAudioSourceNode →
GainNode (input level) →
MediaRecorder (WebM/Opus) →
AudioBuffer (for playback)
```

### 3. Audio Effects

#### Available Effects
All effects can be enabled/disabled individually with adjustable parameters:

1. **Reverb**
   - Mix: 0-100%
   - Decay: 0.1-5.0s

2. **Delay**
   - Mix: 0-100%
   - Time: 0-1s
   - Feedback: 0-90%

3. **Distortion**
   - Amount: 0-100%
   - Tone: 0-100%

4. **Compressor**
   - Threshold: -100 to 0 dB
   - Ratio: 1:1 to 20:1

5. **EQ (3-band)**
   - Low (100Hz): -12 to +12 dB
   - Mid (1kHz): -12 to +12 dB
   - High (10kHz): -12 to +12 dB

6. **Filter**
   - Type: Lowpass, Highpass, Bandpass
   - Cutoff: 20-20000 Hz
   - Resonance: 0.1-20

7. **Chorus**
   - Rate: 0.1-10 Hz
   - Depth: 0-100%
   - Mix: 0-100%

8. **Phaser**
   - Rate: 0.1-10 Hz
   - Depth: 0-100%
   - Feedback: 0-90%

### 4. Visual Themes

#### Color Schemes

**Theme 1: Dark**
- Background: `#1a1a1a`
- Primary: `#3a3a3a`
- Accent: `#00bcd4` (cyan)
- Text: `#ffffff`
- Success: `#4caf50`
- Warning: `#ff9800`

**Theme 2: Matrix (Green on Black)**
- Background: `#000000`
- Primary: `#0a0a0a`
- Accent: `#00ff00` (bright green)
- Text: `#00ff00`
- Success: `#00cc00`
- Warning: `#88ff00`

**Theme 3: Vivid (Bold & Colorful)**
- Background: `#0d1117`
- Primary: `#161b22`
- Accent: `#ff007a` (hot pink)
- Secondary: `#00d9ff` (electric blue)
- Tertiary: `#ffd700` (gold)
- Text: `#ffffff`

### 5. Tutorial System

#### First Launch Tutorial (Skippable)
1. Welcome screen with "Skip" button
2. Step 1: "This is the drum sequencer - click to add beats"
3. Step 2: "Press play to hear your rhythm"
4. Step 3: "Try a preset pattern" (highlight preset buttons)
5. Step 4: "Record loops with the microphone" (if permission granted)
6. Step 5: "Save your work anytime"
7. Completion: "You're ready! Have fun creating music!"

#### Tooltip System
- Hover tooltips for all controls
- Touch-hold tooltips for mobile (500ms delay)
- Context-sensitive help messages

#### Help Button
- Overlay panel with feature explanations
- Quick reference guide
- Keyboard shortcuts list

### 6. Session Management

#### Save Format (JSON)
```json
{
  "version": "1.0.0",
  "timestamp": "2025-11-28T10:30:00Z",
  "theme": "matrix",
  "sequencer": {
    "tempo": 120,
    "stepCount": 16,
    "timeSignature": "4/4",
    "currentPatternSlot": 0,
    "patternBank": [
      {
        "name": "Pattern 1",
        "pattern": {
          "kick1": [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
          "snare1": [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
          "loop1": [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
        },
        "patternSamples": []
      }
    ]
  },
  "loopPedal": {
    "tracks": [
      {
        "index": 0,
        "name": "Global Sample 1",
        "audioData": "base64_encoded_webm_data",
        "format": "webm",
        "volume": 0.8,
        "muted": false,
        "solo": false,
        "startTrim": 0.5
      }
    ]
  },
  "effects": {
    "reverb": { "enabled": false, "mix": 0.3, "decay": 2.0 },
    "delay": { "enabled": false, "mix": 0.5, "time": 0.375, "feedback": 0.4 }
  }
}
```

#### Export Options
1. **Session File** (.json): Complete session with patterns, samples, and effects
2. **Audio Mix** (.wav): Final mixdown of drums + samples

## Code Conventions

### JavaScript Style
- ES6+ features (const/let, arrow functions, template literals)
- No semicolons (ASI)
- 2-space indentation
- Single quotes for strings
- JSDoc comments for all functions

#### Example
```javascript
/**
 * Schedules a drum hit at a specific time
 * @param {string} instrument - Name of the instrument
 * @param {number} time - Time in seconds (AudioContext time)
 * @param {number} velocity - Hit velocity (0.0 - 1.0)
 */
const scheduleDrumHit = (instrument, time, velocity) => {
  const buffer = audioBuffers[instrument]
  if (!buffer) return

  const source = audioContext.createBufferSource()
  source.buffer = buffer

  const gainNode = audioContext.createGain()
  gainNode.gain.value = velocity

  source.connect(gainNode)
  gainNode.connect(masterGain)
  source.start(time)
}
```

### CSS Style
- BEM naming convention
- CSS custom properties for theming
- Mobile-first responsive design
- Logical properties where possible

#### Example
```css
.sequencer__grid {
  display: grid;
  grid-template-columns: repeat(16, 1fr);
  gap: var(--spacing-xs);
}

.sequencer__step--active {
  background: var(--color-accent);
  transform: scale(1.1);
}
```

### HTML Style
- Semantic HTML5 elements
- ARIA labels for accessibility
- data-* attributes for state
- Minimal inline styles (use classes)

## Performance Goals

### Bundle Size
- HTML + CSS + JS: < 100KB minified
- Drum samples: ~500KB compressed
- Total initial load: < 1MB
- First Contentful Paint: < 1s
- Time to Interactive: < 2s

### Runtime Performance
- 60fps canvas rendering
- Audio latency: < 10ms
- Scheduler precision: < 1ms drift
- Memory usage: < 100MB
- Support 16 simultaneous audio sources

### Optimization Strategies
1. Lazy load drum samples (load on first play)
2. Use requestAnimationFrame for canvas
3. Debounce UI updates (50ms)
4. Use Web Workers for audio processing (if needed)
5. Implement audio sprite for small samples
6. Offscreen canvas for pre-rendering
7. Event delegation for sequencer grid

## Development Workflow

### Git Workflow
- Commit after each completed feature
- Descriptive commit messages (present tense)
- Example: "Add drum sequencer grid rendering"

### Testing Checklist
- [ ] Works in Chrome, Firefox, Safari, Edge
- [ ] Responsive on desktop, tablet, mobile
- [ ] Touch controls work correctly
- [ ] Keyboard navigation functional
- [ ] Audio timing is precise (no drift)
- [ ] Session save/load works correctly
- [ ] Microphone recording functional
- [ ] Theme switching works
- [ ] Tutorial can be skipped
- [ ] Tooltips display correctly

## Accessibility Requirements

### WCAG 2.1 AA Compliance
- Color contrast ratio ≥ 4.5:1 for text
- Touch targets ≥ 44x44px
- Keyboard navigation for all controls
- ARIA labels for screen readers
- Focus indicators visible
- No color-only information

### Keyboard Shortcuts
- `Space`: Play/Pause
- `Esc`: Stop
- `+/-`: Increase/Decrease tempo
- `1-9`: Load preset patterns
- `R`: Record loop
- `S`: Save session
- `H`: Toggle help
- `T`: Cycle themes

## Future Enhancement Ideas

(Documented for potential future development)

### Potential Features
- Additional drum kits (electronic, acoustic, world percussion)
- Custom sample upload from files
- Swing/groove quantization
- Collaboration (share sessions via URL)
- Cloud save/sync
- Built-in lessons/challenges
- MIDI controller support
- Audio export to MP3/OGG
- Copy/paste patterns between slots
- Automation (parameter changes over time)

## Project Philosophy

### Design Principles
1. **Simplicity First**: If it requires explanation, it's too complex
2. **Immediate Feedback**: Every action has instant audio/visual response
3. **No Wrong Notes**: Fail-safe design, everything is reversible
4. **Progressive Discovery**: Basic features obvious, advanced features discoverable
5. **Delight Users**: Smooth animations, satisfying interactions, fun sounds

### Child-Centered Design
- Large, obvious buttons (no tiny click targets)
- Bright, engaging colors (not dull or corporate)
- Encouraging language ("Great job!" not "Error")
- Forgiving interface (undo everything)
- Quick wins (make music in seconds)

## Technical Debt to Avoid

### Don't
- Add frameworks (React, Vue, etc.) - keep it simple
- Use jQuery - native DOM is sufficient
- Over-engineer abstractions - YAGNI principle
- Add build tools unless necessary - keep development simple
- Implement features "for later" - ship MVP first
- Optimize prematurely - profile first, optimize second

### Do
- Write readable, well-commented code
- Keep functions small and focused
- Use semantic names for variables/functions
- Test on real devices (not just simulators)
- Commit frequently with good messages
- Document non-obvious decisions

## Resources & References

### Web Audio API
- MDN Web Audio API Guide: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- Web Audio API Scheduling: https://www.html5rocks.com/en/tutorials/audio/scheduling/

### Drum Programming
- 16-step sequencer patterns: Multiple genres
- Quantization and timing theory
- Drum machine UI conventions

### Child-Friendly Design
- Large touch targets (44x44px minimum)
- High contrast colors
- Simple, clear language
- Immediate positive feedback

## Contact & Collaboration

This is an educational project. Contributions welcome!

- Focus on simplicity and user experience
- Maintain vanilla JS approach
- Keep bundle size minimal
- Test with real children when possible

---

**Last Updated**: 2025-11-28
**Version**: 1.1.0
**Status**: Active Development
