/**
 * Renderer - Canvas rendering for Coin Bandit
 */

const GameRenderer = {
  canvas: null,
  ctx: null,
  cellSize: 0,
  offsetX: 0,
  offsetY: 0,

    colors: {
      wall: '#1a1a2e',
      wallBrick: '#252540',
      path: '#5a5a7a',
      doorway: '#4a90d9',
      doorwayGlow: 'rgba(255, 215, 0, 0.55)',
      doorwayInner: 'rgba(74, 144, 217, 0.25)',
      coin: '#ffd700',
      coinShine: '#fff8dc'
    },

  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    return this;
  },

  resize(mazeSize) {
    const container = this.canvas.parentElement;
    const maxW = container.clientWidth - 4;
    const maxH = container.clientHeight - 4;

    // Allow larger cells for small mazes to fill the frame, cap at 48px to avoid pixelation
    this.cellSize = Math.max(14, Math.min(48, Math.floor(Math.min(maxW, maxH) / mazeSize)));
    const canvasW = this.cellSize * mazeSize;
    const canvasH = this.cellSize * mazeSize;

    this.canvas.width = canvasW * window.devicePixelRatio;
    this.canvas.height = canvasH * window.devicePixelRatio;
    this.canvas.style.width = canvasW + 'px';
    this.canvas.style.height = canvasH + 'px';
    this.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

    this.offsetX = (maxW - canvasW) / 2;
    this.offsetY = (maxH - canvasH) / 2;
  },

  render(maze, player, guards, coinCollected, time, entryAnim, respawnFlashTimer) {
    if (!maze || !maze.grid) return;

    const ctx = this.ctx;
    const size = maze.size;
    const cs = this.cellSize;

    // Calculate visual offset for entry animation (slide INTO doorway from outside)
    let visOffsetX = 0, visOffsetY = 0;
    if (entryAnim && entryAnim.remaining > 0) {
      const t = entryAnim.remaining / entryAnim.total; // 1 → 0.5 (slide from outside in)
      switch (entryAnim.dir) {
        case 'north': visOffsetY = -cs * t; break; // come from above, slide down
        case 'south': visOffsetY = cs * t; break;  // come from below, slide up
        case 'west':  visOffsetX = -cs * t; break; // come from left, slide right
        case 'east':  visOffsetX = cs * t; break;  // come from right, slide left
      }
    }

    // Clear background
    ctx.fillStyle = this.colors.wall;
    ctx.fillRect(0, 0, this.canvas.width / window.devicePixelRatio, this.canvas.height / window.devicePixelRatio);

    // Draw walls and paths
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cell = maze.grid[y][x];
        const px = x * cs;
        const py = y * cs;

        if (cell === 0) {
          // Wall - dark
          ctx.fillStyle = this.colors.wall;
          ctx.fillRect(px, py, cs, cs);
          // Subtle brick line
          ctx.fillStyle = this.colors.wallBrick;
          if ((x + y) % 2 === 0) {
            ctx.fillRect(px + 1, py + 1, cs - 2, 1);
          }
        } else if (cell === 2) {
          // Doorway - bright animated opening in the outer wall
          const pulse = Math.sin(time * 0.004) * 0.3 + 0.7; // 0.4 ~ 1.0 pulsing
          
          // Base cell color (slightly darker than path to contrast)
          ctx.fillStyle = this.colors.doorway;
          ctx.fillRect(px, py, cs, cs);
          
          // Inner glow fill
          ctx.fillStyle = this.colors.doorwayInner;
          ctx.fillRect(px + 1, py + 1, cs - 2, cs - 2);
          
          // Bright glowing edge strip on the outer wall side
          ctx.fillStyle = this.colors.doorwayGlow;
          ctx.globalAlpha = pulse;
          if (x === 0) ctx.fillRect(px, py, Math.max(3, cs * 0.2), cs);
          if (x === maze.size - 1) ctx.fillRect(px + cs - Math.max(3, cs * 0.2), py, Math.max(3, cs * 0.2), cs);
          if (y === 0) ctx.fillRect(px, py, cs, Math.max(3, cs * 0.2));
          if (y === maze.size - 1) ctx.fillRect(px, py + cs - Math.max(3, cs * 0.2), cs, Math.max(3, cs * 0.2));
          
          // Direction arrow indicator
          ctx.globalAlpha = 0.6 + pulse * 0.4;
          ctx.fillStyle = '#ffd700';
          const arrowSize = cs * 0.3;
          const cx = px + cs / 2;
          const cy = py + cs / 2;
          ctx.beginPath();
          if (y === 0) {
            // Arrow pointing up (north exit)
            ctx.moveTo(cx, cy - arrowSize);
            ctx.lineTo(cx - arrowSize * 0.7, cy + arrowSize * 0.3);
            ctx.lineTo(cx + arrowSize * 0.7, cy + arrowSize * 0.3);
          } else if (y === maze.size - 1) {
            // Arrow pointing down (south exit)
            ctx.moveTo(cx, cy + arrowSize);
            ctx.lineTo(cx - arrowSize * 0.7, cy - arrowSize * 0.3);
            ctx.lineTo(cx + arrowSize * 0.7, cy - arrowSize * 0.3);
          } else if (x === 0) {
            // Arrow pointing left (west exit)
            ctx.moveTo(cx - arrowSize, cy);
            ctx.lineTo(cx + arrowSize * 0.3, cy - arrowSize * 0.7);
            ctx.lineTo(cx + arrowSize * 0.3, cy + arrowSize * 0.7);
          } else if (x === maze.size - 1) {
            // Arrow pointing right (east exit)
            ctx.moveTo(cx + arrowSize, cy);
            ctx.lineTo(cx - arrowSize * 0.3, cy - arrowSize * 0.7);
            ctx.lineTo(cx - arrowSize * 0.3, cy + arrowSize * 0.7);
          }
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1.0;
        } else {
          // Path - uniform light color
          ctx.fillStyle = this.colors.path;
          ctx.fillRect(px, py, cs, cs);
        }
      }
    }

    // Draw coins
    const collectedSet = new Set(coinCollected.map(c => c.x + ',' + c.y));
    for (const coin of maze.coins) {
      if (collectedSet.has(coin.x + ',' + coin.y)) continue;
      const px = coin.x * cs + cs/2;
      const py = coin.y * cs + cs/2;
      const r = cs * 0.25;

      // Coin body
      ctx.fillStyle = this.colors.coin;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();

      // Shine
      ctx.fillStyle = this.colors.coinShine;
      ctx.beginPath();
      ctx.arc(px - r*0.2, py - r*0.2, r*0.4, 0, Math.PI * 2);
      ctx.fill();

      // "$" symbol on larger coins
      if (cs >= 20) {
        ctx.fillStyle = '#b8860b';
        ctx.font = `bold ${Math.floor(r * 1.2)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', px, py + 1);
      }
    }

    // Draw star (lucky star gem) if present
    if (maze.star) {
      const sx = maze.star.x * cs + cs/2;
      const sy = maze.star.y * cs + cs/2;
      const starSize = cs * 0.5;
      const pulse = Math.sin(time * 0.004) * 0.15 + 0.85;
      const pulseFast = Math.sin(time * 0.008) * 0.3 + 0.7;

      ctx.save();

      // Outer aura — large pulsing glow
      const gradient = ctx.createRadialGradient(sx, sy, starSize * 0.2, sx, sy, starSize * 2.5 * pulse);
      gradient.addColorStop(0, 'rgba(255, 215, 0, 0.6)');
      gradient.addColorStop(0.4, 'rgba(255, 140, 0, 0.3)');
      gradient.addColorStop(0.7, 'rgba(231, 76, 60, 0.1)');
      gradient.addColorStop(1, 'rgba(231, 76, 60, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(sx, sy, starSize * 2.5 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Rotating light rays (8 rays)
      const rayCount = 8;
      for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI * 2 + time * 0.001;
        const rayLen = starSize * (1.6 + 0.4 * Math.sin(time * 0.006 + i));
        const alpha = 0.25 * pulseFast;
        ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
        ctx.lineWidth = cs * 0.06;
        ctx.beginPath();
        ctx.moveTo(
          sx + Math.cos(angle) * starSize * 0.7,
          sy + Math.sin(angle) * starSize * 0.7
        );
        ctx.lineTo(
          sx + Math.cos(angle) * rayLen,
          sy + Math.sin(angle) * rayLen
        );
        ctx.stroke();
      }

      // Sparkle particles orbiting
      const particleCount = 6;
      for (let i = 0; i < particleCount; i++) {
        const pAngle = (i / particleCount) * Math.PI * 2 + time * 0.002;
        const pDist = starSize * (1.3 + 0.2 * Math.sin(time * 0.007 + i * 2));
        const px = sx + Math.cos(pAngle) * pDist;
        const py = sy + Math.sin(pAngle) * pDist;
        const pSize = cs * 0.07 * (0.6 + 0.4 * pulseFast);
        ctx.fillStyle = `rgba(255, 255, 200, ${0.7 * pulse})`;
        ctx.beginPath();
        ctx.arc(px, py, pSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Main star body — five-pointed star
      const drawStar = (cx, cy, outerR, innerR, points, rotation) => {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = (i * Math.PI) / points - Math.PI / 2 + rotation;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      };

      // Outer star (gold)
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
      ctx.shadowBlur = starSize * 0.6;
      drawStar(sx, sy, starSize, starSize * 0.4, 5, 0);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Middle star (orange-red)
      ctx.fillStyle = '#ff6b35';
      drawStar(sx, sy, starSize * 0.72, starSize * 0.28, 5, 0);
      ctx.fill();

      // Inner star (bright white-yellow)
      ctx.fillStyle = '#fff8dc';
      drawStar(sx, sy, starSize * 0.42, starSize * 0.16, 5, 0);
      ctx.fill();

      // Center glow dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, starSize * 0.12, 0, Math.PI * 2);
      ctx.fill();

      // Vertical light beam from above (subtle)
      ctx.fillStyle = `rgba(255, 215, 0, ${0.06 * pulse})`;
      ctx.beginPath();
      ctx.moveTo(sx - starSize * 0.15, sy - starSize * 3);
      ctx.lineTo(sx + starSize * 0.15, sy - starSize * 3);
      ctx.lineTo(sx + starSize * 0.4, sy - starSize * 0.8);
      ctx.lineTo(sx - starSize * 0.4, sy - starSize * 0.8);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Draw guards
    for (const guard of guards) {
      this.drawGuard(ctx, guard, cs, time);
    }

    // Draw player (with possible entry animation offset and respawn blinking)
    this.drawPlayer(ctx, player, cs, time, visOffsetX, visOffsetY, respawnFlashTimer);
  },

  drawPlayer(ctx, player, cs, time, offX, offY, respawnFlashTimer) {
    // Respawn blinking: fast 3-second flash to show where player respawned
    if (respawnFlashTimer > 0) {
      const blinkPhase = Math.sin(time * 0.025);
      if (blinkPhase < 0) return; // skip drawing this frame for blink effect
    }

    const px = player.x * cs + cs/2 + (offX || 0);
    const py = player.y * cs + cs/2 + (offY || 0);
    const r = cs * 0.4;

    // Head — rounded square (pixel feel)
    ctx.fillStyle = '#f0d0a0';
    const headX = px - r;
    const headY = py - r;
    const headW = r * 2;
    const headH = r * 2;
    const br = r * 0.3;
    ctx.beginPath();
    ctx.moveTo(headX + br, headY);
    ctx.lineTo(headX + headW - br, headY);
    ctx.arcTo(headX + headW, headY, headX + headW, headY + br, br);
    ctx.lineTo(headX + headW, headY + headH - br);
    ctx.arcTo(headX + headW, headY + headH, headX + headW - br, headY + headH, br);
    ctx.lineTo(headX + br, headY + headH);
    ctx.arcTo(headX, headY + headH, headX, headY + headH - br, br);
    ctx.lineTo(headX, headY + br);
    ctx.arcTo(headX, headY, headX + br, headY, br);
    ctx.closePath();
    ctx.fill();

    // Black hat (wide brim)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(px - r * 1.1, py - r * 0.9, r * 2.2, r * 0.25);
    // Hat crown
    ctx.fillRect(px - r * 0.5, py - r * 1.2, r * 1.0, r * 0.5);

    // Zorro mask — black band across eyes
    const maskTop = py - r * 0.35;
    const maskH = r * 0.55;
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(px - r * 0.95, maskTop);
    ctx.lineTo(px + r * 0.95, maskTop);
    ctx.lineTo(px + r * 0.95, maskTop + maskH);
    ctx.lineTo(px - r * 0.95, maskTop + maskH);
    ctx.fill();

    // Eye holes — white background then dark pupils
    const eyeY = py - r * 0.05;
    const eyeR = r * 0.18;
    // Left eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px - r * 0.3, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(px - r * 0.3, eyeY, eyeR * 0.55, 0, Math.PI * 2);
    ctx.fill();
    // Right eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px + r * 0.3, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(px + r * 0.3, eyeY, eyeR * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Mask tie strings (tiny lines on sides)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(px - r * 0.9, maskTop + maskH * 0.5);
    ctx.lineTo(px - r * 1.15, maskTop + maskH * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + r * 0.9, maskTop + maskH * 0.5);
    ctx.lineTo(px + r * 1.15, maskTop + maskH * 0.9);
    ctx.stroke();
    ctx.lineWidth = 1;

    // Smirk mouth
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    ctx.arc(px, py + r * 0.35, r * 0.22, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    ctx.lineWidth = 1;
  },

  drawGuard(ctx, guard, cs, time) {
    const px = guard.x * cs + cs/2;
    const py = guard.y * cs + cs/2;
    const w = cs * 0.75;
    const h = cs * 0.8;
    const left = px - w/2;
    const top = py - h/2;

    const color = getGuardColor(guard.perceptionRange);

    // Body
    ctx.fillStyle = color;
    ctx.fillRect(left, top + h * 0.2, w, h * 0.6);

    // Badge
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(left + w * 0.35, top + h * 0.3, w * 0.3, h * 0.15);

    // Face
    ctx.fillStyle = '#f0d0a0'; // skin tone
    ctx.fillRect(left + w * 0.1, top + h * 0.2, w * 0.8, h * 0.25);

    // Eyes (angry)
    ctx.fillStyle = '#1a1a1a';
    const eyeSize = cs * 0.06;
    ctx.fillRect(left + w * 0.25, top + h * 0.25, eyeSize * 2, eyeSize);
    ctx.fillRect(left + w * 0.55, top + h * 0.25, eyeSize * 2, eyeSize);

    // Mustache
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(left + w * 0.2, top + h * 0.35, w * 0.6, h * 0.05);

    // Police hat
    ctx.fillStyle = color;
    ctx.fillRect(left + w * 0.05, top, w * 0.9, h * 0.2);
    ctx.fillRect(left - w * 0.05, top + h * 0.15, w * 1.1, h * 0.05);
    // Badge on hat
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(left + w * 0.4, top + h * 0.02, w * 0.2, h * 0.12);

    // Flashlight (if chasing)
    if (guard.state === 'chase') {
      ctx.fillStyle = 'rgba(255,255,200,0.3)';
      const beamDir = this.getGuardDirection(guard);
      const beamLength = cs * 2;
      const beamWidth = cs * 0.8;
      ctx.beginPath();
      ctx.moveTo(px + beamDir.dx * w * 0.5, py + beamDir.dy * h * 0.5);
      ctx.lineTo(px + beamDir.dx * beamLength + beamWidth * 0.3, py + beamDir.dy * beamLength + beamWidth * 0.3);
      ctx.lineTo(px + beamDir.dx * beamLength - beamWidth * 0.3, py + beamDir.dy * beamLength - beamWidth * 0.3);
      ctx.closePath();
      ctx.fill();
    }
  },

  getGuardDirection(guard) {
    if (!guard.path || guard.path.length === 0) return { dx: 0, dy: -1 };
    const [nx, ny] = guard.path[0];
    return { dx: Math.sign(nx - guard.x), dy: Math.sign(ny - guard.y) };
  },

  updateHUD(coins, lives, location) {
    document.getElementById('coinCount').textContent = coins;
    document.getElementById('lifeCount').textContent = lives;
    document.getElementById('mazeLocation').textContent = location;
  }
};
