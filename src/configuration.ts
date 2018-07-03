import fs = require('fs');
import path = require('path');

export enum OfferingToThing {
    OFFERING_TO_THING = 'OFFERING_TO_THING',
    PROVIDER_TO_THING = 'PROVIDER_TO_THING',
    MARKETPLACE_TO_THING = 'MARKETPLACE_TO_THING'
}

class HistoryConfig {
    public period: number;
    public limit: number;
    public onDisk: boolean;
}

class GatewayConfig {
    public host: string;
    public port: number
}

class AggregationConfig {
    public usePropertyFilters: boolean;
}

class MarketConfig {
    public marketplaceUrlForProvider: string;
    public marketplaceUrlForConsumer: string;
    public providerId: string;
    public providerSecret: string;
    public consumerId: string;
    public consumerSecret: string;
}

class SearchConfig {
    public cseBase: string;
    public cseApiKey: string;
    public cseCx: string;
    public maxSuggestions: number;
}

export class Configuration {

    public moreLogs: boolean;
    public useMerge: boolean;
    public useAggregate: boolean;
    public useHistory: boolean;
    public keepOfferings: boolean;
    public offeringConversionStrategy: OfferingToThing;

    public history = new HistoryConfig();
    public gateway = new GatewayConfig();
    public aggregation = new AggregationConfig();
    public market = new MarketConfig();
    public search = new SearchConfig();

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
                    this.keepOfferings = body.keepOfferings;
                    this.offeringConversionStrategy = body.offeringConversionStrategy;

                    // History config
                    this.history.period = body.history.period;
                    this.history.limit = body.history.limit;
                    this.history.onDisk = body.history.onDisk;

                    // Gateway config
                    this.gateway.port = body.gateway.port;
                    this.gateway.host = body.gateway.host;

                    // Aggregation config
                    this.aggregation.usePropertyFilters = body.aggregation.usePropertyFilters;

                    // Marketplace config
                    this.market.marketplaceUrlForProvider = body.market.marketplaceUrlForProvider;
                    this.market.marketplaceUrlForConsumer = body.market.marketplaceUrlForConsumer;
                    this.market.providerId = body.market.providerId;
                    this.market.providerSecret = body.market.providerSecret;
                    this.market.consumerId = body.market.consumerId;
                    this.market.consumerSecret = body.market.consumerSecret;

                    // Semantic search config
                    this.search.cseBase = body.search.cseBase;
                    this.search.cseApiKey = body.search.cseApiKey;
                    this.search.cseCx = body.search.cseCx;
                    this.search.maxSuggestions = body.search.maxSuggestions;

                    //TODO: Other config

                    resolve();
                } catch (e) {
                    reject("Could not parse JSON config!");
                }
            });
        });
    }
}