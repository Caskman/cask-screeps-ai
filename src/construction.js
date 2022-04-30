const { lookAround, getAdjacentSpots, getManhattanDist } = require('utils');
const { logError } = require('logging');

const ensureControllerRoad = () => {
    const src = Game.spawns['Spawn1'].pos;
    const target = Game.spawns['Spawn1'].room.controller.pos;
    
    const pathObj = PathFinder.search(src, { pos: target, range: 1 });
    if (pathObj.incomplete) {
        console.log("Road path is incomplete");
    }
    return buildPath(pathObj.path, "Controller Road Building");
}

const ensureSpawnRoad = () => {
    const room = Game.spawns['Spawn1'].room;
    const path = getAdjacentSpots(Game.spawns['Spawn1'].pos);

    return buildPath(path, "Spawn Road Building");
}

const _clampBounds = (spot, r) => {
    const _clamp = v => Math.max(Math.min(v,49),0);
    return {
        top: _clamp(spot.y - r),
        left: _clamp(spot.x - r),
        bottom: _clamp(spot.y + r),
        right: _clamp(spot.x + r),
    }
}

const buildExtensions = (amount) => {
    const origin = Game.spawns['Spawn1'].pos;
    let spots = 0;
    const room = Game.spawns['Spawn1'].room;
    
    const _canBuildExtensionHere = (spot) => {
        const r = 1;
        const { top, left, bottom, right } = _clampBounds(spot, r);
        const adjObjects = room.lookAtArea(top, left, bottom, right, true);
        const adjBlockers = adjObjects.filter(o => 
            o.type === 'source'
            || (o.type === 'structure'
                && _.includes([STRUCTURE_SPAWN, STRUCTURE_CONTAINER, STRUCTURE_CONTROLLER], o.structure.structureType))
        );
        const roads = adjObjects.filter(o => o.type === 'structure' && o.structure.structureType === STRUCTURE_ROAD);
        const roadsOnSite = room.lookForAt(LOOK_STRUCTURES, spot);
        
        if (adjBlockers.length > 0 || roads.length === 0 || roadsOnSite.length > 0) {
            return false;
        }
        
        const code = room.createConstructionSite(spot, STRUCTURE_EXTENSION);
        if (code === OK) {
            spots += 1;
        } else if (code === ERR_INVALID_TARGET) {
            return false;
        } else {
            logError(code, "buildExtensions");
        }

        return spots >= amount;
    }
    lookAround(origin, 2, _canBuildExtensionHere);
    
}

const buildRoadPointToPoint = (startPos, endPos, src, range) => {
    if (!range) {
        range = 1;
    }
    const pathObj = PathFinder.search(startPos, { pos: endPos, range });
    if (pathObj.incomplete) {
        console.log("Road path is incomplete for: " + src);
    }
    return buildPath(pathObj.path, src);
}

const buildContainerForSource = (source) => {
    // Build adjacent to source and adjacent to source road
    // within 2 spots of source && not on road && adjacent to road && closest to spawn
    const room = Game.spawns['Spawn1'].room;
    const spawn = Game.spawns['Spawn1'];
    
    const validSpots = [];
    lookAround(source.pos, 1, (spot) => {

        // // Is 2 tiles away from source
        // if (spot.getRangeTo(source.pos) !== 2) {
        //     return false;
        // }
        
        // Unobstructed and not a road
        const stuff = room.lookAt(spot);
        const blockers = stuff.filter(s => s.terrain === 'wall' || s.type === LOOK_STRUCTURES);
        if (blockers.length > 0) {
            return false;
        }
        
        // Adjacent to road
        const adjacentSpots = getAdjacentSpots(spot);
        // Filter to spots that have roads
        const spotsWithRoad = adjacentSpots.filter(s => {
            // Look at stuff on this tile for roads
            const stuff = room.lookForAt(LOOK_STRUCTURES, s);
            const roads = stuff.filter(t => t.structureType === STRUCTURE_ROAD);
            return roads.length > 0;
        });
        if (spotsWithRoad.length > 0) {
            validSpots.push(spot);
        }
        
        return false;
    }, true)
    
    // Sort by range to spawn
    const dists = validSpots.map(s => getManhattanDist(s,spawn.pos));
    const ranked = validSpots.map((e,i) => i).sort((a,b) => dists[a] - dists[b]);
    const constructionSpot = validSpots[ranked[0]];

    const code = room.createConstructionSite(constructionSpot, STRUCTURE_CONTAINER);
    
    if (code === OK) {
        // no op
    } else {
        logError(code, "Building Source Containers");
    }
    return code;
}

const buildContainerForSpawn = () => {
    // look at spots that are in within 2 range of spawn
    const room = Game.spawns['Spawn1'].room;
    const spawn = Game.spawns['Spawn1'];

    const spots = [];
    lookAround(spawn.pos, 1, s => {spots.push(s); return false;}, true);
    // debugger;
    
    // must be clear of structures and natural walls
    const unobstructedSpots = spots.filter(spot => {
        const structures = room.lookForAt(LOOK_STRUCTURES, spot);
        if (structures.length !== 0) {
            return false;
        }
        
        const walls = room.lookForAt(LOOK_TERRAIN, spot).filter(t => t.terrain === 'wall');
        return walls.length === 0;
    });
    
    // Sort by manhattan distance to controller
    const controller = spawn.room.controller;
    const dists = unobstructedSpots.map(s => getManhattanDist(controller.pos, s));
    const rankedUnobstructedSpots = unobstructedSpots
        .map((e,i) => i)
        .sort((a,b) => dists[a] - dists[b])
        .map(i => unobstructedSpots[i]);
    
    // Build
    if (rankedUnobstructedSpots.length === 0) {
        console.log("There are no spots to build the spawn container")
        return;
    }
    
    const theSpot = rankedUnobstructedSpots[0];
    const code = room.createConstructionSite(theSpot, STRUCTURE_CONTAINER);
    if (code === OK) {
        // no op
    } else {
        logError(code, "Building container for spawn");
    }
    
}

const buildPath = (pathArray, src) => {
    const room = Game.spawns['Spawn1'].room;
    let completed = true;
    for (const step of pathArray) {
        const code = room.createConstructionSite(step, STRUCTURE_ROAD);
        if (code === OK) {
            completed = false;
        } else if (code === ERR_INVALID_TARGET) {
            const stuff = room.lookForAt(LOOK_CONSTRUCTION_SITES, step);
            if (stuff.length > 0) {
                completed = false;
            }
        } else {
            logError(code, src);
        }
    }
    return completed;
}

module.exports = {
    ensureSpawnRoad,
    ensureControllerRoad,
    buildExtensions,
    buildRoadPointToPoint,
    buildContainerForSource,
    buildContainerForSpawn,
};