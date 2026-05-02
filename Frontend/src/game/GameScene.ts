import { Scene, Physics, Input } from 'phaser';
import { signalRClient } from '../SignalRClient';
import { TelemetryClient } from '../TelemetryClient';
import { Api } from '../Api';
import { SOUNDS } from './zzfx';
import { AchievementsApi } from '../api/AchievementsApi';

const LEVELS = [
    // Stage 1 (Classic - Tiered Safety)
    [
        "                         ",
        "                         ",
        "         E     E         ",
        "      =============      ",
        "                         ",
        "                         ",
        "   E                 E   ",
        "=======           =======",
        "                         ",
        "                         ",
        "         E     E         ",
        "      =============      ",
        "                         ",
        "                         ",
        "                         ",
        "P1          P2           ",
        "========================="
    ],
    // Stage 2 (Sniper Introduced - Vertical Lanes)
    [
        "                         ",
        "          S              ",
        "      =========          ",
        "                         ",
        "   E                R    ",
        " =======        =======  ",
        "                         ",
        "          X              ",
        "      =========          ",
        "                         ",
        "   E                E    ",
        "=========       =========",
        "                         ",
        "                         ",
        "         ========        ",
        "                         ",
        "P1          P2           ",
        "========================="
    ],
    // Stage 3 (Mix & Challenge - Strategic Gaps)
    [
        "                         ",
        "                         ",
        "  S    R             S   ",
        " =======         ======= ",
        "                         ",
        "          =====          ",
        "                         ",
        "  X                  X   ",
        " =======        =======  ",
        "                         ",
        "                         ",
        "          =====          ",
        "                         ",
        "  E                  E   ",
        " =======        =======  ",
        "                         ",
        "P1          P2           ",
        "========================="
    ],
    // Stage 4 (BOSS STAGE - Arena Style)
    [
        "                         ",
        "                         ",
        "                         ",
        "                         ",
        "=========       =========",
        "                         ",
        "                         ",
        "                         ",
        "                         ",
        "  E                  E   ",
        "  ======         ======  ",
        "                         ",
        "                         ",
        "  X                  X   ",
        "  ======         ======  ",
        "                         ",
        "P1         B      P2     ",
        "========================="
    ]
];

// ─── Power-Up ────────────────────────────────────────────────────────
class PowerUp extends Physics.Arcade.Sprite {
    public type: 'health';
    constructor(scene: Scene, x: number, y: number, type: 'health') {
        super(scene, x, y, 'bullet');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.type = type;
        this.setDisplaySize(16, 16);
        this.setTint(0xff0000); // Health tint
        
        this.setBounceY(0.4);
    }
}

class Snowball extends Physics.Arcade.Sprite {
    private pulseTween: Phaser.Tweens.Tween;
    public hasHit = false; // Guard against double hits per frame
    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'bullet');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setDisplaySize(14, 14);
        this.setTint(0xaaffff);
        this.setCollideWorldBounds(false); // Fly free, overlap logic handles destruction
        (this.body as Physics.Arcade.Body).setAllowGravity(false);
        // ── Pulse glow ──
        this.pulseTween = scene.tweens.add({ targets: this, alpha: 0.35, duration: 280, yoyo: true, repeat: -1 });
    }

    preUpdate(time: number, delta: number) {
        if (!this.active) return;
        super.preUpdate(time, delta);
        // Destroy if it goes off screen to prevent leaks
        if (this.y > 600 || this.y < -50 || this.x < -100 || this.x > 900) {
            this.destroy();
        }
    }

    destroy(fromScene?: boolean) {
        if (this.pulseTween) {
            this.pulseTween.stop();
        }
        super.destroy(fromScene);
    }
}

// ─── Base Enemy ──────────────────────────────────────────────────────
class Enemy extends Physics.Arcade.Sprite {
    public freezeLevel: number = 0;
    public isFrozenBall: boolean = false;
    public comboMultiplier: number = 1;
    public hitRequirement: number = 6;
    public isBoss: boolean = false;
    public movingRight: boolean = true;
    public speed: number = 50;
    
    // ── Meltdown (Thawing) System ──
    protected lastHitTime: number = 0;
    protected thawCooldown: number = 3000; // ms before thawing starts
    protected thawNextTick: number = 0;    // ms until next freeze level drop
    protected steamEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
    protected frozenTimer: number = 0;     // Lifetime of the frozen ball
    protected startFallY: number = -1;      // Tracking fall height
    protected wasInAir: boolean = false;    // Tracking landing
    
    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'enemy');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // ── Physics Fix: Use texture-space (64x64) for hitbox calculations to prevent sinking ──
        this.setSize(36, 64);
        this.setOffset(14, 0); 
        
        this.setCollideWorldBounds(false);
        
        // Ensure scale is explicitly set to 0.5 for a 64x64 texture displayed at 32x32
        // We do this instead of setDisplaySize because setScale cleanly scales the physics body.
        this.setScale(1.0); 
    }

    preUpdate(time: number, delta: number) {
        if (!this.active || !this.body) return;
        super.preUpdate(time, delta);
        
        // ── Screen Wrapping First ──
        this.wrapVertical();
        this.wrapHorizontal();

        if (this.handleMeltdown(time, delta)) return;
        this.updatePatrol();
    }

    protected handleMeltdown(time: number, _delta: number): boolean {
        if (this.isFrozenBall) {
            if (this.y > 1000) this.destroy();
            if (this.steamEmitter) { this.steamEmitter.stop(); this.steamEmitter = undefined; }
            
            const body = this.body as Physics.Arcade.Body;
            if (!body) return true;

            // ── Disappearance Timer (10 Seconds) ──
            const isMoving = Math.abs(body.velocity.x) > 20 || Math.abs(body.velocity.y) > 20;
            if (!isMoving) {
                this.frozenTimer -= _delta;
                
                // Visual Warning: Flash rapidly in the last 2 seconds
                if (this.frozenTimer < 2000) {
                    const blink = Math.floor(time / 100) % 2 === 0;
                    this.setAlpha(blink ? 0.4 : 1.0);
                    this.setTint(0xff8888); // Turn slightly red as it destabilizes
                }

                if (this.frozenTimer <= 0) {
                    const gs = this.scene as any;
                    if (gs && gs.handleEnemyShattered) gs.handleEnemyShattered(this, 1);
                    else this.destroy();
                }
            } else {
                // Reset/Hold timer while moving so it doesn't shatter mid-flight
                this.frozenTimer = 10000;
                this.setAlpha(1.0);
                this.setTint(0xffffff);
            }

            // ── Fall-Shatter Logic ──
            if (!body.blocked.down) {
                if (!this.wasInAir) {
                    this.startFallY = this.y;
                    this.wasInAir = true;
                }
            } else {
                if (this.wasInAir) {
                    const fallDist = this.y - this.startFallY;
                    // If fall is > 100px (Medium/High level), shatter on impact
                    if (this.startFallY !== -1 && fallDist > 100) {
                        const gs = this.scene as any;
                        if (gs && gs.handleEnemyShattered) {
                            gs.handleEnemyShattered(this, 1);
                            return true;
                        }
                    }
                    this.wasInAir = false;
                    this.startFallY = -1;
                }
            }

            // ── Animation Safety Guard ──
            if (isMoving) {
                if (!this.anims.isPlaying || this.anims.currentAnim?.key !== 'iceball-loop') {
                    this.play('iceball-loop', true);
                }
            }
            return true;
        }

        // ── Meltdown (Thawing) Logic ──
        if (this.freezeLevel > 0 && !this.isBoss) {
            const now = time;
            if (now - this.lastHitTime > this.thawCooldown) {
                if (Math.sin(now / 40) > 0) this.setAlpha(0.5); else this.setAlpha(1);
                this.x += (Math.random() - 0.5) * 2; 

                if (now > this.thawNextTick) {
                    this.freezeLevel--;
                    this.thawNextTick = now + 500;
                    const tintIdx = Math.min(this.freezeLevel, Enemy.FREEZE_TINTS.length - 1);
                    this.setTint(Enemy.FREEZE_TINTS[tintIdx]);

                    try {
                        const drip = this.scene.add.particles(this.x, this.y, 'bullet', {
                            speed: { min: 20, max: 50 }, angle: 90,
                            scale: { start: 0.1, end: 0 }, lifespan: 400,
                            quantity: 3, tint: 0xaaffff, alpha: 0.6
                        });
                        drip.explode(3);
                        this.scene.time.delayedCall(500, () => drip.destroy());
                    } catch {}

                    if (this.freezeLevel === 0) {
                        this.setAlpha(1);
                        this.clearTint();
                        if (this.steamEmitter) { this.steamEmitter.stop(); this.steamEmitter = undefined; }
                    }
                }
            } else {
                this.setAlpha(1);
            }
        }
        return false;
    }

    protected updatePatrol() {
        if (this.freezeLevel > 0 && !this.isBoss) {
            this.setVelocityX(0);
            return;
        }
        
        // ── Enhanced Patrol Logic ──
        let shouldTurn = (this.movingRight && this.body!.blocked.right) || (!this.movingRight && this.body!.blocked.left);
        
        if (this.body!.blocked.down) {
            const dir = this.movingRight ? 1 : -1;
            const checkDist = Math.max(12, this.displayWidth / 2 + 10);
            const checkX = this.x + (dir * checkDist); 
            const checkY = this.y + 20; 
            
            const platforms = (this.scene as any).platforms.getChildren();
            let hasGround = false;
            for (let i = 0; i < platforms.length; i++) {
                const p = platforms[i] as any;
                if (checkX >= p.x - 16 && checkX <= p.x + 16 && checkY >= p.y - 16 && checkY <= p.y + 16) {
                    hasGround = true;
                    break;
                }
            }
            // Bosses now turn at edges too, but only if they are not currently in a jump/slam state.
            // Using Math.abs() threshold to ignore tiny vertical jitters from physics impacts.
            if (!hasGround && (Math.abs(this.body!.velocity.y) < 2)) shouldTurn = true;
        }

        if (shouldTurn) {
           this.movingRight = !this.movingRight;
        }
        if (this.x < 16) { this.x = 800 - 16; }
        if (this.x > 800 - 16) { this.x = 16; }
        this.setVelocityX(this.movingRight ? this.speed : -this.speed);
        this.setFlipX(!this.movingRight);
    }

    public wrapHorizontal() {
        // Wrap around the 800px width canvas
        if (this.x > 820) {
            this.x = -20;
        } else if (this.x < -20) {
            this.x = 820;
        }
    }

    public wrapVertical() {
        // Bosses are very tall, so we use a much deeper threshold to prevent unwanted wrapping during jumps.
        const limit = this.isBoss ? 1000 : 650;
        
        if (this.y > limit) { 
            // ── Iceball Abyss Fix ──
            // If a frozen iceball falls off the bottom, shatter it instead of wrapping infinitely.
            if (this.isFrozenBall) {
                const gs = this.scene as any;
                if (gs && typeof gs.handleEnemyShattered === 'function') {
                    if (!this.getData('isShattering')) {
                        gs.handleEnemyShattered(this, 1);
                    }
                } else {
                    this.destroy(); // Fallback for Level Editor
                }
                return;
            }

            // ── Boss/Enemy Recovery Fix ──
            // If the boss falls off, wrap it back to the bottom arena area (y=500)
            // instead of the top of the screen (-100).
            this.y = this.isBoss ? 500 : -100; 
        }
        if (this.y < -100) { this.y = limit - 50; }
    }

    // Graduated freeze tints — gets icier with each hit
    private static FREEZE_TINTS = [0xffffff,0xddeeff,0xbbddff,0x99ccff,0x7799ff,0x5566ff,0x4455ff,0x3344ee,0x2233cc,0x1122aa];

    public hitByBullet(_bulletVelX?: number) {
        if (this.isFrozenBall) return;
        if (this.isBoss) { SOUNDS.hit(); return; }

        this.freezeLevel++;
        // Graduated freeze color
        const tintIdx = Math.min(this.freezeLevel, Enemy.FREEZE_TINTS.length - 1);
        this.setTint(Enemy.FREEZE_TINTS[tintIdx]);
        SOUNDS.hit();

        // Hit impact shake
        const ox = this.x;
        this.scene.tweens.add({ targets: this, x: ox + (Math.random() > 0.5 ? 5 : -5),
            duration: 35, yoyo: true, onComplete: () => { this.x = ox; } });
        
        // ── Meltdown (Steam/Impact) Visuals ──
        this.lastHitTime = this.scene.time.now;
        this.thawNextTick = this.lastHitTime + this.thawCooldown;

        // Persistent Cold Steam while frozen
        if (!this.steamEmitter && !this.isBoss) {
            try {
                this.steamEmitter = this.scene.add.particles(0, 0, 'bullet', {
                    speed: { min: 10, max: 30 },
                    angle: { min: 240, max: 300 },
                    scale: { start: 0.15, end: 0 },
                    alpha: { start: 0.4, end: 0 },
                    lifespan: 1200,
                    frequency: 150,
                    tint: 0xccffff,
                    follow: this,
                    followOffset: { x: 0, y: -20 }
                });
            } catch {}
        }
        
        if (this.freezeLevel >= this.hitRequirement) {
            this.isFrozenBall = true;
            SOUNDS.freeze();
            
            // Clean up meltdown visuals
            if (this.steamEmitter) { this.steamEmitter.stop(); this.steamEmitter = undefined; }
            this.setAlpha(1);

            // ── Accurate Positioning ──
            // Calculate current bottom pixel before changing origin/texture
            // BasicEnemy(origin 0.5, 1) -> bottom is this.y
            // HeavyEnemy(origin 0.5, 0.5) -> bottom is this.y + displayHeight/2
            const currentBottom = this.y + (1 - this.originY) * this.displayHeight;

            this.setTexture('iceball');
            this.play('iceball-loop');
            this.setDisplaySize(52, 52);
            this.setOrigin(0.5, 0.5); // Center for perfect rotation
            this.setTint(0xffffff);
            
            // Move center so bottom matches old position (52/2 = 26)
            this.y = currentBottom - 26;

            // ── Physics Fix: Suggestion A (Sticky Hitbox) ──
            // Using a rectangular body (wider than 32px) instead of a circle.
            // This provides a flat bottom that "sticks" to platform edges better.
            // 108px texture units result in ~44px world-space width at this scale.
            this.setBodySize(108, 108).setOffset(10, 10);
            if (this.body) {
                (this.body as Phaser.Physics.Arcade.Body).setDragX(200); // Reduced for longer slides
            }
            this.setBounce(0.4, 0.4);
            this.setFriction(0.4, 0.4); // Reduced for smoother sliding
            this.setVelocityX(0);
            
            this.frozenTimer = 10000; // 10 Second Lifetime

            (this.scene as any).checkStageClear();
        }
    }

    public hitByIceball() {
        if (this.isBoss) {
            this.freezeLevel++;
            SOUNDS.crash();
            this.scene.cameras.main.shake(100, 0.05);
            this.setTint(0xff0000);
            this.scene.time.delayedCall(200, () => this.setTint(0xffffff));
            if (this.freezeLevel >= 3) { this.destroy(); }
        } else {
            this.destroy();
        }
    }

    public destroy(fromScene?: boolean) {
        if (this.steamEmitter) {
            this.steamEmitter.stop();
            this.steamEmitter.destroy();
        }
        super.destroy(fromScene);
    }
}

// ─── Basic Enemy ─────────────────────────────────────────────────────
class BasicEnemy extends Enemy {
    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y);
        this.play('enemy-walk');
        
        // ── Visual Setup ──
        // Player is 64x64. Basic enemies now also 64x64 for maximum sharpness.
        this.setDisplaySize(64, 64);
        this.setOrigin(0.5, 1);


        // ── Physics Setup ──
        // Crucial: No body.reset() here! Resetting re-centers the body at (x,y).
        // With origin(0.5, 1), the body's bottom already aligns with our feet.
        // Hitbox optimized for 64x64 scale
        this.setBodySize(36, 64);
        this.setOffset(14, 0); 
    }
}

// ─── Red Enemy ───────────────────────────────────────────────────────
class RedEnemy extends Enemy {
    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y);
        this.setTexture('enemy-red');
        this.speed = 120;
        
        // ── Visual & Physics Standardization ──
        this.setDisplaySize(64, 64);
        this.setOrigin(0.5, 1);
        this.setBodySize(36, 64);
        this.setOffset(14, 0);
    }
    
    preUpdate(time: number, delta: number) {
        if (!this.active || !this.body) return;
        super.preUpdate(time, delta);
        if (!this.active || !this.body) return;
        if (this.isFrozenBall) return; 
        
        if (this.freezeLevel > 0) {
            this.setVelocityX(0);
            return;
        }

        if (this.body!.blocked.down) {
            const blocked = (this.movingRight && this.body!.blocked.right) || (!this.movingRight && this.body!.blocked.left);
            if (blocked) {
                if (Math.random() < 0.7) this.setVelocityY(-450);
                else this.movingRight = !this.movingRight;
            } else if (Math.random() < 0.005) this.setVelocityY(-450);
            if (Math.random() < 0.003) this.movingRight = !this.movingRight;
        }
        this.setVelocityX(this.movingRight ? this.speed : -this.speed);
        this.setFlipX(!this.movingRight);
    }

    hitByIceball() {
        // Red enemy: leave red streak particles
        try {
            const em = this.scene.add.particles(this.x, this.y, 'bullet', {
                speed: { min: 80, max: 200 },
                angle: { min: 0, max: 360 },
                scale: { start: 0.4, end: 0 },
                lifespan: 600,
                quantity: 20,
                tint: 0xff3300,
                blendMode: 'ADD'
            });
            em.explode(20);
        } catch {}
        super.hitByIceball();
    }
}

// ─── Heavy Enemy ─────────────────────────────────────────────────────
class HeavyEnemy extends Enemy {
    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y);
        this.setTint(0x55ff55);
        this.speed = 30;
        this.hitRequirement = 10;
        
        // ── Visual & Physics Standardization ──
        this.setDisplaySize(64, 64);
        this.setOrigin(0.5, 1);
        this.setBodySize(36, 64);
        this.setOffset(14, 0);
    }

    hitByIceball() {
        // Shockwave ring effect
        try {
            const ring = (this.scene as any).add?.graphics();
            if (ring) {
                ring.lineStyle(3, 0x00ff88, 1);
                ring.strokeCircle(this.x, this.y, 10);
                (this.scene as any).tweens?.add({
                    targets: ring,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => ring.destroy()
                });
                // Scale the ring up via repeating draws
                let r = 10;
                const expand = this.scene.time.addEvent({
                    delay: 16, repeat: 20,
                    callback: () => {
                        ring.clear();
                        ring.lineStyle(3, 0x00ff88, ring.alpha || 1);
                        ring.strokeCircle(this.x, this.y, r);
                        r += 10;
                    }
                });
                this.scene.time.delayedCall(350, () => { expand.remove(); ring.destroy(); });
            }
        } catch {}
        super.hitByIceball();
    }
}

// ─── Sniper Enemy ('S') — stays still, fires snowballs at nearest player ─
class SniperEnemy extends Enemy {
    private fireTimer!: Phaser.Time.TimerEvent;
    
    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y);
        this.setTexture('enemy-sniper');
        this.speed = 50; // Now moves!
        this.hitRequirement = 3; // easier to freeze
        
        // ── Visual & Physics Standardization ──
        this.setDisplaySize(64, 64);
        this.setOrigin(0.5, 1);
        this.setBodySize(36, 64);
        this.setOffset(14, 0);

        this.fireTimer = scene.time.addEvent({
            delay: 2500,
            loop: true,
            callback: this.fireSnowball,
            callbackScope: this
        });
    }

    preUpdate(time: number, delta: number) {
        // Base Enemy preUpdate handles patrol logic and vertical wrapping
        super.preUpdate(time, delta);
    }

    private fireSnowball() {
        if (!this.active || this.freezeLevel > 0 || this.isFrozenBall) return;
        const gs = this.scene as GameScene;
        const target = gs.getNearestPlayer(this.x, this.y);
        if (!target) return;

        // ── SENTRY VISION CHECK ──
        // Only fire if the player is in front of where we are ALREADY looking
        const isTargetInFront = !this.flipX ? (target.x > this.x) : (target.x < this.x);
        if (!isTargetInFront) return;

        const fireDirX = !this.flipX ? 1 : -1;

        const spawnY = this.y - 25; 

        // Fire after short delay
        this.scene.time.delayedCall(420, () => {
            if (!this.active || this.freezeLevel > 0 || this.isFrozenBall) return;
            
            const speed = 280;
            const sb = new Snowball(this.scene, this.x, spawnY);
            gs.snowballs.add(sb);
            
            if (sb.body) {
                const body = sb.body as Physics.Arcade.Body;
                body.setAllowGravity(false);
                body.setGravity(0, 0);
                // Use the PRE-LOCKED direction
                body.setVelocity(fireDirX * speed, 0); 
            }
            SOUNDS.sniperShoot();
        });
    }

    hitByIceball() {
        (this.scene as GameScene).triggerAchievement('SNIPER_BUSTER');
        super.hitByIceball();
    }

    destroy(fromScene?: boolean) {
        if (this.fireTimer) this.fireTimer.remove();
        super.destroy(fromScene);
    }
}

// ─── Shield Enemy ('X') — only hittable from behind ───────────────────
class ShieldEnemy extends Enemy {
    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y);
        this.setTexture('enemy-shield');
        this.speed = 60;
        this.hitRequirement = 4;

        // ── Visual & Physics Standardization ──
        this.setDisplaySize(64, 64);
        this.setOrigin(0.5, 1);
        this.setBodySize(36, 64);
        this.setOffset(14, 0);
    }

    hitByBullet(bulletVelX?: number) {
        if (this.isFrozenBall) return;
        if (this.isBoss) return;

        // Shield faces direction of movement
        // Bullet must come from BEHIND — opposite side of facing direction
        const facingRight = this.movingRight;
        const bulletFromRight = (bulletVelX ?? 0) < 0; // negative velX means bullet came from right going left

        const hitFromBehind = (facingRight && bulletFromRight) || (!facingRight && !bulletFromRight);

        if (!hitFromBehind) {
            // Blocked! Flash white shield arc in front
            SOUNDS.shieldBlock();
            this.scene.cameras.main.shake(30, 0.01);
            const shieldGfx = this.scene.add.graphics();
            shieldGfx.lineStyle(4, 0xffffff, 1);
            const arcX = this.x + (this.movingRight ? 20 : -20);
            shieldGfx.strokeCircle(arcX, this.y, 18);
            this.scene.tweens.add({ targets: shieldGfx, alpha: 0, duration: 200,
                onComplete: () => shieldGfx.destroy() });
            this.setTint(0xffffff);
            this.scene.time.delayedCall(100, () => this.setTint(0x4488ff));
            return;
        }

        // Hit from behind — use base freeze/meltdown logic
        super.hitByBullet(bulletVelX);
        if (this.isFrozenBall) {
            (this.scene as GameScene).triggerAchievement('SHIELD_BASH');
        }
    }
}

// ─── Boss Enemy ───────────────────────────────────────────────────────
class BossEnemy extends Enemy {
    private spawnTimer: Phaser.Time.TimerEvent;
    public hp: number;
    public maxHp: number;
    private jumpTimer: Phaser.Time.TimerEvent;
    private rageActive: boolean = false;
    private rageFlicker?: Phaser.Time.TimerEvent;
    private wasJumping: boolean = false;
    
    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y);
        this.isBoss = true;
        this.setTexture('enemy-boss');
        // Texture frame is 1024x1024. Aligning hitbox to the centered high-res ghost.
        this.setSize(600, 912); 
        this.setOffset(212, 112); 
        
        // Use the cleaned texture if available
        if (scene.textures.exists('enemy-boss-clean')) {
            this.setTexture('enemy-boss-clean');
        }

        this.setTint(0x228b22);
        this.setAlpha(1.0);
        this.setBlendMode(Phaser.BlendModes.NORMAL);
        this.speed = 90; 
        this.maxHp = 6;
        this.hp = this.maxHp;
        this.hitRequirement = 999;
        this.spawnTimer = scene.time.addEvent({ delay: 4000, callback: this.spawnMinion, callbackScope: this, loop: true });
        this.jumpTimer  = scene.time.addEvent({ delay: 3500, callback: this.jumpSlam,    callbackScope: this, loop: true });
        this.setOrigin(0.5, 1);
        this.play('boss-idle');
        
        // ── Physics Fix: Bosses are massive and should not be shoved by iceballs or players ──
        this.setImmovable(true);
    }

    spawnMinion() {
        if (!this.active || this.hp <= 0) return;
        const gs = this.scene as GameScene;
        
        // Only spawn if the boss is alone (countActive === 1)
        if (gs.enemies.countActive() > 1) return;

        // Visual Burst Effect
        const burst = gs.add.particles(this.x, this.y - 30, 'bullet', {
            speed: { min: 100, max: 200 },
            angle: { min: 200, max: 340 },
            scale: { start: 0.2, end: 0 },
            lifespan: 400,
            quantity: 10,
            tint: 0x00ffff
        });
        burst.explode(10);

        // Spawn left-bursting minion
        const e1 = new BasicEnemy(gs, this.x - 20, this.y - 20);
        e1.movingRight = false;
        e1.setVelocity(-150, -300); // Burst out and up
        gs.enemies.add(e1);

        // Spawn right-bursting minion
        const e2 = new BasicEnemy(gs, this.x + 20, this.y - 20);
        e2.movingRight = true;
        e2.setVelocity(150, -300); // Burst out and up
        gs.enemies.add(e2);
    }

    jumpSlam() {
        if (!this.active || this.body!.velocity.y !== 0) return;
        // Logic Fix: Threshold adjusted to 450 to match actual floor Y
        if (this.y > 450) {
            this.setVelocityY(-350); // Increased slightly for better impact detection
        }
    }

    preUpdate(time: number, delta: number) {
        if (!this.active || !this.body) return;

        // ── 1. Land Detection (Heavy Slam) ──
        // Only trigger if we had a significant downward velocity (a real jump/fall)
        if (this.body.blocked.down && this.wasJumping) {
            this.wasJumping = false;
            const gs = this.scene as GameScene;
            gs.cameras.main.shake(200, 0.015);
            SOUNDS.crash();
            
            const pts = this.scene.add.particles(this.x, this.y + 40, 'bullet', {
                speed: { min: 60, max: 150 }, angle: { min: 200, max: 340 },
                scale: { start: 0.2, end: 0 }, alpha: { start: 0.8, end: 0 },
                lifespan: 300, quantity: 15, tint: 0xccffff
            });
            pts.explode(15);
        }
        // Requirement: Must be falling with significant speed to arm the land-shake
        // Requirement: Arm the slam detection as soon as we start ascending OR are mid-air
        if (!this.body.blocked.down) {
            this.wasJumping = true;
        }

        super.preUpdate(time, delta);
        if (!this.active || !this.body) return;
        if (this.hp <= 0 || this.isFrozenBall) return;

        // ── Animation Control removed (Boss is static image with pulse) ──

        // ── 6. Scaling Pulse ──
        const intensity = this.rageActive ? 2.0 : 1.0;
        
        // Dynamic Breathing Pulse (Targeting ~128px world size from 1024px source)
        const pulse = 0.13 + Math.sin(time / (600 / intensity)) * 0.005;
        this.setScale(pulse);
    }

    public hitByIceball() {
        if (this.hp <= 0) return;
        this.hp--;
        SOUNDS.bossHit();
        const gs = this.scene as GameScene;
        this.setTint(0xff0000);
        this.scene.time.delayedCall(200, () => this.setTint(0xffffff));
        gs.updateBossUI(this.hp, this.maxHp);

        // ── Rage mode at half HP ──
        if (this.hp <= Math.ceil(this.maxHp / 2) && !this.rageActive) {
            this.rageActive = true;
            this.speed *= 1.6;
            gs.cameras.main.shake(500, 0.01);
            this.rageFlicker = this.scene.time.addEvent({
                delay: 180, loop: true,
                callback: () => {
                    if (!this.active) return;
                    this.setTint(this.tintTopLeft === 0xffffff ? 0xff4400 : 0xffffff);
                }
            });
        }

        if (this.hp <= 0) {
            gs.updateBossUI(0, this.maxHp);
            this.destroy();
            gs.winTheGame();
        }
    }

    destroy(fromScene?: boolean) {
        if (this.spawnTimer)  this.spawnTimer.remove();
        if (this.jumpTimer)   this.jumpTimer.remove();
        if (this.rageFlicker) this.rageFlicker.remove();
        super.destroy(fromScene);
    }
}

// ─── Bullet ───────────────────────────────────────────────────────────
class Bullet extends Physics.Arcade.Sprite {
    public velocityX: number = 0;
    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'bullet');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setCollideWorldBounds(false);
        // ── Elongated bullet (stretch in direction of travel) ──
        this.setDisplaySize(28, 7);
        this.setTint(0xccffff);
    }
    public preUpdate(time: number, delta: number) {
        if (!this.active || !this.body) return;
        super.preUpdate(time, delta);
        if (this.x < -20 || this.x > 820) { this.destroy(); }
    }
}

// ─── GameScene ───────────────────────────────────────────────────────
export class GameScene extends Scene {
  private player1!: Physics.Arcade.Sprite;
  private player2!: Physics.Arcade.Sprite;
  private players!: Physics.Arcade.Group;
  private p1InvulnEndTime: number = 0;
  private p2InvulnEndTime: number = 0;

  // ── Animation state ──

  private p1Pushing: boolean = false;
  private p2Pushing: boolean = false;
  private p1Shooting: boolean = false;  // true while shoot-flash frame is showing
  private p2Shooting: boolean = false;
  
  private wasGrounded1 = false;
  private wasGrounded2 = false;
  private targetScore: number = 0;
  private displayScore: number = 0;
  private comboText!: Phaser.GameObjects.Text;
  private sparkleTimer?: Phaser.Time.TimerEvent;
  private bossBgTimer?: Phaser.Time.TimerEvent;
  private bossHpPulseTween?: Phaser.Tweens.Tween;
  private rapidGlow1!: Phaser.GameObjects.Arc;
  private rapidGlow2!: Phaser.GameObjects.Arc;

  private cursors1!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys2!: any;
  private spaceKey!: Input.Keyboard.Key;
  
  private platforms!: Physics.Arcade.StaticGroup;
  public enemies!: Physics.Arcade.Group;
  private bullets!: Physics.Arcade.Group;
  private items!: Physics.Arcade.Group;
  public snowballs!: Physics.Arcade.Group;
  
  private currentScore: number = 0;
  private currentStage: number = 0;
  private numPlayers: number = 1;
  private p1Lives: number = 3;
  private p2Lives: number = 3;
  private isPaused: boolean = false;
  private isClearing: boolean = false;
  private isChangingScene: boolean = false; // Guard for GameOver/Level transitions
  private p1Invulnerable: boolean = false;
  private p2Invulnerable: boolean = false;
  private customLevelStructure: string[] | null = null;
  private fromEditor: boolean = false;
  private p1IsDead: boolean = false;
  private p2IsDead: boolean = false;
  private p1Spawn: { x: number, y: number } = { x: 400, y: 300 };
  private p2Spawn: { x: number, y: number } = { x: 400, y: 300 };
  
  // Achievement tracking
  private p1HitThisStage: boolean = false;
  private p2HitThisStage: boolean = false;
  private stageStartTime: number = 0;
  private killCount: number = 0;
  private unlockedAchievements: Set<string> = new Set();


  private scoreText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
  private winText!: Phaser.GameObjects.Text;
  private bossHealthBar!: Phaser.GameObjects.Graphics;
  private bossGhostHp: number = 0;
  private bossLabel!: Phaser.GameObjects.Text;
  private bossGhostTween?: Phaser.Tweens.Tween;

  // Parallax layers
  private bgLayer1!: Phaser.GameObjects.TileSprite;
  private bgLayer2!: Phaser.GameObjects.TileSprite;
  private bgLayer3!: Phaser.GameObjects.TileSprite;
  
  // HUD & HP System
  private p1Hp: number = 100;
  private p2Hp: number = 100;
  private p1HpGhost: number = 100;
  private p2HpGhost: number = 100;
  private maxHp: number = 100;
  private hudGraphics!: Phaser.GameObjects.Graphics;
  private p1LifeIcons: Phaser.GameObjects.Image[] = [];
  private p2LifeIcons: Phaser.GameObjects.Image[] = [];
  private p1HeartIcons: Phaser.GameObjects.Image[] = [];
  private p2HeartIcons: Phaser.GameObjects.Image[] = [];
  private p1HpTween?: Phaser.Tweens.Tween;
  private p2HpTween?: Phaser.Tweens.Tween;
  
  // Platforming Feel (Coyote Time & Jump Buffering)
  private p1LastGroundedTime: number = 0;
  private p2LastGroundedTime: number = 0;
  private p1JumpBufferTime: number = 0;
  private p2JumpBufferTime: number = 0;
  private pauseBtn!: Phaser.GameObjects.Image;
  private homeBtn!: Phaser.GameObjects.Image;
  private hudContainer!: Phaser.GameObjects.Container;

  constructor() { super('GameScene'); }

  private applyBossTransparency() {
      const texture = this.textures.get('enemy-boss');
      const source = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      
      // Skip if already processed or invalid
      if (!source || this.textures.exists('enemy-boss-clean')) return;

      const canvas = this.textures.createCanvas('enemy-boss-clean', source.width, source.height);
      if (!canvas) return; // Null check for safety
      
      const ctx = canvas.getContext()!;
      ctx.drawImage(source, 0, 0);

      const imgData = ctx.getImageData(0, 0, source.width, source.height);
      const data = imgData.data;

      // Pixel-perfect keying: Any pixel that is PURE BLACK or extremely dark becomes transparent
      for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Threshold for black/dark colors
          if (r < 10 && g < 10 && b < 10) {
              data[i + 3] = 0; // Set Alpha to 0
          }
      }

      ctx.putImageData(imgData, 0, 0);
      if (canvas && canvas.refresh) canvas.refresh();
  }

  init(data: any) {
    this.isChangingScene = false;
    this.isClearing = false;
    
    this.numPlayers = Number(data.players || this.numPlayers || 1);
    this.p1Lives = data.restart ? 3 : (this.p1Lives || 3);
    this.p2Lives = data.restart ? 3 : (this.p2Lives || 3);
    this.p1IsDead = false;
    this.p2IsDead = false;
    this.isPaused = false;
    this.customLevelStructure = data.customLevel || null;
    this.fromEditor = data.fromEditor || false;
    this.unlockedAchievements = data.restart ? new Set() : (this.unlockedAchievements || new Set());
    this.killCount = data.restart ? 0 : (this.killCount || 0);

    if (data.restart) {
        this.currentScore = 0;
        this.displayScore = 0;
        this.targetScore = 0;
        this.currentStage = 0;
    }
  }

  create() {
    this.cleanupHUD();
    this.applyBossTransparency();

    window.onerror = function(msg, url, line, col, error) {
        const stack = error && error.stack ? error.stack.substring(0, 600) : "No stack trace";
        alert(msg + "\nLine: " + line + "\n" + stack);
        return false;
    };

    // ─── Parallax Background ────────────────────────────────────────
    this.cameras.main.setBackgroundColor('#0a0a1a');
    this.createParallaxBg();

    // Ambient Snow Particles
    this.add.particles(0, -50, 'bullet', {
        x: { min: 0, max: 800 },
        lifespan: 10000,
        speedY: { min: 20, max: 100 },
        speedX: { min: -20, max: 20 },
        scale: { start: 0.1, end: 0.3 },
        quantity: 1,
        frequency: 100,
        blendMode: 'ADD',
        tint: 0xaaffff
    });

    // ── Player Animations (using new 12-frame spritesheet) ──
    // Row 1 (frames 0-5): idle/gun poses with gun
    // Row 2 (frames 6-11): clean walk cycle
    // #1  Single idle frame — no breathing
    this.anims.create({ key: 'idle', frames: this.anims.generateFrameNumbers('player', { start: 0, end: 0 }), frameRate: 1 });
    this.anims.create({ key: 'walk', frames: this.anims.generateFrameNumbers('player', { start: 6, end: 11 }), frameRate: 16, repeat: -1 });
    // jump anim key kept for compatibility, but procedural code sets frames directly
    this.anims.create({ key: 'jump', frames: this.anims.generateFrameNumbers('player', { start: 3, end: 3 }), frameRate: 25 });

    this.anims.create({ key: 'enemy-walk', frames: this.anims.generateFrameNumbers('enemy-basic', { start: 0, end: 0 }), frameRate: 1, repeat: -1 });
    this.anims.create({
        key: 'iceball-loop',
        frames: this.anims.generateFrameNumbers('iceball', { start: 0, end: 5 }),
        frameRate: 12,
        repeat: -1
    });
    this.anims.create({
        key: 'iceball-shatter',
        frames: this.anims.generateFrameNumbers('iceball', { start: 6, end: 10 }),
        frameRate: 20,
        repeat: 0
    });

    // ─── HUD & UI (Direct world-space, no container to avoid transform bugs) ─
    this.hudGraphics = this.add.graphics().setScrollFactor(0).setDepth(200);

    this.scoreText = this.add.text(20, 16, `Score: ${this.currentScore}`, { 
        fontSize: '14px', color: '#ffffff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 
    }).setScrollFactor(0).setDepth(201);

    this.stageText = this.add.text(400, 16, `Stage: ${this.currentStage + 1}`, { 
        fontSize: '14px', color: '#55ff55', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);

    // Hearts: placed directly in world space with fixed scroll
    // P1 Panel starts at 15,15. Height 85.
    // Score at 30,25. Hearts row starts at 30, 58.
    for (let i = 0; i < 5; i++) {
        const p1Heart = this.add.image(30 + i * 28, 58, 'heart', 4)
            .setOrigin(0, 0).setScrollFactor(0).setDepth(202).setVisible(false);
        const p2Heart = this.add.image(560 + i * 28, 58, 'heart', 4)
            .setOrigin(0, 0).setScrollFactor(0).setDepth(202).setVisible(false);
        this.p1HeartIcons.push(p1Heart);
        this.p2HeartIcons.push(p2Heart);
    }

    this.pauseBtn = this.add.image(330, 24, 'icon-pause')
        .setInteractive()
        .setScrollFactor(0)
        .setDepth(201)
        .on('pointerdown', () => {
            SOUNDS.pause();
            if (this.isPaused) {
                this.isPaused = false; this.physics.resume(); this.anims.resumeAll(); this.pauseBtn.setTint(0xffffff);
            } else {
                this.isPaused = true; this.physics.pause(); this.anims.pauseAll(); this.pauseBtn.setTint(0x00ff00);
            }
        })
        .on('pointerover', () => { this.pauseBtn.setScale(1.2); })
        .on('pointerout',  () => { this.pauseBtn.setScale(1.0); });

    this.bossHealthBar = this.add.graphics();
    this.bossHealthBar.setScrollFactor(0).setDepth(100);
    this.bossHealthBar.setVisible(false);

    this.bossLabel = this.add.text(400, 550, 'BOSS', {
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setVisible(false).setDepth(101);

    // ── Combo display (hidden until combo > 1) ──
    this.comboText = this.add.text(400, 70, '', {
        fontSize: '28px', color: '#ff0', fontStyle: 'bold',
        stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(20);

    // ── Rapid fire glow circles removed ──

    const homeIcon = this.fromEditor ? 'icon-editor' : 'icon-home';
    this.homeBtn = this.add.image(470, 24, homeIcon)
        .setInteractive()
        .setScrollFactor(0)
        .setDepth(201)
        .on('pointerdown', () => {
            if (this.fromEditor) this.scene.start('LevelEditorScene');
            else this.scene.start('MenuScene');
        })
        .on('pointerover', () => { this.homeBtn.setScale(1.2).setTint(0xff8888); })
        .on('pointerout',  () => { this.homeBtn.setScale(1.0).clearTint(); });

    TelemetryClient.sendEvent(Api.getUsername() || 'Guest', "LEVEL_STARTED");

    this.platforms = this.physics.add.staticGroup();
    this.enemies   = this.physics.add.group({ runChildUpdate: true });
    this.bullets   = this.physics.add.group({ classType: Bullet });
    this.items     = this.physics.add.group({ classType: PowerUp });
    this.snowballs = this.physics.add.group();
    this.players   = this.physics.add.group();

    // Setup Players via centralized spawn
    this.spawnPlayer(1, 400, 300);
    this.spawnPlayer(2, 400, 300);
    
    if (this.numPlayers === 1) {
        this.player2.setActive(false).setVisible(false);
        if (this.player2.body) this.player2.body.enable = false;
    }

    // Colliders (Omega Respawn: Using Group)
    this.physics.add.collider(this.players, this.platforms);
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.collider(this.items, this.platforms);
    
    // ── Player vs Enemies ──
    // 1. Physical Collider: Only for Frozen Iceballs (allows pushing/standing)
    this.physics.add.collider(this.players, this.enemies, (p, e) => {
        const enemy   = e as Enemy;
        const pSprite = p as Physics.Arcade.Sprite;
        const pIndex  = pSprite === this.player1 ? 1 : 2;

        if (enemy.isFrozenBall) {
            if (!enemy.body) return;
            const dirX = pSprite.x < enemy.x ? 1 : -1;
            enemy.setVelocityX(dirX * 450);
            enemy.setVelocityY(-150);
            SOUNDS.shoot();
            
            if (pIndex === 1) {
                this.p1Pushing = true;
                this.time.delayedCall(150, () => this.p1Pushing = false);
            } else {
                this.p2Pushing = true;
                this.time.delayedCall(150, () => this.p2Pushing = false);
            }
        }
    }, (p, e) => {
        // ONLY collide physically if it's an iceball. 
        // Active enemies (and Boss) will pass through via the Overlap below.
        return (e as Enemy).isFrozenBall;
    });

    // 2. Damage Overlap: For Active Enemies & Bosses (prevents "stuck" states)
    this.physics.add.overlap(this.players, this.enemies, (p, e) => {
        const enemy = e as Enemy;
        if (enemy.isFrozenBall) return; // Handled by collider
        
        const pSprite = p as Physics.Arcade.Sprite;
        const pIndex  = pSprite === this.player1 ? 1 : 2;

        if (enemy.freezeLevel === 0 || enemy.isBoss) {
            this.handlePlayerHit(pIndex);
        }
    });

    // Items vs Players
    this.physics.add.overlap(this.players, this.items, (p, i) => {
        const pSprite = p as Physics.Arcade.Sprite;
        const pIndex = pSprite === this.player1 ? 1 : 2;
        this.collectItem(pIndex, i as PowerUp);
    });

    // Snowballs vs Players
    this.physics.add.overlap(this.snowballs, this.players, (sb, p) => {
        const snowball = sb as Snowball;
        const pSprite = p as Physics.Arcade.Sprite;
        if (!snowball.active || snowball.hasHit) return;
        snowball.hasHit = true;
        snowball.destroy();
        const pIndex = pSprite === this.player1 ? 1 : 2;
        this.handlePlayerHit(pIndex);
    });
    
    // Projectiles vs Environment (Destroy on impact)
    this.physics.add.overlap(this.bullets, this.platforms, (b, _plat) => {
        const bullet = b as Bullet;
        if (!bullet.active) return;
        // Impact spark
        const pts = this.add.particles(bullet.x, bullet.y, 'bullet', {
            speed: 50, scale: { start: 0.15, end: 0 }, lifespan: 200, quantity: 4, tint: 0xaaffff
        });
        pts.explode(4);
        bullet.destroy();
    });

    this.physics.add.overlap(this.snowballs, this.platforms, (_s, _plat) => {
        const snowball = _s as Snowball;
        if (!snowball.active) return;
        // Impact effect
        const pts = this.add.particles(snowball.x, snowball.y, 'bullet', {
            speed: 40, scale: { start: 0.1, end: 0 }, lifespan: 150, quantity: 3, tint: 0xaaffff
        });
        pts.explode(3);
        snowball.destroy();
    });

    // Bullets vs Enemies
    this.physics.add.overlap(this.bullets, this.enemies, (b, e) => {
        const bullet = b as Bullet;
        const enemy  = e as Enemy;
        if (!bullet.active || !enemy.active) return;
        
        const velX = bullet.velocityX;
        // ── Impact spark ──
        const sparkDir = velX > 0 ? { min: 120, max: 240 } : { min: -60, max: 60 };
        const spark = this.add.particles(bullet.x, bullet.y, 'bullet', {
            speed: { min: 40, max: 100 }, angle: sparkDir,
            scale: { start: 0.18, end: 0 }, lifespan: 220, quantity: 6,
            tint: 0xaaffff, blendMode: 'ADD'
        });
        spark.explode(6);
        bullet.destroy();
        enemy.hitByBullet(velX);
    });

    // Bullets vs Snowballs (Defensive shooting)
    this.physics.add.overlap(this.bullets, this.snowballs, (b, s) => {
        const bullet = b as Bullet;
        const sb = s as Snowball;
        if (!bullet.active || !sb.active) return;
        bullet.destroy();
        sb.destroy();

        SOUNDS.hit();
        // Tiny impact spark
        const pts = this.add.particles(sb.x, sb.y, 'bullet', {
            speed: 50, scale: { start: 0.2, end: 0 }, lifespan: 200, quantity: 4
        });
        pts.explode(4);
    });

    // Enemy vs Enemy (iceball kills)
    this.physics.add.collider(this.enemies, this.enemies, (e1, e2) => {
        const enemy1 = e1 as Enemy;
        const enemy2 = e2 as Enemy;

        if (enemy1.getData('isShattering') || enemy2.getData('isShattering')) return;

        // ── Boss Crush Logic ──
        // If one is a boss and is landing/overlapping an iceball from above, shatter it.
        const bossCrush1 = enemy1.isBoss && enemy2.isFrozenBall && (enemy1.body!.velocity.y > 10 || enemy1.y < enemy2.y - 10);
        const bossCrush2 = enemy2.isBoss && enemy1.isFrozenBall && (enemy2.body!.velocity.y > 10 || enemy2.y < enemy1.y - 10);
        
        if (bossCrush1 || bossCrush2) {
            const victim = bossCrush1 ? enemy2 : enemy1;
            if (!victim.getData('isShattering')) {
                this.handleEnemyShattered(victim, 1);
                SOUNDS.crash();
            }
            return;
        }

        if (enemy1.isFrozenBall && enemy2.isFrozenBall) {
            // Mutual iceball shatter
            this.handleEnemyShattered(enemy1, 1);
            this.handleEnemyShattered(enemy2, 1);
            SOUNDS.crash();
        } else if (enemy1.isFrozenBall && Math.abs(enemy1.body!.velocity.x) > 50 && !enemy2.isFrozenBall) {
            this.handleEnemyShattered(enemy2, enemy1.comboMultiplier);
            this.handleEnemyShattered(enemy1, 1); // Mutual shatter: iceball also breaks
        } else if (enemy2.isFrozenBall && Math.abs(enemy2.body!.velocity.x) > 50 && !enemy1.isFrozenBall) {
            this.handleEnemyShattered(enemy1, enemy2.comboMultiplier);
            this.handleEnemyShattered(enemy2, 1); // Mutual shatter: iceball also breaks
        }
    }, (e1, e2) => {
        const enemy1 = e1 as Enemy;
        const enemy2 = e2 as Enemy;

        // ── Physical Collision Conditions ──
        // 1. Both are frozen: Collide to prevent stacking/clumping.
        if (enemy1.isFrozenBall && enemy2.isFrozenBall) return true;

        // 2. Boss vs Iceball: Bosses must collide to trigger 'Crush' logic.
        if ((enemy1.isBoss && enemy2.isFrozenBall) || (enemy2.isBoss && enemy1.isFrozenBall)) return true;

        // 3. Moving Iceball vs Enemy: Must collide to trigger 'Kill' logic.
        const isE1MovingBall = enemy1.isFrozenBall && Math.abs(enemy1.body!.velocity.x) > 50;
        const isE2MovingBall = enemy2.isFrozenBall && Math.abs(enemy2.body!.velocity.x) > 50;
        if (isE1MovingBall || isE2MovingBall) return true;

        // 4. Otherwise: Ghostly Walk-Through (Active enemies pass through static balls).
        return false;
    });

    // Inputs
    if (this.input.keyboard) {
        this.cursors1 = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Input.Keyboard.KeyCodes.SPACE);
        this.keys2    = this.input.keyboard.addKeys('W,A,S,D,F');
    }

    this.spaceKey.on('down', () => {
        if (!this.isPaused && this.player1.active) this.fireBullet(this.player1);
    });
    this.input.keyboard?.on('keydown-F', () => {
        if (this.numPlayers === 2 && !this.isPaused && this.player2.active) this.fireBullet(this.player2);
    });

    this.loadLevel(this.currentStage);
  }

  // ─── Parallax Background ──────────────────────────────────────────
  private createParallaxBg() {
    // 3-Layer Seamless Background System with Dark Tint
    this.cameras.main.setBackgroundColor(0x050510);
    
    this.bgLayer1 = this.add.tileSprite(0, 0, 800, 600, 'bg-cavern-far')
        .setOrigin(0, 0).setScrollFactor(0).setDepth(-3).setTint(0x444444);
    
    this.bgLayer2 = this.add.tileSprite(0, 0, 800, 600, 'bg-cavern-mid')
        .setOrigin(0, 0).setScrollFactor(0).setDepth(-2).setTint(0x555555);
        
    this.bgLayer3 = this.add.tileSprite(0, 0, 800, 600, 'bg-cavern-near')
        .setOrigin(0, 0).setScrollFactor(0).setDepth(-1).setTint(0x666666);

    // Adjust scales to ensure full screen coverage if needed
    [this.bgLayer1, this.bgLayer2, this.bgLayer3].forEach(layer => {
        layer.setDisplaySize(800, 600);
    });
  }

  // ─── Nearest player helper (for sniper) ───────────────────────────
  public getNearestPlayer(x: number, y: number): Physics.Arcade.Sprite | null {
    const p1Active = this.player1.active && this.player1.visible;
    const p2Active = this.numPlayers === 2 && this.player2.active && this.player2.visible;
    if (!p1Active && !p2Active) return null;
    if (!p1Active) return this.player2;
    if (!p2Active) return this.player1;
    const d1 = Phaser.Math.Distance.Between(x, y, this.player1.x, this.player1.y);
    const d2 = Phaser.Math.Distance.Between(x, y, this.player2.x, this.player2.y);
    return d1 < d2 ? this.player1 : this.player2;
  }

  // ─── Achievements ─────────────────────────────────────────────────
  public async triggerAchievement(key: string) {
    if (this.unlockedAchievements.has(key)) return;
    this.unlockedAchievements.add(key);
    const result = await AchievementsApi.unlock(key);
    if (result?.isNew) {
        SOUNDS.achievement();
        this.showAchievementBanner(result.icon, result.title, result.description);
    }
  }

  private showAchievementBanner(icon: string, title: string, desc: string) {
    const banner = this.add.container(400, -60);
    const bg = this.add.rectangle(0, 0, 380, 50, 0x000000, 0.85);
    bg.setStrokeStyle(2, 0xffe600);
    const text = this.add.text(-170, -8, `${icon} ACHIEVEMENT: ${title}`, { fontSize: '14px', color: '#ffe600', fontStyle: 'bold' });
    const sub  = this.add.text(-170, 10, desc, { fontSize: '11px', color: '#aaa' });
    banner.add([bg, text, sub]);
    banner.setDepth(100);

    this.tweens.add({
        targets: banner,
        y: 70, duration: 400, ease: 'Back.Out',
        onComplete: () => {
            this.time.delayedCall(2500, () => {
                this.tweens.add({ targets: banner, y: -80, alpha: 0, duration: 300, onComplete: () => banner.destroy() });
            });
        }
    });
  }

  // ─── Hit Freeze ───────────────────────────────────────────────────
  private hitFreeze(ms: number = 67) { // ~4 frames at 60fps
    this.physics.pause();
    this.time.delayedCall(ms, () => { if (!this.isPaused) this.physics.resume(); });
  }

  public handleEnemyShattered(victim: Enemy, combo: number) {
    if (victim.isBoss) { victim.hitByIceball(); return; }
    if (victim.getData('isShattering')) return;
    victim.setData('isShattering', true);
    
    // Immediately disable body to prevent recursive collision crashes
    if (victim.body) victim.body.enable = false;

    // Play shatter animation before removal
    victim.isFrozenBall = true;
    victim.setVelocity(0, 0);
    victim.setTexture('iceball');
    victim.setDisplaySize(64, 64); // Slightly larger for shatter impact
    victim.play('iceball-shatter');
    victim.once('animationcomplete', () => victim.destroy());

    this.playJuice(victim.x, victim.y);
    this.addScore(100 * combo, victim.x, victim.y - 20);
    this.hitFreeze();

    // ── Combo counter pop ──
    if (combo > 1) {
        this.comboText.setText(`${combo}x COMBO!`);
        this.comboText.setAlpha(1).setScale(1.8);
        this.tweens.add({ targets: this.comboText, scale: 1, alpha: 0,
            duration: 900, ease: 'Cubic.Out' });
    }

    this.killCount++;
    if (this.killCount === 1) this.triggerAchievement('FIRST_BLOOD');
    if (combo >= 10) this.triggerAchievement('COMBO_KING');

    const item = new PowerUp(this, victim.x, victim.y, 'health');
    this.items.add(item);
    this.checkStageClear();
  }

  private collectItem(playerIndex: number, item: PowerUp) {
    item.destroy();
    SOUNDS.coin();

    if (item.type === 'health') {
        const isP1 = playerIndex === 1;
        let hp = isP1 ? this.p1Hp : this.p2Hp;

        if (hp < 100) {
            hp = Math.min(hp + 25, 100);
            if (isP1) this.p1Hp = hp; else this.p2Hp = hp;
        } else {
            // Heart pickup at full health adds an extra life (max 5)
            if (isP1 && this.p1Lives < 5) {
                this.p1Lives++;
                this.p1Hp = 25;
            } else if (!isP1 && this.p2Lives < 5) {
                this.p2Lives++;
                this.p2Hp = 25;
            }
        }

        const pSprite = isP1 ? this.player1 : this.player2;
        this.tweens.add({ targets: pSprite, scale: 0.6, duration: 100, yoyo: true });
        return;
    }
  }

  private fireBullet(player: Physics.Arcade.Sprite) {
    if (!player || !player.active) return;
    // Spawn bullet at gun height (≈22px above feet on the 48px sprite)
    const bulletY = player.y - 22;
    const bullet = new Bullet(this, player.x, bulletY);
    this.bullets.add(bullet);
    const facingRight = !player.flipX;
    const vel = 400;
    const vx = facingRight ? vel : -vel;
    bullet.velocityX = vx;
    bullet.setVelocityX(vx);
    bullet.setFlipX(!facingRight); // face direction of travel
    (bullet.body as Physics.Arcade.Body).setAllowGravity(false);
    SOUNDS.shoot();
    // #2  Shoot flash — snap to frame 5 (gun-extended pose) for 110ms
    const isP1 = player === this.player1;
    if (isP1) {
        this.p1Shooting = true;
        // Only stop anim and force frame if NOT walking/moving
        const isMoving = Math.abs(player.body?.velocity.x || 0) > 10;
        if (!isMoving) {
            if (player.anims) player.anims.stop();
            player.setFrame(5);
        }
        this.time.delayedCall(110, () => {
            this.p1Shooting = false;
            if (player.anims && !player.anims.isPlaying) {
                if (player.body?.blocked.down && Math.abs(player.body.velocity.x) > 10)
                    player.anims.play('walk', true);
                else
                    player.anims.play('idle', true);
            }
        });
    } else {
        this.p2Shooting = true;
        const isMoving = Math.abs(player.body?.velocity.x || 0) > 10;
        if (!isMoving) {
            if (player.anims) player.anims.stop();
            player.setFrame(5);
        }
        this.time.delayedCall(110, () => {
            this.p2Shooting = false;
            if (player.anims && !player.anims.isPlaying) {
                if (player.body?.blocked.down && Math.abs(player.body.velocity.x) > 10)
                    player.anims.play('walk', true);
                else
                    player.anims.play('idle', true);
            }
        });
    }
    // ── Shoot recoil ──
    const recoilDir = facingRight ? -4 : 4;
    const origX = player.x;
    this.tweens.add({ targets: player, x: origX + recoilDir, duration: 50, yoyo: true,
        onComplete: () => player.setX(origX) });
        
    TelemetryClient.sendEvent(Api.getUsername() || 'Guest', "SHOT_FIRED");
  }

  private spawnPlayer(index: number, x: number, y: number) {
      const p = this.physics.add.sprite(x, y, 'player');
      p.setDisplaySize(64, 64).setCollideWorldBounds(false).setOrigin(0.5, 1);
      
      // Hitbox widened to 42 for stability.
      // Offset adjusted to sink the feet by exactly 4 pixels (restoring the classic grounded look).
      p.setBodySize(42, 58).setOffset(11, 2);
      p.setDepth(1000); 
      
      if (index === 1) {
          this.player1 = p;
      } else {
          this.player2 = p;
          p.setTint(0x00ffff);
      }
      this.players.add(p);
      return p;
  }

  private respawnPlayer(index: number) {
      const oldPlayer = index === 1 ? this.player1 : this.player2;
      const rx = oldPlayer.x;
      const ry = oldPlayer.y;
      
      // Omega-Max: Total object cleanup
      this.tweens.killTweensOf(oldPlayer);
      oldPlayer.destroy();
      
      const newPlayer = this.spawnPlayer(index, rx, ry);
      
      // Start invulnerability grace period (1.5s)
      if (index === 1) {
          this.p1Invulnerable = true;
          this.p1InvulnEndTime = this.time.now + 1500;
      } else {
          this.p2Invulnerable = true;
          this.p2InvulnEndTime = this.time.now + 1500;
      }
  }

  private handlePlayerHit(playerIndex: number) {
    if (this.isChangingScene || this.isClearing) return;
    const isInvuln = playerIndex === 1 ? this.p1Invulnerable : this.p2Invulnerable;
    if (isInvuln) return;

    if (playerIndex === 1) {
        this.p1HitThisStage = true;
        this.p1Hp = 0; // 1 Hit = 1 Life Lost
        
        // Grant i-frames on every hit to prevent instant multi-frame death
        this.p1Invulnerable = true;
        this.p1InvulnEndTime = this.time.now + 1500;

        if (this.p1Hp <= 0) {
            if (this.p1Lives > 1) {
                this.p1Lives--;
                this.p1Hp = 100;
                this.respawnPlayer(1);
            } else {
                this.p1Lives = 0;
                this.p1IsDead = true;
                this.player1.setActive(false).setVisible(false);
                if (this.player1.body) this.player1.body.enable = false;
            }
        }
    } else {
        this.p2HitThisStage = true;
        this.p2Hp = 0; // 1 Hit = 1 Life Lost

        // Grant i-frames on every hit to prevent instant multi-frame death
        this.p2Invulnerable = true;
        this.p2InvulnEndTime = this.time.now + 1500;

        if (this.p2Hp <= 0) {
            if (this.p2Lives > 1) {
                this.p2Lives--;
                this.p2Hp = 100;
                this.respawnPlayer(2);
            } else {
                this.p2Lives = 0;
                this.p2IsDead = true;
                this.player2.setActive(false).setVisible(false);
                if (this.player2.body) this.player2.body.enable = false;
            }
        }
    }

    SOUNDS.playerHit();
    this.cameras.main.shake(80, 0.012);
    
    // ── ATOMIC GAME OVER CHECK ──
    const p1Out = this.p1IsDead;
    const p2Out = (this.numPlayers < 2) || this.p2IsDead;
    
    if (p1Out && p2Out && !this.isChangingScene) {
        this.isChangingScene = true;
        TelemetryClient.sendEvent(Api.getUsername() || 'Guest', "GAME_OVER");
        
        this.time.delayedCall(800, () => {
            this.scene.start('GameOverScene', { 
                score: this.currentScore,
                customLevel: this.customLevelStructure,
                players: this.numPlayers,
                fromEditor: this.fromEditor
            });
        });
        return;
    }
  }

  private loadLevel(index: number) {
    this.p1IsDead = false;
    this.p2IsDead = false;
    this.isChangingScene = false;
    this.isClearing = false;
    this.platforms.clear(true, true);
    this.enemies.clear(true, true);
    this.bullets.clear(true, true);
    this.items.clear(true, true);
    this.snowballs.clear(true, true);
    if (this.sparkleTimer) { this.sparkleTimer.remove(); this.sparkleTimer = undefined; }
    if (this.bossBgTimer)  { this.bossBgTimer.remove();  this.bossBgTimer  = undefined; }

    // Reset Boss UI state
    if (this.bossLabel) this.bossLabel.setVisible(false);
    this.bossHealthBar.clear();
    this.bossGhostHp = 0;
    if (this.bossGhostTween) { this.bossGhostTween.stop(); this.bossGhostTween = undefined; }

    // Reset Player HP
    this.p1Hp = 100;
    this.p2Hp = 100;
    this.p1HpGhost = 100;
    this.p2HpGhost = 100;
    if (this.p1HpTween) { this.p1HpTween.stop(); this.p1HpTween = undefined; }
    if (this.p2HpTween) { this.p2HpTween.stop(); this.p2HpTween = undefined; }

    if (this.player1.body) this.player1.setVelocity(0, 0);
    if (this.player2.body) this.player2.setVelocity(0, 0);
    // REMOVED setPosition(-200) holding - it causes vanished players on early exit
    this.p1HitThisStage = false;
    this.p2HitThisStage = false;
    this.stageStartTime = this.time.now;

    const grid = this.customLevelStructure ? this.customLevelStructure : LEVELS[index];
    if (!this.customLevelStructure && index >= LEVELS.length) { this.winTheGame(); return; }

    const isBossStage = !this.customLevelStructure && index === LEVELS.length - 1;

    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            const char = grid[r][c];
            const x = c * 32 + 16;
            const y = r * 32 + 32; // Grounded to the bottom of the tile

            if (char === '=') {
                const p = this.platforms.create(x, y, 'platform');
                p.setDisplaySize(32, 32).refreshBody();
            } else if (char === 'E') { this.enemies.add(new BasicEnemy(this, x, y)); }
            else if (char === 'R')   { this.enemies.add(new RedEnemy(this, x, y)); }
            else if (char === 'J')   { this.enemies.add(new HeavyEnemy(this, x, y)); }
            else if (char === 'S')   { this.enemies.add(new SniperEnemy(this, x, y)); }
            else if (char === 'X')   { this.enemies.add(new ShieldEnemy(this, x, y)); }
            else if (char === 'B') {
                const b = new BossEnemy(this, x, y);
                this.enemies.add(b);
                this.updateBossUI(b.maxHp, b.maxHp);
            } else if (char === 'P' || char === '1') {
                // If map uses 'P1' it might trigger twice; check next char
                const nextChar = grid[r][c+1] || '';
                if (char === 'P' && nextChar === '2') continue; // Move to '2' handler
                this.p1Spawn = { x, y };
                this.player1.setPosition(x, y).setVisible(true).setActive(true);
                if (this.player1.body) this.player1.body.enable = true;
                this.triggerSpawnEffect(x, y);
            }
            else if (char === '2') { 
                if (this.numPlayers > 1) {
                    this.p2Spawn = { x, y };
                    this.player2.setPosition(x, y).setVisible(true).setActive(true); 
                    if (this.player2.body) this.player2.body.enable = true;
                    this.triggerSpawnEffect(x, y);
                } else {
                    // Solo mode: Ensure P2 is absolutely gone
                    this.player2.setPosition(-2000, -2000).setVisible(false).setActive(false);
                    if (this.player2.body) this.player2.body.enable = false;
                }
            }
        }
    }
    
    // ── Final Safety Pass ──
    this.player1.setVisible(true);
    if (this.numPlayers === 1) this.player2.setVisible(false);
    
    this.stageText.setText(`Stage: ${this.currentStage + 1}`);

    // ── Start-of-Stage Grace Period ──
    // Grant 1.5s invulnerability to prevent instant hits upon spawning
    this.p1Invulnerable = true;
    this.p1InvulnEndTime = this.time.now + 1500;
    this.player1.setTint(0xffcc00); // Ironclad Gold Tint
    
    if (this.numPlayers === 2) {
        this.p2Invulnerable = true;
        this.p2InvulnEndTime = this.time.now + 1500;
        this.player2.setTint(0xffcc00); // Ironclad Gold Tint
    }

    // Cleanup tint after invulnerability
    this.time.delayedCall(1500, () => {
        if (this.player1.active) this.player1.clearTint();
        if (this.player2.active) this.player2.clearTint();
    });

    // ── Platform frost sparkles ──
    this.sparkleTimer = this.time.addEvent({
        delay: 1800, loop: true,
        callback: () => {
            const plats = this.platforms.getChildren();
            if (!plats.length) return;
            const plat = plats[Math.floor(Math.random() * plats.length)] as any;
            const em = this.add.particles(
                plat.x + (Math.random() - 0.5) * 24, plat.y - 6, 'bullet', {
                    speed: { min: 8, max: 30 }, angle: { min: 210, max: 330 },
                    scale: { start: 0.12, end: 0 }, lifespan: 750, quantity: 3,
                    tint: 0xaaffff, blendMode: 'ADD'
                });
            em.explode(3);
        }
    });

    // ── Boss stage: pulsing red background ──
    if (isBossStage) {
        let redOn = false;
        this.bossBgTimer = this.time.addEvent({
            delay: 900, loop: true,
            callback: () => {
                redOn = !redOn;
                this.cameras.main.setBackgroundColor(redOn ? '#150308' : '#0a0a1a');
            }
        });
    }
  }

  public updateBossUI(hp: number, maxHp: number) {
    const gs = this;
    if (this.bossGhostHp === 0 || hp >= maxHp) {
      this.bossGhostHp = maxHp;
    }

    if (this.bossLabel) this.bossLabel.setVisible(hp > 0);

    // Trigger ghosting decay if HP dropped
    if (this.bossGhostHp > hp) {
      if (this.bossGhostTween) this.bossGhostTween.stop();
      this.bossGhostTween = this.tweens.add({
        targets: this,
        bossGhostHp: hp,
        delay: 400, // Wait a bit after hit for impact
        duration: 800,
        ease: 'Power2',
        onUpdate: () => this.renderBossHealth(hp, maxHp)
      });
    }

    this.renderBossHealth(hp, maxHp);
  }

  private renderBossHealth(hp: number, maxHp: number) {
    const g = this.bossHealthBar;
    g.clear();

    if (hp <= 0 && this.bossGhostHp <= 0) {
      g.setVisible(false);
      if (this.bossLabel) this.bossLabel.setVisible(false);
      return;
    }
    g.setVisible(true);

    const bx = 150, by = 570, bw = 500, bh = 20;

    // 1. Shadow / Outer Glow
    g.fillStyle(0x000000, 0.5);
    g.fillRect(bx - 4, by - 4, bw + 8, bh + 8);

    // 2. Main Container background
    g.fillStyle(0x222222, 0.9);
    g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);

    // 3. Ghost damage bar (behind main)
    if (this.bossGhostHp > hp) {
      const gPct = this.bossGhostHp / maxHp;
      g.fillStyle(0xffffff, 0.6); // White ghosting for max contrast
      g.fillRect(bx, by, bw * gPct, bh);
    }

    // 4. Actual Health Bar
    const pct = hp / maxHp;
    let color = 0x00ff00;
    if (pct <= 0.25) color = 0xff0000;
    else if (pct <= 0.5) color = 0xffff00;

    g.fillStyle(color, 1);
    g.fillRect(bx, by, bw * pct, bh);

    // 5. Segmented Overlay (Arcade feel)
    g.lineStyle(1, 0x000000, 0.3);
    const segmentWidth = bw / maxHp;
    for (let i = 1; i < maxHp; i++) {
        g.lineBetween(bx + i * segmentWidth, by, bx + i * segmentWidth, by + bh);
    }

    // 6. Polished Border
    g.lineStyle(2, 0xffffff, 1);
    g.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);

    // 7. Inner highlight/glass effect
    g.fillStyle(0xffffff, 0.1);
    g.fillRect(bx, by, bw * Math.max(pct, this.bossGhostHp/maxHp), bh / 2);

    // Update Label position
    if (this.bossLabel) {
        this.bossLabel.setPosition(bx + bw/2, by - 15);
        this.bossLabel.setVisible(true);
    }
  }

  public winTheGame() {
    if (this.isChangingScene) return;
    this.isChangingScene = true;
    
    // Total Physics & Logic Freeze
    this.physics.pause();
    this.enemies.getChildren().forEach(e => {
        if (e.body) (e.body as any).enable = false;
    });
    
    SOUNDS.victory();
    // Only trigger BOSS_SLAYER if we are in the actual boss stage of the campaign
    if (!this.customLevelStructure && this.currentStage >= LEVELS.length - 1) {
        this.triggerAchievement('BOSS_SLAYER');
    }
    
    // Create 'YOU WIN' text only if it doesn't exist
    if (!this.winText && !this.fromEditor) {
        this.winText = this.add.text(400, 300, 'YOU WIN!', { 
            fontSize: '64px', color: '#ff0', fontStyle: 'bold', stroke: '#000', strokeThickness: 6 
        }).setOrigin(0.5).setDepth(2000);
    }
    this.time.delayedCall(1500, () => {
        if (this.fromEditor) {
            this.scene.restart({
                restart: true,
                customLevel: this.customLevelStructure,
                players: this.numPlayers,
                fromEditor: true
            });
        } else {
            this.scene.start('WinScene', { 
                score: this.currentScore, 
                players: this.numPlayers 
            });
        }
    });
  }

  public checkStageClear() {
    if (this.isClearing || this.isChangingScene) return;
    let activeEnemies = 0;
    this.enemies.getChildren().forEach(e => {
        if (!(e as Enemy).isFrozenBall && e.active) activeEnemies++;
    });
    if (activeEnemies === 0) {
        this.isClearing = true;
        SOUNDS.coin();

        // Check achievements
        if (!this.p1HitThisStage && (!this.numPlayers || !this.p2HitThisStage))
            this.triggerAchievement('UNTOUCHABLE');
        const elapsed = (this.time.now - this.stageStartTime) / 1000;
        if (elapsed < 30) this.triggerAchievement('SPEEDRUNNER');

        // ── Stage clear cinematic: slow-mo + white flash + camera zoom ──
        this.physics.world.timeScale = 0.25; // 0.25x speed (slow-mo)
        const flash = this.add.rectangle(400, 288, 800, 576, 0xffffff, 0).setDepth(50);
        this.tweens.add({ targets: flash, alpha: 0.7, duration: 200, yoyo: true,
            onComplete: () => flash.destroy() });
        this.cameras.main.zoomTo(1.25, 400, 'Sine.easeOut');
        this.time.delayedCall(600, () => {
            this.cameras.main.zoomTo(1.0, 300, 'Sine.easeIn');
            this.physics.world.timeScale = 1.0;
        });

        if (this.customLevelStructure) {
            this.time.delayedCall(2000, () => {
                if (this.isChangingScene) return;
                this.winTheGame();
            });
            return;
        }

        this.currentStage++;
        this.time.delayedCall(2000, () => { 
            if (this.isChangingScene) return;
            this.isClearing = false; 
            this.loadLevel(this.currentStage); 
        });
    }
  }

  private playJuice(x: number, y: number) {
    this.cameras.main.shake(150, 0.02);
    SOUNDS.crash();
    const pts = this.add.particles(x, y, 'bullet', {
        speed: { min: -100, max: 100 }, angle: { min: 0, max: 360 },
        scale: { start: 0.5, end: 0 }, lifespan: 800, quantity: 15, blendMode: 'ADD'
    });
    pts.explode(15);
  }

  private addScore(points: number, x?: number, y?: number) {
    this.targetScore += points;
    // Score rolls up in update()
    if (x && y) {
        const floatText = this.add.text(x, y, `+${points}`, {
            fontSize: '22px', color: '#ff0', fontStyle: 'bold', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5);
        this.tweens.add({ targets: floatText, y: y - 55, alpha: 0, duration: 1000,
            onComplete: () => floatText.destroy() });
    }
    signalRClient.sendScore(this.targetScore);
  }

  update(_time: number, delta: number) {
    if (this.isPaused) return;

    // ── Score roll ──
    if (this.displayScore < this.targetScore) {
        this.displayScore = Math.min(this.displayScore + Math.ceil((this.targetScore - this.displayScore) * 0.12 + 1), this.targetScore);
        this.currentScore = this.displayScore;
        this.scoreText.setText(`Score: ${this.displayScore}`);
    }

    // Parallax scroll
    if (this.bgLayer1) this.bgLayer1.tilePositionX += 0.05;
    if (this.bgLayer2) this.bgLayer2.tilePositionX += 0.15;
    if (this.bgLayer3) this.bgLayer3.tilePositionX += 0.35;

    this.wasGrounded1 = !!this.player1.body?.blocked.down;
    if (this.wasGrounded1) this.p1LastGroundedTime = _time;

    if (this.numPlayers === 2) {
        this.wasGrounded2 = !!this.player2.body?.blocked.down;
        if (this.wasGrounded2) this.p2LastGroundedTime = _time;
    }

    this.updatePlayer(this.player1, this.cursors1, _time);
    if (this.numPlayers === 2) this.updatePlayer(this.player2, this.keys2, _time);

    this.updateHUD();
  }

  private updateHUD() {
    // Sync ghost HP (trailing effect)
    this.syncGhostHP(1, this.p1Hp);
    if (this.numPlayers === 2) this.syncGhostHP(2, this.p2Hp);
    
    this.renderHUD();
  }

  private syncGhostHP(playerIndex: number, currentHp: number) {
    const isP1 = playerIndex === 1;
    const ghost = isP1 ? this.p1HpGhost : this.p2HpGhost;
    let tween = isP1 ? this.p1HpTween : this.p2HpTween;

    if (ghost > currentHp && !tween) {
        const newTween = this.tweens.add({
            targets: this,
            [isP1 ? 'p1HpGhost' : 'p2HpGhost']: currentHp,
            delay: 500,
            duration: 800,
            ease: 'Power2',
            onComplete: () => {
                if (isP1) this.p1HpTween = undefined;
                else this.p2HpTween = undefined;
            }
        });
        if (isP1) this.p1HpTween = newTween;
        else this.p2HpTween = newTween;
    } else if (currentHp > ghost) {
        // Instant sync on heal
        if (isP1) this.p1HpGhost = currentHp;
        else this.p2HpGhost = currentHp;
    }
  }

  private renderHUD() {
    const g = this.hudGraphics;
    g.clear();

    const p1Visible = this.player1 && this.player1.active && !this.p1IsDead;
    const p2Visible = this.numPlayers >= 2 && this.player2 && this.player2.active && !this.p2IsDead;

    if (p1Visible) {
        this.drawPlayerHUD(1, 15, 15, this.p1Hp, this.p1HpGhost, this.p1InvulnEndTime, this.p1Lives);
    }

    if (p2Visible) {
        this.drawPlayerHUD(2, 625, 15, this.p2Hp, this.p2HpGhost, this.p2InvulnEndTime, this.p2Lives);
    }

    // Update life icons (Removed in favor of unified hearts)
  }

  // updatePlayerHearts removed in favor of procedural drawing in drawPlayerHUD

  private drawPlayerHUD(index: number, x: number, y: number, hp: number, ghostHp: number, invulnEndTime: number, currentLives: number) {
    const g = this.hudGraphics;
    const bw = 160, bh = 60;

    // 1. Background Panel
    g.fillStyle(0x000000, 0.6);
    g.fillRoundedRect(x, y, bw, bh, 8);
    g.lineStyle(2, index === 1 ? 0xffffff : 0x00ffff, 0.8);
    g.strokeRoundedRect(x, y, bw, bh, 8);

    // 2. Hearts (Procedural)
    const heartY = y + 28;
    const heartSpacing = 21;
    // Current total hearts = lives count. Draw up to 5 icons.
    for (let i = 0; i < 5; i++) {
        const heartX = x + 10 + (i * heartSpacing);
        let fillPct = 0;

        // Logic: hearts 0 to lives-2 are full spares. 
        // Heart at index lives-1 shows current HP.
        if (i < currentLives - 1) {
            fillPct = 1.0; // Full spare life
        } else if (i === currentLives - 1) {
            fillPct = hp / 100; // Active life granular health
        }

        if (i < currentLives) {
            const isHit = (i === currentLives - 1) && (ghostHp > hp);
            this.drawHeart(g, heartX, heartY, fillPct, isHit);
        }
    }

    // 3. Invulnerability Gauge
    const barX = x + 8, barW = bw - 16;
    const timeLeft = Math.max(0, invulnEndTime - this.time.now);
    if (timeLeft > 0) {
        const iPct = timeLeft / 1500;
        g.fillStyle(0x00aaff, 1);
        g.fillRect(barX, y + bh - 6, barW * iPct, 3);
    }
  }

  private drawHeart(g: Phaser.GameObjects.Graphics, x: number, y: number, fillPct: number, isHit: boolean) {
    const ox = x, oy = y;
    
    // 1. Background / Shadow
    g.fillStyle(0x000000, 0.4);
    g.beginPath();
    g.moveTo(ox + 5.5, oy + 9);
    g.lineTo(ox + 1, oy + 4.5);
    g.lineTo(ox + 1, oy + 3);
    g.lineTo(ox + 2.5, oy + 1.5);
    g.lineTo(ox + 4, oy + 1.5);
    g.lineTo(ox + 5.5, oy + 2.5);
    g.lineTo(ox + 7, oy + 1.5);
    g.lineTo(ox + 8.5, oy + 1.5);
    g.lineTo(ox + 10, oy + 3);
    g.lineTo(ox + 10, oy + 4.5);
    g.closePath();
    g.fillPath();

    // 2. Heart Shape (Outline)
    g.lineStyle(1.0, 0xffffff, 0.8);
    g.beginPath();
    g.moveTo(ox + 5.5, oy + 8.5);
    g.lineTo(ox + 0.5, oy + 4);
    g.lineTo(ox + 0.5, oy + 2.5);
    g.lineTo(ox + 2, oy + 1);
    g.lineTo(ox + 4, oy + 1);
    g.lineTo(ox + 5.5, oy + 2);
    g.lineTo(ox + 7, oy + 1);
    g.lineTo(ox + 9, oy + 1);
    g.lineTo(ox + 10.5, oy + 2.5);
    g.lineTo(ox + 10.5, oy + 4);
    g.closePath();
    g.strokePath();

    // 3. Fill (Liquid style from bottom up)
    if (fillPct > 0) {
        g.fillStyle(isHit ? 0xffaaaa : 0xff0000, 1);
        
        g.beginPath();
        g.moveTo(ox + 5.5, oy + 8.5);
        g.lineTo(ox + 1, oy + 4);
        g.lineTo(ox + 1, oy + 2.5);
        g.lineTo(ox + 2, oy + 1.2);
        g.lineTo(ox + 4, oy + 1.2);
        g.lineTo(ox + 5.5, oy + 2.2);
        g.lineTo(ox + 7, oy + 1.2);
        g.lineTo(ox + 9, oy + 1.2);
        g.lineTo(ox + 10, oy + 2.5);
        g.lineTo(ox + 10, oy + 4);
        g.closePath();
        g.fillPath();

        // Overlay dark part for empty percent
        if (fillPct < 1.0) {
            g.fillStyle(0x000000, 0.7);
            const emptyH = 8.5 * (1 - fillPct);
            g.fillRect(ox, oy, 11, emptyH);
        }
    }
  }

  private updatePlayer(player: Physics.Arcade.Sprite, keys: any, _time: number) {
    if (!player) return;

    const isDead = player === this.player1 ? this.p1IsDead : this.p2IsDead;
    if (isDead) {
        player.setActive(false).setVisible(false);
        if (player.body) player.body.enable = false;
        return;
    }

    // ── OMEGA-MAX Stability System ──
    // Runs before ALL other logic to prevent any possible vanish or stuck state.
    if (player.active) {
        // 1. Positional Recovery & Absolute Clamping
        if (player.x < -100 || player.x > 900 || player.y < -100 || player.y > 700) {
            player.setPosition(400, 300);
            if (player.body) player.setVelocity(0, 0);
        }
        // Force clamp character to internal view area (Omega Guard)
        if (player.x < 16) player.x = 16;
        if (player.x > 784) player.x = 784;
        if (player.y < 32) player.y = 32;
        // Removed: if (player.y > 576) player.y = 576; // ALLOW FALLING

        // ── Instant Abyss Respawn ──
        if (player.y > 640) {
            const spawn = player === this.player1 ? this.p1Spawn : this.p2Spawn;
            player.setPosition(spawn.x, spawn.y);
            if (player.body) player.setVelocity(0, 0);
            SOUNDS.hit(); // Feedback for respawn
        }
        
        const isP1 = player === this.player1;
        const invTime = isP1 ? this.p1InvulnEndTime : this.p2InvulnEndTime;
        
        // 2. Visual State Recovery & Manual Blink
        if (this.time.now < invTime) {
            const flicker = Math.floor(this.time.now / 50) % 2 === 0;
            // OMEGA: Increased visibility on blink (0.6 instead of 0.3)
            player.setAlpha(flicker ? 0.6 : 1.0).setTint(0xff0000).setVisible(true);
        } else {
            if (isP1) { this.p1Invulnerable = false; }
            else { this.p2Invulnerable = false; }

            if (player.active) {
                player.setAlpha(1).setVisible(true);
                if (isP1) player.clearTint();
                else player.setTint(0x00ffff);
            }
        }
        player.setDepth(1000);
    }

    if (!player.active || !player.body || !keys) return;

    const isP1 = player === this.player1;
    const pushing = isP1 ? this.p1Pushing : this.p2Pushing;
    const speed = 200;
    
    // ── Input & Movement ──
    const leftDown = (keys.left && keys.left.isDown) || (keys.A && keys.A.isDown);
    const rightDown = (keys.right && keys.right.isDown) || (keys.D && keys.D.isDown);
    const jumpDown = (keys.up && keys.up.isDown) || (keys.W && keys.W.isDown);
    
    if (leftDown) {
        player.setVelocityX(-speed); player.setFlipX(true);
        if (player.body.blocked.down) {
            if (player.anims) player.anims.play('walk', true);
            player.setAngle(0);
            player.setScale(1);
        }
    } else if (rightDown) {
        player.setVelocityX(speed); player.setFlipX(false);
        if (player.body.blocked.down) {
            if (player.anims) player.anims.play('walk', true);
            player.setAngle(0);
            player.setScale(1);
        }
    } else {
        player.setVelocityX(0);
        if (player.body.blocked.down) {
            player.setAngle(0);
            if (player.anims) player.anims.play('idle', true);
            player.setScale(1);
        }
    }

    // ── Jump/Air Visuals ──
    if (!player.body.blocked.down) {
        player.setAngle(0);
        player.setScale(1);
    }

    // Coyote Time & Jump Buffering
    const lastGrounded = isP1 ? this.p1LastGroundedTime : this.p2LastGroundedTime;
    const canCoyoteJump = (_time - lastGrounded) < 150; // 150ms window
    
    if (jumpDown) {
        if (isP1) this.p1JumpBufferTime = _time;
        else this.p2JumpBufferTime = _time;
    }

    const jumpBuffer = isP1 ? this.p1JumpBufferTime : this.p2JumpBufferTime;
    const isBuffered = (_time - jumpBuffer) < 100; // 100ms window

    if (isBuffered && (player.body.blocked.down || canCoyoteJump)) {
        player.setVelocityY(-450);
        SOUNDS.jump();
        if (player.anims) player.anims.play('jump', true);
        // Clear buffers
        if (isP1) { this.p1JumpBufferTime = 0; this.p1LastGroundedTime = 0; }
        else { this.p2JumpBufferTime = 0; this.p2LastGroundedTime = 0; }
    }
    
    // ── Visual Overrides ──
    const shooting = player === this.player1 ? this.p1Shooting : this.p2Shooting;
    if (pushing) {
        player.setAngle(player.flipX ? -20 : 20);
    } else if (shooting) {
        player.setAngle(0);
    } else if (!player.body.blocked.down) {
        if (player.anims) player.anims.stop();
        const vy = player.body.velocity.y;
        player.setFrame(vy < -30 ? 3 : 4);
        player.setAngle(0); 
    } else {
        if (!this.tweens.isTweening(player)) player.setAngle(0);
    }
    
    // Cleanup P2 if solo
    if (player === this.player2 && this.numPlayers === 1) {
        player.setVisible(false).setActive(false);
    }
  }

  private cleanupHUD() {
    // Destroy each HUD element directly — no container, no leaks
    if (this.hudGraphics) { this.hudGraphics.destroy(); this.hudGraphics = undefined as any; }
    if (this.pauseBtn) { this.pauseBtn.destroy(); this.pauseBtn = undefined as any; }
    if (this.homeBtn) { this.homeBtn.destroy(); this.homeBtn = undefined as any; }
    if (this.scoreText) { this.scoreText.destroy(); this.scoreText = undefined as any; }
    if (this.stageText) { this.stageText.destroy(); this.stageText = undefined as any; }
    if (this.winText) { this.winText.destroy(); this.winText = undefined as any; }
    if (this.bossHealthBar) { this.bossHealthBar.destroy(); this.bossHealthBar = undefined as any; }
    if (this.bossLabel) { this.bossLabel.destroy(); this.bossLabel = undefined as any; }

    // Destroy every heart icon individually
    [...this.p1HeartIcons, ...this.p2HeartIcons, ...this.p1LifeIcons, ...this.p2LifeIcons]
        .forEach(icon => { if (icon) icon.destroy(); });

    this.p1HeartIcons = [];
    this.p2HeartIcons = [];
    this.p1LifeIcons = [];
    this.p2LifeIcons = [];
  }

  private triggerSpawnEffect(x: number, y: number) {
    // 1. Golden Pillar of Light
    const pillar = this.add.rectangle(x, 300, 60, 600, 0xffcc00, 0.3).setDepth(2000);
    this.tweens.add({
        targets: pillar,
        alpha: 0,
        scaleX: 0,
        duration: 500,
        onComplete: () => pillar.destroy()
    });

    // 2. Golden Shockwave Ring
    const ring = this.add.circle(x, y, 10).setDepth(2001);
    ring.setStrokeStyle(4, 0xffcc00, 1);
    this.tweens.add({
        targets: ring,
        scale: 12,
        alpha: 0,
        duration: 800,
        onComplete: () => ring.destroy()
    });

    // 3. Golden Ember Burst
    const pts = this.add.particles(x, y, 'bullet', {
        speed: { min: 80, max: 250 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.4, end: 0 },
        lifespan: 1200,
        quantity: 30,
        tint: 0xffcc00,
        blendMode: 'ADD'
    });
    pts.setDepth(2002);
    pts.explode(30);
    
    SOUNDS.hit(); // Use hit chime for the spawn sound
  }
}
