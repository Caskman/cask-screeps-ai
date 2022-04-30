const { runCreeps } = require('creeps');
const { getSourceWork, printSourceHarvestingEfficiency } = require('sourceWork');
const { getSourceWorkDecisions } = require('sourceWorkDecisions');
const { getSpawnDecisions } = require('spawnDecision');

const { logError } = require('logging');

const getCreepCounts = () => {
    const creepCounts = {};
    for (const creepI in Game.creeps) {
        const creep = Game.creeps[creepI];
        const creepType = creep.memory.type;
        if (!(creepType in creepCounts)) {
            creepCounts[creepType] = 0;
        }
        creepCounts[creepType] += 1;
    }
    return creepCounts;
}

const getExtensionStructureInfo = () => {
    const extensions = Game.spawns['Spawn1'].room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_EXTENSION }
    })
    const extensionSites = Game.spawns['Spawn1'].room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: { structureType: STRUCTURE_EXTENSION }
    })
    
    return {
        extensions,
        extensionSites,
    };
}
/**
 * 
 */
const decisions = [
    ...getSpawnDecisions(),
    ...getSourceWorkDecisions(),
];

const getContextObj = () => {
    const decisionMap = {};
    const creepCounts = getCreepCounts();
    const sourceWork = getSourceWork(creepCounts);
    const { workList, jobMap } = sourceWork;
    const contextInfo = {
        creepCounts,
        extensionInfo: getExtensionStructureInfo(),
        sourceWork,
    };
    // Map all decisions
    for (const dec of decisions) {
        if (dec.name in decisionMap) {
            console.log("Dupe name found in decisions: " + dec.name);
            return;
        }
        decisionMap[dec.name] = dec;
    }
    
    const contextObj = {
        fetchInfo: (key) => {
            if (!(key in contextInfo)) {
                console.log("Key not available in context info: " + key);
            }
            return contextInfo[key];
        },
        fetchCondition: (key) => {
            if (!(key in decisionMap)) {
                console.log("Key not available in decisions: " + key);
            }
            return decisionMap[key].condition(contextObj);
        },
        fetchJob: (jobID) => {
            return jobMap[jobID];
        },
    };
    
    return contextObj;
}

const runDecisions = (contextObj) => {


    // Execute all decisions
    for (const dec of decisions) {
        let conditionResult;
        try {
            conditionResult = dec.condition(contextObj);
        } catch (err) {
            console.log('Error running condition of ' + dec.name);
            throw err;
        }
        if (conditionResult) {
            try {
                dec.action(contextObj, conditionResult);
            } catch (err) {
                console.log('Error running action of ' + dec.name);
                throw err;
            }
        }
    }
}

const test = (contextObj) => {
}

const deleteRoadConstructionSites = () => {
    const room = Game.spawns['Spawn1'].room;
    const roads = room.find(FIND_CONSTRUCTION_SITES, {
        filter: c => c.structureType === STRUCTURE_ROAD,
    });
    roads.forEach(r => r.remove());
}

const _checkDebugCommand = (name, fn) => {
    const memoryName = "DEBUG_COMMANDS";
    const memoryObj = Memory[memoryName] || {};
    if (name in memoryObj && memoryObj[name]) {
        memoryObj[name] = false;
        Memory[memoryName] = memoryObj;
        fn();
    }
    memoryObj[name] = false;
    Memory[memoryName] = memoryObj;
}

const runDebugCommands = () => {
    _checkDebugCommand('DEBUG_TEST', () => test(contextObj));
    _checkDebugCommand('DEBUG_DELETE_ROAD_CONSTRUCTION_SITES', deleteRoadConstructionSites);
    _checkDebugCommand('CHECK_CPU', () => {
        const c = Game.cpu;
        console.log('cpu limit: ' + c.limit + " tickLimit: " + c.tickLimit + " bucket: " + c.bucket);
    });
}

const getTimestamp = () => Math.floor(+new Date());

const getTickSpeedTracking = () => {
    const memoryName = 'TICK_SPEED_TRACKING';
    if (!(memoryName in Memory)) {
        Memory[memoryName] = {
            history: [],
            previousTickSystime: getTimestamp(),
        };
    }
    return Memory[memoryName];
}

const trackTickSpeed = () => {
    const details = getTickSpeedTracking();
    const { history, previousTickSystime } = details;
    const timestamp = getTimestamp();
    const previousTickSpeed = timestamp - previousTickSystime;
    history.push(previousTickSpeed);
    if (history.length > 10) {
        history.shift();
    }
    details.previousTickSystime = timestamp;
    
    if (Game.time % 141 === 0) {
        const avg = Math.floor(_.sum(history) / history.length);
        console.log('Avg Tick Duration ' + avg);
    }
}

module.exports.loop = function () {
    const start = getTimestamp();
    trackTickSpeed();
    const contextObj = getContextObj();

    runDebugCommands();
    if (Game.time % 113 === 0) printSourceHarvestingEfficiency();
    
    Memory.spawning = false;

    runDecisions(contextObj);
    runCreeps(contextObj);
    
    // Clean up dead creeps
    for (const creepI in Memory.creeps) {
        if(!Game.creeps[creepI]) {
            delete Memory.creeps[creepI];
        }
    }
    const end = getTimestamp();
    // console.log("Elapsed: "+(end - start) + " ms");
}