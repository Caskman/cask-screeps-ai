const {
    buildContainerForSource,
    buildRoadPointToPoint,
} = require('construction');
const { 
    getSourceContainerInfo,
    getSpawnContainerInfo,
    spawnCreep,
} = require('utils');
const { getSourceTrackingObj, generateHaulerBodyPartsFromBudget, generateHarvesterBodyPartsFromBudget } = require('sourceWork');


const getSourceWorkDecisions = () => [
    {
        name: "Harvesters",
        condition: (contextObj) => {
            const work = contextObj.fetchInfo("sourceWork");
            const { containers } = getSpawnContainerInfo();
            if (containers.length === 0) {
                return false;
            }

            const unCompletedSupplyLines = work.getUncompletedSupplyLines();
            if (unCompletedSupplyLines.length === 0) {
                return false;
            }
            const sourceWork = unCompletedSupplyLines[0];

            if (!sourceWork.harvesterJobs) {
                return false;
            }
            const availableJobs = sourceWork.harvesterJobs.filter(j => !j.creepName);
            if (availableJobs.length > 0) {
                return sourceWork;
            } else {
                return false;
            }
        },
        action: (contextObj, conditionReturnValue) => {
            // debugger;
            const sourceWork = conditionReturnValue;
            const sourceID = sourceWork.sourceID;
            const trackingObj = getSourceTrackingObj(sourceID);
            const bodyParts = generateHarvesterBodyPartsFromBudget(trackingObj.harvesterBodyPartBudget);
            const availableWork = sourceWork.harvesterJobs.filter(j => !j.creepName);
            const chosenWork = availableWork[0];
            const code = spawnCreep(bodyParts, { type: "HARVESTER", jobID: chosenWork.id });
        }
    },
    {
        name: "Haulers",
        condition: (contextObj) => {
            const { containers } = getSpawnContainerInfo();
            if (containers.length === 0) {
                return false;
            }
            const work = contextObj.fetchInfo("sourceWork");
            const unCompletedSupplyLines = work.getUncompletedSupplyLines();
            if (unCompletedSupplyLines.length === 0) {
                return false;
            }
            const sourceWork = unCompletedSupplyLines[0];
            
            if (!sourceWork.haulerJobs) {
                return false;
            }
            const availableJobs = sourceWork.haulerJobs.filter(j => !j.creepName);
            if (availableJobs.length > 0) {
                return sourceWork;
            } else {
                return false;
            }
        },
        action: (contextObj, conditionReturnValue) => {
            const sourceWork = conditionReturnValue;
            const sourceID = sourceWork.sourceID;
            const trackingObj = getSourceTrackingObj(sourceID);
            const bodyParts = generateHaulerBodyPartsFromBudget(trackingObj.haulerBodyPartBudget);
            const availableWork = sourceWork.haulerJobs.filter(j => !j.creepName);
            const chosenWork = availableWork[0];
            const code = spawnCreep(bodyParts, { type: "HAULER", jobID: chosenWork.id });
        }
    },
    {
        name: "Source Roads",
        condition: (contextObj) => {
            // if there are no completed supply lines && closest source doesn't have a road
            //   build source road
            // else if there is an uncompleted supply line && uncompleted supply line doesn't have a road
            //   build source road for supply line

            const work = contextObj.fetchInfo("sourceWork");
            const unCompletedSupplyLines = work.getUncompletedSupplyLines();
            if (unCompletedSupplyLines.length > 0) {
                const sourceWork = unCompletedSupplyLines[0];
                if (!work.getSourceRoadStatus(sourceWork.sourceID)) {
                    return sourceWork;
                }
            }
            return false;
        },
        action: (contextObj, conditionReturnValue) => {
            const work = contextObj.fetchInfo("sourceWork");
            const sourceWork = conditionReturnValue;
            const spawn = Game.spawns['Spawn1'];
            const source = Game.getObjectById(sourceWork.sourceID);
            
            // debugger;
            const complete = buildRoadPointToPoint(spawn.pos, source.pos, "Building source road for source id " + sourceWork.sourceID, 2);
            if (complete) {
                // debugger;
            }
            work.setSourceRoadStatus(sourceWork.sourceID, complete);
        }
    },
    {
        name: "Source Containers",
        condition: (contextObj) => {
            // Take first uncompleted supply line
            // If it doesn't have a source container or container constructionsite, build it
            const work = contextObj.fetchInfo("sourceWork");
            const unCompletedSupplyLines = work.getUncompletedSupplyLines();
            if (unCompletedSupplyLines.length > 0) {
                const sourceWork = unCompletedSupplyLines[0];
                
                if (!work.getSourceRoadStatus(sourceWork.sourceID)) {
                    return false;
                }
                
                const source = Game.getObjectById(sourceWork.sourceID);
                const { constructionSites, containers } = getSourceContainerInfo(source);
                if (constructionSites.length + containers.length === 0) {
                    return sourceWork;
                }
            }
            return false;
        },
        action: (contextObj, conditionReturnValue) => {
            const sourceWork = conditionReturnValue;
            const source = Game.getObjectById(sourceWork.sourceID);
            buildContainerForSource(source);
        }
    },
]


module.exports = {
    getSourceWorkDecisions,
};