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
 * Configuration for the HistoryStore components.
 */
class HistoryConfig {

    /**
     * @param {number} _period Interval of time between each call to the Thing(s) in a store.
     * @param {number} _limit Maximum amount of values stored in memory before removing older values.
     * @param {boolean} _onDisk Indicate if values should be stored on disk. If not, stored in memory.
     */
    constructor(
        private _period: number,
        private _limit: number,
        private _onDisk: boolean
    ) {
    }

    get period(): number {
        return this._period;
    }

    get limit(): number {
        return this._limit;
    }

    get onDisk(): boolean {
        return this._onDisk;
    }
}

/**
 * Configuration for the Gateway server.
 */
class GatewayConfig {

    /**
     * @param {string} _host Host of the gateway server.
     * @param {number} _port Port of the gateway server.
     * @param {boolean} _usePropertyFilters Indicate if min/max filters are used on properties when aggregating.
     * @param {boolean} _useMerge Indicate if properties are merged in read mode.
     * @param {boolean} _useAggregate Indicate if identical Things are aggregated in common offerings.
     * @param {boolean} _useHistory Indicate if HistoryStores are used for properties in read mode.
     */
    constructor(
        private _host: string,
        private _port: number,
        private _usePropertyFilters: boolean,
        private _useMerge: boolean,
        private _useAggregate: boolean,
        private _useHistory: boolean
    ) {
    }

    get host(): string {
        return this._host;
    }

    get port(): number {
        return this._port;
    }

    get usePropertyFilters(): boolean {
        return this._usePropertyFilters;
    }

    get useMerge(): boolean {
        return this._useMerge;
    }

    get useAggregate(): boolean {
        return this._useAggregate;
    }

    get useHistory(): boolean {
        return this._useHistory;
    }
}

/**
 * Configuration used to connect to the Marketplace.
 */
class MarketConfig {

    /**
     * @param {string} _marketplaceUrlForProvider Marketplace URL used to register new offerings.
     * @param {string} _marketplaceUrlForConsumer Marketplace URL used to fetch existing offerings.
     * @param {string} _providerId Provider identifier used to authenticate to the marketplace.
     * @param {string} _providerSecret Provider secret used to authenticate to the marketplace.
     * @param {string} _consumerId Consumer identifier used to authenticate to the marketplace.
     * @param {string} _consumerSecret Consumer secret used to authenticate to the marketplace.
     */
    constructor(
        private _marketplaceUrlForProvider: string,
        private _marketplaceUrlForConsumer: string,
        private _providerId: string,
        private _providerSecret: string,
        private _consumerId: string,
        private _consumerSecret: string
    ) {
    }

    get marketplaceUrlForProvider(): string {
        return this._marketplaceUrlForProvider;
    }

    get marketplaceUrlForConsumer(): string {
        return this._marketplaceUrlForConsumer;
    }

    get providerId(): string {
        return this._providerId;
    }

    get providerSecret(): string {
        return this._providerSecret;
    }

    get consumerId(): string {
        return this._consumerId;
    }

    get consumerSecret(): string {
        return this._consumerSecret;
    }
}

/**
 * Configuration used by the SemanticSearcher component.
 */
class SearchConfig {

    /**
     * @param {string} _cseBase Base URI of the Google Custom Search Engine used in the SemanticSearcher component.
     * @param {string} _cseApiKey API Key used to authenticate to the Google CSE.
     * @param {string} _cseCx Identifier used to authenticate to the Google CSE.
     * @param {number} _maxSuggestions Maximum amount of suggestion shown to the user of the SemanticSearcher.
     */
    constructor(
        private _cseBase: string,
        private _cseApiKey: string,
        private _cseCx: string,
        private _maxSuggestions: number
    ) {
    }

    get cseBase(): string {
        return this._cseBase;
    }

    get cseApiKey(): string {
        return this._cseApiKey;
    }

    get cseCx(): string {
        return this._cseCx;
    }

    get maxSuggestions(): number {
        return this._maxSuggestions;
    }
}

/**
 * General configuration for the whole application.
 */
export class Configuration {

    /**
     * Show additional logs?
     */
    private _moreLogs: boolean;
    /**
     * Keep offerings alive on the marketplace after shutting down the application?
     */
    private _keepOfferings: boolean;
    /**
     * Offering to Thing conversion strategy.
     */
    private _offeringConversionStrategy: OfferingToThing;

    private _history: HistoryConfig;
    private _gateway: GatewayConfig;
    private _market: MarketConfig;
    private _search: SearchConfig;

    /**
     * Default constructor. Private to avoid having an uninitialized configuration.
     */
    private constructor() {
        // Nothing to do here - waiting for init
    }

    public static getConfiguration(configSource: string): Promise<Configuration> {
        let config = new Configuration();
        return config.init(configSource);
    }

    get moreLogs(): boolean {
        return this._moreLogs;
    }

    get keepOfferings(): boolean {
        return this._keepOfferings;
    }

    get offeringConversionStrategy(): OfferingToThing {
        return this._offeringConversionStrategy;
    }

    get history(): HistoryConfig {
        return this._history;
    }

    get gateway(): GatewayConfig {
        return this._gateway;
    }

    get market(): MarketConfig {
        return this._market;
    }

    get search(): SearchConfig {
        return this._search;
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
                    this._moreLogs = body.moreLogs;
                    this._keepOfferings = body.keepOfferings;
                    this._offeringConversionStrategy = body.offeringConversionStrategy;

                    // History config
                    this._history = new HistoryConfig(
                        body.history.period,
                        body.history.limit,
                        body.history.onDisk
                    );

                    // Gateway config
                    this._gateway = new GatewayConfig(
                        body.gateway.port,
                        body.gateway.host,
                        body.gateway.usePropertyFilters,
                        body.gateway.useMerge,
                        body.gateway.useAggregate,
                        body.gateway.useHistory
                    );

                    // Marketplace config
                    this._market = new MarketConfig(
                        body.market.marketplaceUrlForProvider,
                        body.market.marketplaceUrlForConsumer,
                        body.market.providerId,
                        body.market.providerSecret,
                        body.market.consumerId,
                        body.market.consumerSecret
                    );

                    // Semantic search config
                    this._search = new SearchConfig(
                        body.search.cseBase,
                        body.search.cseApiKey,
                        body.search.cseCx,
                        body.search.maxSuggestions
                    );

                    resolve(this);
                } catch (e) {
                    reject("Could not parse JSON config: " + e);
                }
            });
        });
    }
}