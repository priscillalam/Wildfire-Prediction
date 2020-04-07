function setup() {
    let mapOptions = {
        zoom: 4,
        center: new google.maps.LatLng(-6.1839906, 106.82296),
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        disableDefaultUI: true
    };

    window.map = new google.maps.Map(document.getElementById("map"), mapOptions);
    window.controller = new Controller();
}

class Controller {
    loadMap() {
        html2canvas(document.getElementById("map"), {
            useCORS: true,
            onrendered: (canvas) => {
                document.body.appendChild(canvas);
                document.getElementById("map").style.display = "none";
                document.getElementById("start").style.display = "none";
                this._startModel(canvas);
            }
        });
    }

    _startModel(canvas) {
        let bounds = map.getBounds();
        let southWest = bounds.getSouthWest();
        let northEast = bounds.getNorthEast();

        let diagonalDistanceInMiles =
            distanceInMiles(southWest.lat(), southWest.lng(), northEast.lat(), northEast.lng());
        let pixelDistance = Math.sqrt(IMAGE_WIDTH * IMAGE_WIDTH + IMAGE_HEIGHT * IMAGE_HEIGHT);
        let milesPerPixel = diagonalDistanceInMiles / pixelDistance;

        let context = canvas.getContext("2d");
        sharpenImage(context, IMAGE_WIDTH, IMAGE_HEIGHT, SHARPEN_AMOUNT);
        let state = Array(IMAGE_WIDTH);
        let originalPatch = context.getImageData(
            0,
            0,
            IMAGE_WIDTH,
            IMAGE_HEIGHT);
        for (let x = 0; x < IMAGE_WIDTH; x++) {
            state[x] = Array(IMAGE_HEIGHT);
            for (let y = 0; y < IMAGE_HEIGHT; y++) {
                let hsv = hsvOfPixel(originalPatch, x, y);
                if (BURNABLE_AREA_HUE - MAX_HUE_DELTA < hsv.h &&
                    hsv.h < BURNABLE_AREA_HUE + MAX_HUE_DELTA && hsv.v < MAX_TREE_VALUE &&
                    hsv.s >= MIN_TREE_SATURATION) {
                    state[x][y] = new CellState(STATE_TREE, getFuel(hsv), 0, getFuel(hsv), 0);
                } else {
                    state[x][y] = new CellState(STATE_EMPTY, 0, 0, 0, 0);
                }
            }
        }
        new Model(context, state, originalPatch, milesPerPixel, document.getElementById("ITERATIONS"));
        renderConstants();
    }
}

class Model {
    constructor(context, state, originalPatch, milesPerPixel, iterationCounter) {
        this.iterations = 0;
        this.originalPatch = originalPatch;
        this.stateManager = new StateManager(state, originalPatch, milesPerPixel);
        this.context = context;
        this.iterationCounter = iterationCounter;
        this._loop();
    }

    _renderIterations() {
        this.iterationCounter.innerHTML = this.iterations;
        this.iterations++;
    }

    _renderCurrentState() {
        let state = this.stateManager.state;
        let buffer = new Uint8ClampedArray(IMAGE_WIDTH * IMAGE_HEIGHT * 4); 
        for (let x = 0; x < IMAGE_WIDTH; x++) {
            for (let y = 0; y < IMAGE_HEIGHT; y++) {
                let imageDataIndex = 4 * (y * IMAGE_WIDTH + x);
                if (state[x][y].isBurning()) {
                    // Render burning areas as red
                    buffer[imageDataIndex] = 255;
                    buffer[imageDataIndex + 1] = 0;
                    buffer[imageDataIndex + 2] = 0;
                    buffer[imageDataIndex + 3] = this.originalPatch.data[imageDataIndex + 3];
                } else if (state[x][y].isBurned()) {
                    // Render burned areas as purple
                    buffer[imageDataIndex] = 255;
                    buffer[imageDataIndex + 1] = 0;
                    buffer[imageDataIndex + 2] = 255;
                    buffer[imageDataIndex + 3] = this.originalPatch.data[imageDataIndex + 3];

                } else if (state[x][y].fuel < 0.8 * state[x][y].fuelCapacity) {
                    // Render recovering areas as black
                    buffer[imageDataIndex] = 0;
                    buffer[imageDataIndex + 1] = 0;
                    buffer[imageDataIndex + 2] = 0;
                    buffer[imageDataIndex + 3] = this.originalPatch.data[imageDataIndex + 3];
                } else {
                    buffer[imageDataIndex] = this.originalPatch.data[imageDataIndex];
                    buffer[imageDataIndex + 1] = this.originalPatch.data[imageDataIndex + 1];
                    buffer[imageDataIndex + 2] = this.originalPatch.data[imageDataIndex + 2];

                    if (state[x][y].isEmpty()) {
                        // Fade out areas that are not relevant to the model
                        buffer[imageDataIndex + 3] = 150;
                    } else {
                        buffer[imageDataIndex + 3] = this.originalPatch.data[imageDataIndex + 3];
                    }
                }
            }
        }
        let imageData = this.context.createImageData(IMAGE_WIDTH, IMAGE_HEIGHT);
        imageData.data.set(buffer);
        this.context.putImageData(imageData, 0, 0);
    }

    _renderFireOutlines() {
        let firesToCounter = this.stateManager.firesToCounter;
        for (let fire in firesToCounter) {
            let coordinates = fire.split(",");
            this.context.beginPath();
            this.context.arc(coordinates[0], coordinates[1], 20, 0, 2 * Math.PI);
            this.context.strokeStyle = "white";
            this.context.stroke();
            firesToCounter[fire]++;
            if (firesToCounter[fire] == OUTLINE_DISPLAY_LENGTH) {
                delete firesToCounter[fire]
            }
        }
    }

    _loop() {
        this._renderIterations();
        this._renderCurrentState();
        this._renderFireOutlines();
        this.stateManager.transitionToNext();;
        setTimeout(() => this._loop(), ITERATION_WAIT_TIME_MS);
    }
}

class StateManager {
    constructor(state, patch, milesPerPixel) {
        this.state = state;
        this.transition = new StateTransition();
        this.firesToCounter = {};
        this.milesPerPixel = milesPerPixel;
        this.patch = patch;
    }

    transitionToNext() {
        this.state = this.transition.computeNextState(this.state, this.patch, this.firesToCounter, this.milesPerPixel);
    }
}

class StateTransition {

    computeNextState(state, patch, firesToCounter, milesPerPixel) {
        let newState = Array(IMAGE_WIDTH);
        for (let x = 0; x < IMAGE_WIDTH; x++) {
            newState[x] = Array(IMAGE_HEIGHT);
            for (let y = 0; y < IMAGE_HEIGHT; y++) {
                this._handleCell(x, y, patch, state, newState, firesToCounter, milesPerPixel);  
            }
        }
        return newState;
    }

    _handleCell(x, y, patch, state, newState, firesToCounter, milesPerPixel) {
        if (state[x][y].isBurning()) {
            this._handleBurningCell(x, y, state, newState);
        } else if (state[x][y].isTree()) {
            this._handleTreeCell(x, y, patch, state, newState, firesToCounter, milesPerPixel);
        } else if (state[x][y].isBurned()) {
            this._handleBurnedCell(x, y, state, newState);
        } else {
            this._handleEmptyCell(x, y, state, newState);
        }
    }

    _handleBurningCell(x, y, state, newState) {
        newState[x][y] = updateBurnForTimestamp(state[x][y]);
    }

    _handleBurnedCell(x, y, state, newState) {
        newState[x][y] = new CellState(STATE_TREE, state[x][y].fuelCapacity, 0, 0, 1);
    }

    _handleEmptyCell(x, y, state, newState) {
        newState[x][y] = state[x][y];
    }

    _handleTreeCell(x, y, patch, state, newState, firesToCounter, milesPerPixel) {
        let neighborBurningRate = areAnyNeighborsBurning(state, x, y);
        if (neighborBurningRate > 0) {
            this._handleTreeAdjacentBurningCell(x, y, patch, state, newState, neighborBurningRate);
        } else {
            this._handleTreeStandaloneCell(x, y, state, newState, firesToCounter, milesPerPixel);
        }
    }

    _handleTreeAdjacentBurningCell(x, y, patch, state, newState, neighborBurningRate) {
        let randomValue = Math.random();
        let transferredEnergy = transferEnergy(neighborBurningRate);
        if (transferredEnergy == 0 || state[x][y].fuelCapacity * 0.8 > state[x][y].fuel || randomValue >= PROBABILITY_OF_FIRE_TRANSFER) {
            newState[x][y] = updateFuelForTimestamp(state[x][y]);
        } else {
            newState[x][y] = new CellState(
                STATE_BURNING,
                state[x][y].fuelCapacity,
                transferredEnergy,
                state[x][y].fuel,
                0);
        }
    }
     
    _handleTreeStandaloneCell(x, y, state, newState, firesToCounter, milesPerPixel) {
        let randomValue = Math.random();
        if (randomValue < RANDOM_BURN_RATE_PROBABILITY * milesPerPixel) {
            firesToCounter[[x, y]] = 0;
            newState[x][y] = new CellState(
                STATE_BURNING,
                state[x][y].fuelCapacity,
                initialEnergy(),
                state[x][y].fuel,
                0);
        } else {
            newState[x][y] = updateFuelForTimestamp(state[x][y]);
        }
    }
}    
