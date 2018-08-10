import {Thing, parseTD} from "../thingweb.node-wot/packages/td-tools";
import {ThingAnalyzer} from "./thing-analyzer";
import {Gateway} from "./gateway";
import {OfferingManager} from "./offering-manager";
import {OfferingConverter} from "./offering-converter";
import {Configuration, OfferingToThing} from "./configuration";
import {SearchResult, SemanticSearcher} from "./semantic-searcher";

export class Api {

    private static readonly CONFIG_SOURCE = "../config.json";

    private _config: Configuration;
    private _thingAnalyzer: ThingAnalyzer;
    private _offeringManager: OfferingManager;
    private _gateway: Gateway;
    private _offeringConverter: OfferingConverter;
    private _semanticSearcher: SemanticSearcher;

    /**
     * Used to store names/URIs that are already in use for offerings in this session.
     * @type {any[]}
     */
    private _alreadyUsedOfferingNames: Array<string> = [];

    private _initComplete = false;

    /**
     * Default constructor. Private to avoid having a uninitialized api.
     */
    private constructor() {
        // Nothing to do, call init
    }

    /**
     * Static method to call to init the API.
     * @return {Promise<any>}
     */
    public static getApi(configSource?: string): Promise<any> {
        let api = new Api();
        return api.init(configSource);
    }

    /**
     * Initialize the API. Must be called before using the API methods.
     * @return {Promise<any>}
     */
    private init(configSource?: string): Promise<any> {
        return new Promise((resolve, reject) => {
            Configuration.getConfiguration(configSource ? configSource : Api.CONFIG_SOURCE).then((config) => {
                this._config = config;
                this._thingAnalyzer = new ThingAnalyzer(this._config);
                this._semanticSearcher = new SemanticSearcher(this._config);
                this._offeringConverter = new OfferingConverter(this._config);
                this._offeringManager = new OfferingManager(this._config);
                this._offeringConverter.init().then(() => {
                    this._offeringManager.init().then(() => {
                        this._gateway = new Gateway(this._config, this._offeringManager);
                        this._initComplete = true;
                        resolve(this);

                        // Exit handler
                        if (!this._config.keepOfferings) {
                            console.log('Setting up exit handler');
                            let exitHandler = () => {
                                this._offeringManager.unregisterAllOfferings().then(() => {
                                    process.exit(1);
                                });
                            };
                            process.on('exit', exitHandler);
                            process.on('SIGINT', exitHandler);
                            process.on('SIGUSR1', exitHandler);
                            process.on('SIGUSR2', exitHandler);
                            process.on('uncaughtException', exitHandler);
                        }

                    }).catch((err) => {
                        console.log('OfferingManager failed to init, error:', err);
                    });
                }).catch((err) => {
                    console.log('OfferingConverter failed to init, error:', err);
                });
            }).catch((e) => {
                reject('Config error:' + e);
            });
        });
    }

    /**
     * Register things on the marketplace. If there is no direct compatibility with the Offering model or if,
     * the API is configured to use additional features requiring it, a gateway is set up.
     * @param {Array<string>} tds JSON TDs (not parsed)
     * @return {Promise<any>}
     */
    public convertThings(tds: Array<string>) {
        if (!this._initComplete) {
            throw 'ERROR: Config not initialized!';
        } else {
            // Parse all things
            let parsedThings: Array<Thing> = [];
            for (let i = 0; i < tds.length; i++) {
                try {
                    let thing = parseTD(tds[i]);
                    thing = this._thingAnalyzer.resolveContexts(thing, ThingAnalyzer.findPrefixes(thing));
                    parsedThings.push(thing);
                } catch (e) {
                    console.log('Could not parse thing at index', i, ':', e);
                }
            }
            console.log('PARSED EVERYTHING:', parsedThings.length, 'THINGS');

            let directRegistration: Array<Thing> = [];
            let gatewayRegistration: Array<Thing> = [];
            // Use parsed things
            if (this._config.gateway.useMerge || this._config.gateway.useAggregate || this._config.gateway.useHistory) {
                gatewayRegistration = parsedThings;
            } else {
                // Sort compatible and non compatible things
                for (let i = 0; i < parsedThings.length; i++) {
                    if (this._thingAnalyzer.isThingDirectlyCompatible(parsedThings[i])) {
                        directRegistration.push(parsedThings[i]);
                    } else {
                        gatewayRegistration.push(parsedThings[i]);
                    }
                }
            }
            console.log(directRegistration.length, "things to register directly");
            console.log(gatewayRegistration.length, "things to register with gateway");
            this.convertThingsDirectly(directRegistration);
            this.convertThingsWithGateway(gatewayRegistration);
        }
    }

    /**
     * Get the list of all offerings waiting to be registered.
     * @return {Array<any>}
     */
    public getOfferingsToRegister() {
        return this._offeringManager.toRegister;
    }

    /**
     * Get the list of all offerings already registered on the marketplace for this session.
     * @return {Array<any>}
     */
    public getRegisteredOfferings() {
        return this._offeringManager.registered;
    }

    /**
     * Register offerings based on a set of provided names.
     * @param {Array<string>} offeringNames
     * @return {Promise<void>}
     */
    public registerOfferings(offeringNames: Array<string>): Promise<void> {
        return this._offeringManager.registerOfferings(offeringNames);
    }

    /**
     * Register all offerings currently waiting to be registered.
     * @return {Promise<any>}
     */
    public registerAllOfferings(): Promise<void> {
        return this._offeringManager.registerAllOfferings();
    }

    /**
     * Remove offerings based on a set of provided names.
     * @param {Array<string>} offeringNames
     * @return {Promise<void>}
     */
    public deleteOfferings(offeringNames: Array<string>): Promise<void> {
        return this._offeringManager.unregisterOfferings(offeringNames);
    }

    /**
     * Delete all registered offerings from the marketplace.
     */
    public deleteAllOfferings(): Promise<void> {
        return this._offeringManager.unregisterAllOfferings();
    }

    /**
     * Convert offerings to the TD format
     * @param {Array<string>} offeringIds Unique identifiers for offerings on the marketplace.
     * @return {Promise<any>}
     */
    public convertOfferings(offeringIds: Array<string>): Promise<Array<Thing>> {
        return new Promise((resolve, reject) => {
            if (!this._initComplete) {
                reject('Configuration not initialized!');
            } else {
                switch (this._config.offeringConversionStrategy) {
                    case OfferingToThing.OFFERING_TO_THING:
                        let promises: Array<Promise<any>> = [];
                        for (let i = 0; i < offeringIds.length; i++) {
                            promises.push(this._offeringConverter.convertOne(offeringIds[i]));
                        }
                        Promise.all(promises).then((data) => {
                            console.log('Offerings converted!');
                            resolve(data);
                        }).catch((err) => {
                            console.log('There was a problem converting an offering:');
                            console.log(err);
                        });
                        break;
                    case OfferingToThing.MARKETPLACE_TO_THING:
                        this._offeringConverter.convertMultiple(offeringIds).then((data) => {
                            console.log('Offerings converted!');
                            resolve([data]);
                        }).catch((err) => {
                            console.log('There was a problem converting an offering:');
                            console.log(err);
                        });
                        break;
                    case OfferingToThing.PROVIDER_TO_THING:
                        this._offeringConverter.convertMultipleByProvider(offeringIds).then((data) => {
                            resolve(data);
                            console.log('Offerings converted!');
                        }).catch((err) => {
                            console.log('There was a problem converting an offering:');
                            console.log(err);
                        });
                        break;
                }
            }
        });
    }

    /**
     * Get Semantic type suggestion for a field based on its name.
     * @param {string} name
     * @return {Promise<Array<SearchResult>>}
     */
    public getSemanticTypeSuggestions(name: string): Promise<Array<SearchResult>> {
        return this._semanticSearcher.makePropertySearch(name);
    }

    /**
     * Get the current provider's id.
     * @return {string}
     */
    public getProviderId(): string {
        return this._offeringManager.getProviderId();
    }

    /**
     * Get the current consumer.
     * @return {string}
     */
    public getConsumer(): any {
        return this._offeringConverter.consumer;
    }

    /**
     * Directly register things on the marketplace (after checking they are compatible)
     * @param {Array<Thing>} things
     */
    private convertThingsDirectly(things: Array<Thing>): void {
        for (let i = 0; i < things.length; i++) {
            // Rename duplicates
            let fakeIndex = 0;
            while (this._alreadyUsedOfferingNames.indexOf(things[i].name) > -1) {
                let fakeIndexString = String(fakeIndex);
                if (fakeIndex === 0) {
                    things[i].name = things[i].name + (++fakeIndex);
                } else {
                    things[i].name = things[i].name.slice(0, -1 * fakeIndexString.length) + (++fakeIndex);
                }
            }
            this._alreadyUsedOfferingNames.push(things[i].name);
            this._offeringManager.addOfferingsForThing(things[i]);
        }
    }

    /**
     * Initialize or update the gateway to register incompatible things or to use advanced features.
     * @param {Array<Thing>} things
     */
    private convertThingsWithGateway(things: Array<Thing>): void {
        this._gateway.init().then((gateway) => {
            if (this._config.gateway.useAggregate) {
                // Identify identical things
                let identicalThings: Array<Array<Thing>> = [];
                for (let i = 0; i < things.length; i++) {
                    let ok = false;
                    for (let j = 0; j < identicalThings.length; j++) {
                        if (ThingAnalyzer.areThingsIdentical(identicalThings[j][0], things[i])) {
                            identicalThings[j].push(things[i]);
                            ok = true;
                        }
                    }
                    if (!ok) {
                        identicalThings.push([things[i]]);
                    }
                }
                // Register things by type
                for (let i = 0; i < identicalThings.length; i++) {
                    // Rename duplicates
                    let fakeIndex = 0;
                    while (this._alreadyUsedOfferingNames.indexOf(identicalThings[i][0].name) > -1) {
                        let fakeIndexString = String(fakeIndex);
                        if (fakeIndex === 0) {
                            identicalThings[i][0].name = identicalThings[i][0].name + (++fakeIndex);
                        } else {
                            identicalThings[i][0].name = identicalThings[i][0].name.slice(0, -1 * fakeIndexString.length) + (++fakeIndex);
                        }
                    }
                    this._alreadyUsedOfferingNames.push(identicalThings[i][0].name);
                    // Once the name is unique, add to the gateway.
                    this._gateway.addAggregatedThings(identicalThings[i]);
                }
            } else {
                for (let i = 0; i < things.length; i++) {
                    // Rename duplicates
                    let fakeIndex = 0;
                    while (this._alreadyUsedOfferingNames.indexOf(things[i].name) > -1) {
                        let fakeIndexString = String(fakeIndex);
                        if (fakeIndex === 0) {
                            things[i].name = things[i].name + (++fakeIndex);
                        } else {
                            things[i].name = things[i].name.slice(0, -1 * fakeIndexString.length) + (++fakeIndex);
                        }
                    }
                    this._alreadyUsedOfferingNames.push(things[i].name);
                }
                gateway.addSingleThings(things);
            }
        }).catch((err) => {
            console.log('ERROR:', err);
        });
    }
}