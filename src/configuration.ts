import fs = require('fs');
import path = require('path');

class HistoryConfig {
    public period: number;
    public limit: number;
}

class GatewayConfig {
    public host: string;
    public port: number
}

class AggregationConfig {
    public usePropertyFilters: boolean;
}

export class Configuration {

    public moreLogs: boolean;
    public useMerge: boolean;
    public useAggregate: boolean;
    public useHistory: boolean;

    public history = new HistoryConfig();
    public gateway = new GatewayConfig();
    public aggregation = new AggregationConfig();

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
            fs.readFile(path.resolve(__dirname, configSource), "utf-8", (err, data) => {
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

                    // Gateway config
                    this.gateway.port = body.gateway.port;
                    this.gateway.host = body.gateway.host;

                    // Aggregation config
                    this.aggregation.usePropertyFilters = body.aggregation.usePropertyFilters;

                    //TODO: Other config

                    resolve();
                } catch (e) {
                    reject("Could not parse JSON config!");
                }
            });
        });
    }
}