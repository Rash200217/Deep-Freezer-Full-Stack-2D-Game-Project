import { Scene, GameObjects } from 'phaser';
import { SOUNDS } from './zzfx';
import { Api } from '../Api';

export class GameOverScene extends Scene {
    private score: number = 0;
    private customLevel: any = null;
    private players: number = 1;
    private fromEditor: boolean = false;

    private bgLayer1!: GameObjects.TileSprite;
    private bgLayer2!: GameObjects.TileSprite;
    private bgLayer3!: GameObjects.TileSprite;

    constructor() {
        super('GameOverScene');
    }

    init(data: any) {
        this.score = data.score || 0;
        this.customLevel = data.customLevel || null;
        this.players = data.players || 1;
        this.fromEditor = data.fromEditor || false;
    }

    create() {
        // ─── 1. Red Parallax Background ──────────────────────────────
        this.createParallaxBg();

        // ─── 2. Snow Particles ───────────────────────────────────────
        this.add.particles(0, -50, 'bullet', {
            x: { min: 0, max: 800 },
            lifespan: 10000,
            speedY: { min: 10, max: 50 },
            speedX: { min: -5, max: 5 },
            scale: { start: 0.1, end: 0.2 },
            quantity: 1,
            frequency: 300,
            blendMode: 'ADD',
            tint: 0x88ffff,
            alpha: 0.3
        });

        // ─── 3. Header & Branding ────────────────────────────────────
        if (this.score > 0) {
            Api.submitScore(this.score).catch(e => console.error('Score submission failed', e));
        }
        this.add.text(400, 40, 'DEEP FREEZER', {
            fontSize: '18px',
            color: '#00ccff',
            fontStyle: 'bold',
            letterSpacing: 4
        }).setOrigin(0.5).setAlpha(0.7);

        const title = this.add.text(400, 130, 'GAME OVER', {
            fontSize: '64px',
            fontFamily: 'Arial Black, Gadget, sans-serif',
            color: '#ff2222',
            stroke: '#660000',
            strokeThickness: 8,
            shadow: { offsetX: 0, offsetY: 0, color: '#ff0000', blur: 30, fill: true }
        }).setOrigin(0.5);

        this.tweens.add({
            targets: title,
            alpha: 0.7,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });

        // ─── 4. Glassmorphism Score Panel ────────────────────────────
        const panel = this.add.graphics();
        panel.fillStyle(0x000000, 0.6);
        panel.fillRoundedRect(250, 200, 300, 100, 12);
        panel.lineStyle(2, 0xffffff, 0.1);
        panel.strokeRoundedRect(250, 200, 300, 100, 12);

        this.add.text(400, 230, 'FINAL SCORE', { fontSize: '14px', color: '#aaaaaa' }).setOrigin(0.5);
        this.add.text(400, 265, this.score.toString(), {
            fontSize: '42px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // ─── 5. Navigation Buttons ───────────────────────────────────
        const restartBtn = this.createStyledButton(400, 370, 'PLAY AGAIN', 0x39ff14);
        restartBtn.on('pointerdown', () => {
            this.scene.start('GameScene', { 
                restart: true, 
                customLevel: this.customLevel, 
                players: this.players,
                fromEditor: this.fromEditor
            });
        });

        if (this.fromEditor) {
            const editorBtn = this.createStyledButton(400, 450, 'BACK TO EDITOR', 0x00ccff);
            editorBtn.on('pointerdown', () => this.scene.start('LevelEditorScene'));
        }

        const menuBtn = this.createStyledButton(400, 530, 'MAIN MENU', 0xaaaaaa);
        menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
    }

    private createParallaxBg() {
        this.bgLayer1 = this.add.tileSprite(0, 0, 800, 600, 'bg-cavern-far').setOrigin(0, 0).setTint(0x441111);
        this.bgLayer2 = this.add.tileSprite(0, 0, 800, 600, 'bg-cavern-mid').setOrigin(0, 0).setTint(0x552222);
        this.bgLayer3 = this.add.tileSprite(0, 0, 800, 600, 'bg-cavern-near').setOrigin(0, 0).setTint(0x663333);
        [this.bgLayer1, this.bgLayer2, this.bgLayer3].forEach(l => l.setDisplaySize(800, 600).setAlpha(0.8));
    }

    update() {
        this.bgLayer1.tilePositionX += 0.1;
        this.bgLayer2.tilePositionX += 0.2;
        this.bgLayer3.tilePositionX += 0.3;
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
