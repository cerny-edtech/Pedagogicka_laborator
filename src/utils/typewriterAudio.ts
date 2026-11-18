// Physical mechanical typewriter acoustic synthesizer using Web Audio API.
// Synthesizes stereo mechanical keycap impact, ink-ribbon/paper-on-rubber-platen thump,
// staggered escapement pawl ratchet ticks, wooden desk + iron chassis ConvolverNode body,
// carriage-return ratchet zip, and an inharmonic vintage stamped brass bell on Enter.

let audioCtx: AudioContext | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;
let masterDryGain: GainNode | null = null;
let bodyConvolver: ConvolverNode | null = null;
let bodyWetGain: GainNode | null = null;

// Pre-baked stereo buffer pools for organic variation (zero repetitive machine-gun artifacts)
const standardBuffers: AudioBuffer[] = [];
const spaceBuffers: AudioBuffer[] = [];
const backspaceBuffers: AudioBuffer[] = [];
const enterCarriageBuffers: AudioBuffer[] = [];
let brassBellBuffer: AudioBuffer | null = null;

let activeVoiceCount = 0;

function seededRand() {
  return Math.random() * 2 - 1;
}

// Create short wooden desk & cast-iron chassis body impulse response (68ms stereo)
function createChassisImpulseResponse(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 0.068);
  const ir = ctx.createBuffer(2, len, sr);
  const left = ir.getChannelData(0);
  const right = ir.getChannelData(1);

  // Desk & cast-iron frame early reflections + warm low-mid cavity modes
  let lpL = 0;
  let lpR = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const decayFast = Math.exp(-t / 0.011);
    const decayBody = Math.exp(-t / 0.024);

    // Subtle tabletop & frame resonant air modes
    const woodMode =
      Math.sin(2 * Math.PI * 168 * t) * 0.14 * decayBody +
      Math.sin(2 * Math.PI * 342 * t + 0.6) * 0.09 * decayBody +
      Math.sin(2 * Math.PI * 695 * t + 1.1) * 0.05 * decayFast;

    const rawL = seededRand() * decayFast * 0.38;
    const rawR = seededRand() * decayFast * 0.38;
    lpL = lpL * 0.65 + rawL * 0.35;
    lpR = lpR * 0.65 + rawR * 0.35;

    // Distinct left/right desk bounce taps
    let earlyL = 0;
    let earlyR = 0;
    if (i === Math.floor(0.0045 * sr)) earlyL += 0.24;
    if (i === Math.floor(0.0062 * sr)) earlyR += 0.21;
    if (i === Math.floor(0.0125 * sr)) {
      earlyL += 0.11;
      earlyR -= 0.09;
    }

    left[i] = (woodMode + lpL * 0.7 + earlyL) * (i === 0 ? 0.6 : 1);
    right[i] = (-woodMode * 0.85 + lpR * 0.7 + earlyR) * (i === 0 ? 0.6 : 1);
  }
  return ir;
}

// One-pole lowpass + highpass helper over an array for physical spectral sculpting
function sculptBand(samples: Float32Array, sr: number, hpHz: number, lpHz: number): Float32Array {
  const out = new Float32Array(samples.length);
  const dt = 1 / sr;
  const rcLp = 1 / (2 * Math.PI * lpHz);
  const alphaLp = dt / (rcLp + dt);
  const rcHp = 1 / (2 * Math.PI * hpHz);
  const alphaHp = rcHp / (rcHp + dt);

  let lp = 0;
  let hp = 0;
  let prevIn = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    hp = hpHz > 5 ? alphaHp * (hp + x - prevIn) : x;
    prevIn = x;
    lp = lp + alphaLp * (hp - lp);
    out[i] = lp;
  }
  return out;
}

// Bake a single organic standard mechanical keystroke ("tik-KLAP...tk")
function bakeStandardKeyBuffer(ctx: AudioContext, seedOffset: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 0.056);
  const buf = ctx.createBuffer(2, len, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);

  const rawBody = new Float32Array(len);
  const rawSnap = new Float32Array(len);
  const rawTick = new Float32Array(len);

  const j = seedOffset * 0.13;
  const keycapDelay = 0.0;
  const platenTime = 0.0032 + (seedOffset % 3) * 0.0004;
  const escapementTime1 = 0.0135 + (seedOffset % 4) * 0.0011;
  const escapementTime2 = escapementTime1 + 0.0024;

  // Deterministic pseudo-pink state for organic grit
  let p0 = 0, p1 = 0, p2 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const w = seededRand();
    p0 = 0.99 * p0 + w * 0.12;
    p1 = 0.92 * p1 + w * 0.25;
    p2 = 0.72 * p2 + w * 0.35;
    const pink = p0 + p1 + p2 + w * 0.18;

    // 1. Keycap finger tap (0ms, ~1.5ms crisp bakelite click)
    const dtKey = t - keycapDelay;
    if (dtKey >= 0 && dtKey < 0.005) {
      rawSnap[i] += w * Math.exp(-dtKey / 0.0009) * 0.55;
    }

    // 2. Typebar slug slapping ink ribbon + paper against rubber platen cylinder
    const dtPlaten = t - platenTime;
    if (dtPlaten >= 0) {
      // Damped platen membrane/cylinder resonance (non-swept, physical fixed modes!)
      const rubberThump =
        (Math.sin(2 * Math.PI * (126 + j * 14) * dtPlaten) * 0.52 +
          Math.sin(2 * Math.PI * (258 + j * 22) * dtPlaten + 0.5) * 0.36 +
          Math.sin(2 * Math.PI * (510 + j * 30) * dtPlaten + 1.2) * 0.18) *
        Math.exp(-dtPlaten / 0.0062);

      // Paper & steel slug impact broadband transient
      const ribbonSlap = pink * Math.exp(-dtPlaten / 0.0028) * 0.95;
      rawBody[i] += rubberThump * 0.88;
      rawSnap[i] += ribbonSlap;
    }

    // 3. Staggered mechanical escapement pawl + cogwheel tick
    const dtEsc1 = t - escapementTime1;
    if (dtEsc1 >= 0 && dtEsc1 < 0.006) {
      rawTick[i] += w * Math.exp(-dtEsc1 / 0.0011) * 0.62;
    }
    const dtEsc2 = t - escapementTime2;
    if (dtEsc2 >= 0 && dtEsc2 < 0.005) {
      rawTick[i] += w * Math.exp(-dtEsc2 / 0.0009) * 0.42;
    }
  }

  const bodySculpted = sculptBand(rawBody, sr, 55, 620);
  const snapSculpted = sculptBand(rawSnap, sr, 950, 4600);
  const tickSculpted = sculptBand(rawTick, sr, 1850, 6200);

  const stereoShift = (seedOffset - 2.5) * 0.05;
  const gainL = 1 - Math.max(0, stereoShift);
  const gainR = 1 + Math.min(0, stereoShift);

  for (let i = 0; i < len; i++) {
    const mono = (bodySculpted[i] * 0.92 + snapSculpted[i] * 0.85 + tickSculpted[i] * 0.72) * 0.9;
    // Slight L/R micro-phase difference on escapement tick creates tactile spatial width
    const tickSpread = tickSculpted[i] * 0.18;
    L[i] = Math.max(-0.98, Math.min(0.98, (mono + tickSpread) * gainL));
    R[i] = Math.max(-0.98, Math.min(0.98, (mono - tickSpread) * gainR));
  }

  return buf;
}

// Bake hollow crossbar Spacebar ("THUNK-klk")
function bakeSpaceBuffer(ctx: AudioContext, seedOffset: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 0.072);
  const buf = ctx.createBuffer(2, len, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);

  const rawThump = new Float32Array(len);
  const rawClack = new Float32Array(len);
  const rawTick = new Float32Array(len);

  const escDelay = 0.019 + (seedOffset % 3) * 0.0015;
  let pinkState = 0;

  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const w = seededRand();
    pinkState = 0.93 * pinkState + w * 0.28;

    // Crossbar hollow cavity thump (lower chassis modes + damped spring)
    const cavity =
      (Math.sin(2 * Math.PI * (88 + seedOffset * 4) * t) * 0.65 +
        Math.sin(2 * Math.PI * (174 + seedOffset * 7) * t + 0.4) * 0.44 +
        Math.sin(2 * Math.PI * (365 + seedOffset * 11) * t + 1.0) * 0.16) *
      Math.exp(-t / 0.0115);

    rawThump[i] = cavity * 0.9 + pinkState * Math.exp(-t / 0.0065) * 0.75;
    rawClack[i] = pinkState * Math.exp(-t / 0.0032) * 0.62;

    const dtEsc = t - escDelay;
    if (dtEsc >= 0 && dtEsc < 0.007) {
      rawTick[i] = w * Math.exp(-dtEsc / 0.0013) * 0.55;
    }
  }

  const thump = sculptBand(rawThump, sr, 45, 520);
  const clack = sculptBand(rawClack, sr, 650, 2900);
  const tick = sculptBand(rawTick, sr, 1500, 5000);

  for (let i = 0; i < len; i++) {
    const s = (thump[i] * 1.05 + clack[i] * 0.72 + tick[i] * 0.65) * 0.85;
    L[i] = Math.max(-0.98, Math.min(0.98, s + tick[i] * 0.14));
    R[i] = Math.max(-0.98, Math.min(0.98, s - tick[i] * 0.14));
  }
  return buf;
}

// Bake tight mechanical Backspace pawl release ("chk-tk")
function bakeBackspaceBuffer(ctx: AudioContext, seedOffset: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 0.048);
  const buf = ctx.createBuffer(2, len, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);

  const rawBody = new Float32Array(len);
  const rawMech = new Float32Array(len);
  const backDelay = 0.011 + seedOffset * 0.0012;

  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const w = seededRand();
    // Initial pawl release tick
    rawMech[i] += w * Math.exp(-t / 0.0016) * 0.72;

    // Carriage spring back-step bump
    const dtB = t - backDelay;
    if (dtB >= 0) {
      rawBody[i] +=
        (Math.sin(2 * Math.PI * 195 * dtB) * 0.45 +
          Math.sin(2 * Math.PI * 410 * dtB) * 0.22 +
          w * 0.45) *
        Math.exp(-dtB / 0.0045);
      if (dtB < 0.005) {
        rawMech[i] += w * Math.exp(-dtB / 0.001) * 0.48;
      }
    }
  }

  const b = sculptBand(rawBody, sr, 80, 950);
  const m = sculptBand(rawMech, sr, 1750, 5600);

  for (let i = 0; i < len; i++) {
    const s = (b[i] * 0.75 + m[i] * 0.85) * 0.85;
    L[i] = Math.max(-0.98, Math.min(0.98, s * 0.96 + m[i] * 0.12));
    R[i] = Math.max(-0.98, Math.min(0.98, s * 1.02 - m[i] * 0.12));
  }
  return buf;
}

// Bake Carriage Return Zip (series of sliding brass gear teeth ending on rubber margin bumper)
function bakeEnterCarriageBuffer(ctx: AudioContext, seedOffset: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 0.28);
  const buf = ctx.createBuffer(2, len, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);

  const rawTeeth = new Float32Array(len);
  const rawBumper = new Float32Array(len);

  // 8 accelerating/decelerating gear teeth during slide from t=0.055 to t=0.205
  const toothCount = 8;
  const toothTimes: number[] = [];
  for (let k = 0; k < toothCount; k++) {
    const prog = k / (toothCount - 1);
    const tPos = 0.052 + prog * 0.145 + (k % 2 === 0 ? 0.002 : -0.001) * (seedOffset + 1);
    toothTimes.push(tPos);
  }
  const bumperTime = 0.212;

  let pink = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const w = seededRand();
    pink = 0.91 * pink + w * 0.28;

    // Gear ratchet teeth clicks
    for (let k = 0; k < toothTimes.length; k++) {
      const dt = t - toothTimes[k];
      if (dt >= 0 && dt < 0.008) {
        const amp = (0.45 + 0.28 * Math.sin(k * 0.8)) * Math.exp(-dt / 0.0014);
        rawTeeth[i] += (w * 0.7 + Math.sin(2 * Math.PI * (1620 + k * 55) * dt) * 0.3) * amp;
      }
    }

    // Damped margin rubber stop bumper thump
    const dtBump = t - bumperTime;
    if (dtBump >= 0) {
      const thump =
        (Math.sin(2 * Math.PI * 102 * dtBump) * 0.65 +
          Math.sin(2 * Math.PI * 228 * dtBump + 0.7) * 0.35 +
          pink * 0.55) *
        Math.exp(-dtBump / 0.011);
      rawBumper[i] += thump;
    }
  }

  const teeth = sculptBand(rawTeeth, sr, 1200, 4800);
  const bumper = sculptBand(rawBumper, sr, 50, 750);

  for (let i = 0; i < len; i++) {
    const t = i / sr;
    // Carriage sweeps slightly from right to left across stereo stage
    const sweep = Math.min(1, Math.max(0, (t - 0.05) / 0.16));
    const panL = 0.65 + 0.5 * sweep;
    const panR = 1.15 - 0.5 * sweep;
    const mix = teeth[i] * 0.78 + bumper[i] * 0.95;
    L[i] = Math.max(-0.98, Math.min(0.98, mix * panL * 0.78));
    R[i] = Math.max(-0.98, Math.min(0.98, mix * panR * 0.78));
  }
  return buf;
}

// Bake vintage stamped brass bell with realistic inharmonic partials + clapper strike
function bakeBrassBellBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 0.68);
  const buf = ctx.createBuffer(2, len, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);

  const f0 = 2088;
  // Physical stamped dome modes: non-integer partials + slight asymmetric beating pair
  const modes = [
    { freq: f0 * 1.0, amp: 0.55, tau: 0.21 },
    { freq: f0 * 1.0028, amp: 0.42, tau: 0.19 }, // natural bell shimmer beating
    { freq: f0 * 1.486, amp: 0.28, tau: 0.13 },
    { freq: f0 * 2.025, amp: 0.21, tau: 0.085 },
    { freq: f0 * 2.57, amp: 0.12, tau: 0.048 },
    { freq: f0 * 3.18, amp: 0.07, tau: 0.025 },
  ];

  for (let i = 0; i < len; i++) {
    const t = i / sr;
    // Tiny steel clapper impact (1.5ms)
    const clapper = seededRand() * Math.exp(-t / 0.0014) * 0.32;
    let bellL = clapper;
    let bellR = clapper * 0.9;

    for (let m = 0; m < modes.length; m++) {
      const mode = modes[m];
      const env = Math.exp(-t / mode.tau);
      const valL = Math.sin(2 * Math.PI * mode.freq * t) * mode.amp * env;
      const valR = Math.sin(2 * Math.PI * mode.freq * t + m * 0.45) * mode.amp * env;
      bellL += valL;
      bellR += valR;
    }

    // Soft attack anti-click (0.5ms) + tail fade
    const attack = Math.min(1, i / (sr * 0.0006));
    const tail = Math.min(1, (len - 1 - i) / (sr * 0.02));
    L[i] = Math.max(-0.98, Math.min(0.98, bellL * attack * tail * 0.58));
    R[i] = Math.max(-0.98, Math.min(0.98, bellR * attack * tail * 0.58));
  }
  return buf;
}

function initEngine(ctx: AudioContext) {
  if (masterDryGain && masterCompressor && bodyConvolver) return;

  masterCompressor = ctx.createDynamicsCompressor();
  masterCompressor.threshold.setValueAtTime(-13, ctx.currentTime);
  masterCompressor.knee.setValueAtTime(8, ctx.currentTime);
  masterCompressor.ratio.setValueAtTime(3.2, ctx.currentTime);
  masterCompressor.attack.setValueAtTime(0.0015, ctx.currentTime);
  masterCompressor.release.setValueAtTime(0.065, ctx.currentTime);
  masterCompressor.connect(ctx.destination);

  masterDryGain = ctx.createGain();
  masterDryGain.gain.setValueAtTime(0.84, ctx.currentTime);
  masterDryGain.connect(masterCompressor);

  bodyConvolver = ctx.createConvolver();
  bodyConvolver.buffer = createChassisImpulseResponse(ctx);
  bodyWetGain = ctx.createGain();
  bodyWetGain.gain.setValueAtTime(0.28, ctx.currentTime);
  bodyConvolver.connect(bodyWetGain);
  bodyWetGain.connect(masterCompressor);

  standardBuffers.length = 0;
  spaceBuffers.length = 0;
  backspaceBuffers.length = 0;
  enterCarriageBuffers.length = 0;

  for (let i = 0; i < 6; i++) standardBuffers.push(bakeStandardKeyBuffer(ctx, i));
  for (let i = 0; i < 4; i++) spaceBuffers.push(bakeSpaceBuffer(ctx, i));
  for (let i = 0; i < 3; i++) backspaceBuffers.push(bakeBackspaceBuffer(ctx, i));
  for (let i = 0; i < 3; i++) enterCarriageBuffers.push(bakeEnterCarriageBuffer(ctx, i));
  brassBellBuffer = bakeBrassBellBuffer(ctx);
}

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      initEngine(audioCtx);
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener('pointerdown', unlock, { passive: true, once: false });
  window.addEventListener('keydown', unlock, { passive: true, once: false });
}

function playStereoBuffer(
  ctx: AudioContext,
  buffer: AudioBuffer,
  startTime: number,
  gainValue: number,
  rate: number,
  pan: number,
  wetScale = 1
) {
  if (!masterDryGain || !bodyConvolver) return;

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.setValueAtTime(rate, startTime);

  const voiceGain = ctx.createGain();
  voiceGain.gain.setValueAtTime(gainValue, startTime);

  if (typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), startTime);
    src.connect(panner);
    panner.connect(voiceGain);
  } else {
    src.connect(voiceGain);
  }

  voiceGain.connect(masterDryGain);
  if (wetScale > 0) {
    const wetSend = ctx.createGain();
    wetSend.gain.setValueAtTime(wetScale, startTime);
    voiceGain.connect(wetSend);
    wetSend.connect(bodyConvolver);
  }

  activeVoiceCount++;
  src.onended = () => {
    activeVoiceCount = Math.max(0, activeVoiceCount - 1);
    src.disconnect();
    voiceGain.disconnect();
  };
  src.start(startTime);
}

export function playTypewriterSound(isEnter = false, isSpace = false, isBackspace = false) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    initEngine(ctx);

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Gentle headroom trim during rapid 90+ WPM bursts
    const burstTrim = activeVoiceCount > 3 ? 0.84 : 1.0;
    const now = ctx.currentTime;
    const microRate = 0.965 + Math.random() * 0.07;
    const microPan = (Math.random() - 0.5) * 0.28;

    if (isEnter) {
      // Vintage brass carriage bell + authentic sliding gear carriage-return zip + margin thump
      if (brassBellBuffer) {
        playStereoBuffer(ctx, brassBellBuffer, now, 0.54 * burstTrim, 0.99 + Math.random() * 0.02, 0.22, 0.65);
      }
      if (enterCarriageBuffers.length > 0) {
        const buf = enterCarriageBuffers[Math.floor(Math.random() * enterCarriageBuffers.length)];
        playStereoBuffer(ctx, buf, now + 0.015, 0.78 * burstTrim, microRate, 0, 1.0);
      }
      return;
    }

    if (isSpace) {
      if (spaceBuffers.length > 0) {
        const buf = spaceBuffers[Math.floor(Math.random() * spaceBuffers.length)];
        playStereoBuffer(ctx, buf, now, 0.88 * burstTrim, microRate, microPan * 0.5, 1.0);
      }
      return;
    }

    if (isBackspace) {
      if (backspaceBuffers.length > 0) {
        const buf = backspaceBuffers[Math.floor(Math.random() * backspaceBuffers.length)];
        playStereoBuffer(ctx, buf, now, 0.76 * burstTrim, microRate, -0.18 + Math.random() * 0.1, 0.9);
      }
      return;
    }

    if (standardBuffers.length > 0) {
      const buf = standardBuffers[Math.floor(Math.random() * standardBuffers.length)];
      playStereoBuffer(ctx, buf, now, 0.86 * burstTrim, microRate, microPan, 1.0);
    }
  } catch {
    // Fail silently if Web Audio blocked
  }
}

export function testTypewriterSound() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  playTypewriterSound(false, false, false);
  setTimeout(() => playTypewriterSound(false, false, false), 115);
  setTimeout(() => playTypewriterSound(false, true, false), 235);
  setTimeout(() => playTypewriterSound(true, false, false), 375);
}
