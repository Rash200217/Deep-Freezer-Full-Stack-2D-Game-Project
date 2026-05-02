import { Scene } from 'phaser';

export class BootScene extends Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Load generated AI assets
    this.load.spritesheet('player', '/assets/player_sheet.png', { frameWidth: 64, frameHeight: 64 });
    this.load.image('enemy', '/assets/enemy.png');
    this.load.spritesheet('enemy-basic', '/assets/basic_enemies.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('iceball', '/assets/iceball_sheet_processed.png', { frameWidth: 128, frameHeight: 128 });
    this.load.image('platform', '/assets/platform.png');

    // Load specialized enemy assets
    this.load.spritesheet('enemy-red', '/assets/red enemies.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('enemy-shield', '/assets/shield enemies.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('enemy-sniper', '/assets/sniper enemies.png', { frameWidth: 64, frameHeight: 64 });
    this.load.image('enemy-boss', '/assets/boss_king_v3.png');
    
    // Background Layers
    this.load.image('bg-cavern-far', '/assets/bg_cavern_far.png');
    this.load.image('bg-cavern-mid', '/assets/bg_cavern_mid.png');
    this.load.image('bg-cavern-near', '/assets/bg_cavern_near.png');
    this.load.audio('menu-theme', '/assets/snow_theme.ogg');

    // ── Generate Procedural Heart Spritesheet (5 Frames: Full, 75%, 50%, 25%, Empty) ──
    const hGfx = this.add.graphics();
    const frameW = 24;
    
    for (let f = 0; f < 5; f++) {
        const ox = f * frameW;
        const fillPct = f === 4 ? 0 : 1 - (f * 0.25);
        
        // 1. Shadow
        hGfx.fillStyle(0x000000, 0.2);
        hGfx.fillCircle(ox + 13, 13, 8);

        // 2. Background / Empty State (Dark outline)
        hGfx.lineStyle(1.5, 0x440000, 1);
        const path = [ 12,20, 2,10, 2,7, 5,4, 9,4, 12,7, 15,4, 19,4, 22,7, 22,10, 12,20 ];
        hGfx.beginPath();
        hGfx.moveTo(ox + path[0], path[1]);
        for(let i=2; i<path.length; i+=2) hGfx.lineTo(ox + path[i], path[i+1]);
        hGfx.strokePath();

        // 3. Red Fill (Liquid style fill)
        if (fillPct > 0) {
            hGfx.fillStyle(0xff0000, 1);
            hGfx.beginPath();
            
            // We'll use a clipping-like approach by only drawing the bottom part of the heart
            // The fill starts from the bottom (y=20) up to a certain height
            const fillY = 20 - (16 * fillPct); 
            
            // Draw full heart but intersected with a rectangle? 
            // Simpler: Just fill the whole heart but change color of top part? No.
            // I'll draw the heart shape but use fillPct to control the top line of the fill.
            hGfx.moveTo(ox + 12, 20); // bottom
            hGfx.lineTo(ox + 2, 10);
            
            // If fill is low, we don't reach the "ears" of the heart
            if (fillPct > 0.6) {
                hGfx.lineTo(ox + 2, fillY > 7 ? fillY : 7);
                if (fillY <= 7) {
                    hGfx.lineTo(ox + 5, 4);
                    hGfx.lineTo(ox + 9, 4);
                    hGfx.lineTo(ox + 12, 7);
                    hGfx.lineTo(ox + 15, 4);
                    hGfx.lineTo(ox + 19, 4);
                    hGfx.lineTo(ox + 22, 7);
                }
                hGfx.lineTo(ox + 22, 10);
            } else {
                // Lower half (triangle-ish area)
                const interpX = 2 + (10 * (1 - fillPct/0.6)); // approx
                hGfx.lineTo(ox + 22, 10); // Simplified for low fill
            }
            // Actually, the easiest high-quality way is to draw the WHOLE heart 
            // and then clear the top part using a 'clear' rectangle if that were possible.
            // Since it isn't easy with graphics.generateTexture, I'll just draw a Full Heart 
            // and use a dark overlay for the 'empty' part.
            
            hGfx.beginPath();
            hGfx.moveTo(ox + path[0], path[1]);
            for(let i=2; i<path.length; i+=2) hGfx.lineTo(ox + path[i], path[i+1]);
            hGfx.fillPath();
            
            // Overlap "Empty" grey on top part
            if (f > 0 && f < 4) {
                 hGfx.fillStyle(0x220000, 0.8); // Dark "empty" look
                 const emptyH = 16 * (1 - fillPct);
                 hGfx.fillRect(ox, 4, 24, emptyH); 
                 // Note: This fills a bar on top. It's a classic HUD look.
            }
        }

        // 4. Inner highlight (Only if mostly full)
        if (fillPct > 0.5) {
            hGfx.fillStyle(0xffffff, 0.3);
            hGfx.fillCircle(ox + 7, 8, 2);
        }
    }
    
    hGfx.generateTexture('heart', frameW * 5, 24);
    hGfx.destroy();

    // Bullet Icon
    const iGfx = this.add.graphics();
    iGfx.fillStyle(0x88ccff, 1);
    iGfx.fillCircle(8, 8, 8);
    iGfx.generateTexture('bullet', 16, 16);
    iGfx.clear();

    // Gun Visual
    iGfx.fillStyle(0x334455, 1);
    iGfx.fillRect(0, 2, 12, 3);
    iGfx.fillRect(0, 5, 2, 5);
    iGfx.fillStyle(0x223344, 1);
    iGfx.fillRect(8, 2, 4, 3);
    iGfx.generateTexture('gun', 12, 10);
    iGfx.clear();

    // ── Generate Procedural HUD Icons (Home, Pause, Editor) ──
    // Pause Icon
    iGfx.fillStyle(0x000000, 0.6);
    iGfx.fillCircle(16, 16, 15);
    iGfx.lineStyle(1.5, 0xffff00, 0.5);
    iGfx.strokeCircle(16, 16, 15);
    iGfx.fillStyle(0xffff00, 1);
    iGfx.fillRect(11, 10, 4, 12);
    iGfx.fillRect(17, 10, 4, 12);
    iGfx.generateTexture('icon-pause', 32, 32);
    iGfx.clear();

    // Home Icon
    iGfx.fillStyle(0x000000, 0.6);
    iGfx.fillCircle(16, 16, 15);
    iGfx.lineStyle(1.5, 0xffffff, 0.5);
    iGfx.strokeCircle(16, 16, 15);
    iGfx.fillStyle(0xffffff, 1);
    iGfx.beginPath();
    iGfx.moveTo(16, 8);
    iGfx.lineTo(8, 15);
    iGfx.lineTo(10, 15);
    iGfx.lineTo(10, 24);
    iGfx.lineTo(22, 24);
    iGfx.lineTo(22, 15);
    iGfx.lineTo(24, 15);
    iGfx.closePath();
    iGfx.fillPath();
    iGfx.generateTexture('icon-home', 32, 32);
    iGfx.clear();

    // Audio On Icon (Bold Arcade Speaker)
    iGfx.fillStyle(0x000000, 0.9);
    iGfx.fillCircle(16, 16, 15);
    iGfx.lineStyle(2, 0xffffff, 1);
    iGfx.strokeCircle(16, 16, 15);
    
    iGfx.fillStyle(0x00ffff, 1); 
    // Speaker body
    iGfx.fillRect(6, 12, 6, 8);
    iGfx.beginPath();
    iGfx.moveTo(12, 12); iGfx.lineTo(20, 6); iGfx.lineTo(20, 26); iGfx.lineTo(12, 20);
    iGfx.closePath(); iGfx.fillPath();
    
    // Thick Sound Wave
    iGfx.lineStyle(3, 0xffffff, 1);
    iGfx.beginPath(); iGfx.arc(18, 16, 8, -0.8, 0.8); iGfx.strokePath();

    iGfx.generateTexture('icon-audio', 32, 32);
    iGfx.clear();

    // Audio Off Icon (Bold Arcade Speaker - Muted)
    iGfx.fillStyle(0x000000, 0.9);
    iGfx.fillCircle(16, 16, 15);
    iGfx.lineStyle(2, 0xffffff, 0.5); 
    iGfx.strokeCircle(16, 16, 15);
    
    iGfx.fillStyle(0x444444, 1);
    iGfx.fillRect(6, 12, 6, 8);
    iGfx.beginPath();
    iGfx.moveTo(12, 12); iGfx.lineTo(20, 6); iGfx.lineTo(20, 26); iGfx.lineTo(12, 20);
    iGfx.closePath(); iGfx.fillPath();

    // Red X Strike
    iGfx.lineStyle(3, 0xff0000, 1);
    iGfx.lineBetween(6, 6, 26, 26);
    iGfx.lineBetween(26, 6, 6, 26);

    iGfx.generateTexture('icon-audio-off', 32, 32);
    iGfx.clear();

    // Editor Icon (Gear/Tool)
    iGfx.fillStyle(0x000000, 0.6);
    iGfx.fillCircle(16, 16, 15);
    iGfx.lineStyle(1.5, 0xffffff, 0.5);
    iGfx.strokeCircle(16, 16, 15);
    iGfx.fillStyle(0xffffff, 1);
    iGfx.fillCircle(16, 16, 6);
    for (let a = 0; a < 360; a += 45) {
        const rad = Phaser.Math.DegToRad(a);
        iGfx.fillRect(16 + Math.cos(rad) * 6 - 2, 16 + Math.sin(rad) * 6 - 2, 4, 4);
    }
    iGfx.fillStyle(0x000000, 1);
    iGfx.fillCircle(16, 16, 2);
    iGfx.generateTexture('icon-editor', 32, 32);
    iGfx.destroy();
  }

  create() {
    // ─── Initial Chill Loading Screen Logic ───
    const width = 800;
    const height = 600;
    
    // 1. Dark Arctic Background
    this.cameras.main.setBackgroundColor('#050510');
    
    // 2. The Ice Block (Container)
    const iceX = width / 2;
    const iceY = height / 2;
    
    // Procedural Ice Graphics
    const iceGfx = this.add.graphics();
    iceGfx.fillStyle(0xaaffff, 0.4);
    iceGfx.fillRoundedRect(-150, -60, 300, 120, 12);
    iceGfx.lineStyle(2, 0xffffff, 0.3);
    iceGfx.strokeRoundedRect(-150, -60, 300, 120, 12);
    
    const iceContainer = this.add.container(iceX, iceY, [iceGfx]);
    
    // 3. Glowing Title (Hidden behind ice)
    const title = this.add.text(0, 0, 'DEEP FREEZER', {
        fontSize: '38px',
        fontFamily: 'Arial Black',
        color: '#ffffff',
        stroke: '#00ffff',
        strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0.2);
    iceContainer.add(title);

    // 4. Loading Text
    const loadingText = this.add.text(iceX, iceY + 100, 'CHILLING...', {
        fontSize: '18px',
        color: '#00ffff'
    }).setOrigin(0.5);

    // 5. Crack Graphics (Dynamic)
    const crackGfx = this.add.graphics();
    crackGfx.lineStyle(2, 0xffffff, 1);
    iceContainer.add(crackGfx);

    // 6. Loading Progress Listener
    this.load.on('progress', (value: number) => {
        loadingText.setText(`CHILLING... ${Math.floor(value * 100)}%`);
        
        // Reveal title as we progress
        title.setAlpha(0.2 + (value * 0.8));
        
        // Draw random cracks based on progress
        if (value > 0.2) {
            crackGfx.beginPath();
            crackGfx.moveTo(-150 + Math.random() * 300, -60 + Math.random() * 120);
            crackGfx.lineTo(-150 + Math.random() * 300, -60 + Math.random() * 120);
            crackGfx.strokePath();
        }
    });

    this.load.on('complete', () => {
        loadingText.setText('SHATTERING!');
        
        // Shatter Sequence
        this.tweens.add({
            targets: iceContainer,
            scale: 1.2,
            alpha: 0,
            duration: 400,
            ease: 'Back.In',
            onComplete: () => {
                // Particle Burst
                const pts = this.add.particles(iceX, iceY, 'bullet', {
                    speed: { min: 100, max: 300 },
                    scale: { start: 0.5, end: 0 },
                    lifespan: 800,
                    quantity: 40,
                    tint: 0xaaffff
                });
                pts.explode(40);
                
                this.time.delayedCall(500, () => {
                    this.scene.start('MenuScene');
                });
            }
        });
    });

    // If no assets were left to load, trigger complete manually
    if (!this.load.isLoading()) {
        this.load.emit('complete');
    }
  }
}
