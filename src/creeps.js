const { runHarvesterHauler } = require('creepHarvesterHauler');
const { runHarvester } = require('creepHarvester');
const { runHauler } = require('creepHauler');
const { runExtensionFiller } = require('creepExtensionFiller');
const { runBuilder } = require('creepBuilder');
const { runBootstrapper } = require('creepBootstrapper');

const runCreeps = (contextObj) => {

    for (const creep_i in Game.creeps) {
        const creep = Game.creeps[creep_i];
        if (creep.memory.type === "HARVESTER_HAULER") {
            runHarvesterHauler(creep, contextObj);
        }
        if (creep.memory.type === "HARVESTER") {
            runHarvester(creep, contextObj);
        }
        if (creep.memory.type === "HAULER") {
            runHauler(creep, contextObj);
        }
        if (creep.memory.type === "BUILDER") {
            runBuilder(creep, contextObj);
        }
        if (creep.memory.type === "EXTENSIONFILLER") {
            runExtensionFiller(creep, contextObj);
        }
        if (creep.memory.type === "BOOTSTRAPPER") {
            runBootstrapper(creep, contextObj);
        }
    }
}


module.exports = {
    runCreeps,
};