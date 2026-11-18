// High-realism procedural stereo ambient soundscape synthesizer (Cafe, Rain, Fireplace)
// Uses equal-power seamless circular crossfaded stereo 1/f noise buffers, scene-tuned
// stereo acoustic room impulse responses (ConvolverNode), physical water-drop Minnaert bubble
// chirps, 3 distinct hearth wood/spark/sap crackles, and 6-voice formant-sculpted café murmur.

export type AmbientSoundType = 'cafe' | 'rain' | 'fire';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;
let activeCleanup: (() => void) | null = null;
let currentPlayingSound: AmbientSoundType | null = null;
let desiredVolume = 0.45;

function getOrCreateContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Create true STEREO seamless circular pink noise (equal-power overlap-add: zero loop volume drops!)
function createSeamlessStereoPinkBuffer(ctx: AudioContext, seconds = 9): AudioBuffer {
  const sr = ctx.sampleRate;
  const length = Math.floor(sr * seconds);
  const xfade = Math.floor(sr * 0.45);
  const total = length + xfade;
  const buffer = ctx.createBuffer(2, length, sr);

  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(total);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    // Warm up pink filter briefly so beginning matches steady-state RMS
    for (let w = 0; w < 256; w++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      b6 = white * 0.115926;
    }

    for (let i = 0; i < total; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
      raw[i] = sample;
    }

    const out = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      if (i < xfade) {
        const phase = (i / xfade) * (Math.PI * 0.5);
        out[i] = raw[i] * Math.sin(phase) + raw[length + i] * Math.cos(phase);
      } else {
        out[i] = raw[i];
      }
    }
  }
  return buffer;
}

// Create true STEREO seamless circular brown noise (constant warm rumble without seam clicks/dips)
function createSeamlessStereoBrownBuffer(ctx: AudioContext, seconds = 9): AudioBuffer {
  const sr = ctx.sampleRate;
  const length = Math.floor(sr * seconds);
  const xfade = Math.floor(sr * 0.55);
  const total = length + xfade;
  const buffer = ctx.createBuffer(2, length, sr);

  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(total);
    let lastOut = 0;
    for (let i = 0; i < total; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      raw[i] = lastOut * 3.1;
    }
    const out = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      if (i < xfade) {
        const phase = (i / xfade) * (Math.PI * 0.5);
        out[i] = raw[i] * Math.sin(phase) + raw[length + i] * Math.cos(phase);
      } else {
        out[i] = raw[i];
      }
    }
  }
  return buffer;
}

// Procedural stereo room / outdoor acoustic Impulse Response for realistic spatial depth
function createSceneReverb(
  ctx: AudioContext,
  durationSec: number,
  rt60Decay: number,
  hfDampingCutoff: number
): ConvolverNode {
  const sr = ctx.sampleRate;
  const length = Math.floor(sr * durationSec);
  const ir = ctx.createBuffer(2, length, sr);
  const dt = 1 / sr;
  const rc = 1 / (2 * Math.PI * hfDampingCutoff);
  const alpha = dt / (rc + dt);

  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / sr;
      // Exponential tail + tiny fade-in past 2ms so early reflections sound airy
      const attack = Math.min(1, t / 0.004);
      const env = Math.exp(-t / rt60Decay) * attack;
      const white = Math.random() * 2 - 1;
      lp = lp + alpha * (white - lp);
      data[i] = lp * env * 0.42;
    }
    // Distinct subtle stereo early reflection taps
    const taps = ch === 0 ? [0.008, 0.019, 0.031, 0.047] : [0.011, 0.023, 0.036, 0.053];
    taps.forEach((sec, idx) => {
      const pos = Math.floor(sec * sr);
      if (pos < length) {
        data[pos] += (idx % 2 === 0 ? 1 : -1) * (0.22 / (idx + 1));
      }
    });
  }

  const convolver = ctx.createConvolver();
  convolver.buffer = ir;
  return convolver;
}

function panToNode(ctx: AudioContext, src: AudioNode, pan: number, dest: AudioNode, revSend?: GainNode) {
  if (typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(panner);
    panner.connect(dest);
    if (revSend) panner.connect(revSend);
    return panner;
  }
  src.connect(dest);
  if (revSend) src.connect(revSend);
  return null;
}

// ======================= 1. REALISTIC RAIN SOUNDSCAPE =======================
function buildRainGraph(ctx: AudioContext, dest: GainNode): () => void {
  const nodes: AudioNode[] = [];
  const sources: AudioBufferSourceNode[] = [];
  const timers: number[] = [];

  const pinkBuf = createSeamlessStereoPinkBuffer(ctx, 9);
  const brownBuf = createSeamlessStereoBrownBuffer(ctx, 9);

  // Courtyard / eaves spatial reverb
  const reverb = createSceneReverb(ctx, 0.65, 0.19, 1750);
  const revReturn = ctx.createGain();
  revReturn.gain.value = 0.28;
  reverb.connect(revReturn);
  revReturn.connect(dest);
  nodes.push(reverb, revReturn);

  // Layer 1: Wide warm outdoor rain curtain with gentle inharmonic breeze swelling
  const rainSrc = ctx.createBufferSource();
  rainSrc.buffer = pinkBuf;
  rainSrc.loop = true;

  const hp1 = ctx.createBiquadFilter();
  hp1.type = 'highpass';
  hp1.frequency.value = 190;

  const airTilt = ctx.createBiquadFilter();
  airTilt.type = 'highshelf';
  airTilt.frequency.value = 2400;
  airTilt.gain.value = -5.5;

  const lp1 = ctx.createBiquadFilter();
  lp1.type = 'lowpass';
  lp1.frequency.value = 3400;
  lp1.Q.value = 0.55;

  const rainGain = ctx.createGain();
  rainGain.gain.value = 0.36;

  // Dual inharmonic LFO breeze gusts (frequency & gain gently breathe together)
  const lfo1 = ctx.createOscillator();
  lfo1.frequency.value = 0.058;
  const lfo1G = ctx.createGain();
  lfo1G.gain.value = 0.055;
  lfo1.connect(lfo1G);
  lfo1G.connect(rainGain.gain);

  const lfo2 = ctx.createOscillator();
  lfo2.frequency.value = 0.093;
  const lfo2F = ctx.createGain();
  lfo2F.gain.value = 420;
  lfo2.connect(lfo2F);
  lfo2F.connect(lp1.frequency);

  rainSrc.connect(hp1);
  hp1.connect(airTilt);
  airTilt.connect(lp1);
  lp1.connect(rainGain);
  rainGain.connect(dest);

  // Layer 2: Soft indoor roof/windowpane rain warmth (stereo brown noise, lowpass ~310Hz)
  const roofSrc = ctx.createBufferSource();
  roofSrc.buffer = brownBuf;
  roofSrc.loop = true;

  const roofLp = ctx.createBiquadFilter();
  roofLp.type = 'lowpass';
  roofLp.frequency.value = 310;
  const roofGain = ctx.createGain();
  roofGain.gain.value = 0.34;

  roofSrc.connect(roofLp);
  roofLp.connect(roofGain);
  roofGain.connect(dest);

  // Layer 3: Fine canopy leaf drizzle shimmer (very soft HF sprinkle)
  const drizzleSrc = ctx.createBufferSource();
  drizzleSrc.buffer = pinkBuf;
  drizzleSrc.loop = true;

  const drizzleHp = ctx.createBiquadFilter();
  drizzleHp.type = 'highpass';
  drizzleHp.frequency.value = 2600;
  const drizzleLp = ctx.createBiquadFilter();
  drizzleLp.type = 'lowpass';
  drizzleLp.frequency.value = 6400;
  const drizzleGain = ctx.createGain();
  drizzleGain.gain.value = 0.055;

  drizzleSrc.connect(drizzleHp);
  drizzleHp.connect(drizzleLp);
  drizzleLp.connect(drizzleGain);
  drizzleGain.connect(dest);

  rainSrc.start();
  roofSrc.start(0, 2.3);
  drizzleSrc.start(0, 4.9);
  lfo1.start();
  lfo2.start();

  sources.push(rainSrc, roofSrc, drizzleSrc);
  nodes.push(hp1, airTilt, lp1, rainGain, lfo1, lfo1G, lfo2, lfo2F, roofLp, roofGain, drizzleHp, drizzleLp, drizzleGain);

  // Layer 4: Authentic physical water droplets on leaves & puddles (Minnaert upward bubble chirp + crisp 2ms splash)
  let alive = true;
  const scheduleDroplets = () => {
    if (!alive) return;
    const now = ctx.currentTime;
    const isCluster = Math.random() < 0.45;
    const count = isCluster ? 2 : 1;

    for (let k = 0; k < count; k++) {
      const start = now + k * (0.04 + Math.random() * 0.09);
      const pan = (Math.random() - 0.5) * 1.75;
      const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
      if (panner) panner.pan.setValueAtTime(pan, start);

      // Type A: Crisp splash / roof gutter drip tap
      if (Math.random() < 0.58) {
        const dropLen = Math.floor(ctx.sampleRate * 0.016);
        const dropBuf = ctx.createBuffer(1, dropLen, ctx.sampleRate);
        const d = dropBuf.getChannelData(0);
        for (let i = 0; i < dropLen; i++) {
          const t = i / ctx.sampleRate;
          d[i] = (Math.random() * 2 - 1) * Math.exp(-t / 0.0028);
        }
        const src = ctx.createBufferSource();
        src.buffer = dropBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1600 + Math.random() * 2800, start);
        bp.Q.setValueAtTime(1.3, start); // broad natural splash, not whistling

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.045 + Math.random() * 0.05, start);

        src.connect(bp);
        bp.connect(g);
        if (panner) {
          g.connect(panner);
          panner.connect(dest);
          panner.connect(reverb);
        } else {
          g.connect(dest);
          g.connect(reverb);
        }
        src.start(start);
        src.onended = () => {
          src.disconnect();
          bp.disconnect();
          g.disconnect();
          panner?.disconnect();
        };
      } else {
        // Type B: Physical Minnaert air-bubble upward pitch chirp (real puddle plink!)
        const fStart = 950 + Math.random() * 1400;
        const fEnd = fStart * (1.38 + Math.random() * 0.25);
        const dur = 0.015 + Math.random() * 0.01;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(fStart, start);
        osc.frequency.exponentialRampToValueAtTime(fEnd, start + dur);

        const g = ctx.createGain();
        const peak = 0.022 + Math.random() * 0.024;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.linearRampToValueAtTime(peak, start + 0.0022);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

        osc.connect(g);
        if (panner) {
          g.connect(panner);
          panner.connect(dest);
          panner.connect(reverb);
        } else {
          g.connect(dest);
          g.connect(reverb);
        }
        osc.start(start);
        osc.stop(start + dur + 0.005);
        osc.onended = () => {
          osc.disconnect();
          g.disconnect();
          panner?.disconnect();
        };
      }
    }

    const nextMs = 95 + Math.random() * 290;
    timers.push(window.setTimeout(scheduleDroplets, nextMs));
  };
  timers.push(window.setTimeout(scheduleDroplets, 120));

  // Layer 5: Very soft distant rain-cloud rumble swell every 16-28 seconds
  const scheduleDistantRumble = () => {
    if (!alive) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = brownBuf;
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(115, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 1.8);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 5.8);

    src.connect(lp);
    lp.connect(g);
    panToNode(ctx, g, (Math.random() - 0.5) * 0.7, dest);

    src.start(now, Math.random() * 5);
    src.stop(now + 6.0);
    src.onended = () => {
      src.disconnect();
      lp.disconnect();
      g.disconnect();
    };

    timers.push(window.setTimeout(scheduleDistantRumble, 16000 + Math.random() * 14000));
  };
  timers.push(window.setTimeout(scheduleDistantRumble, 6000));

  return () => {
    alive = false;
    timers.forEach((id) => clearTimeout(id));
    sources.forEach((s) => {
      try { s.stop(); } catch {}
      try { s.disconnect(); } catch {}
    });
    nodes.forEach((n) => {
      try { n.disconnect(); } catch {}
    });
  };
}

// ======================= 2. REALISTIC FIREPLACE SOUNDSCAPE =======================
function buildFireGraph(ctx: AudioContext, dest: GainNode): () => void {
  const nodes: AudioNode[] = [];
  const sources: AudioBufferSourceNode[] = [];
  const timers: number[] = [];

  const pinkBuf = createSeamlessStereoPinkBuffer(ctx, 9);
  const brownBuf = createSeamlessStereoBrownBuffer(ctx, 9);

  // Brick & oak hearth spatial room acoustic tail
  const reverb = createSceneReverb(ctx, 0.42, 0.14, 2100);
  const revReturn = ctx.createGain();
  revReturn.gain.value = 0.25;
  reverb.connect(revReturn);
  revReturn.connect(dest);
  nodes.push(reverb, revReturn);

  // Layer 1: Deep chimney air draft & hearth warmth
  const draftSrc = ctx.createBufferSource();
  draftSrc.buffer = brownBuf;
  draftSrc.loop = true;

  const draftLp = ctx.createBiquadFilter();
  draftLp.type = 'lowpass';
  draftLp.frequency.value = 175;
  const draftGain = ctx.createGain();
  draftGain.gain.value = 0.44;

  const draftLfo = ctx.createOscillator();
  draftLfo.frequency.value = 0.14;
  const draftLfoG = ctx.createGain();
  draftLfoG.gain.value = 0.08;
  draftLfo.connect(draftLfoG);
  draftLfoG.connect(draftGain.gain);

  draftSrc.connect(draftLp);
  draftLp.connect(draftGain);
  draftGain.connect(dest);

  // Layer 2: Licking open flames (warm mid-low roar flutter 240Hz-680Hz)
  const flameSrc = ctx.createBufferSource();
  flameSrc.buffer = pinkBuf;
  flameSrc.loop = true;

  const flameBp = ctx.createBiquadFilter();
  flameBp.type = 'bandpass';
  flameBp.frequency.value = 390;
  flameBp.Q.value = 0.65;

  const flameGain = ctx.createGain();
  flameGain.gain.value = 0.24;

  const flutterA = ctx.createOscillator();
  flutterA.frequency.value = 1.9;
  const flutterAG = ctx.createGain();
  flutterAG.gain.value = 0.055;
  flutterA.connect(flutterAG);
  flutterAG.connect(flameGain.gain);

  const flutterB = ctx.createOscillator();
  flutterB.frequency.value = 3.15;
  const flutterBG = ctx.createGain();
  flutterBG.gain.value = 0.032;
  flutterB.connect(flutterBG);
  flutterBG.connect(flameGain.gain);

  flameSrc.connect(flameBp);
  flameBp.connect(flameGain);
  flameGain.connect(dest);

  // Layer 3: Gentle glowing ember air sizzle
  const emberSrc = ctx.createBufferSource();
  emberSrc.buffer = pinkBuf;
  emberSrc.loop = true;

  const emberHp = ctx.createBiquadFilter();
  emberHp.type = 'highpass';
  emberHp.frequency.value = 1350;
  const emberLp = ctx.createBiquadFilter();
  emberLp.type = 'lowpass';
  emberLp.frequency.value = 3600;
  const emberGain = ctx.createGain();
  emberGain.gain.value = 0.048;

  emberSrc.connect(emberHp);
  emberHp.connect(emberLp);
  emberLp.connect(emberGain);
  emberGain.connect(dest);

  draftSrc.start();
  flameSrc.start(0, 2.7);
  emberSrc.start(0, 5.1);
  draftLfo.start();
  flutterA.start();
  flutterB.start();

  sources.push(draftSrc, flameSrc, emberSrc);
  nodes.push(
    draftLp, draftGain, draftLfo, draftLfoG,
    flameBp, flameGain, flutterA, flutterAG, flutterB, flutterBG,
    emberHp, emberLp, emberGain
  );

  // Layer 4: 3 Physical Stereo Wood / Ember / Sap Crackles
  let alive = true;
  const scheduleCrackle = () => {
    if (!alive) return;
    const now = ctx.currentTime;
    const roll = Math.random();
    const pan = (Math.random() - 0.5) * 1.45;
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.setValueAtTime(pan, now);

    if (roll < 0.55) {
      // Type A: Rapid micro ember spark tick (crisp 2.5ms broadband transient)
      const len = Math.floor(ctx.sampleRate * 0.01);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate;
        d[i] = (Math.random() * 2 - 1) * Math.exp(-t / 0.0012);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2200 + Math.random() * 2600, now);
      bp.Q.setValueAtTime(1.1, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.11 + Math.random() * 0.14, now);

      src.connect(bp);
      bp.connect(g);
      if (panner) { g.connect(panner); panner.connect(dest); panner.connect(reverb); }
      else { g.connect(dest); g.connect(reverb); }
      src.start(now);
      src.onended = () => { src.disconnect(); bp.disconnect(); g.disconnect(); panner?.disconnect(); };
    } else if (roll < 0.86) {
      // Type B: Dry hardwood fiber split (sharp crack + damped wooden resonance modes)
      const len = Math.floor(ctx.sampleRate * 0.032);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate;
        const woodRes =
          (Math.sin(2 * Math.PI * (390 + Math.random() * 3) * t) * 0.45 +
            Math.sin(2 * Math.PI * 860 * t) * 0.25) *
          Math.exp(-t / 0.007);
        const snap = (Math.random() * 2 - 1) * Math.exp(-t / 0.0022) * 0.8;
        d[i] = (woodRes + snap) * 0.85;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.24 + Math.random() * 0.18, now);

      src.connect(g);
      if (panner) { g.connect(panner); panner.connect(dest); panner.connect(reverb); }
      else { g.connect(dest); g.connect(reverb); }
      src.start(now);
      src.onended = () => { src.disconnect(); g.disconnect(); panner?.disconnect(); };
    } else {
      // Type C: Resin / sap pocket pop (punchy burst + short sizzle tail)
      const len = Math.floor(ctx.sampleRate * 0.045);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate;
        const pop = Math.sin(2 * Math.PI * 240 * t) * Math.exp(-t / 0.004) * 0.5;
        const hiss = (Math.random() * 2 - 1) * Math.exp(-t / 0.011) * 0.65;
        d[i] = pop + hiss;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.22 + Math.random() * 0.15, now);

      src.connect(g);
      if (panner) { g.connect(panner); panner.connect(dest); panner.connect(reverb); }
      else { g.connect(dest); g.connect(reverb); }
      src.start(now);
      src.onended = () => { src.disconnect(); g.disconnect(); panner?.disconnect(); };
    }

    const nextMs = Math.random() < 0.28 ? 35 + Math.random() * 65 : 140 + Math.random() * 480;
    timers.push(window.setTimeout(scheduleCrackle, nextMs));
  };
  timers.push(window.setTimeout(scheduleCrackle, 150));

  return () => {
    alive = false;
    timers.forEach((id) => clearTimeout(id));
    sources.forEach((s) => {
      try { s.stop(); } catch {}
      try { s.disconnect(); } catch {}
    });
    nodes.forEach((n) => {
      try { n.disconnect(); } catch {}
    });
  };
}

// ======================= 3. REALISTIC CAFÉ SOUNDSCAPE =======================
function buildCafeGraph(ctx: AudioContext, dest: GainNode): () => void {
  const nodes: AudioNode[] = [];
  const sources: AudioBufferSourceNode[] = [];
  const timers: number[] = [];

  const pinkBuf = createSeamlessStereoPinkBuffer(ctx, 10);
  const brownBuf = createSeamlessStereoBrownBuffer(ctx, 10);

  // Lively plastered & wooden European café acoustic space (RT60 ~0.45s)
  const reverb = createSceneReverb(ctx, 0.55, 0.16, 2900);
  const revReturn = ctx.createGain();
  revReturn.gain.value = 0.34;
  reverb.connect(revReturn);
  revReturn.connect(dest);
  nodes.push(reverb, revReturn);

  // Layer 1: Warm architectural room bed + quiet distant fridge/espresso airbed
  const roomSrc = ctx.createBufferSource();
  roomSrc.buffer = brownBuf;
  roomSrc.loop = true;
  const roomLp = ctx.createBiquadFilter();
  roomLp.type = 'lowpass';
  roomLp.frequency.value = 185;
  const roomGain = ctx.createGain();
  roomGain.gain.value = 0.22;

  roomSrc.connect(roomLp);
  roomLp.connect(roomGain);
  roomGain.connect(dest);
  roomSrc.start();
  sources.push(roomSrc);
  nodes.push(roomLp, roomGain);

  // Layer 2: 6 Stereo-Panned Formant-Sculpted Conversational Voices (distinct offsets & cadences)
  const voiceSpecs = [
    { pan: -0.78, f1: 310, f2: 760, rate: 0.96, offset: 0.4, gain: 0.14 },
    { pan: -0.45, f1: 420, f2: 980, rate: 1.03, offset: 2.1, gain: 0.12 },
    { pan: -0.15, f1: 345, f2: 830, rate: 0.98, offset: 3.9, gain: 0.11 },
    { pan: 0.19, f1: 455, f2: 1060, rate: 1.05, offset: 5.5, gain: 0.11 },
    { pan: 0.48, f1: 325, f2: 790, rate: 0.94, offset: 7.2, gain: 0.13 },
    { pan: 0.78, f1: 405, f2: 920, rate: 1.01, offset: 8.7, gain: 0.13 },
  ];

  const voiceEnvs: GainNode[] = [];

  voiceSpecs.forEach((spec) => {
    const src = ctx.createBufferSource();
    src.buffer = pinkBuf;
    src.loop = true;
    src.playbackRate.value = spec.rate;

    // Parallel vocal formants F1 (chest) + F2 (vowel clarity) -> completely natural speech timbre
    const bp1 = ctx.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.frequency.value = spec.f1;
    bp1.Q.value = 3.2;

    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.value = spec.f2;
    bp2.Q.value = 2.8;

    const sumG = ctx.createGain();
    sumG.gain.value = 1.0;

    // Cadence gain modulated probabilistically via speech phrase envelopes below
    const speechEnv = ctx.createGain();
    speechEnv.gain.value = spec.gain;

    src.connect(bp1);
    src.connect(bp2);
    bp1.connect(sumG);
    bp2.connect(sumG);
    sumG.connect(speechEnv);

    const panner = panToNode(ctx, speechEnv, spec.pan, dest);
    if (panner) {
      const revSend = ctx.createGain();
      revSend.gain.value = 0.25;
      panner.connect(revSend);
      revSend.connect(reverb);
      nodes.push(panner, revSend);
    }

    src.start(0, spec.offset);
    sources.push(src);
    voiceEnvs.push(speechEnv);
    nodes.push(bp1, bp2, sumG, speechEnv);
  });

  let alive = true;

  // Syllabic conversational phrasing for each voice table (talk in 1-2s phrases with natural pauses)
  voiceEnvs.forEach((env, idx) => {
    const base = voiceSpecs[idx].gain;
    const drivePhrase = () => {
      if (!alive) return;
      const now = ctx.currentTime;
      const speaking = Math.random() < 0.72;
      if (speaking) {
        const syllables = 3 + Math.floor(Math.random() * 5);
        let tCursor = now;
        for (let s = 0; s < syllables; s++) {
          const sylDur = 0.14 + Math.random() * 0.13;
          const sylPeak = base * (0.55 + Math.random() * 0.65);
          env.gain.setTargetAtTime(sylPeak, tCursor, 0.035);
          env.gain.setTargetAtTime(base * 0.22, tCursor + sylDur * 0.65, 0.045);
          tCursor += sylDur;
        }
        const pauseMs = Math.round((tCursor - now) * 1000) + 350 + Math.random() * 1400;
        timers.push(window.setTimeout(drivePhrase, pauseMs));
      } else {
        env.gain.setTargetAtTime(base * 0.18, now, 0.18);
        timers.push(window.setTimeout(drivePhrase, 1000 + Math.random() * 2000));
      }
    };
    timers.push(window.setTimeout(drivePhrase, idx * 280));
  });

  // Layer 3: Physical Porcelain Cups, Saucers & Spoon Taps (inharmonic glazed ceramic modes + hard strike)
  const schedulePorcelain = () => {
    if (!alive) return;
    const now = ctx.currentTime;
    const pan = (Math.random() - 0.5) * 1.5;
    const isStirSeries = Math.random() < 0.35;
    const strikes = isStirSeries ? 2 + Math.floor(Math.random() * 2) : 1;

    for (let k = 0; k < strikes; k++) {
      const start = now + k * (0.11 + Math.random() * 0.07);
      const baseFreq = 2350 + Math.random() * 1150;
      // Glazed porcelain/ceramic natural modes (non-integer ratios!)
      const partials = [
        { mult: 1.0, amp: 0.48, tau: 0.042 },
        { mult: 2.23, amp: 0.28, tau: 0.028 },
        { mult: 3.57, amp: 0.16, tau: 0.018 },
      ];

      const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
      if (panner) panner.pan.setValueAtTime(pan, start);

      const mixG = ctx.createGain();
      mixG.gain.setValueAtTime(0.038 + Math.random() * 0.035, start);

      // Tiny ceramic click transient
      const impLen = Math.floor(ctx.sampleRate * 0.004);
      const impBuf = ctx.createBuffer(1, impLen, ctx.sampleRate);
      const impD = impBuf.getChannelData(0);
      for (let i = 0; i < impLen; i++) {
        impD[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.0006));
      }
      const impSrc = ctx.createBufferSource();
      impSrc.buffer = impBuf;
      impSrc.connect(mixG);
      impSrc.start(start);
      impSrc.onended = () => impSrc.disconnect();

      partials.forEach((p) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq * p.mult, start);
        const pg = ctx.createGain();
        pg.gain.setValueAtTime(0.0001, start);
        pg.gain.linearRampToValueAtTime(p.amp, start + 0.0012);
        pg.gain.exponentialRampToValueAtTime(0.0001, start + p.tau * 3.2);
        osc.connect(pg);
        pg.connect(mixG);
        osc.start(start);
        osc.stop(start + p.tau * 3.4);
        osc.onended = () => { osc.disconnect(); pg.disconnect(); };
      });

      if (panner) {
        mixG.connect(panner);
        panner.connect(dest);
        panner.connect(reverb);
      } else {
        mixG.connect(dest);
        mixG.connect(reverb);
      }
    }

    timers.push(window.setTimeout(schedulePorcelain, 2600 + Math.random() * 4800));
  };
  timers.push(window.setTimeout(schedulePorcelain, 900));

  // Layer 4: Espresso Barista Steam Wand & Wooden Knock-Box every 11-22s
  const scheduleBarista = () => {
    if (!alive) return;
    const now = ctx.currentTime;
    const barPan = -0.58; // Espresso bar slightly left

    if (Math.random() < 0.72) {
      // Milk steaming wand: pitch rises subtly as milk warms!
      const steamSrc = ctx.createBufferSource();
      steamSrc.buffer = pinkBuf;
      steamSrc.loop = true;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1250, now);
      bp.frequency.exponentialRampToValueAtTime(2650, now + 2.2);
      bp.Q.value = 1.6;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.065, now + 0.25);
      g.gain.setValueAtTime(0.062, now + 1.85);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.55);

      steamSrc.connect(bp);
      bp.connect(g);
      panToNode(ctx, g, barPan, dest, reverb as unknown as GainNode);

      steamSrc.start(now, Math.random() * 4);
      steamSrc.stop(now + 2.65);
      steamSrc.onended = () => { steamSrc.disconnect(); bp.disconnect(); g.disconnect(); };
    } else {
      // Two muffled wooden knock-box taps for spent coffee puck
      [0, 0.16].forEach((offset) => {
        const start = now + offset;
        const len = Math.floor(ctx.sampleRate * 0.045);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          const t = i / ctx.sampleRate;
          d[i] =
            (Math.sin(2 * Math.PI * 135 * t) * 0.7 + (Math.random() * 2 - 1) * 0.25) *
            Math.exp(-t / 0.008);
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.14, start);
        src.connect(g);
        panToNode(ctx, g, barPan, dest, reverb as unknown as GainNode);
        src.start(start);
        src.onended = () => { src.disconnect(); g.disconnect(); };
      });
    }

    timers.push(window.setTimeout(scheduleBarista, 10500 + Math.random() * 11500));
  };
  timers.push(window.setTimeout(scheduleBarista, 4200));

  return () => {
    alive = false;
    timers.forEach((id) => clearTimeout(id));
    sources.forEach((s) => {
      try { s.stop(); } catch {}
      try { s.disconnect(); } catch {}
    });
    nodes.forEach((n) => {
      try { n.disconnect(); } catch {}
    });
  };
}

function ensureMasterChain(ctx: AudioContext): GainNode {
  if (!masterCompressor) {
    masterCompressor = ctx.createDynamicsCompressor();
    masterCompressor.threshold.setValueAtTime(-12, ctx.currentTime);
    masterCompressor.knee.setValueAtTime(10, ctx.currentTime);
    masterCompressor.ratio.setValueAtTime(2.5, ctx.currentTime);
    masterCompressor.connect(ctx.destination);
  }
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    masterGain.connect(masterCompressor);
  }
  return masterGain;
}

export function startAmbientSound(type: AmbientSoundType, volume = 0.45): void {
  const ctx = getOrCreateContext();
  if (!ctx) return;

  desiredVolume = Math.max(0, Math.min(1, volume));
  const outGain = ensureMasterChain(ctx);

  // If already playing the requested type, simply unlock & adjust volume smoothly
  if (currentPlayingSound === type && activeCleanup) {
    outGain.gain.cancelScheduledValues(ctx.currentTime);
    outGain.gain.setTargetAtTime(desiredVolume * 0.72, ctx.currentTime, 0.14);
    return;
  }

  // Stop existing soundscape first cleanly
  if (activeCleanup) {
    try { activeCleanup(); } catch {}
    activeCleanup = null;
  }

  currentPlayingSound = type;

  if (type === 'rain') {
    activeCleanup = buildRainGraph(ctx, outGain);
  } else if (type === 'fire') {
    activeCleanup = buildFireGraph(ctx, outGain);
  } else {
    activeCleanup = buildCafeGraph(ctx, outGain);
  }

  const now = ctx.currentTime;
  outGain.gain.cancelScheduledValues(now);
  outGain.gain.setValueAtTime(Math.max(0.0001, outGain.gain.value), now);
  outGain.gain.linearRampToValueAtTime(desiredVolume * 0.72, now + 0.45);
}

export function setAmbientVolume(volume: number): void {
  desiredVolume = Math.max(0, Math.min(1, volume));
  if (!audioCtx || !masterGain || !currentPlayingSound) return;
  const now = audioCtx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setTargetAtTime(desiredVolume * 0.72, now, 0.08);
}

export function stopAmbientSound(): void {
  const cleanup = activeCleanup;
  activeCleanup = null;
  currentPlayingSound = null;

  if (!audioCtx || !masterGain) {
    if (cleanup) cleanup();
    return;
  }

  const now = audioCtx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setTargetAtTime(0.0001, now, 0.09);

  if (cleanup) {
    window.setTimeout(() => {
      if (!currentPlayingSound) {
        try { cleanup(); } catch {}
      }
    }, 260);
  }
}
