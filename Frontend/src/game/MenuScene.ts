import { Scene, Input, GameObjects } from 'phaser';
import { Api } from '../Api';
import { signalRClient } from '../SignalRClient';
import { SOUNDS } from './zzfx';

export class MenuScene extends Scene {
  private bgLayer1!: GameObjects.TileSprite;
  private bgLayer2!: GameObjects.TileSprite;
  private bgLayer3!: GameObjects.TileSprite;
  private statusText!: GameObjects.Text;
  private loginHint!: GameObjects.Text;
  private registerHint!: GameObjects.Text;
  private logoutHint!: GameObjects.Text;
  private mainContainer!: GameObjects.Container;
  private playerSelectContainer!: GameObjects.Container;
  private instructionsContainer!: GameObjects.Container;
  private loadingOverlay!: GameObjects.Container;

  constructor() {
    super('MenuScene');
  }

  create() {
    // ─── 1. Parallax Background ──────────────────────────────────────
    this.createParallaxBg();

    // ─── 2. Snow Particles ───────────────────────────────────────────
    this.add.particles(0, -50, 'bullet', {
        x: { min: 0, max: 800 },
        lifespan: 10000,
        speedY: { min: 20, max: 80 },
        speedX: { min: -10, max: 10 },
        scale: { start: 0.1, end: 0.2 },
        quantity: 1,
        frequency: 200,
        blendMode: 'ADD',
        tint: 0xaaffff,
        alpha: 0.4
    });

    // ─── 3. Header & Panels ──────────────────────────────────────────
    this.createHeader();
    this.fetchAndDisplayLeaderboard();

    // ─── 4. Title ────────────────────────────────────────────────────
    const title = this.add.text(400, 160, 'DEEP FREEZER', {
        fontSize: '44px',
        fontFamily: 'Arial Black, Gadget, sans-serif',
        color: '#00ffff',
        stroke: '#003366',
        strokeThickness: 10,
        shadow: { offsetX: 0, offsetY: 0, color: '#ffffff', blur: 25, fill: true }
    }).setOrigin(0.5);

    this.tweens.add({
        targets: title,
        scale: 1.05,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    // ─── 5. Navigation Containers ────────────────────────────────────
    this.mainContainer = this.add.container(0, 0);
    this.playerSelectContainer = this.add.container(0, 0).setVisible(false).setAlpha(0);

    // Main Menu Buttons (Shifted up to fit 4 buttons)
    const startBtn = this.createStyledButton(400, 250, 'START GAME', 0x39ff14);
    const editorBtn = this.createStyledButton(400, 340, 'LEVEL EDITOR', 0xff00ff);
    const communityBtn = this.createStyledButton(400, 430, 'COMMUNITY MAPS', 0xffff00);
    const howToBtn = this.createStyledButton(400, 520, 'HOW TO PLAY', 0x00ccff);

    this.mainContainer.add([startBtn, editorBtn, communityBtn, howToBtn]);

    // Instructions Panel
    this.createInstructionsPanel();

    // ─── 5b. Music Logic ─────────────────────────────────────────────
    const playMusic = () => {
        SOUNDS.resume();
        if (!this.sound.get('menu-theme')) {
            const music = this.sound.add('menu-theme', { loop: true, volume: 0.35 });
            music.play();
        } else if (!this.sound.get('menu-theme').isPlaying) {
            this.sound.get('menu-theme').play();
        }
        // @ts-ignore
        const ctx = (this.sound as any).context;
        if (ctx && ctx.state === 'suspended') {
            ctx.resume();
        }
    };

    // Auto-play attempt
    playMusic();

    // Browser policy fallback: Start music on first interaction
    this.input.once('pointerdown', playMusic);
    this.input.keyboard?.once('keydown', playMusic);

    // Player Select Buttons (Keeping consistent with shifted main menu)
    const onePlayerBtn = this.createStyledButton(400, 340, 'SOLO MISSION', 0x00ffff);
    const twoPlayerBtn = this.createStyledButton(400, 430, 'CO-OP SURVIVAL', 0xff00ff);
    const backBtn = this.add.text(400, 520, '← BACK TO MENU', { fontSize: '20px', color: '#aaa' })
        .setOrigin(0.5).setInteractive().on('pointerdown', () => this.togglePlayerSelect(false));

    this.playerSelectContainer.add([onePlayerBtn, twoPlayerBtn, backBtn]);

    // ─── 6. Logic & Interaction ──────────────────────────────────────
    startBtn.on('pointerdown', () => this.togglePlayerSelect(true));
    
    onePlayerBtn.on('pointerdown', () => this.startGame(1));
    twoPlayerBtn.on('pointerdown', () => this.startGame(2));

    editorBtn.on('pointerdown', () => {
        if (Api.isAdmin()) {
            alert("ADMINS CANNOT USE LEVEL EDITOR.");
            return;
        }
        this.scene.start('LevelEditorScene');
    });

    communityBtn.on('pointerdown', () => {
        if (Api.isAdmin()) {
            alert("ADMINS CANNOT USE COMMUNITY HUB.");
            return;
        }
        this.scene.start('CommunityScene');
    });

    howToBtn.on('pointerdown', () => this.toggleInstructions(true));

    // Keyboard Shortcuts
    if (this.input.keyboard) {
        this.input.keyboard.on('keydown-L', () => window.open('/portal.html?tab=login', '_blank'));
        this.input.keyboard.on('keydown-R', () => window.open('/portal.html?tab=register', '_blank'));
        this.input.keyboard.on('keydown-BACKSPACE', () => {
            Api.logout();
            // Simple visual feedback
            this.statusText.setText('LOGGING OUT...');
            this.statusText.setStyle({ color: '#ff0000' });
        });
        this.input.keyboard.on('keydown-ESC', () => this.toggleInstructions(false));
    }

    this.setupUserPolling();

    // ─── 7. Mute Button ──────────────────────────────────────────────
    const isMuted = localStorage.getItem('mute') === 'true';
    this.sound.mute = isMuted;

    const muteBtn = this.add.image(760, 555, isMuted ? 'icon-audio-off' : 'icon-audio')
        .setInteractive()
        .setScale(2.0)
        .setAlpha(1.0);

    muteBtn.on('pointerdown', () => {
        const currentlyMuted = !this.sound.mute;
        this.sound.mute = currentlyMuted;
        localStorage.setItem('mute', currentlyMuted.toString());
        muteBtn.setTexture(currentlyMuted ? 'icon-audio-off' : 'icon-audio');
        muteBtn.setTint(currentlyMuted ? 0xff4444 : 0xffffff);
    });

    muteBtn.on('pointerover', () => muteBtn.setScale(2.2).setTint(0xffffff));
    muteBtn.on('pointerout', () => muteBtn.setScale(2.0).setTint(this.sound.mute ? 0xff4444 : 0xffffff));
    
    if (isMuted) muteBtn.setTint(0xff4444);

    // ─── 8. Author Credit (Bottom Left) ──────────────────────────────
    const authorBtn = this.add.text(20, 575, 'MADE BY RASHMIKA DHANANJAYA', { 
        fontSize: '12px', 
        color: '#ffffff', 
        fontStyle: 'bold',
        fontFamily: 'Orbitron, Arial'
    }).setAlpha(0.6).setInteractive({ useHandCursor: true });

    authorBtn.on('pointerdown', () => {
        window.open('https://github.com/Rash200217', '_blank'); // Replace with your actual GitHub URL
    });

    authorBtn.on('pointerover', () => {
        authorBtn.setAlpha(1).setTint(0x00ffff);
        this.tweens.add({ targets: authorBtn, scale: 1.1, duration: 100 });
    });

    authorBtn.on('pointerout', () => {
        authorBtn.setAlpha(0.6).clearTint();
        this.tweens.add({ targets: authorBtn, scale: 1.0, duration: 100 });
    });
    this.createLoadingOverlay();
  }

  private createParallaxBg() {
    this.bgLayer1 = this.add.tileSprite(0, 0, 800, 600, 'bg-cavern-far').setOrigin(0, 0).setTint(0x222244);
    this.bgLayer2 = this.add.tileSprite(0, 0, 800, 600, 'bg-cavern-mid').setOrigin(0, 0).setTint(0x333366);
    this.bgLayer3 = this.add.tileSprite(0, 0, 800, 600, 'bg-cavern-near').setOrigin(0, 0).setTint(0x444488);
    [this.bgLayer1, this.bgLayer2, this.bgLayer3].forEach(l => l.setDisplaySize(800, 600).setAlpha(0.6));
  }

  update() {
    this.bgLayer1.tilePositionX += 0.2;
    this.bgLayer2.tilePositionX += 0.4;
    this.bgLayer3.tilePositionX += 0.6;
  }

  private createHeader() {
    // Profile Panel (Top Left) - Premium Glassmorphism
    const profilePanel = this.add.graphics();
    profilePanel.fillStyle(0x000000, 0.6);
    profilePanel.fillRoundedRect(10, 10, 220, 70, 12);
    profilePanel.lineStyle(2, 0x00ccff, 0.4);
    profilePanel.strokeRoundedRect(10, 10, 220, 70, 12);

    this.statusText = this.add.text(25, 22, 'GUEST MODE', {
        fontSize: '18px',
        color: '#ff4444', // Visibility color for not logged in
        fontStyle: 'bold',
        fontFamily: 'Orbitron, Arial'
    });

    this.loginHint = this.add.text(25, 45, '[L] LOGIN', { fontSize: '11px', color: '#00ccff', fontStyle: 'bold' });
    this.registerHint = this.add.text(105, 45, '[R] REGISTER', { fontSize: '11px', color: '#ffcc00', fontStyle: 'bold' });
    
    this.logoutHint = this.add.text(25, 62, 'BACKSPACE to LOGOUT', { fontSize: '10px', color: '#00ffff', fontStyle: 'bold' }).setVisible(false);
  }

  private createStyledButton(x: number, y: number, label: string, color: number) {
    const container = this.add.container(x, y);
    
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(-150, -25, 300, 50, 10);
    bg.lineStyle(2, color, 0.5);
    bg.strokeRoundedRect(-150, -25, 300, 50, 10);

    const text = this.add.text(0, 0, label, {
        fontSize: '24px',
        color: '#' + color.toString(16).padStart(6, '0'),
        fontStyle: 'bold'
    }).setOrigin(0.5);

    container.add([bg, text]);
    container.setSize(300, 50).setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => SOUNDS.pause());

    container.on('pointerover', () => {
        this.tweens.add({ targets: container, scale: 1.05, duration: 100 });
        bg.clear();
        bg.fillStyle(0x000000, 0.8);
        bg.fillRoundedRect(-150, -25, 300, 50, 10);
        bg.lineStyle(3, 0xffffff, 1);
        bg.strokeRoundedRect(-150, -25, 300, 50, 10);
        text.setStyle({ color: '#ffffff' });
        SOUNDS.shoot(); // Subtle chime
    });

    container.on('pointerout', () => {
        this.tweens.add({ targets: container, scale: 1.0, duration: 100 });
        bg.clear();
        bg.fillStyle(0x000000, 0.7);
        bg.fillRoundedRect(-150, -25, 300, 50, 10);
        bg.lineStyle(2, color, 0.5);
        bg.strokeRoundedRect(-150, -25, 300, 50, 10);
        text.setStyle({ color: '#' + color.toString(16).padStart(6, '0') });
    });

    return container;
  }

  private togglePlayerSelect(show: boolean) {
    if (show) {
        this.tweens.add({ targets: this.mainContainer, alpha: 0, x: -50, duration: 300, onComplete: () => this.mainContainer.setVisible(false) });
        this.playerSelectContainer.setVisible(true).setX(50);
        this.tweens.add({ targets: this.playerSelectContainer, alpha: 1, x: 0, duration: 300 });
    } else {
        this.tweens.add({ targets: this.playerSelectContainer, alpha: 0, x: 50, duration: 300, onComplete: () => this.playerSelectContainer.setVisible(false) });
        this.mainContainer.setVisible(true).setX(-50);
        this.tweens.add({ targets: this.mainContainer, alpha: 1, x: 0, duration: 300 });
    }
  }

  private async startGame(players: number) {
    if (Api.isAdmin()) {
        alert("ADMINS CANNOT PLAY. REDIRECTING TO PANEL...");
        window.open('/admin.html', '_blank');
        return;
    }

    // Show Loading Overlay
    this.showLoading(true);

    const username = Api.getUsername() || `Guest_${Math.floor(Math.random()*1000)}`;
    try {
        await signalRClient.connect(username);
        // Small delay for smooth transition
        this.time.delayedCall(800, () => {
            this.scene.start('GameScene', { restart: true, players: players });
        });
    } catch (err) {
        console.error("Failed to connect:", err);
        this.showLoading(false);
        alert("CONNECTION FAILED. PLEASE TRY AGAIN.");
    }
  }

  private createLoadingOverlay() {
    this.loadingOverlay = this.add.container(0, 0).setVisible(false).setAlpha(0).setDepth(2000);
    
    // Background Blur/Dim
    const bg = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.9);
    
    // Spinning Crystal
    const crystal = this.add.image(400, 250, 'bullet')
        .setScale(4)
        .setTint(0x00ffff);
    
    this.tweens.add({
        targets: crystal,
        angle: 360,
        duration: 2000,
        repeat: -1
    });

    this.tweens.add({
        targets: crystal,
        scale: 5,
        alpha: 0.5,
        duration: 1000,
        yoyo: true,
        repeat: -1
    });

    const title = this.add.text(400, 350, 'INITIALIZING MISSION...', {
        fontSize: '28px',
        fontFamily: 'Press Start 2P, Arial',
        color: '#00ffff',
        stroke: '#003366',
        strokeThickness: 4
    }).setOrigin(0.5);

    const subtext = this.add.text(400, 400, 'SYNCHRONIZING WITH AWS CLOUD...', {
        fontSize: '14px',
        color: '#ffffff'
    }).setOrigin(0.5).setAlpha(0.7);

    this.tweens.add({
        targets: [title, subtext],
        alpha: 0.3,
        duration: 800,
        yoyo: true,
        repeat: -1
    });

    this.loadingOverlay.add([bg, crystal, title, subtext]);
  }

  private showLoading(show: boolean) {
    if (show) {
        this.loadingOverlay.setVisible(true);
        this.tweens.add({ targets: this.loadingOverlay, alpha: 1, duration: 400 });
    } else {
        this.tweens.add({ targets: this.loadingOverlay, alpha: 0, duration: 300, onComplete: () => this.loadingOverlay.setVisible(false) });
    }
  }

  private async fetchAndDisplayLeaderboard() {
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.6);
    panel.fillRoundedRect(610, 10, 180, 200, 12);
    panel.lineStyle(1, 0xffffff, 0.3);
    panel.strokeRoundedRect(610, 10, 180, 200, 12);

    this.add.text(700, 30, 'HALL OF FAME', { fontSize: '16px', color: '#00ccff', fontStyle: 'bold' }).setOrigin(0.5);
    
    try {
        const scores = await Api.getLeaderboard();
        let y = 60;
        for (const s of scores.slice(0, 5)) {
            this.add.text(625, y, `${s.username.toUpperCase()}`, { fontSize: '11px', color: '#00ffff' }).setOrigin(0, 0);
            this.add.text(775, y, `${s.value}`, { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(1, 0);
            y += 26;
        }
    } catch (err) {
        this.add.text(700, 100, 'OFFLINE', { fontSize: '12px', color: '#444' }).setOrigin(0.5);
    }
  }

  private setupUserPolling() {
    this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: () => {
            const storedUser = localStorage.getItem('username');
            if (storedUser) {
                const isAdmin = localStorage.getItem('isAdmin') === 'true';
                const color = isAdmin ? '#ffe600' : '#39ff14'; // Yellow for Admin
                this.statusText.setText(storedUser.toUpperCase() + (isAdmin ? ' [ADM]' : ''));
                this.statusText.setStyle({ color });
                this.loginHint.setVisible(false);
                this.registerHint.setVisible(false);
                this.logoutHint.setVisible(true);
                const token = localStorage.getItem('token');
                if (token && !Api.getToken()) Api.setToken(token, storedUser, isAdmin);
            } else {
                if (Api.getToken()) Api.logout();
                this.statusText.setText('GUEST MODE');
                this.statusText.setStyle({ color: '#ff4444' }); // Neon Red for visibility
                this.loginHint.setVisible(true);
                this.registerHint.setVisible(true);
                this.logoutHint.setVisible(false);
            }
        }
    });
  }
  private createInstructionsPanel() {
    this.instructionsContainer = this.add.container(0, 0).setVisible(false).setAlpha(0).setDepth(1000);
    
    const bg = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.85).setInteractive();
    
    const panel = this.add.graphics();
    panel.fillStyle(0x050510, 0.95);
    panel.fillRoundedRect(100, 50, 600, 500, 15);
    panel.lineStyle(3, 0x00ccff, 1);
    panel.strokeRoundedRect(100, 50, 600, 500, 15);

    const title = this.add.text(400, 75, 'HOW TO PLAY', { fontSize: '32px', color: '#00ffff', fontStyle: 'bold' }).setOrigin(0.5);
    
    const content = [
        "MOVEMENT:  Player1 - [ARROW KEYS]  Player2 - [WASD]",
        "COMBAT:    Player1 - [SPACE]  Player2 - [F] to Fire Ice Bullets",
        "",
        "THE GOAL:",
        "1. SHOOT enemies until they freeze into a SNOWBALL.",
        "2. PUSH the snowball to roll it across the screen.",
        "3. SHATTER enemies by hitting them with rolling snowballs!",
        "",
        "POWER-UPS:",
        "❤ HEARTS restore health. Pick them up at full health",
        "  to gain EXTRA LIVES (Max 5).",
        "",
        "TIPS:",
        "• Enemies thaw over time! Hit them quickly to finish.",
        "• Dark Blue enemies are shielded - hit them from front.",
        "• Bosses are massive - they take multiple snowball hits."
    ];

    const body = this.add.text(140, 115, content.join('\n'), { 
        fontSize: '14px', 
        color: '#ffffff', 
        lineSpacing: 6,
        fontFamily: 'Arial, sans-serif'
    });

    const closeBtn = this.add.text(400, 520, '[ CLOSE ]', { fontSize: '22px', color: '#ff00ff', fontStyle: 'bold' })
        .setOrigin(0.5).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.toggleInstructions(false))
        .on('pointerover', () => closeBtn.setScale(1.1).setTint(0xffffff))
        .on('pointerout', () => closeBtn.setScale(1.0).clearTint());

    this.instructionsContainer.add([bg, panel, title, body, closeBtn]);
  }

  private toggleInstructions(show: boolean) {
    if (show) {
        this.instructionsContainer.setVisible(true);
        this.tweens.add({ targets: this.instructionsContainer, alpha: 1, duration: 300 });
    } else {
        this.tweens.add({ targets: this.instructionsContainer, alpha: 0, duration: 200, onComplete: () => this.instructionsContainer.setVisible(false) });
    }
  }
}
