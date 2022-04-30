const { 
    getSpawnContainerInfo,
    spawnCreep,
} = require('utils');
const {
    ensureSpawnRoad,
    ensureControllerRoad,
    buildExtensions,
    buildContainerForSpawn,
} = require('construction');
const { getSinkDetails, generateSinkBodyPartsFromBudget } = require('sourceWork');


const getSpawnDecisions = () => [
    {
        name: "Spawn Bootstrappers",
        condition: (contextObj) => {
            const { containers } = getSpawnContainerInfo();
            const counts = contextObj.fetchInfo("creepCounts");
            return containers.length === 0 && (!("BOOTSTRAPPER" in counts) || counts["BOOTSTRAPPER"] < 3);
        },
        action: (contextObj, conditionReturnValue) => {
            spawnCreep([WORK,CARRY,MOVE], { type: "BOOTSTRAPPER" });
        },
    },
    {
        name: "HarvesterHaulers",
        condition: (contextObj) => {
            const counts = contextObj.fetchInfo("creepCounts");
            return !("HARVESTER_HAULER" in counts) || counts["HARVESTER_HAULER"] < 3;
        },
        action: () => {
        }
    },
    {
        name: "Builders",
        condition: (contextObj) => {
            const { containers } = getSpawnContainerInfo();
            const counts = contextObj.fetchInfo("creepCounts");
            if (containers.length < 1) {
                return !contextObj.fetchCondition("HarvesterHaulers") && (!("BUILDER" in counts) || counts["BUILDER"] < 2);
            }
            
            const { count: requiredBuilderCount } = getSinkDetails();
            return (("EXTENSIONFILLER" in counts) && counts["EXTENSIONFILLER"] > 0) && (!("BUILDER" in counts) || counts["BUILDER"] < requiredBuilderCount);

            // const counts = contextObj.fetchInfo("creepCounts");
            // const { containers } = getSpawnContainerInfo();
            // return (!contextObj.fetchCondition("HarvesterHaulers") || containers.length > 0) && (!("BUILDER" in counts) || counts["BUILDER"] < 2);
        },
        action: (returnValue) => {
            const { bodyPartsBudget } = getSinkDetails();
            spawnCreep(generateSinkBodyPartsFromBudget(bodyPartsBudget), { type: "BUILDER" });
        }
    },
    {
        name: "ExtensionFillers",
        condition: (contextObj) => {
            const { containers } = getSpawnContainerInfo();
            const counts = contextObj.fetchInfo("creepCounts");
            return containers.length > 0 && (!("EXTENSIONFILLER" in counts) || counts["EXTENSIONFILLER"] < 1);
        },
        action: () => {
            spawnCreep([CARRY,CARRY,CARRY,MOVE], { type: "EXTENSIONFILLER" });
        }
    },
    {
        name: "Build Spawn Road",
        condition: (contextObj) => {
            if (Memory.SPAWN_ROAD_BUILT) {
                return false;
            }
            const { containers } = getSpawnContainerInfo();
            return containers.length > 0;
        },
        action: () => {
            const complete = ensureSpawnRoad();
            Memory.SPAWN_ROAD_BUILT = complete;
        }
    },
    {
        name: "Build Spawn Container",
        condition: (contextObj) => {
            const { containerConstructionSites, containers } = getSpawnContainerInfo();

            if ((containerConstructionSites.length + containers.length) > 0) {
                return false;
            }
            
            const work = contextObj.fetchInfo("sourceWork");
            const sourceLinesWithContainers = work.workList.filter(s => {
                return !!s.containerID;
            });
            return sourceLinesWithContainers.length > 0;
        },
        action: (contextObj) => {
            buildContainerForSpawn();
        }
    },
    {
        name: "Build Controller Road",
        condition: (contextObj) => {
            return Memory.SPAWN_ROAD_BUILT && !Memory.CONTROLLER_ROAD_BUILT;
        },
        action: () => {
            const complete = ensureControllerRoad();
            Memory.CONTROLLER_ROAD_BUILT = complete;
        }
    },
    {
        name: "Build Extensions",
        condition: (contextObj) => {
            if (!Memory.CONTROLLER_ROAD_BUILT || Game.spawns['Spawn1'].room.controller.level < 2) {
                return false;
            }
            
            const { containers } = getSpawnContainerInfo();
            if (containers.length === 0) {
                return false;
            }
            
            const {extensions,extensionSites} = contextObj.fetchInfo("extensionInfo");
            return extensions.length + extensionSites.length < 5;
        },
        action: (contextObj) => {
            const {extensions,extensionSites} = contextObj.fetchInfo("extensionInfo");
            buildExtensions(5 - extensions.length - extensionSites.length);
        }
    },

]

module.exports = {
    getSpawnDecisions,
};