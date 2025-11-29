# Instrument Samples Credits

This document credits the sources of all audio samples used in the Web Drum Machine & Sample Recorder.

## Sample Sources

### tidalcycles/Dirt-Samples (GitHub)
**License:** Various (CC0, CC-BY, Public Domain)
**URL:** https://github.com/tidalcycles/Dirt-Samples

Samples from this repository:
- **Kicks:** kick-808.wav, kick-deep.wav, kick-punch.wav, kick-sub.wav, kick-acoustic.wav, kick-electro.wav
- **Snares:** snare-808.wav, snare-crack.wav, snare-tight.wav, snare-acoustic.wav
- **Hi-Hats:** hihat-808-closed.wav, hihat-808-open.wav, hihat-pedal.wav, maracas.wav, tambourine.wav
- **Toms:** tom-floor.wav, tom-808-high.wav, tom-808-low.wav
- **Cymbals:** crash-hard.wav, ride-bell.wav, splash.wav, china.wav
- **Percussion:** conga.wav, conga-high.wav, bongo.wav, bongo-high.wav, woodblock.wav, triangle.wav, claves.wav, guiro.wav, cabasa.wav, agogo.wav, timbale.wav, vibraslap.wav

### FreeAnimalSounds.org
**License:** Free for personal and commercial use
**URL:** https://freeanimalsounds.org/

Animal sound samples:
- dog-bark.mp3
- cat-meow.mp3
- cow.mp3
- sheep.mp3
- horse.mp3
- pig.mp3
- chicken.mp3
- rooster.mp3
- duck.mp3
- owl.mp3
- wolf.mp3
- elephant.mp3
- frog.mp3
- monkey.mp3

### Original Samples (Built-in)
The following 16 samples are the original drum machine samples included with the project:
- kick1.wav, kick2.wav
- snare1.wav, snare2.wav
- hihat-closed.wav, hihat-open.wav
- clap.wav, snap.wav
- tom-high.wav, tom-mid.wav, tom-low.wav
- crash.wav, ride.wav
- shaker.wav, cowbell.wav, rimshot.wav

## Additional Sources (for future expansion)

### Freesound.org
**License:** Various (CC0, CC-BY, CC-BY-NC)
**URL:** https://freesound.org/

A collaborative database of Creative Commons licensed sounds.

### 99Sounds
**License:** Royalty-free
**URL:** https://99sounds.org/

Free high-quality samples in 24-bit WAV format.

### Mixkit
**License:** Mixkit License (free for commercial use)
**URL:** https://mixkit.co/free-sound-effects/

Free sound effects for video and audio projects.

### Zapsplat
**License:** Royalty-free
**URL:** https://www.zapsplat.com/

Free professional sound effects in WAV format.

### SampleSwap
**License:** Free to use
**URL:** https://sampleswap.org/

Community-built sample library, free since 2001.

## License Compliance

All samples included in this project are either:
1. Released under Creative Commons licenses (CC0, CC-BY)
2. Explicitly marked as royalty-free for commercial use
3. Public domain

When using samples from CC-BY licensed sources, attribution is provided above.

## Adding New Samples

When adding new samples to the project:
1. Verify the license allows distribution
2. Add the source and license to this document
3. Update `assets/instruments.json` with the new instrument entries
4. Place samples in the appropriate subdirectory under `assets/samples/`

## Sample File Organization

```
assets/samples/
├── drums/
│   ├── kicks/
│   ├── snares/
│   ├── hihats/
│   ├── toms/
│   └── cymbals/
├── percussion/
├── animals/
├── [original samples: kick1.wav, snare1.wav, etc.]
└── instruments.json
```
