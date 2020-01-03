const IMAGE_WIDTH = 928;
const IMAGE_HEIGHT = 800;

const STATE_EMPTY = 0;
const STATE_TREE = STATE_EMPTY + 1;
const STATE_BURNING = STATE_TREE + 1;
const STATE_BURNED = STATE_BURNING + 1;

const MAX_FUEL = 100;

const ENERGY_TRANSFER_RATE_MEAN = 0.5;
const ENERGY_TRANSFER_RATE_STD_DEV = 0.25;

const INITIAL_ENERGY_MEAN = 50;
const INITIAL_ENERGY_STD_DEV = 25; 

const ITERATION_WAIT_TIME_MS = 1000;

const REGROWTH_K_ITERATIONS = 5; // Regrow in 5 iterations 

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
			(cellState.fuelCapacity + cellState.iterationsSinceBurned) / (REGROWTH_K_ITERATIONS + cellState.iterationsSinceBurned));
		return new CellState(STATE_TREE, cellState.fuelCapacity, 0, newFuel, cellState.iterationsSinceBurned + 1);
	}
}

function updateBurnForTimestamp(cellState) {
	let remainingFuel = cellState.fuel - cellState.burnRate;
	if (remainingFuel < 0) {
		return new CellState(STATE_BURNED, cellState.fuelCapacity, 0, 0, 0);
	} else {
		return new CellState(STATE_BURNED, cellState.fuelCapacity, cellState.burnRate, remainingFuel, 0);
	}
}

function transferEnergy(energyOfNeighboringCell) {
	let energyTransferRate = randomGaussian(ENERGY_TRANSFER_RATE_MEAN, ENERGY_TRANSFER_RATE_STD_DEV);
	energyTransferRate = Math.max(0, energyTransferRate);
	energyTransferRate = Math.min(1, energyTransferRate);
	return energyTransferRate * energyTransferRate;
}

function initialEnergy() {
	return randomGaussian(INITIAL_ENERGY_MEAN, INITIAL_ENERGY_STD_DEV);
}

const MAX_HUE_DELTA = 36;
const BURNABLE_AREA_HUE = 90;
const DARKEN_DELTA = 128;
const MAX_TREE_VALUE = 50;

const RANDOM_BURN_RATE_PROBABILITY = 0.000002368; // From https://iopscience.iop.org/article/10.1088/1367-2630/4/1/317

const IMAGE_URL = 'https://petapixel.com/assets/uploads/2017/01/large2014.jpg';

function renderConstants() {
    document.getElementById("MAX_HUE_DELTA").innerHTML = MAX_HUE_DELTA;
    document.getElementById("BURNABLE_AREA_HUE").innerHTML = BURNABLE_AREA_HUE;
    document.getElementById("RANDOM_BURN_RATE_PROBABILITY").innerHTML = RANDOM_BURN_RATE_PROBABILITY;
}
