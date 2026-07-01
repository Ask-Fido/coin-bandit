/**
 * Maze Generation & World Map
 * Coin Bandit - 金币大盗贼
 */

const COLS = ['A','B','C','D','E','F','G','H','I'];
const ROWS = [1,2,3,4,5,6,7,8,9];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getColIndex(col) {
  return COLS.indexOf(col) + 1;
}

function getMazeKey(col, row) {
  return col + row;
}

function getLevel(col, row) {
  return Math.max(getColIndex(col), row);
}

function getMazeSize(col, row) {
  const level = getLevel(col, row);
  const logical = 11 + (level - 1) * 2;
  return { logical, actual: 2 * logical + 1 };
}

function getAdjacentMazes(col, row) {
  const adj = {};
  const cIdx = getColIndex(col);
  if (row > 1) adj.north = { col, row: row - 1 };
  if (row < 9) adj.south = { col, row: row + 1 };
  if (cIdx < 9) adj.east = { col: COLS[cIdx], row };
  if (cIdx > 1) adj.west = { col: COLS[cIdx - 2], row };
  return adj;
}

/**
 * BFS pathfinding on grid
 * Returns array of [x,y] positions from start to target, or null
 */
function findPath(grid, startX, startY, targetX, targetY) {
  const size = grid.length;
  const queue = [[startX, startY, []]];
  const visited = new Set();
  visited.add(startX + ',' + startY);
  const dirs = [[0,-1],[0,1],[-1,0],[1,0]];

  while (queue.length > 0) {
    const [x, y, path] = queue.shift();
    if (x === targetX && y === targetY) {
      return path;
    }
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size &&
          grid[ny][nx] === 1 &&
          !visited.has(nx + ',' + ny)) {
        visited.add(nx + ',' + ny);
        queue.push([nx, ny, [...path, [nx, ny]]]);
      }
    }
  }
  return null;
}

/**
 * Generate a maze for a specific world position
 */
function generateMaze(col, row) {
  const colIndex = getColIndex(col);
  const { logical, actual } = getMazeSize(col, row);
  const guardCount = colIndex;
  const perceptionRange = row;
  const size = actual;

  // Initialize grid with walls (0 = wall, 1 = path, 2 = exit)
  const grid = Array(size).fill(null).map(() => Array(size).fill(0));

  // Recursive backtracking maze generation
  // Walk on odd coordinates only
  const visited = new Set();
  const stack = [[1, 1]];
  visited.add('1,1');
  grid[1][1] = 1;

  while (stack.length > 0) {
    const [x, y] = stack[stack.length - 1];
    const neighbors = [];
    const dirs = [[0,-2],[0,2],[-2,0],[2,0]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx > 0 && nx < size && ny > 0 && ny < size && !visited.has(nx + ',' + ny)) {
        neighbors.push([nx, ny, dx, dy]);
      }
    }
    if (neighbors.length > 0) {
      const [nx, ny, dx, dy] = neighbors[Math.floor(Math.random() * neighbors.length)];
      grid[y + dy/2][x + dx/2] = 1;
      grid[ny][nx] = 1;
      visited.add(nx + ',' + ny);
      stack.push([nx, ny]);
    } else {
      stack.pop();
    }
  }

  // Add loops (remove interior walls) to create branches
  // Lower-level mazes get more loops for better exploration and evasion
  const level = getLevel(col, row);
  let loopRatio;
  if (level <= 3)      loopRatio = 0.20;  // A-C: 20% — lots of branches
  else if (level <= 5) loopRatio = 0.15;  // D-E: 15%
  else if (level <= 7) loopRatio = 0.10;  // F-G: 10%
  else                 loopRatio = 0.04;  // H-I: 4%

  const targetLoops = Math.floor(logical * logical * loopRatio);
  let loopsCreated = 0;
  const maxAttempts = targetLoops * 8; // plenty of attempts
  for (let i = 0; i < maxAttempts && loopsCreated < targetLoops; i++) {
    const wx = 2 + Math.floor(Math.random() * (size - 3));
    const wy = 2 + Math.floor(Math.random() * (size - 3));
    // Only punch holes at pure wall cells (even,even coords that are still walls)
    if (wx % 2 === 0 && wy % 2 === 0 && grid[wy][wx] === 0) {
      // Ensure at least 2 neighboring path cells to form a meaningful branch
      let pathNeighbors = 0;
      if (wy > 1 && grid[wy-1][wx] === 1) pathNeighbors++;
      if (wy < size-2 && grid[wy+1][wx] === 1) pathNeighbors++;
      if (wx > 1 && grid[wy][wx-1] === 1) pathNeighbors++;
      if (wx < size-2 && grid[wy][wx+1] === 1) pathNeighbors++;
      if (pathNeighbors >= 2) {
        grid[wy][wx] = 1;
        loopsCreated++;
      }
    }
  }

  // Place exits: carve doorways through the outer wall
  // Exit = { inside (path cell), doorway (wall cell opened up), dir, destCol, destRow }
  const adj = getAdjacentMazes(col, row);
  const exits = [];
  const doorwayCells = new Set();

  for (const dir of Object.keys(adj)) {
    let edgeCells = [];
    // Skip corner cells (first and last 2 positions on each edge)
    // to avoid ambiguous directional exits
    if (dir === 'north') {
      for (let x = 3; x < size - 2; x += 2) {
        if (grid[1][x] === 1) edgeCells.push({ inside: { x, y: 1 }, doorway: { x, y: 0 } });
      }
    } else if (dir === 'south') {
      for (let x = 3; x < size - 2; x += 2) {
        if (grid[size-2][x] === 1) edgeCells.push({ inside: { x, y: size-2 }, doorway: { x, y: size-1 } });
      }
    } else if (dir === 'west') {
      for (let y = 3; y < size - 2; y += 2) {
        if (grid[y][1] === 1) edgeCells.push({ inside: { x: 1, y }, doorway: { x: 0, y } });
      }
    } else if (dir === 'east') {
      for (let y = 3; y < size - 2; y += 2) {
        if (grid[y][size-2] === 1) edgeCells.push({ inside: { x: size-2, y }, doorway: { x: size-1, y } });
      }
    }

    if (edgeCells.length > 0) {
      shuffle(edgeCells);
      const count = Math.min(1 + Math.floor(Math.random() * 2), edgeCells.length);
      for (let i = 0; i < count; i++) {
        const { inside, doorway } = edgeCells[i];
        grid[doorway.y][doorway.x] = 2; // open the wall → doorway cell
        exits.push({
          inside: { x: inside.x, y: inside.y },
          doorway: { x: doorway.x, y: doorway.y },
          dir,
          destCol: adj[dir].col,
          destRow: adj[dir].row
        });
        doorwayCells.add(doorway.x + ',' + doorway.y);
      }
    }
  }

  // Ensure at least one exit per side if adjacent maze exists
  for (const dir of Object.keys(adj)) {
    const hasExit = exits.some(e => e.dir === dir);
    if (!hasExit) {
      let insideX, insideY, doorX, doorY;
      // Avoid corners: pick from middle range
      const minX = 3, maxX = size - 3;
      const minY = 3, maxY = size - 3;
      if (dir === 'north') {
        insideX = minX + 2 * Math.floor(Math.random() * ((maxX - minX) / 2));
        if (insideX % 2 === 0) insideX++;
        insideY = 1;
        doorX = insideX;
        doorY = 0;
      } else if (dir === 'south') {
        insideX = minX + 2 * Math.floor(Math.random() * ((maxX - minX) / 2));
        if (insideX % 2 === 0) insideX++;
        insideY = size - 2;
        doorX = insideX;
        doorY = size - 1;
      } else if (dir === 'west') {
        insideX = 1;
        insideY = minY + 2 * Math.floor(Math.random() * ((maxY - minY) / 2));
        if (insideY % 2 === 0) insideY++;
        doorX = 0;
        doorY = insideY;
      } else if (dir === 'east') {
        insideX = size - 2;
        insideY = minY + 2 * Math.floor(Math.random() * ((maxY - minY) / 2));
        if (insideY % 2 === 0) insideY++;
        doorX = size - 1;
        doorY = insideY;
      }
      // Ensure inside is path
      grid[insideY][insideX] = 1;
      grid[doorY][doorX] = 2; // doorway
      exits.push({
        inside: { x: insideX, y: insideY },
        doorway: { x: doorX, y: doorY },
        dir,
        destCol: adj[dir].col,
        destRow: adj[dir].row
      });
      doorwayCells.add(doorX + ',' + doorY);
    }
  }

  // Place coins on all regular path cells (not doorways)
  const coins = [];
  for (let y = 1; y < size; y += 2) {
    for (let x = 1; x < size; x += 2) {
      if (grid[y][x] === 1 && !doorwayCells.has(x + ',' + y)) {
        coins.push({ x, y });
      }
    }
  }

  // Lucky star for G7 (final maze) — bottom-right corner
  let star = null;
  if (col === 'G' && row === 7) {
    // Aim for bottom-right quadrant
    let starX = size - 4;
    let starY = size - 4;
    if (starX % 2 === 0) starX--;
    if (starY % 2 === 0) starY--;
    // Ensure it's a path cell and not a doorway
    if (grid[starY][starX] === 0 || doorwayCells.has(starX + ',' + starY)) {
      for (let d = 1; d < size; d++) {
        let found = false;
        for (let dy = -d; dy <= d && !found; dy++) {
          for (let dx = -d; dx <= d && !found; dx++) {
            const nx = starX + dx, ny = starY + dy;
            const key = nx + ',' + ny;
            if (nx > 0 && nx < size && ny > 0 && ny < size && grid[ny][nx] !== 0 && !doorwayCells.has(key)) {
              starX = nx; starY = ny; found = true;
            }
          }
        }
        if (found) break;
      }
    }
    star = { x: starX, y: starY };
  }

  // Place guards on regular path cells, not near star, not on doorways
  const guards = [];
  const availableCells = [];
  const starKey = star ? star.x + ',' + star.y : null;
  for (let y = 1; y < size; y += 2) {
    for (let x = 1; x < size; x += 2) {
      if (grid[y][x] === 1 && !doorwayCells.has(x + ',' + y)) {
        // Avoid placing on the star
        if ((x + ',' + y) !== starKey) {
          availableCells.push([x, y]);
        }
      }
    }
  }

  shuffle(availableCells);
  for (let i = 0; i < guardCount && i < availableCells.length; i++) {
    const [gx, gy] = availableCells[i];
    guards.push({
      x: gx,
      y: gy,
      state: 'patrol',
      path: [],
      perceptionRange,
      lastMove: 0,
      lastChaseTime: -15000,  // gameTime of last chase (-15s so first check won't trigger immediately)
      recentPositions: [],    // sliding window of recent {x,y} for area tracking
      patrolCheckTimer: 15000, // countdown to next patrol check (ms)
      exploreTarget: null,    // {x,y} target for exploration movement
      explorePath: null       // path to explore target
    });
  }

  return {
    grid,
    size,
    logical,
    coins,
    exits,
    guards,
    guardCount,
    perceptionRange,
    col,
    row,
    visited: false,
    allCoinsCollected: false,
    collectedCoins: new Set(),
    completed: false,
    star
  };
}

/**
 * Find a safe spawn position outside all guards' perception
 * Prefer positions near the capture point
 */
function findSafeSpawn(grid, guards, playerX, playerY) {
  const size = grid.length;
  const candidates = [];

  for (let y = 1; y < size; y += 2) {
    for (let x = 1; x < size; x += 2) {
      if (grid[y][x] !== 0) {
        let safe = true;
        for (const g of guards) {
          const dist = Math.max(Math.abs(x - g.x), Math.abs(y - g.y));
          if (dist <= g.perceptionRange) {
            safe = false;
            break;
          }
        }
        if (safe) {
          const d = Math.abs(x - playerX) + Math.abs(y - playerY);
          candidates.push({ x, y, dist: d });
        }
      }
    }
  }

  if (candidates.length > 0) {
    // Prefer near the player, but also some randomness
    candidates.sort((a, b) => a.dist - b.dist);
    // Pick one of the closest 5
    const top = candidates.slice(0, Math.min(5, candidates.length));
    const pick = top[Math.floor(Math.random() * top.length)];
    return { x: pick.x, y: pick.y };
  }

  // Fallback: any path cell
  const allPaths = [];
  for (let y = 1; y < size; y += 2) {
    for (let x = 1; x < size; x += 2) {
      if (grid[y][x] !== 0) allPaths.push({ x, y });
    }
  }
  return allPaths[Math.floor(Math.random() * allPaths.length)];
}

/**
 * Find a good starting position: path cell with at least 2 exits, outside guard range
 */
function findStartPosition(grid, guards) {
  const size = grid.length;
  const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
  const candidates = [];

  for (let y = 1; y < size; y += 2) {
    for (let x = 1; x < size; x += 2) {
      if (grid[y][x] === 1) {
        // Count path neighbors (including doorways)
        let pathNeighbors = 0;
        for (const [dx, dy] of dirs) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < size && ny >= 0 && ny < size && grid[ny][nx] !== 0) {
            pathNeighbors++;
          }
        }
        // Must have at least 2 open paths (not a dead end)
        if (pathNeighbors >= 2) {
          let safe = true;
          if (guards) {
            for (const g of guards) {
              const dist = Math.max(Math.abs(x - g.x), Math.abs(y - g.y));
              if (dist <= g.perceptionRange) {
                safe = false;
                break;
              }
            }
          }
          if (safe) {
            candidates.push({ x, y, neighbors: pathNeighbors });
          }
        }
      }
    }
  }

  if (candidates.length > 0) {
    // Prefer positions with more exits, with some randomness
    candidates.sort((a, b) => b.neighbors - a.neighbors);
    const top = candidates.slice(0, Math.min(8, candidates.length));
    return top[Math.floor(Math.random() * top.length)];
  }

  // Fallback: any path cell
  for (let y = 1; y < size; y += 2) {
    for (let x = 1; x < size; x += 2) {
      if (grid[y][x] === 1) return { x, y };
    }
  }
  return { x: 1, y: 1 };
}

/**
 * Check if a position is inside any guard's perception range
 */
function isInGuardRange(x, y, guards) {
  for (const g of guards) {
    const dist = Math.max(Math.abs(x - g.x), Math.abs(y - g.y));
    if (dist <= g.perceptionRange) {
      return true;
    }
  }
  return false;
}

/**
 * Get guard color based on row (perception level)
 */
function getGuardColor(row) {
  const colors = [
    '#3498db', '#2980b9', '#1a5276', '#6c3483',
    '#7d3c98', '#922b21', '#b9770e', '#d35400', '#1a1a1a'
  ];
  return colors[row - 1] || '#3498db';
}
