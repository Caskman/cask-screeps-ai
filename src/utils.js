const { logError } = require('logging');


const _spawnCreep = (bodyParts, creepType, opts) => {
    const name = creepType + Game.time.toString();
    return Game.spawns["Spawn1"].spawnCreep(bodyParts, name, opts);
}

const spawnCreep = (bodyParts, creepMemory) => {
    if (Game.spawns['Spawn1'].spawning || Memory.spawning) {
        return;
    }
    const creepType = creepMemory.type;
    let code = _spawnCreep(bodyParts, creepType, { dryRun: true });
    if (code === OK) {
        code = _spawnCreep(bodyParts, creepType, {memory: creepMemory});
        Memory.spawning = true;
        console.log("Spawned " + creepType + " creep with code: " + code)
    } else if (code === ERR_NOT_ENOUGH_ENERGY || code === ERR_BUSY) {
        // no op
    } else {
        logError(code, "Spawn");
    }
    return code;
}

/**
 * Given a pos, returns all spots that are adjacent
 */
const getAdjacentSpots = (pos) => {
    const room = Game.spawns['Spawn1'].room;
    const offsets = [-1,0,1];
    const spots = [];
    for (const i of offsets) {
        for (const j of offsets) {
            if (i === 0 && j === 0) {
                continue;
            }
            spots.push(new RoomPosition(pos.x + i, pos.y + j, room.name));
        }
    }
    return spots;
}

/**
 * Returns the first spot that the filter function returns true on.
 * 
 * origin: RoomPosition - starting point
 * startingRange: number - How far away to look.  Only looks at tiles that are this exact range from origin
 * filterFn: (spot: RoomPosition, startingRange: number): boolean - Function called on every spot found.  
 *                                                                  Returning true from this function halts traversal
 * doNotExpandSearch: boolean (optional) - will prevent the function from expanding the search
 * 
 */
const lookAround = (origin, startingRange, filterFn, doNotExpandSearch) => {
    const roomName = Game.spawns['Spawn1'].room.name;
    let range = startingRange;
    const rangeLimit = 50;
    while (true) {
        if (range > rangeLimit) {
            console.log('lookAround has gone beyond ' + rangeLimit)
            return null;
        }
        
        const spots = [];
        const spotMap = {};
        const _checkAndPush = (x, y, name) => {
            if (x >= 0 && x < 50 && y >= 0 && y < 50) {
                const key = x + "," + y;
                if (key in spotMap) {
                    return;
                }
                spotMap[key] = true;
                spots.push(new RoomPosition(x, y, name));
            }
        }
        for (let i = -1 * range; i <= range; i += 1) {
            _checkAndPush(origin.x + i, origin.y + range, roomName);
            _checkAndPush(origin.x + i, origin.y - range, roomName);
            _checkAndPush(origin.x + range, origin.y + i, roomName);
            _checkAndPush(origin.x - range, origin.y + i, roomName);
        }
        const dists = spots.map(s => origin.getRangeTo(s));
        const ranked = spots.map((e,i) => i).sort((a,b) => dists[a] - dists[b]);
        
        for (const spotI of ranked) {
            const spot = spots[spotI];
            if (filterFn(spot, startingRange)) {
                return spot;
            }
        }
        
        if (doNotExpandSearch) {
            return null;
        }
        
        range += 1;
    }
}

const getManhattanDist = (posA, posB) => {
    return Math.abs(posA.x - posB.x) + Math.abs(posA.y - posB.y);
}

const getSpawnContainerInfo = () => {
    const spawn = Game.spawns['Spawn1'];
    const room = Game.spawns['Spawn1'].room;
    
    const structures = lookForAtArea(room, LOOK_STRUCTURES, spawn.pos, 2);
    const constructionSites = lookForAtArea(room, LOOK_CONSTRUCTION_SITES, spawn.pos, 2);
    // debugger;
    return {
        containers: structures.filter(s => s.structureType === STRUCTURE_CONTAINER),
        containerConstructionSites: constructionSites.filter(s => s.structureType === STRUCTURE_CONTAINER),
    };
}

const lookAtArea = (room, pos, range) => {
    return room.lookAtArea(pos.y - range, pos.x - range, pos.y + range, pos.x + range, true);
}

const lookForAtArea = (room, type, pos, range) => {
    return room.lookForAtArea(type, pos.y - range, pos.x - range, pos.y + range, pos.x + range, true).map(t => {
        if ('structure' in t) {
            return t.structure;
        } else if ('constructionSite' in t) {
            return t.constructionSite;
        } else {
            // debugger;
            console.log('Missing key in util.lookAtArea function: ' + JSON.stringify(t));
        }
    });
}

const getSourceContainerInfo = (source) => {
    const room = Game.spawns['Spawn1'].room;
    const stuff = lookAtArea(room, source.pos, 2);
    const constructionSites = stuff.filter(s => s.type === LOOK_CONSTRUCTION_SITES && s.constructionSite.structureType === STRUCTURE_CONTAINER);
    const containers = stuff.filter(s => s.type === LOOK_STRUCTURES &&  s.structure.structureType === STRUCTURE_CONTAINER);
    
    return {
        constructionSites,
        containers,
    };
}

module.exports = {
    lookAround,
    getAdjacentSpots,
    lookAtArea,
    getManhattanDist,
    getSpawnContainerInfo,
    lookForAtArea,
    getSourceContainerInfo,
    spawnCreep,
};