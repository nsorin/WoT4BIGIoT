import fs = require('fs');

class HistoryConfig {
    public historyPeriod;
    public historyLimit;
}

export class Configuration {

    public moreLogs;
    public useMerge;
    public useAggregate;
    public useHistory;

    public history = new HistoryConfig();

    constructor () {
        //TODO: Is there anything to do?
    }

    /**
     * Initialize configuration by reading the config file.
     * @param configSource
     * @return {Promise<any>}
     */
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
                    this.history.historyPeriod = body.history.historyPeriod;
                    this.history.historyLimit = body.history.historyLimit;

                    //TODO: Other config

                    resolve();
                } catch (e) {
                    reject("Could not parse JSON config!");
                }
            });
        });
    }
}