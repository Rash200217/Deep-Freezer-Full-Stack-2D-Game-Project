import { Scene } from 'phaser';
import { LevelsApi } from '../api/LevelsApi';

interface LevelData { id: number; name: string; authorName: string; playCount: number; gridData: string; createdAt: string; [key: string]: any; }

export class CommunityScene extends Scene {
    private levels: LevelData[] = [];
    private loadingText!: Phaser.GameObjects.Text;

    constructor() {
        super('CommunityScene');
    }

    create() {
        this.cameras.main.setBackgroundColor('#000022');
        
        this.add.text(400, 40, 'COMMUNITY MAP HUB', { fontSize: '32px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

        const homeBtn = this.add.text(20, 20, '< BACK', { fontSize: '20px', color: '#f00', backgroundColor: '#400', padding: {x: 10, y: 5}}).setInteractive({ useHandCursor: true });
        homeBtn.on('pointerdown', () => this.scene.start('MenuScene'));
        homeBtn.on('pointerover', () => homeBtn.setStyle({ backgroundColor: '#800' }));
        homeBtn.on('pointerout', () => homeBtn.setStyle({ backgroundColor: '#400' }));

        this.loadingText = this.add.text(400, 300, 'Fetching Levels...', { fontSize: '24px', color: '#aaa' }).setOrigin(0.5);

        this.fetchLevels();
    }

    private async fetchLevels() {
        this.levels = await LevelsApi.getLevels();
        this.loadingText.destroy();

        if (this.levels.length === 0) {
            this.add.text(400, 300, 'No levels uploaded yet.\nBe the first via the Level Editor!', { fontSize: '20px', color: '#888', align: 'center' }).setOrigin(0.5);
            return;
        }

        let startY = 120;
        this.levels.forEach((lvl, _i) => {
            const cardBg = this.add.rectangle(400, startY, 600, 60, 0x111133).setInteractive({ useHandCursor: true });
            
            this.add.text(120, startY - 15, lvl.name, { fontSize: '22px', color: '#0f0', fontStyle: 'bold' });
            this.add.text(120, startY + 10, `By: ${lvl.authorName}   |   Plays: ${lvl.playCount}`, { fontSize: '14px', color: '#ccc' });
            
            const btn = this.add.text(620, startY, 'PLAY', { fontSize: '18px', color: '#fff', backgroundColor: '#0a0', padding: {x: 15, y: 5}}).setOrigin(0.5).setInteractive({ useHandCursor: true });
            
            const handlePlay = () => {
                let parsedGrid = [];
                try {
                    parsedGrid = JSON.parse(lvl.gridData);
                } catch(e) {
                    return; // invalid json
                }
                this.scene.start('GameScene', { restart: true, customLevel: parsedGrid, players: 1 });
            };

            cardBg.on('pointerdown', handlePlay);
            btn.on('pointerdown', handlePlay);
            
            cardBg.on('pointerover', () => cardBg.setFillStyle(0x222255));
            cardBg.on('pointerout', () => cardBg.setFillStyle(0x111133));

            startY += 80;
        });
    }
}
