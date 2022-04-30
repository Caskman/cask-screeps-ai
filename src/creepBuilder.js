const { logCreepError } = require('logging');
const {
    creepTargetEnergyAvailable,
    creepGetEnergySource,
    hangIdle,
    goRecycle,
    hasEnergyCapacity,
    hasEnergy,
    getConstructionTargets,
} = require('creepUtils');
const { getManhattanDist, getSpawnContainerInfo } = require('utils');
const { underSinkBodyPartBudget, setSinkBlocked, overSinkPopCount } = require('sourceWork');

const getEnergySource = () => {
    return creepGetEnergySource([0.8, 0.25]);
}

const sufficientEnergySource = (creep) => {
    const { target, threshold } = getEnergySource();
    return creepTargetEnergyAvailable(target, threshold);
}

const onSpawnContainer = (creep) => {
    const { containers } = getSpawnContainerInfo();
    if (containers.length === 0) {
        return false;
    }
    const container = containers[0];
    return getManhattanDist(creep.pos, container.pos) === 0;
}

const runBuilder = (creep, contextObj) => {
    if (creep.spawning) {
        return;
    }
    const m = creep.memory;

    // State Changes
    if (onSpawnContainer(creep)) {
        m.state = 'IDLE';
    } else if (!hasEnergy(creep)) {
        if (overSinkPopCount(contextObj)) {
            m.state = 'RECYCLING';
        } else if (underSinkBodyPartBudget(creep)) {
            m.state = 'RECYCLING';
        } else if (sufficientEnergySource(creep)) {
            m.state = 'LOADING';
        } else {
            m.state = 'BLOCKED';
        }
    } else if (getConstructionTargets(creep).length === 0) {
        m.state = 'UPGRADING';
    } else {
        m.state = 'BUILDING';
    }
    
    // State Actions
    if (m.state === 'BUILDING') {
        const target = getConstructionTargets(creep)[0];
        const code = creep.build(target);
        if (code === ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        } else if (code === OK || code === ERR_BUSY) {
        } else {
            logCreepError(code, creep);
        }
    } else if (m.state === 'LOADING') {
        const target = getEnergySource().target;
        const code = creep.withdraw(target, RESOURCE_ENERGY);
        if (code === ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        } else if (code === OK || code == ERR_BUSY) {
        } else {
            logCreepError(code, creep);
        }
    } else if (m.state === 'UPGRADING') {
        const target = Game.spawns['Spawn1'].room.controller;
        const code = creep.upgradeController(target);
        if (code === ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        } else if (code === OK || code === ERR_BUSY) {
        } else {
            logCreepError(code, creep);
        }
    } else if (m.state === 'IDLE') {
        hangIdle(creep);
    } else if (m.state === 'BLOCKED') {
        setSinkBlocked();
        hangIdle(creep);
    } else if (m.state === 'RECYCLING') {
        goRecycle(creep);
    }
}

module.exports = {
    runBuilder,
};