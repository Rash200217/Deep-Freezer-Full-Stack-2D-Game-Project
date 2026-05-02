import * as Phaser from 'phaser';
import { BootScene } from './game/BootScene';
import { MenuScene } from './game/MenuScene';
import { GameScene } from './game/GameScene';
import { GameOverScene } from './game/GameOverScene';
import { LevelEditorScene } from './game/LevelEditorScene';
import { CommunityScene } from './game/CommunityScene';
import { WinScene } from './game/WinScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  pixelArt: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 600, x: 0 },
      debug: false
    }
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene, LevelEditorScene, CommunityScene, WinScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

const game = new Phaser.Game(config);
