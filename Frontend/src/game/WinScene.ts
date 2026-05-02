import { Scene, GameObjects } from 'phaser';
import { SOUNDS } from './zzfx';
import { Api } from '../Api';

export class WinScene extends Scene {
    private score: number = 0;
    private players: number = 1;

    private bgLayer1!: GameObjects.TileSprite;
    private bgLayer2!: GameObjects.TileSprite;
    private bgLayer3!: GameObjects.TileSprite;

    constructor() {
        super('WinScene');
    }

    init(data: any) {
        this.score = data.score || 0;
        this.players = data.players || 1;
    }

    create() {
        // ─── 1. Victory Parallax Background (Bright/Cyan) ────────────
        this.createParallaxBg();

        // ─── 2. Snow Particles (Victory Glitter) ─────────────────────
        this.add.particles(0, -50, 'bullet', {
            x: { min: 0, max: 800 },
            lifespan: 10000,
            speedY: { min: 20, max: 80 },
            speedX: { min: -10, max: 10 },
            scale: { start: 0.1, end: 0.3 },
            quantity: 2,
            frequency: 100,
            blendMode: 'ADD',
            tint: 0x00ffff,
            alpha: 0.5
        });

        // ─── 3. Header & Branding ────────────────────────────────────
        if (this.score > 0) {
            Api.submitScore(this.score).catch(e => console.error('Score submission failed', e));
        }
        this.add.text(400, 40, 'DEEP FREEZER', {
            fontSize: '18px',
            color: '#ffffff',
            fontStyle: 'bold',
            letterSpacing: 4
        }).setOrigin(0.5).setAlpha(0.6);

        const title = this.add.text(400, 130, 'MISSION COMPLETE', {
            fontSize: '56px',
            fontFamily: 'Arial Black, Gadget, sans-serif',
            color: '#00ffff',
            stroke: '#004444',
            strokeThickness: 8,
            shadow: { offsetX: 0, offsetY: 0, color: '#00ffff', blur: 30, fill: true }
        }).setOrigin(0.5);

        this.tweens.add({
            targets: title,
            scale: 1.05,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // ─── 4. Glassmorphism Stats Panel ────────────────────────────
        const panel = this.add.graphics();
        panel.fillStyle(0xffffff, 0.1);
        panel.fillRoundedRect(250, 200, 300, 120, 15);
        panel.lineStyle(2, 0x00ffff, 0.3);
        panel.strokeRoundedRect(250, 200, 300, 120, 15);

        this.add.text(400, 225, 'ARCTIC CHAMPION SCORE', { fontSize: '12px', color: '#00ffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.add.text(400, 265, this.score.toString(), {
            fontSize: '52px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // ─── 5. Navigation Buttons ───────────────────────────────────
        const restartBtn = this.createStyledButton(400, 390, 'PLAY AGAIN', 0x39ff14);
        restartBtn.on('pointerdown', () => {
            this.scene.start('GameScene', { 
                restart: true, 
                players: this.players
            });
        });

        const menuBtn = this.createStyledButton(400, 480, 'MAIN MENU', 0xaaaaaa);
        menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
    }

    private createParallaxBg() {
        this.bgLayer1 = this.add.tileSprite(0, 0, 800, 600, 'bg-cavern-far').setOrigin(0, 0).setTint(0x004466);
        this.bgLayer2 = this.add.tileSprite(0, 0, 800, 600, 'bg-cavern-mid').setOrigin(0, 0).setTint(0x006688);
        this.bgLayer3 = this.add.tileSprite(0, 0, 800, 600, 'bg-cavern-near').setOrigin(0, 0).setTint(0x0088aa);
        [this.bgLayer1, this.bgLayer2, this.bgLayer3].forEach(l => l.setDisplaySize(800, 600).setAlpha(0.9));
    }

    update() {
        this.bgLayer1.tilePositionX += 0.5;
        this.bgLayer2.tilePositionX += 0.8;
        this.bgLayer3.tilePositionX += 1.2;
    }

    private createStyledButton(x: number, y: number, label: string, color: number) {
        const container = this.add.container(x, y);
        
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.7);
        bg.fillRoundedRect(-140, -25, 280, 50, 10);
        bg.lineStyle(2, color, 0.5);
        bg.strokeRoundedRect(-140, -25, 280, 50, 10);

        const text = this.add.text(0, 0, label, {
            fontSize: '22px',
            color: '#' + color.toString(16).padStart(6, '0'),
            fontStyle: 'bold'
        }).setOrigin(0.5);

        container.add([bg, text]);
        container.setSize(280, 50).setInteractive({ useHandCursor: true });
        container.on('pointerdown', () => SOUNDS.pause());

        container.on('pointerover', () => {
            this.tweens.add({ targets: container, scale: 1.05, duration: 100 });
            bg.clear();
            bg.fillStyle(0x000000, 0.8);
            bg.fillRoundedRect(-140, -25, 280, 50, 10);
            bg.lineStyle(3, 0xffffff, 1);
            bg.strokeRoundedRect(-140, -25, 280, 50, 10);
            text.setStyle({ color: '#ffffff' });
        });

        container.on('pointerout', () => {
            this.tweens.add({ targets: container, scale: 1.0, duration: 100 });
            bg.clear();
            bg.fillStyle(0x000000, 0.7);
            bg.fillRoundedRect(-140, -25, 280, 50, 10);
            bg.lineStyle(2, color, 0.5);
            bg.strokeRoundedRect(-140, -25, 280, 50, 10);
            text.setStyle({ color: '#' + color.toString(16).padStart(6, '0') });
        });

        return container;
    }
}
