/**
 * ZzFX - Zuper Zmall Zeckless Zynthesizer
 * By Frank Force 2019
 */
export const zzfx = (...args: any[]) => zzfxP(zzfxG(...args));
export const zzfxP = (samples: any[]) => {
    let audioContext = zzfxX;
    if (!audioContext) {
        try {
            audioContext = zzfxX = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            return;
        }
    }
    if (localStorage.getItem('mute') === 'true') return;
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    let buffer = audioContext.createBuffer(samples.length, samples[0].length, zzfxR),
        source = audioContext.createBufferSource();

    samples.map((d, i) => buffer.getChannelData(i).set(d));
    source.buffer = buffer;

    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0.08; // Master SFX Volume (8% - Balanced for clarity)
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    source.start();
    return source;
};
export const zzfxG = (
    volume = 1, randomness = .05, frequency = 220, attack = 0, slide = 0,
    sustain = 0, release = .1, shape = 0, shapeCurve = 1, slide1 = 0,
    slide2 = 0, slide3 = 0, tremor = 0, tremorTime = 0, format = 0
) => {
    let sampleRate = zzfxR,
        PI2 = Math.PI * 2,
        sign = (v: number) => v > 0 ? 1 : -1,
        startSlide = slide *= 500 * PI2 / sampleRate / sampleRate,
        startFrequency = frequency *= (1 + randomness * 2 * Math.random() - randomness) * PI2 / sampleRate,
        b = [], t = 0, tm = 0, i = 0, j = 1, r = 0, c = 0, s = 0, f, length;

    for (length = attack + sustain + release + slide1 + slide2 + slide3;
         i < length * sampleRate; i++) {
        if (i < attack * sampleRate) c = i / (attack * sampleRate);
        else if (i < (attack + sustain) * sampleRate) c = 1 - (i - attack * sampleRate) / (sustain * sampleRate) * (1 - volume);
        else c = volume - (i - (attack + sustain) * sampleRate) / (release * sampleRate) * volume;

        c = shape ? shape > 1 ? shape > 2 ? shape > 3 ?
            Math.sin((t % PI2) ** 3) :
            Math.max(Math.min(Math.tan(t), 1), -1) :
            1 - (2 * t / PI2 % 2 + 2) % 2 :
            1 - 4 * Math.abs(Math.round(t / PI2) - t / PI2) :
            Math.sin(t);

        c = sign(c) * (Math.abs(c) ** shapeCurve);
        b[i] = c * volume; 

        if (tremor) {
            tm += tremorTime * PI2 / sampleRate;
            b[i] *= 1 + tremor * Math.sin(tm);
        }

        f = frequency;
        frequency += slide;
        t += f;
    }
    return [b];
};
export const zzfxR = 44100;
export let zzfxX: AudioContext | null = null;

// Sound Presets - Minimalist & Balanced
export const SOUNDS = {
    // ── Combat ──
    shoot:       () => zzfx(0.6, 0, 50, 0, 0, 0, 0.01, 0, 0),                 // Minimal click
    hit:         () => zzfx(0.5, 0.05, 1500, 0, 0, 0.01, 0.03, 0.1, 0),       
    freeze:      () => zzfx(0.6, 0.05, 2000, 0, 0.02, 0.05, 0.05, 1, 10),     
    crash:       () => zzfx(0.4, 0.2, 800, 0, 0, 0.05, 0.1, 4, 0),            
    sniperShoot: () => zzfx(0.4, 0, 80, 0, 0, 0.01, 0.02, 0, 0),              // Simple blip
    shieldBlock: () => zzfx(0.5, 0, 1000, 0, 0, 0.02, 0.05, 0.1, 0),          
    
    // ── Player ──
    jump:        () => zzfx(0.4, 0.05, 600, 0.01, 0.02, 0.05, 0.02, 0.5, 5),  
    playerHit:   () => zzfx(0.7, 0, 300, 0, 0, 0.02, 0.05, 0.1, 0),           // Soft metal clink
    death:       () => zzfx(0.7, 0, 100, 0.2, 0, 0.3, 0.5, 0, 0),             
    
    // ── Boss ──
    bossHit:     () => zzfx(0.3, 0, 60, 0, 0, 0.01, 0.05, 0, 0),              // Simple thump (Quieter)
    bossRoar:    () => zzfx(0.3, 0, 40, 0.2, 0, 0.2, 0.3, 0, 0),              // Low hum (Quieter)
    
    // ── UI & Rewards ──
    coin:        () => zzfx(0.6, 0, 1500, 0, 0.02, 0.08, 0.05, 1.5, 10),      
    achievement: () => zzfx(0.8, 0, 1000, 0, 0.05, 0.1, 0.1, 2.5, 15),        
    victory:     () => {                                                      
        zzfx(0.8, 0, 800, 0, 0.05, 0.1, 0, 0, 0); 
        setTimeout(() => zzfx(0.8, 0, 1000, 0, 0.05, 0.1, 0, 0, 0), 80); 
        setTimeout(() => zzfx(0.8, 0, 1200, 0, 0.1, 0.2, 0, 0, 0), 160); 
    },
    pause:       () => zzfx(0.4, 0, 800, 0, 0, 0.02, 0, 0, 0),                
    resume:      () => { 
        if (!zzfxX) {
            try { zzfxX = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch (e) {}
        }
        if (zzfxX && zzfxX.state === 'suspended') zzfxX.resume(); 
    }
};
