"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
class HistoryConfig {
}
class Configuration {
    constructor() {
        this.history = new HistoryConfig();
        //TODO: Is there anything to do?
    }
    init(configSource) {
        return new Promise((resolve, reject) => {
            fs.readFile(configSource, "utf-8", (err, data) => {
                try {
                    let body = JSON.parse(data);
                    // Root config
                    this.moreLogs = body.moreLogs;
                    this.useMerge = body.useMerge;
                    this.useAggregate = body.useAggregate;
                    this.useHistory = body.useHistory;
                    // History config
                    this.history.period = body.history.period;
                    this.history.limit = body.history.limit;
                    //TODO: Other config
                    resolve();
                }
                catch (e) {
                    reject("Could not parse JSON config!");
                }
            });
        });
    }
}
exports.Configuration = Configuration;
//# sourceMappingURL=configuration.js.map