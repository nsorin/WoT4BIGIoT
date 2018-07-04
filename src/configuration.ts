import fs = require('fs');
import path = require('path');

/**
 * Possible conversion modes when going from the Offering model to the Thing model.
 */
export enum OfferingToThing {
    OFFERING_TO_THING = 'OFFERING_TO_THING',
    PROVIDER_TO_THING = 'PROVIDER_TO_THING',
    MARKETPLACE_TO_THING = 'MARKETPLACE_TO_THING'
}

/**
 * Configuration for the HistoryStore component.
 */
class HistoryConfig {
    /**
     * Period of time between each call to the Thing when using a HistoryStore.
     */
    public period: number;
    /**
     * Maximum amount of stored outputs when using a HistoryStore which stores data in memory.
     */
    public limit: number;
    /**
     * Store HistoryStore data on a file instead of memory?
     */
    public onDisk: boolean;
}

/**
 * Configuration for the Gateway server.
 */
class GatewayConfig {
    /**
     * Host address for the gateway server.
     */
    public host: string;
    /**
     * Port to listen to for the gateway server.
     */
    public port: number
}

/**
 * Configuration used when aggregating Things.
 */
class AggregationConfig {
    /**
     * Allow consumer to filter output of aggregated Thing offerings?
     */
    public usePropertyFilters: boolean;
}

/**
 * Configuration used to connect to the Marketplace.
 */
class MarketConfig {
    public marketplaceUrlForProvider: string;
    public marketplaceUrlForConsumer: string;
    public providerId: string;
    public providerSecret: string;
    public consumerId: string;
    public consumerSecret: string;
}

/**
 * Configuration used by the SemanticSearcher component.
 */
class SearchConfig {
    public cseBase: string;
    public cseApiKey: string;
    public cseCx: string;
    /**
     * Maximum amount of semantic annotation suggestions sent to the user after calling the SemanticSearcher.
     */
    public maxSuggestions: number;
}

/**
 * General configuration for the whole application.
 */
export class Configuration {

    /**
     * Show additional logs?
     */
    public moreLogs: boolean;
    /**
     * Merge properties when converting Things?
     */
    public useMerge: boolean;
    /**
     * Aggregate identical Things when converting Things?
     */
    public useAggregate: boolean;
    /**
     * Use HistoryStores for properties when converting Things?
     */
    public useHistory: boolean;
    /**
     * Keep offerings alive on the marketplace after shutting down the application?
     */
    public keepOfferings: boolean;
    /**
     * Offering to Thing conversion strategy.
     */
    public offeringConversionStrategy: OfferingToThing;

    public history = new HistoryConfig();
    public gateway = new GatewayConfig();
    public aggregation = new AggregationConfig();
    public market = new MarketConfig();
    public search = new SearchConfig();

    /**
     * Default constructor. Private to avoid having an uninitialized configuration.
     */
    private constructor() {
        //TODO: Is there anything to do?
    }

    public static getConfiguration(configSource: string): Promise<Configuration> {
        let config = new Configuration();
        return config.init(configSource);
    }

    /**
     * Initialize configuration by reading the config file.
     * @param configSource
     * @return {Promise<any>}
     */
    private init(configSource: string): Promise<Configuration> {
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

                    resolve(this);
                } catch (e) {
                    reject("Could not parse JSON config!");
                }
            });
        });
    }
}