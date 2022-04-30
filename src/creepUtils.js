const {
    getSpawnContainerInfo,
    lookAround,
} = require('utils');
const { logCreepError } = require('logging');
const { getManhattanDist } = require('utils');

const getConstructionTargets = (creep, proximityPriority) => {
    // Priority for construction targets
    // containers > extensions > roads
    // spawn roads > source roads > controller roads
    // proximity to spawn
    const spawn = Game.spawns['Spawn1'];
    if (!proximityPriority) {
        proximityPriority = spawn.pos;
    }
    const targets = Game.spawns['Spawn1'].room.find(FIND_CONSTRUCTION_SITES);

    const proximityPriorityDists = targets.map(t => getManhattanDist(proximityPriority, t.pos));

    const importanceMap = {
        [STRUCTURE_CONTAINER]: 30,
        [STRUCTURE_EXTENSION]: 50,
        [STRUCTURE_ROAD]: 100,
    }
    const importances = targets.map(t => t.structureType in importanceMap ? importanceMap[t.structureType] : 1000);

    const ranked = targets.map((e,i) => i)
        // stable sort by proximity to spawn
        .sort((a,b) => proximityPriorityDists[a] - proximityPriorityDists[b])
        // then sort by type
        .sort((a,b) => importances[a] - importances[b]);
    return ranked.map(i => targets[i]);
}

const creepTargetEnergyAvailable = (target, threshold) => {
    const source = target.store;
    return source.getUsedCapacity(RESOURCE_ENERGY) >= (threshold * source.getCapacity(RESOURCE_ENERGY));
}

const creepTargetEnergyFull = (target) => {
    return creepTargetEnergyAvailable(target, 1.0);
}

const creepGetEnergySource = (thresholds) => {
    let target = Game.spawns['Spawn1'];
    let threshold = thresholds[0];
    // Pull from container if it exists, otherwise from spawn
    const { containers } = getSpawnContainerInfo();
    if (containers.length > 0) {
        target = containers[0];
        threshold = thresholds[1];
    }
    return {
        target,
        threshold,
    }
}

const _isSpotClear = (loc, range) => {
    const room = Game.spawns['Spawn1'].room;
    const stuff = room.lookAtArea(loc.y - range, loc.x - range, loc.y + range, loc.x + range, true);
    const blockers = stuff.filter(t => t.terrain === 'wall' || (t.type === "structure" && t.structure.structureType !== STRUCTURE_ROAD) || t.type === "source");
    return blockers.length === 0;
}

const _getIdleSpot = () => {
    const refresh_rate = 100;
    if (!("CREEP_IDLE_SPOT" in Memory) || !(Memory["CREEP_IDLE_SPOT"]) || (Memory["CREEP_IDLE_SPOT"].timestamp + refresh_rate) > Game.time) {
        const idleSpot = lookAround(Game.spawns['Spawn1'].pos, 2, _isSpotClear);
        // const idleSpot = findIdleSpot();
        Memory["CREEP_IDLE_SPOT"] = {
            timestamp: Game.time,
            pos: idleSpot,
        };
    }
    return Memory["CREEP_IDLE_SPOT"].pos;
}

const hangIdle = (creep) => {
    const idleSpot = _getIdleSpot();
    if (creep.pos.inRangeTo(idleSpot,0)) {
        return true;
    }
    const code = creep.moveTo(idleSpot);
    if (code === OK || code === ERR_TIRED || code === ERR_NO_PATH) {
        // no op
    } else if (code === ERR_INVALID_TARGET) {
        Memory["CREEP_IDLE_SPOT"] = null;
    } else {
        logCreepError(code, creep);
    }
    return false;
}

const goRecycle = (creep) => {
    const target = getSpawnContainerInfo().containers[0];
    if (getManhattanDist(creep.pos, target.pos) === 0) {
        const spawn = Game.spawns['Spawn1'];
        spawn.recycleCreep(creep);
    } else {
        creep.moveTo(target);
    }
}

const hasEnergyCapacity = (creep) => {
    return creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
}

const hasEnergy = (creep) => {
    return creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
}

module.exports = {
    creepTargetEnergyAvailable,
    creepTargetEnergyFull,
    creepGetEnergySource,
    hangIdle,
    goRecycle,
    hasEnergyCapacity,
    hasEnergy,
    getConstructionTargets,
};