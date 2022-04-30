
const logError = (code, errorSource) => {
    console.log("Unrecognized code: " + code + " from " + errorSource)
}
const logCreepError = (code, creep) => {
    const m = creep.memory;
    logError(code, m.type + "_" + m.state);
}

module.exports = {
    logError,
    logCreepError,
};