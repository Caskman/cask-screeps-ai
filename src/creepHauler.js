const { logCreepError } = require('logging');
const {
    setHaulerBlocked,
    underHaulerBodyPartBudget,
} = require('sourceWork');
const {
    hasEnergy,
    hasEnergyCapacity,
    goRecycle,
    hangIdle,
} = require('creepUtils');
const {
    getManhattanDist,
    getSpawnContainerInfo,
} = require('utils');


const runHauler = (creep, contextObj) => {
    if (creep.spawning) {
        return;
    }
    const m = creep.memory;
    
    if (!m.jobID) {
        logCreepError("No job ID", creep);
        return;
    }
    const job = contextObj.fetchJob(m.jobID);
    
    if (!job) {
        logCreepError("Job has no properties: " + m.jobID, creep);
        m.state = 'IDLE';
    } else if (hasEnergy(creep)) {
        m.state = 'UNLOADING';
    } else if (underHaulerBodyPartBudget(contextObj, creep)) {
        m.state = 'RECYCLING';
    } else {
        m.state = 'LOADING';
    }

    if (m.state === 'UNLOADING') {
        const destination = Game.getObjectById(job.destination);
        const code = creep.transfer(destination, RESOURCE_ENERGY);
        if (code === ERR_NOT_IN_RANGE) {
            creep.moveTo(destination);
        } else if (code === OK) {
        } else if (code === ERR_FULL) {
            setHaulerBlocked(contextObj, m.jobID);
        } else {
            logCreepError(code, creep);
        }
    } else if (m.state === 'LOADING') {
        const target = Game.getObjectById(job.target);
        const code = creep.withdraw(target, RESOURCE_ENERGY);
        if (code === ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        } else if (code == OK || code === ERR_NOT_ENOUGH_ENERGY) {
        } else {
            logCreepError(code, creep);
        }
    } else if (m.state === 'RECYCLING') {
        goRecycle(creep);
    } else if (m.state === 'IDLE') {
        hangIdle(creep);
    }
};

module.exports = {
    runHauler,
};