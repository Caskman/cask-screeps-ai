const { logCreepError } = require('logging');
const {
    getManhattanDist,
    getSpawnContainerInfo,
} = require('utils');
const {
    hasEnergy,
    hangIdle,
} = require('creepUtils');

const _extensionFillerGetTarget = (creep) => {
    const spawn = Game.spawns['Spawn1'];

    const extensionsWithSpace = Game.spawns['Spawn1'].room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_EXTENSION }
        }).filter(e => e.store.getFreeCapacity(RESOURCE_ENERGY) > 0);

    const dists = extensionsWithSpace.map(e => getManhattanDist(creep.pos, e.pos));
    const targets = extensionsWithSpace
        .map((e,i) => i)
        .sort((a,b) => dists[a] - dists[b])
        .map(i => extensionsWithSpace[i]);

    if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        targets.push(spawn);
    }
    
    return targets;
};

const getDroppedEnergyInSpawnArea = () => {
    const { containers } = getSpawnContainerInfo();
    const container = containers[0];
    const spawn = Game.spawns['Spawn1'];
    const room = spawn.room;
    const energy = room.lookForAt(LOOK_ENERGY, container);
    // console.log(JSON.stringify(energy));
    return energy;
}

const runExtensionFiller = (creep) => {
    if (creep.spawning) {
        return;
    }
    const m = creep.memory;
    
    if (_extensionFillerGetTarget(creep).length > 0) {
        if (!hasEnergy(creep)) {
            if (getDroppedEnergyInSpawnArea().length > 0) {
                m.state = 'CLEANING';
            } else {
                m.state = 'LOADING';
            }
        } else {
            m.state = 'UNLOADING';
        }
    } else if (hasEnergy(creep)) {
        m.state = 'REFILLING';
    } else if (getDroppedEnergyInSpawnArea().length > 0) {
        m.state = 'CLEANING';
    } else {
        m.state = 'IDLE';
    }
    
    if (m.state === 'UNLOADING') {
        const target = _extensionFillerGetTarget(creep)[0];

        const code = creep.transfer(target, RESOURCE_ENERGY);
        if (code === ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        } else if (code === ERR_FULL || code === ERR_BUSY || code === OK) {
        } else {
            logCreepError(code, creep);
        }
    } else if (m.state === 'LOADING') {
        const { containers } = getSpawnContainerInfo();
        const source = containers[0];
        const code = creep.withdraw(source, RESOURCE_ENERGY);
        if (code === ERR_NOT_IN_RANGE) {
            creep.moveTo(source);
        } else if (code == OK || code === ERR_NOT_ENOUGH_ENERGY) {
        } else {
            logCreepError(code, creep);
        }
    } else if (m.state === 'REFILLING') {
        const { containers } = getSpawnContainerInfo();
        const container = containers[0];
        const code = creep.transfer(container, RESOURCE_ENERGY);
        if (code === ERR_NOT_IN_RANGE) {
            creep.moveTo(container);
        } else if (code === ERR_FULL || code === OK) {
        } else {
            logCreepError(code, creep);
        }
    } else if (m.state === 'CLEANING') {
        const energy = getDroppedEnergyInSpawnArea()[0];
        const code = creep.pickup(energy);
        if (code === ERR_NOT_IN_RANGE) {
            creep.moveTo(energy);
        } else if (code === OK) {
        } else {
            logCreepError(code, creep);
        }
    } else if (m.state === 'IDLE') {
        const { containers } = getSpawnContainerInfo();
        const container = containers[0];
        if (getManhattanDist(creep.pos, container.pos) === 0) {
            hangIdle(creep);
        }
    }
}

module.exports = {
    runExtensionFiller,
};