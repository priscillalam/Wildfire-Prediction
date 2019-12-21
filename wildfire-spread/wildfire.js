let originalPatch;
let context;
let state = Array(IMAGE_WIDTH);
let iterations = 0;

function setup() {
    let canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");
    let image = new Image();
    image.onload = function() {
        context.drawImage(image, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
        originalPatch = context.getImageData(
            0,
            0,
            IMAGE_WIDTH,
            IMAGE_HEIGHT);

        for (let x = 0; x < IMAGE_WIDTH; x++) {
            state[x] = Array(IMAGE_HEIGHT);
            for (let y = 0; y < IMAGE_HEIGHT; y++) {
                let hsv = hsvOfPixel(x, y);
                if (BURNABLE_AREA_HUE - MAX_HUE_DELTA < hsv.h &&
                    hsv.h < BURNABLE_AREA_HUE + MAX_HUE_DELTA && hsv.v < MAX_TREE_VALUE) {
                    state[x][y] = new CellState(STATE_TREE, getFuel(hsv), 0, getFuel(hsv), 0);
                } else {
                    state[x][y] = new CellState(STATE_EMPTY, 0, 0, 0, 0);
                }
            }
        }
        setTimeout(runLoop, ITERATION_WAIT_TIME_MS);
    };
    image.crossOrigin = '';
    image.src = IMAGE_URL;
    renderConstants();
}

function runLoop() {
    renderCurrentState();
    computeNextState();
    setTimeout(runLoop, ITERATION_WAIT_TIME_MS);
}

function renderCurrentState() {
    document.getElementById("ITERATIONS").innerHTML = iterations;
    iterations++;
    let buffer = new Uint8ClampedArray(IMAGE_WIDTH * IMAGE_HEIGHT * 4); 
    for (let x = 0; x < IMAGE_WIDTH; x++) {
        for (let y = 0; y < IMAGE_HEIGHT; y++) {
            let imageDataIndex = 4 * (y * IMAGE_WIDTH + x);
            if (state[x][y].isBurning()) {
                buffer[imageDataIndex] = 255;
                buffer[imageDataIndex + 1] = 0;
                buffer[imageDataIndex + 2] = 0;
                buffer[imageDataIndex + 3] = originalPatch.data[imageDataIndex + 3];
            } else if (state[x][y].isBurned()) {
                buffer[imageDataIndex] = 255;
                buffer[imageDataIndex + 1] = 0;
                buffer[imageDataIndex + 2] = 255;
                buffer[imageDataIndex + 3] = originalPatch.data[imageDataIndex + 3];

            } else {
                buffer[imageDataIndex] = originalPatch.data[imageDataIndex];
                buffer[imageDataIndex + 1] = originalPatch.data[imageDataIndex + 1];
                buffer[imageDataIndex + 2] = originalPatch.data[imageDataIndex + 2];
                buffer[imageDataIndex + 3] = originalPatch.data[imageDataIndex + 3];
            }
        }
    }
    let imageData = context.createImageData(IMAGE_WIDTH, IMAGE_HEIGHT);
    imageData.data.set(buffer);
    context.putImageData(imageData, 0, 0);
}

function computeNextState() {
    let newState = Array(IMAGE_WIDTH);
    for (let x = 0; x < IMAGE_WIDTH; x++) {
        newState[x] = Array(IMAGE_HEIGHT);
        for (let y = 0; y < IMAGE_HEIGHT; y++) {
            if (state[x][y].isBurning()) {
                handleBurningCell(x, y, newState);
            } else if (state[x][y].isTree()) {
                handleTreeCell(x, y, newState);
            } else if (state[x][y].isBurned()) {
                handleBurnedCell(x, y, newState);
            } else {
                handleEmptyCell(x, y, newState);
            }
        }
    }
    state = newState;
}


/** Logic to handle each type of cell **/

function handleBurningCell(x, y, newState) {
    newState[x][y] = updateBurnForTimestamp(state[x][y]);
}

function handleTreeCell(x, y, newState) {

    function handleAdjacentBurningCell(x, y, newState, neighborBurningRate) {
        let randomValue = Math.random();
        let treeDensity = treeDensityOfCell(x, y, state);
        let transferredEnergy = transferEnergy(neighborBurningRate);
        if (transferredEnergy == 0) {
            newState[x][y] = updateFuelForTimestamp(state[x][y]);
        } else {
            newState[x][y] = new CellState(STATE_BURNING, state[x][y].fuelCapacity, 0, transferredEnergy, 0);
        }
    }
 
    function handleStandaloneCell(x, y, newState) {
        let randomValue = Math.random();
        if (randomValue < RANDOM_BURN_RATE_PROBABILITY) {
            newState[x][y] = new CellState(STATE_BURNING, state[x][y].fuelCapacity, initialEnergy(), state[x][y].fuel, 0);
        } else {
            newState[x][y] = updateFuelForTimestamp(state[x][y]);
        }
    }

    let neighborBurningRate = areAnyNeighborsBurning(x, y);
    if (neighborBurningRate > 0) {
        handleAdjacentBurningCell(x, y, newState, neighborBurningRate);
    } else {
        handleStandaloneCell(x, y, newState);
    }
}

function handleBurnedCell(x, y, newState) {
    newState[x][y] = new CellState(STATE_TREE, state[x][y].fuelCapacity, 0, state[x][y].fuelCapacity, 1);
}

function handleEmptyCell(x, y, newState) {
    newState[x][y] = state[x][y];
}

/** Other useful functions **/

function treeDensityOfCell(x, y, state) {
    return Math.abs(hsvOfPixel(x, y).h - BURNABLE_AREA_HUE) / MAX_HUE_DELTA;
}

function darken(value) {
    return Math.max(value - DARKEN_DELTA, 0);
}

function areAnyNeighborsBurning(pixelX, pixelY) {
    for (let x = pixelX - 1; x <= pixelX + 1; x++) {
        for (let y = pixelY - 1; y <= pixelY + 1; y++) {
            if (x >= 0 && x < IMAGE_WIDTH && y >= 0 && y < IMAGE_HEIGHT &&
                (pixelX != x || pixelY != y)) {
                if (state[x][y].isBurning()) {
                    return state[x][y].burnRate;
                }
            }
        }
    }
    return 0;
}
