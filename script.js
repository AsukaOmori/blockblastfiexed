/**
 * Block Blast Clone
 * Logic: 8x8 Grid, Drag & Drop Polyominoes, Line Clearing
 */

const CONFIG = {
    GRID_SIZE: 8,
    COLORS: [
        '#FF5733', '#33FF57', '#3357FF', '#F333FF', '#33FFF5', '#FFD133'
    ]
};

class Game {
    constructor() {
        this.grid = Array(CONFIG.GRID_SIZE).fill().map(() => Array(CONFIG.GRID_SIZE).fill(null));
        this.score = 0;
        this.highScore = localStorage.getItem('blockBlastHighScore') || 0;
        this.level = 1;
        this.pxPerLine = 100; // Base score per line
        this.activePieces = []; // The 3 pieces currently available

        // DOM Elements
        this.gridEl = document.getElementById('grid');
        this.dragContainerEl = document.getElementById('drag-container');
        this.levelEl = document.getElementById('level');
        this.scoreEl = document.getElementById('score');
        this.highScoreEl = document.getElementById('high-score');
        this.gameOverModal = document.getElementById('game-over-modal');
        this.finalScoreEl = document.getElementById('final-score');
        document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());

        document.getElementById('rotate-cw').addEventListener('click', () => this.rotateAllPieces(true));
        document.getElementById('rotate-ccw').addEventListener('click', () => this.rotateAllPieces(false));

        this.init();
    }

    restartGame() {
        this.grid = Array(CONFIG.GRID_SIZE).fill().map(() => Array(CONFIG.GRID_SIZE).fill(null));
        this.score = 0;
        this.level = 1;
        this.activePieces = [];
        this.bag = [];
        this.updateScore(0);
        this.updateLevel(1);
        this.renderGrid();
        this.gameOverModal.classList.add('hidden');
        this.spawnPieces();
    }

    init() {
        this.renderGrid();
        this.updateScore(0);
        this.updateLevel(1);
        this.highScoreEl.innerText = this.highScore;
        this.spawnPieces();
        this.setupInputHandlers();
    }

    renderGrid() {
        this.gridEl.innerHTML = '';
        this.gridEl.style.setProperty('--grid-gap', '4px');

        for (let r = 0; r < CONFIG.GRID_SIZE; r++) {
            for (let c = 0; c < CONFIG.GRID_SIZE; c++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = r;
                cell.dataset.col = c;
                // If we had saved state, we'd check this.grid[r][c] here
                this.gridEl.appendChild(cell);
            }
        }
    }

    setupInputHandlers() {
        // We will implement custom drag logic here to support both Mouse and Touch
        // and to handle the "offset" dragging (finger doesn't cover the piece)

        let draggedPiece = null;
        let startX, startY;
        let initialLeft, initialTop;
        let currentVisual = null;

        const onDown = (e) => {
            const pieceContainer = e.target.closest('.piece-container');
            if (!pieceContainer || pieceContainer.dataset.used === 'true') return;

            e.preventDefault();
            const pieceIndex = parseInt(pieceContainer.dataset.index);
            const pieceObj = this.activePieces[pieceIndex];

            draggedPiece = {
                data: pieceObj, // The shape data
                element: pieceContainer,
                index: pieceIndex
            };

            // Create a clone for dragging
            const rect = pieceContainer.getBoundingClientRect();
            currentVisual = pieceContainer.querySelector('.piece-visual').cloneNode(true);
            currentVisual.classList.add('dragging');

            // Set initial position to match the container exactly
            currentVisual.style.left = rect.left + 'px';
            currentVisual.style.top = rect.top + 'px';

            // Calculate scale based on cell size vs visual size
            // For now, hardcode or calculate dynamically?
            // Real game scales up 1:1 with grid.
            const gridCellSize = this.gridEl.children[0].getBoundingClientRect().width;
            const pieceBlockSize = 20; // from CSS
            const scale = gridCellSize / pieceBlockSize;
            currentVisual.style.transform = `scale(${scale})`; // Match grid size

            document.body.appendChild(currentVisual);

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            // Offset so we drag from where we grabbed
            startX = clientX;
            startY = clientY;
            initialLeft = rect.left;
            initialTop = rect.top;

            // Lift it up a bit (visual feedback)
            // Ideally we want to center the piece under the finger somewhat, 
            // but for now let's just stick to absolute tracking
        };

        const onMove = (e) => {
            if (!draggedPiece || !currentVisual) return;
            e.preventDefault();

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            const deltaX = clientX - startX;
            const deltaY = clientY - startY;

            // We move the visual, but we want to lift it UP so the user's finger 
            // doesn't cover the block they are placing.
            // Many mobile games offset the piece by ~100px upwards.
            const fingerOffset = 80;

            currentVisual.style.left = (initialLeft + deltaX) + 'px';
            currentVisual.style.top = (initialTop + deltaY - fingerOffset) + 'px';

            // Hit testing for preview
            this.handlePreview(currentVisual);
        };

        const onUp = (e) => {
            if (!draggedPiece) return;

            // Try to place
            const placed = this.tryPlacePiece(draggedPiece.data, currentVisual);

            if (placed) {
                // Remove from tray
                draggedPiece.element.innerHTML = ''; // Empty it visually
                draggedPiece.element.dataset.used = 'true';
                this.activePieces[draggedPiece.index] = null;

                // Check if turn needs refill
                if (this.activePieces.every(p => p === null)) {
                    this.spawnPieces();
                } else {
                    this.checkGameOver();
                }
            } else {
                // Snap back animation (could rely on CSS transition)
                // For now just destroy
            }

            if (currentVisual) currentVisual.remove();
            currentVisual = null;
            draggedPiece = null;
            this.clearPreviews();
        };

        window.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);

        window.addEventListener('touchstart', onDown, { passive: false });
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
    }

    spawnPieces() {
        this.activePieces = [
            this.generateRandomPiece(),
            this.generateRandomPiece(),
            this.generateRandomPiece()
        ];

        this.dragContainerEl.innerHTML = '';
        this.activePieces.forEach((piece, idx) => {
            const container = document.createElement('div');
            container.classList.add('piece-container');
            container.dataset.index = idx;

            const visual = this.createPieceVisual(piece);
            container.appendChild(visual);
            this.dragContainerEl.appendChild(container);
        });

        // Check immediate game over (rare but possible with 1x1 holes only)
        this.checkGameOver();
    }

    generateRandomPiece() {
        // Tetrominoes and small blocks

        // Small blocks (always useful)
        const SMALL_BLOCKS = [
            [[1]], // 1x1
            [[1, 1]], // 1x2
            [[1], [1]], // 2x1
        ];

        // Standard Tetris Shapes (Tetrominoes)
        const TETROMINOES = [
            [[1, 1, 1, 1]], // I (horizontal)
            [[1], [1], [1], [1]], // I (vertical)
            [[1, 1], [1, 1]], // O (Square)
            [[0, 1, 0], [1, 1, 1]], // T
            [[1, 0], [1, 1], [1, 0]], // T (vertical)
            [[0, 1, 1], [1, 1, 0]], // S
            [[1, 1, 0], [0, 1, 1]], // Z
            [[1, 0, 0], [1, 1, 1]], // J
            [[0, 0, 1], [1, 1, 1]], // L
            [[1, 1], [1, 0], [1, 0]], // L (vertical)
            [[1, 1], [0, 1], [0, 1]], // J (vertical)
        ];

        // Extra complex / Big shapes (for higher levels)
        const COMPLEX_SHAPES = [
            [[1, 1, 1], [1, 1, 1]], // 3x2 block
            [[1, 1, 1], [1, 0, 1]], // U shape
            [[1, 0, 0], [1, 0, 0], [1, 1, 1]], // Large L
            [[0, 0, 1], [0, 0, 1], [1, 1, 1]], // Large J
        ];

        let shapesPool = [];

        // Weighted probability:
        // Level 1-2: Mostly small blocks and simple tetrominoes
        // Level 3+: Full mix

        if (this.level < 3) {
            // High chance of small blocks to keep it easy
            if (Math.random() < 0.4) shapesPool = SMALL_BLOCKS;
            else shapesPool = TETROMINOES;
        } else {
            const rand = Math.random();
            if (rand < 0.2) shapesPool = SMALL_BLOCKS; // 20% small
            else if (rand < 0.8) shapesPool = TETROMINOES; // 60% tetris
            else shapesPool = COMPLEX_SHAPES; // 20% complex
        }

        const shape = shapesPool[Math.floor(Math.random() * shapesPool.length)];
        const color = CONFIG.COLORS[Math.floor(Math.random() * CONFIG.COLORS.length)];
        return { shape, color };
    }

    createPieceVisual(piece) {
        const wrap = document.createElement('div');
        wrap.classList.add('piece-visual');
        const rows = piece.shape.length;
        const cols = piece.shape[0].length;

        wrap.style.gridTemplateRows = `repeat(${rows}, 20px)`;
        wrap.style.gridTemplateColumns = `repeat(${cols}, 20px)`;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const block = document.createElement('div');
                if (piece.shape[r][c]) {
                    block.classList.add('piece-block');
                    block.style.backgroundColor = piece.color;
                }
                wrap.appendChild(block);
            }
        }
        return wrap;
    }

    handlePreview(visual) {
        this.clearPreviews();

        // Logical Hit Test
        // 1. Get visual center (or top-left)
        const rect = visual.getBoundingClientRect();

        // Center point of the first block of the shape (0,0)
        // Note: shape might start with empty space if we had rotated shapes, 
        // but our basic shapes usually have (0,0) filled or relevant.
        // Let's sample the center of the visual to find the nearest grid cell.

        const firstBlockX = rect.left + 10; // +10 for center of 20px block
        const firstBlockY = rect.top + 10;

        // However, the visual is SCALED up. so 20px is actually GridCellSize.
        // Let's get grid metrics.
        const gridRect = this.gridEl.getBoundingClientRect();
        const cellSize = this.gridEl.firstElementChild.getBoundingClientRect().width;

        // Relative to grid
        const relativeX = rect.left - gridRect.left;
        const relativeY = rect.top - gridRect.top;

        const colIndex = Math.round(relativeX / (cellSize + 4)); // 4 is gap
        const rowIndex = Math.round(relativeY / (cellSize + 4));

        // We need to know which block in the piece shape corresponds to 'rect.left/top'.
        // For now, let's assume the dragged visual's top-left aligns with (0,0) of the shape matrix.

        if (this.isValidPlacement(colIndex, rowIndex, this.activePieces[draggedPiece.index])) {
            this.showPreview(colIndex, rowIndex, this.activePieces[draggedPiece.index]);
        }
    }

    // ... we need 'draggedPiece' globally or passed in. 
    // Wait, 'draggedPiece' is closure scoped in setupInputHandlers.
    // I need to refactor slightly to access it or pass it.
    // For now I'm writing the class methods assuming access or parameters.

    isValidPlacement(startCol, startRow, piece) {
        if (!piece) return false;

        for (let r = 0; r < piece.shape.length; r++) {
            for (let c = 0; c < piece.shape[0].length; c++) {
                if (piece.shape[r][c] === 1) {
                    const targetR = startRow + r;
                    const targetC = startCol + c;

                    if (targetR < 0 || targetR >= CONFIG.GRID_SIZE ||
                        targetC < 0 || targetC >= CONFIG.GRID_SIZE) {
                        return false;
                    }

                    if (this.grid[targetR][targetC] !== null) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    showPreview(col, row, piece) {
        for (let r = 0; r < piece.shape.length; r++) {
            for (let c = 0; c < piece.shape[0].length; c++) {
                if (piece.shape[r][c] === 1) {
                    const index = (row + r) * CONFIG.GRID_SIZE + (col + c);
                    const cell = this.gridEl.children[index];
                    if (cell) {
                        cell.style.backgroundColor = piece.color;
                        cell.style.opacity = '0.5';
                    }
                }
            }
        }
    }

    clearPreviews() {
        const cells = this.gridEl.querySelectorAll('.cell');
        cells.forEach((cell, idx) => {
            const r = Math.floor(idx / CONFIG.GRID_SIZE);
            const c = idx % CONFIG.GRID_SIZE;
            if (this.grid[r][c] === null) {
                cell.style.backgroundColor = '';
                cell.style.opacity = '';
            }
        });
    }

    tryPlacePiece(piece, visual) {
        // We duplicate logic from handlePreview slightly
        const rect = visual.getBoundingClientRect();
        const gridRect = this.gridEl.getBoundingClientRect();
        const cellSize = this.gridEl.firstElementChild.getBoundingClientRect().width;
        const relativeX = rect.left - gridRect.left;
        const relativeY = rect.top - gridRect.top;
        const col = Math.round(relativeX / (cellSize + 4));
        const row = Math.round(relativeY / (cellSize + 4));

        if (this.isValidPlacement(col, row, piece)) {
            this.placePiece(col, row, piece);
            return true;
        }
        return false;
    }

    placePiece(col, row, piece) {
        for (let r = 0; r < piece.shape.length; r++) {
            for (let c = 0; c < piece.shape[0].length; c++) {
                if (piece.shape[r][c] === 1) {
                    this.grid[row + r][col + c] = piece.color;
                    const index = (row + r) * CONFIG.GRID_SIZE + (col + c);
                    const cell = this.gridEl.children[index];
                    cell.style.backgroundColor = piece.color;
                    cell.classList.add('filled');
                }
            }
        }

        this.checkForLines();
    }

    checkForLines() {
        const rowsToClear = [];
        const colsToClear = [];

        // Check Rows
        for (let r = 0; r < CONFIG.GRID_SIZE; r++) {
            if (this.grid[r].every(cell => cell !== null)) {
                rowsToClear.push(r);
            }
        }

        // Check Cols
        for (let c = 0; c < CONFIG.GRID_SIZE; c++) {
            let full = true;
            for (let r = 0; r < CONFIG.GRID_SIZE; r++) {
                if (this.grid[r][c] === null) {
                    full = false;
                    break;
                }
            }
            if (full) colsToClear.push(c);
        }

        if (rowsToClear.length > 0 || colsToClear.length > 0) {
            this.clearLines(rowsToClear, colsToClear);
        }
    }

    clearLines(rows, cols) {
        // Visual clear
        const cellsToClear = new Set();

        rows.forEach(r => {
            for (let c = 0; c < CONFIG.GRID_SIZE; c++) {
                cellsToClear.add(`${r},${c}`);
            }
        });

        cols.forEach(c => {
            for (let r = 0; r < CONFIG.GRID_SIZE; r++) {
                cellsToClear.add(`${r},${c}`);
            }
        });

        cellsToClear.forEach(key => {
            const [r, c] = key.split(',').map(Number);
            const index = r * CONFIG.GRID_SIZE + c;
            const cell = this.gridEl.children[index];

            // Add animation class
            cell.classList.add('cleared');

            // Logic clear
            this.grid[r][c] = null;
        });

        // Calculate Score with Multiplier
        const lineCount = rows.length + cols.length;
        // Base: 100 per line.
        // Combo Multiplier: 1 line = x1, 2 lines = x1.5, 3 lines = x2, 4+ = x3
        let multiplier = 1;
        if (lineCount === 2) multiplier = 1.5;
        if (lineCount === 3) multiplier = 2;
        if (lineCount >= 4) multiplier = 3;

        const points = Math.round((lineCount * this.pxPerLine) * multiplier);
        this.updateScore(this.score + points);

        // Show floating text at the "center" of the clear
        // We pick the first cleared cell to spawn text for simplicity, or center of board
        if (lineCount > 0) {
            this.showFloatingText(`+${points}`, rows, cols);
        }

        // Cleanup DOM after animation
        setTimeout(() => {
            cellsToClear.forEach(key => {
                const [r, c] = key.split(',').map(Number);
                const index = r * CONFIG.GRID_SIZE + c;
                const cell = this.gridEl.children[index];
                cell.className = 'cell'; // reset
                cell.style.backgroundColor = '';
            });
        }, 300);
    }

    showFloatingText(text, rows, cols) {
        // Find a good position: Center of the cleared lines?
        // Let's just pick the center of the grid for big combos, or the row/col index

        let targetIndex;
        if (rows.length > 0) {
            const r = rows[Math.floor(rows.length / 2)];
            const c = 4; // Center col
            targetIndex = r * CONFIG.GRID_SIZE + c;
        } else {
            const c = cols[Math.floor(cols.length / 2)];
            const r = 4; // Center row
            targetIndex = r * CONFIG.GRID_SIZE + c;
        }

        const cell = this.gridEl.children[targetIndex];
        const rect = cell.getBoundingClientRect();

        const floatEl = document.createElement('div');
        floatEl.classList.add('floating-text');
        floatEl.innerText = text;
        floatEl.style.left = rect.left + 'px';
        floatEl.style.top = rect.top + 'px';

        document.body.appendChild(floatEl);

        setTimeout(() => floatEl.remove(), 1000);
    }

    checkGameOver() {
        // If no pieces left, obviously not game over (we spawn more)
        // But the check handles non-null pieces.

        let canPlaceAny = false;

        for (let i = 0; i < this.activePieces.length; i++) {
            const piece = this.activePieces[i];
            if (piece === null) continue;

            // Brute force check all positions
            for (let r = 0; r < CONFIG.GRID_SIZE; r++) {
                for (let c = 0; c < CONFIG.GRID_SIZE; c++) {
                    if (this.isValidPlacement(c, r, piece)) {
                        canPlaceAny = true;
                        break;
                    }
                }
                if (canPlaceAny) break;
            }
            if (canPlaceAny) break;
        }

        if (!canPlaceAny && this.activePieces.some(p => p !== null)) {
            this.triggerGameOver();
        }
    }

    triggerGameOver() {
        this.finalScoreEl.innerText = this.score;
        this.gameOverModal.classList.remove('hidden');
    }

    updateScore(newScore) {
        this.score = newScore;
        this.scoreEl.innerText = this.score;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.highScoreEl.innerText = this.highScore;
            localStorage.setItem('blockBlastHighScore', this.highScore);
        }

        // Check Level Up
        // Level up every 1000 points?
        // Level 1 -> 2 at 500
        // Level 2 -> 3 at 1500 ...
        const requiredScore = this.level * 500;
        if (this.score >= requiredScore) {
            this.updateLevel(this.level + 1);
        }
    }

    updateLevel(lvl) {
        this.level = lvl;
        this.levelEl.innerText = this.level;
    }

    rotateAllPieces(clockwise) {
        // Rotate all currently active pieces in the tray
        this.activePieces.forEach((piece, idx) => {
            if (piece) {
                // Rotate the shape matrix
                piece.shape = this.rotateMatrix(piece.shape, clockwise);

                // Update specific visual
                const container = this.dragContainerEl.querySelector(`.piece-container[data-index="${idx}"]`);
                if (container) {
                    container.innerHTML = '';
                    const visual = this.createPieceVisual(piece);
                    container.appendChild(visual);
                }
            }
        });
        // Re-check game over after rotation (maybe rotation saved us?)
        this.checkGameOver();
    }

    rotateMatrix(matrix, clockwise) {
        const rows = matrix.length;
        const cols = matrix[0].length;

        // New matrix dimensions
        const newRows = cols;
        const newCols = rows;

        const newMatrix = Array(newRows).fill().map(() => Array(newCols).fill(0));

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (clockwise) {
                    // Clockwise: (r, c) -> (c, rows - 1 - r)
                    newMatrix[c][rows - 1 - r] = matrix[r][c];
                } else {
                    // Counter-Clockwise: (r, c) -> (cols - 1 - c, r)
                    newMatrix[cols - 1 - c][r] = matrix[r][c];
                }
            }
        }
        return newMatrix;
    }
}

// Start Game
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});
