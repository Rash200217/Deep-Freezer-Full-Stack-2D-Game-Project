import { Scene, GameObjects } from 'phaser';
import { LevelsApi } from '../api/LevelsApi';
import { AchievementsApi } from '../api/AchievementsApi';

export class LevelEditorScene extends Scene {
    private grid: string[][] = [];
    private images: GameObjects.Image[][] = [];;
    private gridLines!: GameObjects.Graphics;
    
    private brush: string = '=';
    private isBucketFill: boolean = false;
    private uiContainer!: GameObjects.Container;
    private uiVisible: boolean = true;
    private brushIcons: GameObjects.Text[] = [];
    private selectionBox!: GameObjects.Graphics;
    
    constructor() { super('LevelEditorScene'); }

    create() {
        this.cameras.main.setBackgroundColor('#111');

        this.gridLines = this.add.graphics();
        this.uiContainer = this.add.container(0, 0).setDepth(1000);
        
        const OFFSET_X = 0;
        const OFFSET_Y = 12;
        
        for (let r = 0; r < 18; r++) {
            this.grid[r] = [];
            this.images[r] = [];
            for (let c = 0; c < 25; c++) {
                this.grid[r].push(' ');
                const x = OFFSET_X + c * 32 + 16;
                const y = OFFSET_Y + r * 32 + 16;
                const img = this.add.image(x, y, 'platform').setVisible(false).setDisplaySize(32, 32);
                this.images[r].push(img);
                this.gridLines.lineStyle(1, 0x333333);
                this.gridLines.strokeRect(OFFSET_X + c * 32, OFFSET_Y + r * 32, 32, 32);
            }
        }

        this.input.on('pointerdown', this.handlePointer, this);
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (pointer.isDown && !this.isBucketFill) this.handlePointer(pointer);
        });

        this.buildUI();
        this.refreshAllImages();
    }

    private makeBtn(obj: Phaser.GameObjects.Text, bg: string, hoverBd: string) {
        obj.setInteractive({ useHandCursor: true });
        
        // Premium Micro-Animations
        obj.on('pointerover', () => {
            obj.setStyle({ backgroundColor: hoverBd });
            this.tweens.add({ targets: obj, scale: 1.05, duration: 80 });
        });
        
        obj.on('pointerout', () => {
            obj.setStyle({ backgroundColor: bg });
            this.tweens.add({ targets: obj, scale: 1, duration: 80 });
        });

        obj.on('pointerdown', () => {
            this.tweens.add({ targets: obj, scale: 0.95, duration: 50, yoyo: true });
        });

        return obj;
    }

    private buildUI() {
        // ── 1. Sidebar Background (Solid Premium Style) ──
        const uiBg = this.add.rectangle(0, 0, 240, 600, 0x0a0a15, 1).setOrigin(0, 0);
        const uiBorder = this.add.graphics();
        uiBorder.lineStyle(2, 0x00ccff, 0.6);
        uiBorder.strokeLineShape(new Phaser.Geom.Line(240, 0, 240, 600));
        this.uiContainer.add([uiBg, uiBorder]);

        const title = this.add.text(10, 15, 'LEVEL EDITOR', { fontSize: '20px', color: '#00ccff', fontStyle: 'bold' });
        this.uiContainer.add(title);

        // ── 2. Tools Section (Brush Grid) ──
        const toolsLabel = this.add.text(10, 50, 'DRAWING TOOLS', { fontSize: '11px', color: '#555', fontStyle: 'bold' }).setAlpha(0.8);
        this.uiContainer.add(toolsLabel);
        
        const tools = [
            { key: '1', char: '=',  label: 'PLATFORM', color: '#00ccff' },
            { key: '2', char: 'E',  label: 'ENEMY',    color: '#ffdd00' },
            { key: '3', char: 'R',  label: 'ELITE',    color: '#ff3300' },
            { key: '4', char: 'S',  label: 'SNIPER',   color: '#ffaa00' },
            { key: '5', char: 'X',  label: 'SHIELD',   color: '#4488ff' },
            { key: '6', char: 'B',  label: 'BOSS',     color: '#ff00ff' },
            { key: '7', char: 'P',  label: 'P1 START', color: '#00ffff' },
            { key: '8', char: ' ',  label: 'ERASER',   color: '#999999' }
        ];

        this.selectionBox = this.add.graphics().lineStyle(2, 0xffffff, 1);
        this.uiContainer.add(this.selectionBox);

        let yOffset = 75;
        tools.forEach((t, i) => {
            const icon = this.add.text(10, yOffset, `${t.key}: ${t.label}`, { 
                fontSize: '13px', 
                color: t.color, 
                backgroundColor: '#1a1a25', 
                padding: {x: 10, y: 5}, 
                fixedWidth: 220 
            }).setInteractive({ useHandCursor: true });
            
            icon.on('pointerdown', () => { this.brush = t.char; this.refreshBrushSelection(); });
            this.brushIcons.push(icon);
            this.uiContainer.add(icon);
            yOffset += 28;
        });

        this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
            const found = tools.find(t => t.key === event.key);
            if (found) { this.brush = found.char; this.refreshBrushSelection(); }
        });

        // ── 3. Global Settings ──
        yOffset += 5;
        const fillHint = this.add.text(10, yOffset, `[F] MODE: DRAW`, { fontSize: '12px', color: '#fa0', fontStyle: 'bold' });
        const hideHint = this.add.text(130, yOffset, `[H] HIDE UI`, { fontSize: '12px', color: '#0af', fontStyle: 'bold' });
        this.uiContainer.add([fillHint, hideHint]);
        this.input.keyboard!.on('keydown-F', () => {
            this.isBucketFill = !this.isBucketFill;
            fillHint.setText(`[F] MODE: ${this.isBucketFill ? 'FILL' : 'DRAW'}`);
        });

        this.input.keyboard!.on('keydown-H', () => {
            this.uiVisible = !this.uiVisible;
            this.uiContainer.setVisible(this.uiVisible);
            this.selectionBox.setVisible(this.uiVisible);
        });

        this.input.keyboard!.on('keydown-P', () => {
            this.game.registry.set('editorGrid', JSON.parse(JSON.stringify(this.grid))); 
            this.scene.start('GameScene', { restart: true, customLevel: this.getGridArray(), players: 1, fromEditor: true });
        });

        // ── 4. File Actions (Compact Grid) ──
        yOffset += 25;
        const fileLabel = this.add.text(10, yOffset, 'FILE OPERATIONS', { fontSize: '11px', color: '#555', fontStyle: 'bold' }).setAlpha(0.8);
        this.uiContainer.add(fileLabel);
        yOffset += 20;

        const testBtn = this.makeBtn(this.add.text(10, yOffset, '▶ PREVIEW LEVEL (P)', { fontSize: '13px', color: '#0f0', backgroundColor: '#131', padding: {x: 5, y: 8}, fixedWidth: 220, align: 'center'}), '#131', '#151');
        testBtn.on('pointerdown', () => { this.game.registry.set('editorGrid', JSON.parse(JSON.stringify(this.grid))); this.scene.start('GameScene', { restart: true, customLevel: this.getGridArray(), players: 1, fromEditor: true }); });
        this.uiContainer.add(testBtn);

        const groupY = yOffset + 45;
        const copyBtn = this.makeBtn(this.add.text(10, groupY, 'COPY MAP', { fontSize: '11px', color: '#fff', backgroundColor: '#223', padding: {x: 5, y: 5}, fixedWidth: 105, align: 'center'}), '#223', '#334');
        const pasteBtn = this.makeBtn(this.add.text(125, groupY, 'PASTE MAP', { fontSize: '11px', color: '#fff', backgroundColor: '#223', padding: {x: 5, y: 5}, fixedWidth: 105, align: 'center'}), '#223', '#334');
        copyBtn.on('pointerdown', () => this.exportClipboard());
        pasteBtn.on('pointerdown', () => this.importClipboard());

        const publishBtn = this.makeBtn(this.add.text(10, groupY + 30, 'PUBLISH TO COMMUNITY', { fontSize: '11px', color: '#fff', backgroundColor: '#311', padding: {x: 5, y: 5}, fixedWidth: 220, align: 'center'}), '#311', '#522');
        publishBtn.on('pointerdown', () => this.handlePublish());

        this.uiContainer.add([copyBtn, pasteBtn, publishBtn]);

        // ── 5. Save/Load Slots (Organized Grid) ──
        yOffset = groupY + 60;
        for (let i = 1; i <= 3; i++) {
            const by = yOffset + ((i - 1) * 28);
            const s = this.makeBtn(this.add.text(10,  by, `SAVE ${i}`, { fontSize: '11px', color: '#afa', backgroundColor: '#121', padding: {x: 5, y: 5}, fixedWidth: 105, align: 'center'}), '#121', '#131');
            const l = this.makeBtn(this.add.text(125, by, `LOAD ${i}`, { fontSize: '11px', color: '#aaf', backgroundColor: '#112', padding: {x: 5, y: 5}, fixedWidth: 105, align: 'center'}), '#112', '#123');
            s.on('pointerdown', () => this.saveSlot(i));
            l.on('pointerdown', () => this.loadSlot(i));
            this.uiContainer.add([s, l]);
        }

        // ── 6. Navigation ──
        const exitBtn = this.makeBtn(this.add.text(10, 565, 'EXIT TO MENU', { fontSize: '13px', color: '#f55', backgroundColor: '#222', padding: {x: 5, y: 7}, fixedWidth: 220, align: 'center'}), '#222', '#333');
        exitBtn.on('pointerdown', () => this.scene.start('MenuScene'));
        this.uiContainer.add(exitBtn);


        this.refreshBrushSelection();

        // Restore grid if returning from preview
        const savedGrid = this.game.registry.get('editorGrid');
        if (savedGrid) {
            for (let r = 0; r < 18; r++) for (let c = 0; c < 25; c++) this.grid[r][c] = savedGrid[r]?.[c] ?? ' ';
            this.refreshAllImages();
            this.game.registry.remove('editorGrid');
        }
    }

    private refreshBrushSelection() {
        const tools = ['=', 'E', 'R', 'S', 'X', 'B', 'P', ' '];
        const idx = tools.indexOf(this.brush);
        if (idx !== -1 && this.brushIcons[idx]) {
            const icon = this.brushIcons[idx];
            this.selectionBox.clear();
            this.selectionBox.lineStyle(2, 0xffffff, 0.8);
            this.selectionBox.strokeRect(icon.x - 2, icon.y - 2, icon.width + 4, icon.height + 4);
            
            // Add a subtle glow
            this.selectionBox.lineStyle(4, 0x00ccff, 0.3);
            this.selectionBox.strokeRect(icon.x - 4, icon.y - 4, icon.width + 8, icon.height + 8);
        }
    }

    private async handlePublish() {
        const token = localStorage.getItem('token');
        if (!token) { this.flashMessage('LOGIN REQUIRED TO PUBLISH', '#f80'); return; }
        const name = prompt("Enter a name for your custom map:");
        if (name) {
            const arr = this.getGridArray();
            const thumbnail = this.generateThumbnail(arr);
            const ok = await LevelsApi.publishLevel(name, JSON.stringify(arr), thumbnail);
            if (ok) {
                this.flashMessage('MAP PUBLISHED!', '#0f0');
                AchievementsApi.unlock('MAP_MAKER');
            } else {
                this.flashMessage('PUBLISH FAILED', '#f00');
            }
        }
    }

    // ─── Thumbnail Generator ──────────────────────────────────────────
    private generateThumbnail(grid: string[]): string {
        const tileW = 5, tileH = 5;
        const cols  = 25, rows = 18;
        const canvas = document.createElement('canvas');
        canvas.width  = cols * tileW;
        canvas.height = rows * tileH;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = '#111122';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const colorMap: Record<string, string> = {
            '=': '#6688aa',
            'E': '#ff5555',
            'R': '#ff2200',
            'S': '#ffaa00',
            'X': '#4488ff',
            'B': '#ff00ff',
            'P': '#00ffff',
            '1': '#00ffff',
            '2': '#00ffcc',
        };

        for (let r = 0; r < rows; r++) {
            const row = grid[r] || '';
            for (let c = 0; c < cols; c++) {
                const ch = row[c] || ' ';
                const color = colorMap[ch];
                if (color) {
                    ctx.fillStyle = color;
                    ctx.fillRect(c * tileW, r * tileH, tileW, tileH);
                }
            }
        }
        return canvas.toDataURL('image/png');
    }

    private handlePointer(pointer: Phaser.Input.Pointer) {
        const OFFSET_X = 0;
        const OFFSET_Y = 12;
        const SIDEBAR_WIDTH = 240;
        
        // Prevent drawing "through" the sidebar when it's visible
        if (this.uiVisible && pointer.x < SIDEBAR_WIDTH) return;
        
        const c = Math.floor((pointer.x - OFFSET_X) / 32);
        const r = Math.floor((pointer.y - OFFSET_Y) / 32);
        
        if (r >= 0 && r < 18 && c >= 0 && c < 25) {
            // ── Unique Unit Enforcement ──
            // Boss and Player 1 Start must be unique.
            const isUnique = (this.brush === 'B' || this.brush === 'P');

            if (isUnique) {
                // Remove existing instance before placing new one
                for (let gr = 0; gr < 18; gr++) {
                    for (let gc = 0; gc < 25; gc++) {
                        if (this.grid[gr][gc] === this.brush) {
                            this.grid[gr][gc] = ' ';
                            this.updateTileImage(gr, gc);
                        }
                    }
                }
                this.grid[r][c] = this.brush;
                this.updateTileImage(r, c);
            } else {
                if (this.isBucketFill) { 
                    this.floodFill(r, c, this.grid[r][c], this.brush); 
                    this.refreshAllImages(); 
                }
                else { 
                    this.grid[r][c] = this.brush; 
                    this.updateTileImage(r, c); 
                }
            }
        }
    }

    private floodFill(r: number, c: number, targetChar: string, replacementChar: string) {
        if (targetChar === replacementChar) return;
        if (r < 0 || r >= 18 || c < 0 || c >= 25) return;
        if (this.grid[r][c] !== targetChar) return;
        this.grid[r][c] = replacementChar;
        this.floodFill(r + 1, c, targetChar, replacementChar);
        this.floodFill(r - 1, c, targetChar, replacementChar);
        this.floodFill(r, c + 1, targetChar, replacementChar);
        this.floodFill(r, c - 1, targetChar, replacementChar);
    }

    private updateTileImage(r: number, c: number) {
        const char = this.grid[r][c];
        const img  = this.images[r][c];
        img.setVisible(true).clearTint().setDisplaySize(32, 32);
        if      (char === '=') { img.setTexture('platform'); }
        else if (char === 'E') { img.setTexture('enemy-basic'); img.setDisplaySize(64, 64); }
        else if (char === 'R') { img.setTexture('enemy-red'); img.setDisplaySize(64, 64); }
        else if (char === 'S') { img.setTexture('enemy-sniper'); img.setDisplaySize(64, 64); }
        else if (char === 'X') { img.setTexture('enemy-shield'); img.setDisplaySize(64, 64); }
        else if (char === 'B') { img.setTexture('enemy-boss'); img.setDisplaySize(128, 128); }
        else if (char === 'P' || char === '1') { img.setTexture('player'); img.setDisplaySize(64, 64); }
        else if (char === '2') { img.setTexture('player'); img.setTint(0x00ffff); img.setDisplaySize(64, 64); }
        else { img.setVisible(false); }
    }

    private refreshAllImages() {
        for (let r = 0; r < 18; r++) for (let c = 0; c < 25; c++) this.updateTileImage(r, c);
    }

    private getGridArray(): string[] {
        const out = [];
        for (let r = 0; r < 18; r++) out.push(this.grid[r].join(''));
        return out;
    }

    private async exportClipboard() {
        try {
            const jsonStr = JSON.stringify(this.getGridArray(), null, 2);
            await navigator.clipboard.writeText(jsonStr);
            this.flashMessage('COPIED TO CLIPBOARD');
        } catch { this.flashMessage('COPY FAILED', '#f00'); }
    }

    private async importClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed) && parsed.length === 18) {
                for (let r = 0; r < 18; r++) {
                    const rowStr = parsed[r] as string;
                    for (let c = 0; c < 25; c++) this.grid[r][c] = rowStr[c] || ' ';
                }
                this.refreshAllImages();
                this.flashMessage('MAP IMPORTED!');
            } else { this.flashMessage('INVALID MAP ARRAY', '#f00'); }
        } catch { this.flashMessage('IMPORT FAILED / INVALID JSON', '#f00'); }
    }

    private saveSlot(slot: number) {
        try {
            localStorage.setItem(`deepfreeze_slot${slot}`, JSON.stringify(this.getGridArray()));
            this.flashMessage(`SAVED TO SLOT ${slot}`);
        } catch { this.flashMessage(`SAVE FAILED`, '#f00'); }
    }

    private loadSlot(slot: number) {
        try {
            const data = localStorage.getItem(`deepfreeze_slot${slot}`);
            if (data) {
                const parsed = JSON.parse(data);
                for (let r = 0; r < 18; r++) {
                    const rowStr = parsed[r] as string;
                    for (let c = 0; c < 25; c++) this.grid[r][c] = rowStr[c] || ' ';
                }
                this.refreshAllImages();
                this.flashMessage(`LOADED SLOT ${slot}`);
            } else { this.flashMessage(`SLOT ${slot} EMPTY`, '#fa0'); }
        } catch { this.flashMessage(`LOAD FAILED`, '#f00'); }
    }

    private flashMessage(msg: string, color: string = '#0f0') {
        // Center of the visible workspace (800 total - 240 sidebar = 560. 240 + 560/2 = 520)
        const flash = this.add.text(520, 300, msg, { 
            fontSize: '24px', 
            color, 
            backgroundColor: '#000', 
            padding: {x: 10, y: 10} 
        }).setOrigin(0.5).setDepth(2000);
        
        this.tweens.add({ targets: flash, alpha: 0, duration: 1500, onComplete: () => flash.destroy() });
    }
}
