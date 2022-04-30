const { logCreepError } = require('logging');
const {
    hangIdle,
    goRecycle,
    hasEnergy,
    hasEnergyCapacity,
    getConstructionTargets,
    creepTargetEnergyFull,
} = require('creepUtils');
const {
    getManhattanDist,
    getSpawnContainerInfo,
} = require('utils');

const getClosestSourceToSpawn = (creep) => {
    const spawn = Game.spawns['Spawn1'];
    const sources = spawn.room.find(FIND_SOURCES);
    const dists = sources.map(source => getManhattanDist(spawn.pos, source.pos));
    const sorted = sources.map((e,i) => i).sort((a,b) => dists[a] - dists[b]);
    return sources[sorted[0]];
}

const purposeMet = (contextObj) => {
    // spawn container exists
    // supply line completed
    // extension filler exists
    const counts = contextObj.fetchInfo("creepCounts");
    if (!("EXTENSIONFILLER" in counts) || counts["EXTENSIONFILLER"] === 0) {
        return false;
    }

    const { containers } = getSpawnContainerInfo();
    if (containers.length === 0) {
        return false;
    }
    
    const work = contextObj.fetchInfo("sourceWork");
    const completedSupplyLines = work.getCompletedSupplyLines();
    if (completedSupplyLines.length === 0) {
        return false;
    }
    
    return true;
}

const runBootstrapper = (creep, contextObj) => {
    if (creep.spawning) {
        return;
    }
    const m = creep.memory;
    
    // State Changes
    if (purposeMet(contextObj)) {
        m.state = "RECYCLING";
    } else if (!hasEnergy(creep) || (m.state === 'HARVESTING' && hasEnergyCapacity(creep))) {
        m.state = "HARVESTING";
    } else if (!creepTargetEnergyFull(Game.spawns['Spawn1'])) {
        m.state = 'UNLOADING';
    } else if (getConstructionTargets(creep, creep.pos).length !== 0) {
        m.state = 'BUILDING';
    } else {
        m.state = 'IDLE';
    }
    
    // State Actions
    if (m.state === 'BUILDING') {
        const target = getConstructionTargets(creep, creep.pos)[0];
        const code = creep.build(target);
        if (code === ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        } else if (code === OK || code === ERR_BUSY) {
        } else {
            logCreepError(code, creep);
        }
    } else if (m.state === 'HARVESTING') {
        const source = getClosestSourceToSpawn(creep);
        const code = creep.harvest(source);
        if (code === ERR_NOT_IN_RANGE) {
            creep.moveTo(source);
        } else if (code === OK || code == ERR_BUSY || code == ERR_FULL) {
            // no op
        } else {
            logCreepError(code, creep);
        }
    } else if (m.state === 'UNLOADING') {
        const target = Game.spawns['Spawn1'];
        const code = creep.transfer(target, RESOURCE_ENERGY);
        if (code === ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        } else if (code === ERR_BUSY || code === OK) {
        } else {
            logCreepError(code, creep);
        }
    } else if (m.state === 'RECYCLING') {
        goRecycle(creep);
    } else if (m.state === 'IDLE') {
        hangIdle(creep);
    }
}

module.exports = {
    runBootstrapper,
};