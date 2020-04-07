const IMAGE_WIDTH = 928;
const IMAGE_HEIGHT = 800;

const STATE_EMPTY = 0;
const STATE_TREE = STATE_EMPTY + 1;
const STATE_BURNING = STATE_TREE + 1;
const STATE_BURNED = STATE_BURNING + 1;

const ENERGY_TRANSFER_RATE_MEAN = 0.5
const ENERGY_TRANSFER_RATE_STD_DEV = 0.25;

const PROBABILITY_OF_FIRE_TRANSFER = 0.1;

const MAX_FUEL = 100;

const INITIAL_ENERGY_MEAN = 50;
const INITIAL_ENERGY_STD_DEV = 25; 

const ITERATION_WAIT_TIME_MS = 1000;

const REGROWTH_K_ITERATIONS = 5; // Regrow in 5 iterations 
const OUTLINE_DISPLAY_LENGTH = 5;
const SHARPEN_AMOUNT = 0.3;

const MAX_HUE_DELTA = 36;
const BURNABLE_AREA_HUE = 90;
const MAX_TREE_VALUE = 50;
const MIN_TREE_SATURATION = 20;

const RANDOM_BURN_RATE_PROBABILITY = 0.00000216465;

class CellState {
    constructor(state, fuelCapacity, burnRate, fuel, iterationsSinceBurned) {
        this.state = state;
        this.fuelCapacity = fuelCapacity;
        this.burnRate = burnRate;
        this.fuel = fuel;
        this.iterationsSinceBurned = iterationsSinceBurned;
    }

    isEmpty() {
        return this.state == STATE_EMPTY;
    }

    isTree() {
        return this.state == STATE_TREE;
    }

    isBurning() {
        return this.state == STATE_BURNING;
    }

    isBurned() {
        return this.state == STATE_BURNED;
    }
}

function updateFuelForTimestamp(cellState) {
    if (cellState.iterationsSinceBurned == 0) {
        return new CellState(STATE_TREE, cellState.fuelCapacity, 0, cellState.fuel, 0);
    } else {
        let newFuel = Math.min(cellState.fuelCapacity,
            (cellState.fuelCapacity * cellState.iterationsSinceBurned) / (REGROWTH_K_ITERATIONS + cellState.iterationsSinceBurned));
        return new CellState(STATE_TREE, cellState.fuelCapacity, 0, newFuel, cellState.iterationsSinceBurned + 1);
    }
}

function updateBurnForTimestamp(cellState) {
    let remainingFuel = cellState.fuel - cellState.burnRate;
    // If the fuel is exhausted or the burn rate is too low, transition the cell ot burned.
    if (remainingFuel < 0 || cellState.burnRate < INITIAL_ENERGY_MEAN - INITIAL_ENERGY_STD_DEV) {
        return new CellState(STATE_BURNED, cellState.fuelCapacity, 0, 0, 0);
    } else {
        return new CellState(STATE_BURNING, cellState.fuelCapacity, cellState.burnRate, remainingFuel, 0);
    }
}

function transferEnergy(energyOfNeighboringCell) {
    let energyTransferRate = randomGaussian(ENERGY_TRANSFER_RATE_MEAN, ENERGY_TRANSFER_RATE_STD_DEV);
    energyTransferRate = Math.max(0, energyTransferRate);
    energyTransferRate = Math.min(1, energyTransferRate);
    return energyTransferRate * energyOfNeighboringCell;
}

function initialEnergy() {
    return randomGaussian(INITIAL_ENERGY_MEAN, INITIAL_ENERGY_STD_DEV);
}

function renderConstants() {
    document.getElementById("MAX_HUE_DELTA").innerHTML = MAX_HUE_DELTA;
    document.getElementById("BURNABLE_AREA_HUE").innerHTML = BURNABLE_AREA_HUE;
    document.getElementById("RANDOM_BURN_RATE_PROBABILITY").innerHTML = RANDOM_BURN_RATE_PROBABILITY;
}
