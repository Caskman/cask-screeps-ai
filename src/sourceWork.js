const { 
    getSpawnContainerInfo,
    getSourceContainerInfo,
    getAdjacentSpots,
} = require('utils');

const _getFreeAdjacentSpots = (pos) => {
    const spots = getAdjacentSpots(pos);
    const room = Game.spawns['Spawn1'].room;
    const freeSpots = spots.filter(spot => {
        const stuff = room.lookAt(spot);
        const blockers = stuff.filter(s => s.terrain === 'wall' || (s.type === 'structure' && s.structure.structureType !== 'road'));
        return blockers.length === 0;
    });
    return freeSpots;
}

const getSourceRootObj = () => {
    const memoryName = 'SOURCE_TRACKING';
    if (!(memoryName in Memory)) {
        Memory[memoryName] = {};
    }
    const rootObj = Memory[memoryName];
    return rootObj;
}

const getSourceTrackingObj = (sourceID) => {
    const rootObj = getSourceRootObj();
    if (!(sourceID in rootObj)) {
        rootObj[sourceID] = {
            previousSourceAmountsAtRegen: [],
            checkTickstamp: 1,
            
            // harvester
            harvesterBlockageHistory: [],
            harvesterBlockedLastTick: false,
            harvesterBodyPartBudget: 200,
            harvesterCount: 1,

            // hauler
            haulerBlockageHistory: [],
            haulerBlockedLastTick: false,
            haulerBodyPartBudget: 200,
            haulerCount: 1,
            
            // old properties
            blockedHarvesterPressure: 0,
            blockedHaulerPressure: 0,
        }
    }
    return rootObj[sourceID];
}

const printSourceHarvestingEfficiency = () => {
    const rootObj = getSourceRootObj();

    const sourceIDs = Object.keys(rootObj);
    const percentages = sourceIDs.map(sourceID => {
        const source = Game.getObjectById(sourceID);
        const trackingData = rootObj[sourceID];
        const amountHistory = trackingData.previousSourceAmountsAtRegen;
        const numerator = amountHistory.length > 0 ? amountHistory[amountHistory.length-1] : source.energyCapacity;
        const percentage = Math.floor((numerator * 100) / source.energyCapacity);
        return percentage;
    });
    
    // debugger;
    const percentageStats = getStringStats(percentages, 'Source %');
    const supplyStats = getStringBlockedPercentages();
    const stats = [percentageStats].concat(supplyStats);
    const sink = getSinkBlockedPercentage();
    const sinkStats = 'Sink %: ' + sink;
    stats.push(sinkStats);
    const finalString = stats.reduce((m,s,i) => m + (i == 0 ? '' : ' | ') + s, '');
    console.log(finalString);
    // const max = _.max(percentages);
    // const min = _.min(percentages);
    // const average = Math.floor(_.sum(percentages) / percentages.length);
    // console.log('Avg ' + average + ' Max ' + max + ' Min ' + min);
}

const getStringBlockedPercentages = () => {
    const rootObj = getSourceRootObj();
    const sourceIDs = Object.keys(rootObj);
    const haulers = sourceIDs.map(sourceID => getHaulerBlockagePercentage(sourceID));
    const harvesters = sourceIDs.map(sourceID => getHarvesterBlockagePercentage(sourceID));
    return [ getStringStats(haulers, 'Hauler %'), getStringStats(harvesters, 'Harvester %') ];
}

const getStringStats = (data, label) => {
    const max = _.max(data);
    const min = _.min(data);
    const average = Math.floor(_.sum(data) / data.length);
    const string = label + ': Avg ' + average + ' Max ' + max + ' Min ' + min;
    return string;
}

const trackSourceEfficiency = (sources) => {
    sources.forEach(source => {
        const trackingObj = getSourceTrackingObj(source.id);
        if (source.ticksToRegeneration === 1) {
            // Record previous source energy amount at regen
            trackingObj.previousSourceAmountsAtRegen.push(source.energy);
        }
    });
}

const setHaulerBlocked = (contextObj, jobID) => {
    const sourceWorkObj = contextObj.fetchInfo("sourceWork");
    const sourceID = sourceWorkObj.jobIDToSourceID[jobID];
    const tracking = getSourceTrackingObj(sourceID);
    tracking.haulerBlockedLastTick = true;
}

const setHarvesterBlocked = (contextObj, jobID) => {
    const sourceWorkObj = contextObj.fetchInfo("sourceWork");
    const sourceID = sourceWorkObj.jobIDToSourceID[jobID];
    const tracking = getSourceTrackingObj(sourceID);
    tracking.harvesterBlockedLastTick = true;
}

const trackPipelineBlockageAndPressure = (sourceWorkList) => {
    // new tracking with percentages
    for (const sourceWork of sourceWorkList) {
        const sourceID = sourceWork.sourceID;
        const trackingObj = getSourceTrackingObj(sourceID);
        
        // harvester
        trackingObj.harvesterBlockageHistory.push(trackingObj.harvesterBlockedLastTick);
        trackingObj.harvesterBlockedLastTick = false;
        if (trackingObj.harvesterBlockageHistory.length > 100) {
            trackingObj.harvesterBlockageHistory.shift();
        }

        // hauler
        trackingObj.haulerBlockageHistory.push(trackingObj.haulerBlockedLastTick);
        trackingObj.haulerBlockedLastTick = false;
        if (trackingObj.haulerBlockageHistory.length > 100) {
            trackingObj.haulerBlockageHistory.shift();
        }
    }

    // old tracking with pressure
    // const PRESSURE_INCREASE = 10;

    // for (const sourceWork of sourceWorkList) {
    //     const trackingObj = getSourceTrackingObj(sourceWork.sourceID);
        

    //     // When blockages exist, pressure increases linearly but at a higher rate
    //     if (trackingObj.harvesterBlockedLastTick) {
    //         trackingObj.blockedHarvesterPressure += PRESSURE_INCREASE;
    //     } else {
    //         // Pressure decays exponentially
    //         trackingObj.blockedHarvesterPressure = Math.max(0, Math.floor(trackingObj.blockedHarvesterPressure / 2));
    //     }
    //     trackingObj.harvesterBlockedLastTick = false;
        
    //     if (trackingObj.haulerBlockedLastTick) {
    //         trackingObj.blockedHaulerPressure += PRESSURE_INCREASE;
    //     } else {
    //         // Pressure decays exponentially
    //         trackingObj.blockedHaulerPressure = Math.max(0, Math.floor(trackingObj.blockedHaulerPressure / 2));
    //     }
    //     trackingObj.haulerBlockedLastTick = false;
    // }
    
    // Track sink blockage
    const sinkDetails = getSinkDetails();
    sinkDetails.blockageHistory.push(sinkDetails.sinkBlocked);
    if (sinkDetails.blockageHistory.length > 100) {
        sinkDetails.blockageHistory.shift();
    }
    if (sinkDetails.sinkBlocked) {
        sinkDetails.sinkBlocked = false;
    }
}

const HAULER_PRESSURE_THRESHOLD = 50;
const HARVESTER_PRESSURE_THRESHOLD = 100;

const manageWorkerNeed = (sourceWorkList) => {
    // Increment needs as necessary
    /**
     * Only one part of each pipeline needs to increment when improving the pipeline
     * Sink increases when max hauler blockage is past threshold
     * else Hauler increases when harvester blockage is past threshold
     * else Harvester increases when source is above 0
     */
    let thereExistsHaulerBlockageOverThreshold = false;
    for (const sourceWork of sourceWorkList) {
        const sourceID = sourceWork.sourceID;

        if (!isTimeToCheckSupplyLine(sourceID)) {
            // do nothing
        } else if (haulerBlockageOverThreshold(sourceID)) {
            thereExistsHaulerBlockageOverThreshold = true;
        } else if (harvesterBlockageOverThreshold(sourceID)) {
            increaseHaulerEffort2(sourceID);
            updateSourceCheckTickstampForModification(sourceID);
        } else if (getLastSourceValue(sourceID) > 0) {
            increaseHarvesterEffort2(sourceID);
            updateSourceCheckTickstampForModification(sourceID);
        } else {
            updateSourceCheckTickstampForRoutineCheck(sourceID);
        }
    }
    
    // Manage sink effort
    if (isTimeToCheckSink()) {
        if (thereExistsHaulerBlockageOverThreshold) {
            // debugger;
            increaseSinkEffort();
            updateSourceCheckTickstampsForSinkModification(sourceWorkList);
            updateSinkCheckTickstampForModification();
        } else if (shouldDecreaseSinkEffort()) {
            // debugger;
            decreaseSinkEffort();
            updateSourceCheckTickstampsForSinkModification(sourceWorkList);
            updateSinkCheckTickstampForModification();
        } else {
            updateSinkCheckTickstampForRoutineCheck();
        }
    }

    
    // // old version of managing job effort
    // // Increment needs as necessary
    // /**
    //  * Only one part of each pipeline needs to increment at any given time
    //  * 
    //  * Harvester increments when source regen amount is nonzero and no harvester pressure
    //  * 
    //  * Hauler increments when there is harvester pressure and no hauler pressure
    //  * 
    //  * Sink increments when there is hauler pressure
    //  */
    // if (Game.time % 100 !== 0) {
    //     // Only check semi periodically
    //     return;
    // }
    
    // let minHaulerPressure = Number.MIN_SAFE_INTEGER;
    // for (const sourceWork of sourceWorkList) {
    //     const tracking = getSourceTrackingObj(sourceWork.sourceID);
    //     minHaulerPressure = Math.max(tracking.blockedHaulerPressure, minHaulerPressure);
    //     const sourceHistory = tracking.previousSourceAmountsAtRegen;
    //     const lastSourceValue = sourceHistory.length > 0 ? sourceHistory[sourceHistory.length-1] : 0;

    //     if (tracking.blockedHaulerPressure > HAULER_PRESSURE_THRESHOLD) {
    //         // do nothing as we need to increase sink effort
    //     } else if (tracking.blockedHarvesterPressure > HARVESTER_PRESSURE_THRESHOLD) {
    //         // Increase hauler effort
    //         increaseHaulerEffort(tracking);
    //     } else if (lastSourceValue > 0) {
    //         // Increase harvester effort
    //         increaseHarvesterEffort(tracking);
    //     }
    // }

    // // Manage sink effort
    // if (isTimeToCheckSink()) {
    //     setNewSinkCheckTickstamp();
    //     const shouldModifySink = minHaulerPressure > HAULER_PRESSURE_THRESHOLD;
    //     if (shouldModifySink) {
    //         increaseSinkEffort();
    //     } else if (shouldDecreaseSinkEffort()) {
    //         decreaseSinkEffort();
    //     }
    // }
}

const getLastSourceValue = (sourceID) => {
    const trackingObj = getSourceTrackingObj(sourceID);
    const history = trackingObj.previousSourceAmountsAtRegen;
    const lastSourceValue = history.length > 0 ? history[history.length-1] : 0;
    return lastSourceValue;
}

const CHECK_MODIFICATION_PERIOD = 200;
const CHECK_ROUTINE_PERIOD = 100;

const updateSourceCheckTickstampForModification = (sourceID) => {
    const trackingObj = getSourceTrackingObj(sourceID);
    trackingObj.checkTickstamp = Game.time + CHECK_MODIFICATION_PERIOD;
}

const updateSourceCheckTickstampForRoutineCheck = (sourceID) => {
    const trackingObj = getSourceTrackingObj(sourceID);
    trackingObj.checkTickstamp = Game.time + CHECK_ROUTINE_PERIOD;
}

const updateSourceCheckTickstampsForSinkModification = (sourceWorkList) => {
    for (const sourceWork of sourceWorkList) {
        const sourceID = sourceWork.sourceID;
        updateSourceCheckTickstampForModification(sourceID);
    }
}

const updateSinkCheckTickstampForModification = () => {
    const details = getSinkDetails();
    details.checkAgainTickstamp = Game.time + CHECK_MODIFICATION_PERIOD;
}

const updateSinkCheckTickstampForRoutineCheck = () => {
    const details = getSinkDetails();
    details.checkAgainTickstamp = Game.time + CHECK_ROUTINE_PERIOD;
}

const HAULER_BLOCKAGE_THRESHOLD = 15;
const HARVESTER_BLOCKAGE_THRESHOLD = 15;

const getHaulerBlockageThreshold = () => HAULER_BLOCKAGE_THRESHOLD;
const getHarvesterBlockageThreshold = () => HARVESTER_BLOCKAGE_THRESHOLD;

const getHaulerBlockagePercentage = (sourceID) => {
    const trackingObj = getSourceTrackingObj(sourceID);
    return calculateBlockagePercentage(trackingObj.haulerBlockageHistory);
}

const getHarvesterBlockagePercentage = (sourceID) => {
    const trackingObj = getSourceTrackingObj(sourceID);
    return calculateBlockagePercentage(trackingObj.harvesterBlockageHistory);
}

const haulerBlockageOverThreshold = (sourceID) => {
    return getHaulerBlockagePercentage(sourceID) > getHaulerBlockageThreshold();
}

const harvesterBlockageOverThreshold = (sourceID) => {
    return getHarvesterBlockagePercentage(sourceID) > getHarvesterBlockageThreshold();
}

const isTimeToCheckSupplyLine = (sourceID) => {
    const trackingObj = getSourceTrackingObj(sourceID);
    return Game.time >= trackingObj.checkTickstamp;
}

const increaseHaulerEffort2 = (sourceID) => {
    const trackingObj = getSourceTrackingObj(sourceID);
    increaseHaulerEffort(trackingObj);
}

const increaseHarvesterEffort2 = (sourceID) => {
    const trackingObj = getSourceTrackingObj(sourceID);
    increaseHarvesterEffort(trackingObj);
}

const increaseHarvesterEffort = (trackingObj) => {
    const newBudget = getIncreasedBodyPartsBudget(trackingObj.harvesterBodyPartBudget);
    if (newBudget > trackingObj.harvesterBodyPartBudget) {
        console.log('Increasing harvester body parts');
    }
    trackingObj.harvesterBodyPartBudget = newBudget;
}

const increaseHaulerEffort = (trackingObj) => {
    const newBudget = getIncreasedBodyPartsBudget(trackingObj.haulerBodyPartBudget);
    if (newBudget > trackingObj.haulerBodyPartBudget) {
        console.log('Increasing hauler body parts');
    }
    trackingObj.haulerBodyPartBudget = newBudget;
}

// True if current sink body parts are at max of spawn's budget
const atSinkSpawnBudget = () => {
    const {bodyPartsBudget} = getSinkDetails();
    const spawnBudget = getSpawnMaxBudget();
    return bodyPartsBudget >= spawnBudget;
}

const SINK_DETAILS_MEMORY_NAME = 'SINK_DETAILS';

// Returns details for Sink jobs
const getSinkDetails = () => {
    if (!(SINK_DETAILS_MEMORY_NAME in Memory)) {
        Memory[SINK_DETAILS_MEMORY_NAME] = {
            count: 1,
            bodyPartsBudget: 200,
            blockageHistory: [],
            sinkBlocked: false,
            checkAgainTickstamp: 1,
        }
    }
    return Memory[SINK_DETAILS_MEMORY_NAME];
}

const overSinkPopCount = (contextObj) => {
    const details = getSinkDetails();
    const counts = contextObj.fetchInfo("creepCounts");
    return ("BUILDER" in counts) && counts["BUILDER"] > details.count;
}

const setSinkBlocked = () => {
    const details = getSinkDetails();
    details.sinkBlocked = true;
}

const isTimeToCheckSink = () => {
    const details = getSinkDetails();
    return Game.time >= details.checkAgainTickstamp;
}

const shouldDecreaseSinkEffort = () => {
    const percentageBlocked = getSinkBlockedPercentage();
    return percentageBlocked > 25;
}

const getSinkBlockedPercentage = () => {
    const { blockageHistory } = getSinkDetails();
    return calculateBlockagePercentage(blockageHistory);
    // const sum = _.sum(blockageHistory.map(v => v ? 1 : 0));
    // return Math.floor((sum * 100) / blockageHistory.length);
}

const calculateBlockagePercentage = (history) => {
    const sum = _.sum(history.map(v => v ? 1 : 0));
    return Math.floor((sum * 100) / history.length);
}

const decreaseSinkEffort = () => {
    console.log('decreasing sink count')
    decreaseSinkCount();
}

const increaseSinkEffort = () => {
    if (atSinkSpawnBudget()) {
        console.log('increasing sink count')
        increaseSinkCount();
    } else {
        console.log('increasing sink body parts')
        increaseSinkBodyParts();
        // decreaseSinkCount();
    }
}

const increaseSinkCount = () => {
    const details = getSinkDetails();
    details.count += 1;
}

const decreaseSinkCount = () => {
    const details = getSinkDetails();
    details.count = Math.max(1, Math.floor(details.count / 2));
}

// Will increase body parts budget by half of the difference between current body parts and spawn budget with a min increase of 50
const increaseSinkBodyParts = () => {
    const details = getSinkDetails();
    const currentBudget = details.bodyPartsBudget;
    details.bodyPartsBudget = getIncreasedBodyPartsBudget(currentBudget);
}

const getIncreasedBodyPartsBudget = (currentBudget) => {
    const spawnBudget = getSpawnMaxBudget();
    const halvedDiff = (spawnBudget - currentBudget) / 2;
    const diffIn50Increments = Math.max(1, Math.floor(halvedDiff / 50));
    const diffIn50Multiple = diffIn50Increments * 50;
    const increasedBudget = currentBudget + diffIn50Multiple;
    return Math.min(increasedBudget, spawnBudget);
}

const generateHarvesterBodyPartsFromBudget = (budget) => {
    const parts = [MOVE];
    let remainingBudget = budget - BODYPART_COST[MOVE];
    const numWork = Math.floor(remainingBudget / BODYPART_COST[WORK]);
    remainingBudget = remainingBudget - (BODYPART_COST[WORK] * numWork);
    const extraMove = Math.floor(remainingBudget / BODYPART_COST[MOVE]);

    addPartsToArray(parts, WORK, numWork);
    addPartsToArray(parts, MOVE, extraMove);
    return parts;
}

const generateHaulerBodyPartsFromBudget = (budget) => {
    const incrementsOf50 = Math.floor(budget / 50);
    const carryBudgetIncrements = Math.ceil(incrementsOf50 / 2);
    const moveBudgetIncrements = incrementsOf50 - carryBudgetIncrements;
    const parts = [];
    addPartsToArray(parts, CARRY, carryBudgetIncrements);
    addPartsToArray(parts, MOVE, moveBudgetIncrements);
    return parts;
}

// One MOVE, split remaining between WORK and CARRY but favor CARRY
const generateSinkBodyPartsFromBudget = (budget) => {
    const workBudget = budget / 2;
    let numWork = Math.max(1, Math.ceil(workBudget / BODYPART_COST[WORK]));
    const remainingBudgetAfterWork = budget - (numWork * BODYPART_COST[WORK]);
    const budgetForBasics = BODYPART_COST[MOVE] + BODYPART_COST[CARRY];
    if (remainingBudgetAfterWork < budgetForBasics) {
        numWork = numWork - 1;
    }
    
    let remainingBudget = budget - (numWork * BODYPART_COST[WORK]);
    const numMove = Math.max(1, Math.ceil(remainingBudget / 2 / BODYPART_COST[MOVE]));
    remainingBudget = remainingBudget - (numMove * BODYPART_COST[MOVE]);
    const numCarry = Math.floor(remainingBudget / BODYPART_COST[CARRY]);
    const parts = [];
    
    addPartsToArray(parts, WORK, numWork);
    addPartsToArray(parts, CARRY, numCarry);
    addPartsToArray(parts, MOVE, numMove);
    return parts;
}

const underSinkBodyPartBudget = (creep) => {
    const { bodyPartsBudget } = getSinkDetails();
    const currentCost = getCreepBodyPartsCost(creep);
    return currentCost < bodyPartsBudget;
}

const underHarvesterBodyPartBudget = (contextObj, creep) => {
    const m = creep.memory;
    const jobID = m.jobID;
    const sourceWork = contextObj.fetchInfo("sourceWork");
    const sourceID = sourceWork.jobIDToSourceID[jobID];
    const trackingObj = getSourceTrackingObj(sourceID);
    const bodyPartsBudget = trackingObj.harvesterBodyPartBudget;
    const currentCost = getCreepBodyPartsCost(creep);
    return currentCost < bodyPartsBudget;
}

const underHaulerBodyPartBudget = (contextObj, creep) => {
    const m = creep.memory;
    const jobID = m.jobID;
    const sourceWork = contextObj.fetchInfo("sourceWork");
    const sourceID = sourceWork.jobIDToSourceID[jobID];
    const trackingObj = getSourceTrackingObj(sourceID);
    const bodyPartsBudget = trackingObj.haulerBodyPartBudget;
    const currentCost = getCreepBodyPartsCost(creep);
    return currentCost < bodyPartsBudget;
}

// Secondary Sink Functions Boundary

const addPartsToArray = (parts, type, num) => {
    for (let i = 0; i < num; i++) {
        parts.push(type);
    }
}

const getCreepBodyPartsCost = (creep) => {
    const bodyPartsArray = creep.body.map(p => p.type);
    const costs = bodyPartsArray.map(p => BODYPART_COST[p]);
    const sum = _.sum(costs);
    return sum;
}

const getSpawnMaxBudget = () => {
    const spawn = Game.spawns['Spawn1'];
    const extensions = spawn.room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_EXTENSION }
    });
    const extensionsCapacity = extensions.map(e => e.store.getCapacity(RESOURCE_ENERGY));
    const budget = spawn.store.getCapacity(RESOURCE_ENERGY) + _.sum(extensionsCapacity);
    // console.log('spawn budget is ' + budget);
    return budget;
}

const _composeSourceWorkForSource = (source, creepCounts, populateJobsWithCreepNames) => {
    const spawn = Game.spawns['Spawn1'];
    const sourceID = source.id;
    const jobObj = {sourceID};
    
    // Add harvester job if there's a container available
    const { constructionSites, containers } = getSourceContainerInfo(source);
    if (containers.length > 0) {
        const sourceContainer = containers[0];
        jobObj.containerID = sourceContainer.structure.id;

        const harvesterJobs = [{
            id: "HARVESTER_JOB_" + source.id + "_0",
            target: source.id,
            destination: jobObj.containerID,
        }];
        jobObj.harvesterJobs = harvesterJobs;
        populateJobsWithCreepNames(jobObj.harvesterJobs);
    }
    
    let harvesterJobFilled = false;
    if (jobObj.harvesterJobs) {
        harvesterJobFilled = jobObj.harvesterJobs.filter(j => !j.creepName).length === 0;
    }
    
    // Create Hauler jobs only if source container is setup and harvester job is filled
    if (jobObj.containerID && harvesterJobFilled) {
        // destination should be spawn container if extensionfiller exists, otherwise dump into spawn
        let destination = spawn.id;
        const extensionFillerCount = "EXTENSIONFILLER" in creepCounts ? creepCounts["EXTENSIONFILLER"] : 0;
        if (extensionFillerCount > 0) {
            const { containers } = getSpawnContainerInfo();
            if (containers.length > 0) {
                destination = containers[0].id;
            }
        }
        
        const haulerJobs = [{
            id: "HAULER_JOB_" + source.id + "_0",
            target: jobObj.containerID,
            destination,
        }];
        jobObj.haulerJobs = haulerJobs;
        populateJobsWithCreepNames(jobObj.haulerJobs);
    }
    
    let haulerJobFilled = false;
    if (jobObj.haulerJobs) {
        haulerJobFilled = jobObj.haulerJobs.filter(j => !j.creepName).length === 0;
    }

    return jobObj;
}

/**
 * 
 */
const getSourceWork = (creepCounts) => {
    const room = Game.spawns['Spawn1'].room;
    const spawn = Game.spawns['Spawn1'];
    
    let sources = Game.spawns['Spawn1'].room.find(FIND_SOURCES);
    
    // Filter out sources too close to source keeper lairs
    const acceptableDistance = 10;
    const sourceKeeperLairs = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_KEEPER_LAIR
    })
    sources = sources.filter(s => {
        const closeSourceKeepers = sourceKeeperLairs.filter(k => s.pos.getRangeTo(k.pos) <= acceptableDistance);
        return closeSourceKeepers.length === 0;
    });
    
    trackSourceEfficiency(sources);
    
    // Create map of [jobID]: creepName
    const jobIDToCreepName = {};
    for (const creepI in Game.creeps) {
        const creep = Game.creeps[creepI];
        const m = creep.memory;
        if (m.jobID) {
            jobIDToCreepName[m.jobID] = creep.name;
        }
    }
    
    const populateJobsWithCreepNames = (jobs) => {
        jobs.forEach(job => {
            if (job.id in jobIDToCreepName) {
                job.creepName = jobIDToCreepName[job.id];
            }
        });
    }

    const dists = sources.map(s => spawn.pos.getRangeTo(s));
    const sourcesIndexRanked = sources.map((e,i) => i).sort((a, b) => dists[a] - dists[b]);
    
    // Create work list
    const workList = sourcesIndexRanked.map(sourceI => {
        const source = sources[sourceI];
        return _composeSourceWorkForSource(source, creepCounts, populateJobsWithCreepNames);
    });
    
    const _isSupplyLineComplete = (w) => w.containerID
        && w.harvesterJobs && w.harvesterJobs.filter(j => !j.creepName).length === 0
        && w.haulerJobs && w.haulerJobs.filter(j => !j.creepName).length === 0;
    const getCompletedSupplyLines = () => {
        return workList.filter(w => _isSupplyLineComplete(w));
    }
    const getUncompletedSupplyLines = () => {
        return workList.filter(w => !_isSupplyLineComplete(w));
    }

    // Track pipeline blockages here since we'll have source work populated with creep names at this point
    trackPipelineBlockageAndPressure(workList);
    // Manage needs for workers here since blockage and pressure were just updated
    manageWorkerNeed(getCompletedSupplyLines());

    
    // Populate job map [jobID]: jobObject
    // And populate jobIDToSourceID
    const jobMap = {};
    const jobIDToSourceID = {};
    workList.forEach(sourceWork => {
        sourceWork.harvesterHaulerJobs?.forEach(j => {
            jobMap[j.id] = j;
            jobIDToSourceID[j.id] = sourceWork.sourceID;
        });
        sourceWork.harvesterJobs?.forEach(j => {
            jobMap[j.id] = j;
            jobIDToSourceID[j.id] = sourceWork.sourceID;
        });
        sourceWork.haulerJobs?.forEach(j => {
            jobMap[j.id] = j;
            jobIDToSourceID[j.id] = sourceWork.sourceID;
        });
    });

    if (!("SOURCE_ROAD_STATUS" in Memory)) {
        Memory["SOURCE_ROAD_STATUS"] = {};
    }
    
    return {
        workList,
        jobMap, // jobMap is [jobID]: jobObject
        jobIDToSourceID, // [jobID]: sourceID
        getSourceRoadStatus: (sourceID) => {
            return Memory["SOURCE_ROAD_STATUS"][sourceID];
        },
        setSourceRoadStatus: (sourceID, status) => {
            Memory["SOURCE_ROAD_STATUS"][sourceID] = status;
        },
        getCompletedSupplyLines,
        getUncompletedSupplyLines,
    };
}

module.exports = {
    getSourceWork,
    setHaulerBlocked,
    setHarvesterBlocked,
    setSinkBlocked,
    getSinkDetails,
    overSinkPopCount,
    generateSinkBodyPartsFromBudget,
    generateHaulerBodyPartsFromBudget,
    generateHarvesterBodyPartsFromBudget,
    underSinkBodyPartBudget,
    underHarvesterBodyPartBudget,
    underHaulerBodyPartBudget,
    getSourceTrackingObj,
    printSourceHarvestingEfficiency,
};