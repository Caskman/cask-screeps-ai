const { logCreepError } = require('logging');
const {
    setHarvesterBlocked,
    underHarvesterBodyPartBudget,
} = require('sourceWork');
const {
    hasEnergy,
    hasEnergyCapacity,
    goRecycle,
} = require('creepUtils');
const {
    getManhattanDist,
    getSpawnContainerInfo,
} = require('utils');


const runHarvester = (creep, contextObj) => {
    if (creep.spawning) {
        return;
    }
    const m = creep.memory;
    
    if (!m.jobID) {
        logCreepError("No job ID", creep);
        return;
    }
    const job = contextObj.fetchJob(m.jobID);
    
    if (!job.destination) {
        logCreepError("Job has no properties: " + m.jobID, creep);
        console.log(JSON.stringify(job));
        return;
    }

    const target = Game.getObjectById(job.destination);

    if (target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        m.state = 'IDLE';
    } else if (underHarvesterBodyPartBudget(contextObj, creep)) {
        m.state = 'RECYCLING';
    } else {
        m.state = "HARVESTING";
    }

    if (m.state === 'HARVESTING') {
        const source = Game.getObjectById(job.target);
        if (getManhattanDist(creep.pos, target.pos) === 0) {
            const code = creep.harvest(source);
            if (code === ERR_NOT_IN_RANGE) {
                creep.moveTo(source);
            } else if (code === OK || code == ERR_BUSY || code == ERR_FULL) {
            } else {
                logCreepError(code, creep);
            }
        } else {
            creep.moveTo(target);
        }
    } else if (m.state === 'RECYCLING') {
        goRecycle(creep);
    } else if (m.state === 'IDLE') {
        setHarvesterBlocked(contextObj, m.jobID);
    }
};

module.exports = {
    runHarvester,
};