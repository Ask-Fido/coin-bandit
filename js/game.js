/**
 * Game Controller - Main game logic for Coin Bandit
 */

class Game {
  constructor() {
    this.gameState = 'start';
    this.paused = false;
    this.lives = 3;
    this.totalCoins = 0;
    this.currentMaze = null;
    this.currentMazeData = null;
    this.world = {};
    this.visitedMazes = new Set();

    this.player = { x: 1, y: 1 };
    this.playerDirection = null;
    this.pressedDirections = new Set();
    this.playerMoveTimer = 0;
    this.playerMoveInterval = 120;

    this.guardMoveTimer = 0;
    this.guardMoveInterval = 240; // 50% of player speed (120ms)

    this.enteringMaze = false;
    this.entryAnim = null;

    this.lastTimestamp = 0;
    this.gameTime = 0;
    this.captureCooldown = 0;
    this.respawnFlashTimer = 0;

    this.init();
  }

  init() {
    // Button listeners
    document.getElementById('startBtn').addEventListener('click', () => this.startGame());
    document.getElementById('testG7Btn').addEventListener('click', () => this.jumpToG7());
    document.getElementById('tryAgainBtn').addEventListener('click', () => this.tryAgain());
    document.getElementById('endGameBtn').addEventListener('click', () => this.endGame());
    document.getElementById('victoryEndBtn').addEventListener('click', () => this.endGame());

    // Keyboard
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    window.addEventListener('resize', () => this.handleResize());

    // Touch / D-pad
    const dpadBtns = document.querySelectorAll('.dpad-btn');
    dpadBtns.forEach(btn => {
      const dir = btn.dataset.dir;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!this.pressedDirections.has(dir)) {
          this.pressedDirections.add(dir);
          this.playerDirection = dir;
          if (this.gameState === 'playing') this.movePlayer(dir);
          this.playerMoveTimer = 0;
        }
      });
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.pressedDirections.delete(dir);
        if (this.playerDirection === dir) {
          this.playerDirection = this.pressedDirections.size > 0 ? Array.from(this.pressedDirections)[0] : null;
        }
      });
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (!this.pressedDirections.has(dir)) {
          this.pressedDirections.add(dir);
          this.playerDirection = dir;
          if (this.gameState === 'playing') this.movePlayer(dir);
          this.playerMoveTimer = 0;
        }
      });
      btn.addEventListener('mouseup', (e) => {
        e.preventDefault();
        this.pressedDirections.delete(dir);
        if (this.playerDirection === dir) {
          this.playerDirection = this.pressedDirections.size > 0 ? Array.from(this.pressedDirections)[0] : null;
        }
      });
      btn.addEventListener('mouseleave', (e) => {
        this.pressedDirections.delete(dir);
        if (this.playerDirection === dir) {
          this.playerDirection = this.pressedDirections.size > 0 ? Array.from(this.pressedDirections)[0] : null;
        }
      });
    });

    GameRenderer.init('gameCanvas');

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  handleKeyDown(e) {
    if (this.gameState !== 'playing') return;

    const keyMap = {
      'ArrowUp': 'up', 'w': 'up', 'W': 'up',
      'ArrowDown': 'down', 's': 'down', 'S': 'down',
      'ArrowLeft': 'left', 'a': 'left', 'A': 'left',
      'ArrowRight': 'right', 'd': 'right', 'D': 'right'
    };

    if (keyMap[e.key]) {
      if (!this.pressedDirections.has(keyMap[e.key])) {
        this.pressedDirections.add(keyMap[e.key]);
        this.playerDirection = keyMap[e.key];
        this.movePlayer(this.playerDirection);
        this.playerMoveTimer = 0;
      }
      e.preventDefault();
    } else if (e.key === ' ') {
      this.paused = !this.paused;
      e.preventDefault();
    }
  }

  handleKeyUp(e) {
    const keyMap = {
      'ArrowUp': 'up', 'w': 'up', 'W': 'up',
      'ArrowDown': 'down', 's': 'down', 'S': 'down',
      'ArrowLeft': 'left', 'a': 'left', 'A': 'left',
      'ArrowRight': 'right', 'd': 'right', 'D': 'right'
    };

    if (keyMap[e.key]) {
      this.pressedDirections.delete(keyMap[e.key]);
      if (this.playerDirection === keyMap[e.key]) {
        this.playerDirection = this.pressedDirections.size > 0 ? Array.from(this.pressedDirections)[0] : null;
      }
    }
  }

  handleResize() {
    if (this.currentMazeData) {
      GameRenderer.resize(this.currentMazeData.size);
    }
  }

  startGame() {
    this.gameState = 'playing';
    this.paused = false;
    this.lives = 3;
    this.totalCoins = 0;
    this.world = {};
    this.visitedMazes = new Set();
    this.playerDirection = null;
    this.pressedDirections = new Set();
    this.playerMoveTimer = 0;
    this.guardMoveTimer = 0;
    this.captureCooldown = 0;
    this.enteringMaze = false;
    this.entryAnim = null;

    // Show game screen FIRST so container has real dimensions for resize
    document.getElementById('startScreen').classList.remove('active');
    document.getElementById('gameScreen').classList.add('active');
    document.getElementById('gameOverModal').classList.add('hidden');
    document.getElementById('victoryModal').classList.add('hidden');

    this.loadMaze('A', 1);
  }

  jumpToG7() {
    this.gameState = 'playing';
    this.paused = false;
    this.lives = 3;
    this.totalCoins = 0;
    this.world = {};
    this.visitedMazes = new Set();
    this.playerDirection = null;
    this.pressedDirections = new Set();
    this.playerMoveTimer = 0;
    this.guardMoveTimer = 0;
    this.captureCooldown = 0;
    this.enteringMaze = false;
    this.entryAnim = null;

    document.getElementById('startScreen').classList.remove('active');
    document.getElementById('gameScreen').classList.add('active');
    document.getElementById('gameOverModal').classList.add('hidden');
    document.getElementById('victoryModal').classList.add('hidden');

    this.loadMaze('G', 7);
  }

  loadMaze(col, row) {
    const key = getMazeKey(col, row);

    if (!this.world[key]) {
      this.world[key] = generateMaze(col, row);
      this.world[key].collectedCoins = new Set();
      this.world[key].completed = false;
    }

    this.currentMaze = { col, row };
    this.currentMazeData = this.world[key];
    this.currentMazeData.visited = true;
    this.visitedMazes.add(key);

    // Find safe starting position (not a dead end, not in guard range)
    const startPos = findStartPosition(this.currentMazeData.grid, this.currentMazeData.guards);
    this.player.x = startPos.x;
    this.player.y = startPos.y;
    this.playerDirection = null;
    this.pressedDirections = new Set();
    this.playerMoveTimer = 0;
    this.guardMoveTimer = 0;

    for (const g of this.currentMazeData.guards) {
      g.state = 'patrol';
      g.path = [];
      g.lastChaseTime = this.gameTime - 15000;
      g.recentPositions = [];
      g.patrolCheckTimer = 15000;
      g.exploreTarget = null;
      g.explorePath = null;
    }

    GameRenderer.resize(this.currentMazeData.size);
    GameRenderer.updateHUD(this.totalCoins, this.lives, key);
  }

  movePlayer(dir) {
    let dx = 0, dy = 0;
    switch (dir) {
      case 'up': dy = -1; break;
      case 'down': dy = 1; break;
      case 'left': dx = -1; break;
      case 'right': dx = 1; break;
    }

    const nx = this.player.x + dx;
    const ny = this.player.y + dy;
    const grid = this.currentMazeData.grid;
    const size = grid.length;

    // Check if move goes out of bounds or into a wall
    // (doorway cells at outer wall edge are value 2, not wall, so they pass this check)
    if (nx < 0 || nx >= size || ny < 0 || ny >= size || grid[ny][nx] === 0) {
      return; // Wall or boundary, can't move
    }

    // Move player to new cell
    this.player.x = nx;
    this.player.y = ny;

    // If player stepped onto a doorway (outer-wall opening), auto-transition maze
    const cellVal = grid[ny][nx];
    if (cellVal === 2) {
      const exit = this.currentMazeData.exits.find(function(e) {
        return e.doorway.x === nx && e.doorway.y === ny;
      });
      if (exit) {
        this.transitionMaze(exit.dir);
        return;
      }
    }

    // Collect coin
    const coinKey = nx + ',' + ny;
    if (!this.currentMazeData.collectedCoins) this.currentMazeData.collectedCoins = new Set();
    if (!this.currentMazeData.collectedCoins.has(coinKey)) {
      this.currentMazeData.collectedCoins.add(coinKey);
      this.totalCoins++;
    }

    // Check star (I9 victory)
    if (this.currentMazeData.star && this.player.x === this.currentMazeData.star.x && this.player.y === this.currentMazeData.star.y) {
      this.showVictory();
    }
  }

  moveGuard(guard) {
    const grid = this.currentMazeData.grid;

    // During respawn flash (protection period), guards don't detect the player
    if (this.respawnFlashTimer > 0) {
      guard.state = 'patrol';
    } else {
      const dist = Math.max(Math.abs(guard.x - this.player.x), Math.abs(guard.y - this.player.y));
      if (dist <= guard.perceptionRange) {
        guard.state = 'chase';
        guard.lastChaseTime = this.gameTime;
        guard.exploreTarget = null;
        guard.explorePath = null;
      } else {
        guard.state = 'patrol';
      }
    }

    if (guard.state === 'chase') {
      const path = findPath(grid, guard.x, guard.y, this.player.x, this.player.y);
      if (path && path.length > 0) {
        let stepIdx = 0;
        while (stepIdx < path.length && grid[path[stepIdx][1]][path[stepIdx][0]] === 2) {
          stepIdx++;
        }
        if (stepIdx < path.length) {
          const [nx, ny] = path[stepIdx];
          guard.x = nx;
          guard.y = ny;
          this._trackGuardPosition(guard);
        }
      }
    } else if (guard.explorePath && guard.explorePath.length > 0) {
      // Follow exploration path
      let stepIdx = 0;
      while (stepIdx < guard.explorePath.length && grid[guard.explorePath[stepIdx][1]][guard.explorePath[stepIdx][0]] === 2) {
        stepIdx++;
      }
      if (stepIdx < guard.explorePath.length) {
        const [nx, ny] = guard.explorePath[stepIdx];
        guard.x = nx;
        guard.y = ny;
        guard.explorePath = guard.explorePath.slice(stepIdx + 1);
        this._trackGuardPosition(guard);
      }
      if (!guard.explorePath || guard.explorePath.length === 0) {
        guard.exploreTarget = null;
      }
    } else {
      // Normal patrol: random adjacent move
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      shuffle(dirs);
      for (const [dx, dy] of dirs) {
        const nx = guard.x + dx;
        const ny = guard.y + dy;
        if (nx >= 0 && nx < grid.length && ny >= 0 && ny < grid.length && grid[ny][nx] === 1) {
          guard.x = nx;
          guard.y = ny;
          this._trackGuardPosition(guard);
          break;
        }
      }
    }
  }

  _trackGuardPosition(guard) {
    guard.recentPositions.push({ x: guard.x, y: guard.y });
    if (guard.recentPositions.length > 60) {
      guard.recentPositions.shift();
    }
  }

  _checkPatrolExpansion(guard) {
    const gameTime = this.gameTime;
    const noRecentChase = (gameTime - guard.lastChaseTime) > 15000;

    if (!noRecentChase) return;

    // Calculate bounding box of recent positions
    if (guard.recentPositions.length < 10) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of guard.recentPositions) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const areaW = maxX - minX + 1;
    const areaH = maxY - minY + 1;
    const area = areaW * areaH;

    if (area < 100) { // smaller than 10×10
      // Pick a random path cell far from current position
      const grid = this.currentMazeData.grid;
      const candidates = [];
      for (let y = 1; y < grid.length - 1; y++) {
        for (let x = 1; x < grid.length - 1; x++) {
          if (grid[y][x] === 1) {
            const d = Math.max(Math.abs(x - guard.x), Math.abs(y - guard.y));
            if (d >= 10) {
              candidates.push({ x, y, d });
            }
          }
        }
      }

      if (candidates.length > 0) {
        // Prefer farther targets, with some randomness
        candidates.sort((a, b) => b.d - a.d);
        const topN = candidates.slice(0, Math.min(10, candidates.length));
        const target = topN[Math.floor(Math.random() * topN.length)];

        guard.exploreTarget = { x: target.x, y: target.y };
        guard.explorePath = findPath(grid, guard.x, guard.y, target.x, target.y);
      }

      // Reset position tracking after deciding to explore
      guard.recentPositions = [];
    }
  }

  checkCollision() {
    if (this.captureCooldown > 0) return false;
    if (this.respawnFlashTimer > 0) return false; // protection period
    for (const g of this.currentMazeData.guards) {
      if (g.x === this.player.x && g.y === this.player.y) {
        return true;
      }
    }
    return false;
  }

  handleCapture() {
    this.lives--;

    if (this.lives <= 0) {
      this.showGameOver();
      return;
    }

    // Toast
    const toast = document.getElementById('respawnMessage');
    document.getElementById('respawnLives').textContent = this.lives;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2000);

    // Respawn safe
    const safePos = findSafeSpawn(this.currentMazeData.grid, this.currentMazeData.guards, this.player.x, this.player.y);
    this.player.x = safePos.x;
    this.player.y = safePos.y;
    this.playerDirection = null;
    this.pressedDirections = new Set();
    this.captureCooldown = 1000;
    this.respawnFlashTimer = 3000;

    GameRenderer.updateHUD(this.totalCoins, this.lives, getMazeKey(this.currentMaze.col, this.currentMaze.row));
  }

  transitionMaze(dir) {
    const { col, row } = this.currentMaze;
    let nextCol = col;
    let nextRow = row;

    if (dir === 'north') nextRow--;
    else if (dir === 'south') nextRow++;
    else if (dir === 'east') {
      const idx = COLS.indexOf(col);
      if (idx + 1 < COLS.length) nextCol = COLS[idx + 1];
    } else if (dir === 'west') {
      const idx = COLS.indexOf(col);
      if (idx - 1 >= 0) nextCol = COLS[idx - 1];
    }

    this.loadMaze(nextCol, nextRow);

    // Find the matching entry doorway in the new maze (opposite direction)
    const oppDir = dir === 'north' ? 'south' : dir === 'south' ? 'north' : dir === 'east' ? 'west' : 'east';
    const entrance = this.currentMazeData.exits.find(e => e.dir === oppDir);

    if (entrance) {
      // Safety: ensure doorway cell is not in guard range
      if (isInGuardRange(entrance.doorway.x, entrance.doorway.y, this.currentMazeData.guards)) {
        const safePos = findSafeSpawn(this.currentMazeData.grid, this.currentMazeData.guards, entrance.doorway.x, entrance.doorway.y);
        this.player.x = safePos.x;
        this.player.y = safePos.y;
      } else {
        // Land on doorway cell with visual slide-in animation
        this.player.x = entrance.doorway.x;
        this.player.y = entrance.doorway.y;
        this.entryAnim = { dir: oppDir, remaining: 10, total: 10 };
      }
    }
  }

  showGameOver() {
    this.gameState = 'gameOver';
    document.getElementById('finalScore').textContent = this.totalCoins;
    document.getElementById('finalMaze').textContent = getMazeKey(this.currentMaze.col, this.currentMaze.row);
    document.getElementById('gameOverModal').classList.remove('hidden');
  }

  showVictory() {
    this.gameState = 'victory';
    document.getElementById('victoryScore').textContent = this.totalCoins;
    document.getElementById('victoryModal').classList.remove('hidden');
  }

  tryAgain() {
    const randomCol = COLS[Math.floor(Math.random() * 3)];
    const randomRow = 1 + Math.floor(Math.random() * 3);

    this.lives = 3;
    this.totalCoins = 0;
    this.world = {};
    this.visitedMazes = new Set();
    this.gameState = 'playing';
    this.paused = false;
    this.playerDirection = null;
    this.pressedDirections = new Set();
    this.captureCooldown = 0;
    this.entryAnim = null;

    document.getElementById('gameOverModal').classList.add('hidden');
    document.getElementById('victoryModal').classList.add('hidden');

    this.loadMaze(randomCol, randomRow);
    this.respawnFlashTimer = 3000;
  }

  endGame() {
    this.gameState = 'start';
    this.paused = false;
    document.getElementById('gameScreen').classList.remove('active');
    document.getElementById('startScreen').classList.add('active');
    document.getElementById('gameOverModal').classList.add('hidden');
    document.getElementById('victoryModal').classList.add('hidden');
  }

  update(dt) {
    const cappedDt = Math.min(dt, 50);
    this.gameTime += cappedDt;

    // Entry animation tick (visual only, doesn't block movement)
    if (this.entryAnim) {
      this.entryAnim.remaining--;
      if (this.entryAnim.remaining <= 0) {
        this.entryAnim = null;
      }
    }

    this.playerMoveTimer += cappedDt;
    this.guardMoveTimer += cappedDt;
    if (this.captureCooldown > 0) this.captureCooldown -= cappedDt;
    if (this.respawnFlashTimer > 0) this.respawnFlashTimer -= cappedDt;

    // Player movement
    if (this.playerDirection && this.playerMoveTimer >= this.playerMoveInterval) {
      this.movePlayer(this.playerDirection);
      this.playerMoveTimer = 0;
    }

    // Guard movement
    if (this.guardMoveTimer >= this.guardMoveInterval) {
      for (const g of this.currentMazeData.guards) {
        this.moveGuard(g);
      }
      this.guardMoveTimer = 0;
    }

    // Guard patrol expansion check (every 15 seconds)
    for (const g of this.currentMazeData.guards) {
      g.patrolCheckTimer -= cappedDt;
      if (g.patrolCheckTimer <= 0) {
        this._checkPatrolExpansion(g);
        g.patrolCheckTimer = 15000;
      }
    }

    // Check collision
    if (this.checkCollision()) {
      this.handleCapture();
    }

    // Update HUD
    GameRenderer.updateHUD(this.totalCoins, this.lives, getMazeKey(this.currentMaze.col, this.currentMaze.row));
  }

  render() {
    if (!this.currentMazeData) return;

    const collected = [];
    if (this.currentMazeData.collectedCoins) {
      for (const key of this.currentMazeData.collectedCoins) {
        const [x, y] = key.split(',').map(Number);
        collected.push({ x, y });
      }
    }

    GameRenderer.render(this.currentMazeData, this.player, this.currentMazeData.guards, collected, this.gameTime, this.entryAnim, this.respawnFlashTimer);

    // Pause overlay
    if (this.paused) {
      const ctx = GameRenderer.ctx;
      const w = GameRenderer.canvas.width / window.devicePixelRatio;
      const h = GameRenderer.canvas.height / window.devicePixelRatio;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', w / 2, h / 2);
      ctx.font = '14px monospace';
      ctx.fillText('Press SPACE to resume', w / 2, h / 2 + 30);
    }
  }

  gameLoop(timestamp) {
    if (this.lastTimestamp === 0) this.lastTimestamp = timestamp;
    const dt = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    if (this.gameState === 'playing') {
      if (!this.paused) {
        this.update(dt);
      }
      this.render();
    }

    requestAnimationFrame((t) => this.gameLoop(t));
  }
}

// Start
let _gameInstance = null;
window.addEventListener('DOMContentLoaded', () => {
  _gameInstance = new Game();
  window._gameInstance = _gameInstance;
});
