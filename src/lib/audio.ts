/** Tiny WebAudio synth — no asset files needed. */
export type Sfx =
  | 'dribble' | 'bounce' | 'swish' | 'rim' | 'steal' | 'swipe' | 'whistle'
  | 'buzzer' | 'cheer' | 'power' | 'click' | 'jump' | 'dunk'
  | 'squeak' | 'ooh' | 'block' | 'fire' | 'perfect'

class GameAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  enabled = true
  volume = 0.7

  configure(enabled: boolean, volume: number) {
    this.enabled = enabled
    this.volume = volume
    if (this.master) this.master.gain.value = enabled ? volume : 0
  }

  /** must be called from a user gesture at least once */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.enabled ? this.volume : 0
      this.master.connect(this.ctx.destination)
      const len = this.ctx.sampleRate
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const d = this.noise.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private crowd: GainNode | null = null

  /** continuous crowd murmur, level 0..1 (0 stops it) */
  setCrowd(level: number) {
    if (!this.ctx || !this.master || !this.noise) return
    if (!this.crowd) {
      if (level <= 0) return
      const src = this.ctx.createBufferSource()
      src.buffer = this.noise
      src.loop = true
      const f = this.ctx.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 650
      f.Q.value = 0.5
      this.crowd = this.ctx.createGain()
      this.crowd.gain.value = 0
      src.connect(f).connect(this.crowd).connect(this.master)
      src.start()
    }
    this.crowd.gain.setTargetAtTime(Math.max(0, level) * 0.12, this.ctx.currentTime, 0.25)
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, gain: number) {
    const c = this.ctx!
    const t = c.currentTime
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(this.master!)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  private hiss(dur: number, gain: number, filter: BiquadFilterType, freq: number, q = 1, attack = 0.005) {
    const c = this.ctx!
    const t = c.currentTime
    const s = c.createBufferSource()
    s.buffer = this.noise
    const f = c.createBiquadFilter()
    f.type = filter
    f.frequency.value = freq
    f.Q.value = q
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(gain, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    s.connect(f).connect(g).connect(this.master!)
    s.start(t, Math.random() * 0.5)
    s.stop(t + dur + 0.05)
  }

  play(s: Sfx) {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return
    switch (s) {
      case 'dribble':
        this.tone('sine', 150, 60, 0.09, 0.3)
        this.hiss(0.03, 0.06, 'lowpass', 800)
        break
      case 'bounce':
        this.tone('sine', 130, 55, 0.12, 0.45)
        this.hiss(0.04, 0.1, 'lowpass', 900)
        break
      case 'swish':
        this.hiss(0.32, 0.35, 'highpass', 3500, 0.7, 0.04)
        break
      case 'rim':
        this.tone('triangle', 620, 560, 0.25, 0.25)
        this.tone('sine', 1240, 1100, 0.18, 0.12)
        break
      case 'dunk':
        this.tone('triangle', 300, 120, 0.3, 0.35)
        this.hiss(0.2, 0.3, 'bandpass', 1200, 0.8)
        break
      case 'steal':
        this.tone('square', 300, 900, 0.14, 0.12)
        break
      case 'swipe':
        this.hiss(0.12, 0.12, 'bandpass', 2500, 1.5, 0.03)
        break
      case 'jump':
        this.hiss(0.06, 0.06, 'highpass', 2000)
        break
      case 'whistle':
        this.tone('sine', 2500, 2400, 0.35, 0.15)
        this.tone('sine', 2650, 2550, 0.35, 0.08)
        break
      case 'buzzer':
        this.tone('sawtooth', 170, 160, 0.9, 0.18)
        this.tone('square', 172, 165, 0.9, 0.08)
        break
      case 'cheer':
        this.hiss(1.4, 0.22, 'bandpass', 1000, 0.4, 0.15)
        this.hiss(1.1, 0.12, 'bandpass', 2200, 0.6, 0.2)
        break
      case 'power':
        this.tone('sine', 220, 1320, 0.45, 0.2)
        this.tone('triangle', 330, 1980, 0.45, 0.08)
        break
      case 'squeak':
        this.tone('sine', 2200, 3400, 0.07, 0.07)
        this.tone('sine', 3000, 2400, 0.05, 0.04)
        break
      case 'ooh':
        this.hiss(1.0, 0.18, 'bandpass', 500, 2, 0.12)
        this.tone('sine', 260, 170, 0.9, 0.06)
        break
      case 'block':
        this.tone('sine', 180, 60, 0.18, 0.5)
        this.hiss(0.12, 0.25, 'lowpass', 1500)
        break
      case 'fire':
        this.hiss(0.9, 0.3, 'bandpass', 700, 0.6, 0.25)
        this.tone('sawtooth', 90, 220, 0.8, 0.05)
        break
      case 'perfect':
        this.tone('sine', 1320, 1320, 0.12, 0.12)
        this.tone('sine', 1760, 1760, 0.22, 0.1)
        break
      case 'click':
        this.tone('sine', 700, 500, 0.05, 0.15)
        break
    }
  }
}

export const audio = new GameAudio()
