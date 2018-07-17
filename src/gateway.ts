import express = require('express');
import {GatewayRoute, Method} from "./gateway-route";
import {Configuration} from "./configuration";
import {Thing} from "../thingweb.node-wot/packages/td-tools";
import {HistoryStore} from "./history-store";
import {OfferingManager} from "./offering-manager";


/**
 * Gateway server used to perform operations on input/output between the Thing and the Marketplace consumers. Contains
 * GatewayRoutes and HistoryStores which will be registered to the Marketplace.
 */
export class Gateway {

    private _app = express();
    private _routes: Array<GatewayRoute> = [];
    private _historyStores: Array<HistoryStore> = [];
    private _initComplete = false;

    /**
     * @param {Configuration} _config Configuration used by the API.
     * @param {OfferingManager} _offeringManager OfferingManager used by the API.
     */
    constructor(
        private _config: Configuration,
        private _offeringManager: OfferingManager
    ) {
    }

    /**
     * Initialize the Gateway. If init as already been performed, skip it. Should only be done if the Gateway is about
     * to be used, to avoid running a server unnecessarily.
     * @return {Promise<Gateway>}
     */
    public init(): Promise<Gateway> {
        return new Promise((resolve, reject) => {
            if (this._initComplete) {
                resolve(this);
            } else {
                try {
                    this._app.use(express.json());
                    this._app.use(express.urlencoded({extended: true}));
                    console.log('Starting gateway server...');
                    this._app.listen(this._config.gateway.port, this._config.gateway.host, () => {
                        console.log("Started gateway server at http://%s:%s",
                            this._config.gateway.host, this._config.gateway.port);
                        this._initComplete = true;
                        resolve(this);
                    }).on('error', (err) => {
                        reject('Express error: ' + err);
                    });
                } catch (e) {
                    reject('Could not initialize gateway server: ' + e);
                }
            }
        });
    }

    /**
     * Add GatewayRoutes for a set of Things, one Thing at a time.
     * @param {Array<Thing>} things
     */
    public addSingleThings(things: Array<Thing>): void {
        // console.log('Received', things.length, 'to add without aggregation');
        for (let i = 0; i < things.length; i++) {
            if (this._config.gateway.useMerge) {
                let propertyIndexes = [];
                for (let j in things[i].properties) {
                    propertyIndexes.push(j);
                    if (things[i].properties[j].writable) {
                        let newRoute = new GatewayRoute([things[i]], [j], true);
                        this._routes.push(newRoute);
                        this._offeringManager.addOfferingForRoute(newRoute, [things[i]], [j], true);
                    }
                }
                let newRoute = new GatewayRoute([things[i]], propertyIndexes);
                if (this._config.gateway.useHistory) {
                    this._historyStores.push(new HistoryStore(this._config, newRoute));
                } else {
                    this._routes.push(newRoute);
                }
                this._offeringManager.addOfferingForRoute(newRoute, [things[i]], propertyIndexes);
            } else {
                for (let j in things[i].properties) {
                    let newRoute = new GatewayRoute([things[i]], [j]);
                    if (this._config.gateway.useHistory) {
                        this._historyStores.push(new HistoryStore(this._config, newRoute));
                    } else {
                        this._routes.push(newRoute);
                    }
                    this._offeringManager.addOfferingForRoute(newRoute, [things[i]], [j]);
                    if (things[i].properties[j].writable) {
                        let newWriteRoute = new GatewayRoute([things[i]], [j], true);
                        this._routes.push(newWriteRoute);
                        this._offeringManager.addOfferingForRoute(newWriteRoute, [things[i]], [j], true);
                    }
                }
            }
            for (let j in things[i].actions) {
                let newRoute = new GatewayRoute([things[i]], [], false, j);
                this._routes.push(newRoute);
                this._offeringManager.addOfferingForRoute(newRoute, [things[i]], [], false, j);
            }
        }
        if (this._config.gateway.useHistory) this.syncHistoryStores();
        this.syncRoutes();
    }

    /**
     * Add GatewayRoutes for a set of identical Things.
     * @param {Array<Thing>} things
     */
    public addAggregatedThings(things: Array<Thing>): void {
        console.log('Received', things.length, 'to add with aggregation');
        if (things.length > 0) {
            // All things are identical - use first one as reference:
            let thing = things[0];
            if (this._config.gateway.useMerge) {
                let propertyIndexes = [];
                for (let j in thing.properties) {
                    propertyIndexes.push(j);
                    if (thing.properties[j].writable) {
                        let newRoute = new GatewayRoute(things, [j], true);
                        this._routes.push(newRoute);
                        this._offeringManager.addOfferingForRoute(newRoute, things, [j], true);
                    }
                }
                if (this._config.gateway.useHistory) {
                    let newRoute = new GatewayRoute(things, propertyIndexes);
                    this._historyStores.push(new HistoryStore(this._config, newRoute));
                    this._offeringManager.addOfferingForRoute(newRoute, things, propertyIndexes);
                } else {
                    let newRoute = new GatewayRoute(things, propertyIndexes, false, undefined,
                        this._config.gateway.usePropertyFilters);
                    this._routes.push(newRoute);
                    this._offeringManager.addOfferingForRoute(newRoute, things, propertyIndexes);
                }
            } else {
                for (let j in thing.properties) {
                    if (this._config.gateway.useHistory) {
                        let newRoute = new GatewayRoute(things, [j]);
                        this._historyStores.push(new HistoryStore(this._config, newRoute));
                        this._offeringManager.addOfferingForRoute(newRoute, things, [j]);
                    } else {
                        let newRoute = new GatewayRoute(things, [j], false, undefined,
                            this._config.gateway.usePropertyFilters);
                        this._routes.push(newRoute);
                        this._offeringManager.addOfferingForRoute(newRoute, things, [j]);
                    }
                    if (thing.properties[j].writable) {
                        let newWriteRoute = new GatewayRoute(things, [j], true);
                        this._routes.push(newWriteRoute);
                        this._offeringManager.addOfferingForRoute(newWriteRoute, things, [j], true);
                    }
                }
            }
            for (let j in thing.actions) {
                let newRoute = new GatewayRoute(things, [], false, j);
                this._routes.push(newRoute);
                this._offeringManager.addOfferingForRoute(newRoute, things, [], false, j);
            }
            if (this._config.gateway.useHistory) this.syncHistoryStores();
            this.syncRoutes();
        }
    }

    /**
     * Check every GatewayRoute in the routes attribute and create an endpoint for those which do not have one yet.
     */
    private syncRoutes(): void {
        console.log('Syncing routes');
        for (let i = 0; i < this._routes.length; i++) {
            if (!this._routes[i].registered && this._routes[i].valid) {
                console.log('New route found: /' + this._routes[i].uri, 'with method', this._routes[i].method);
                if (this._routes[i].method === Method.GET) {
                    this._app.get('/' + this._routes[i].uri, (req, res) => {
                        // Separate id, filters and params
                        let id = req.query ? req.query.id : null;
                        delete req.query.id;

                        let filters = {};
                        if (this._config.gateway.useAggregate && this._config.gateway.usePropertyFilters) {
                            for (let j = 0; j < this._routes[i].propertyFiltersSchema.length; j++) {
                                let filterName = this._routes[i].propertyFiltersSchema[j].name;
                                if (req.query[filterName]) {
                                    filters[filterName] = req.query[filterName];
                                    delete req.query[filterName];
                                }
                            }
                        }

                        this._routes[i].access(req.query, id, filters).then((result) => {
                            res.send(result);
                        }).catch((err) => {
                            res.status(400).send({error: err});
                        });
                    });
                } else if (this._routes[i].method === Method.POST) {
                    this._app.post('/' + this._routes[i].uri, (req, res) => {
                        // Separate id, filters and params
                        let id = req.body ? req.body.id : null;
                        delete req.body.id;

                        let filters = {};
                        if (this._config.gateway.useAggregate && this._config.gateway.usePropertyFilters) {
                            for (let j = 0; j < this._routes[i].propertyFiltersSchema.length; j++) {
                                let filterName = this._routes[i].propertyFiltersSchema[j].name;
                                if (req.body[filterName]) {
                                    filters[filterName] = req.body[filterName];
                                    delete req.body[filterName];
                                }
                            }
                        }

                        this._routes[i].access(req.body, id, filters).then((result) => {
                            res.send(result);
                        }).catch((err) => {
                            res.status(400).send({error: err});
                        });
                    });
                }
                this._routes[i].registered = true;
            }
        }
    }

    /**
     * Check every HistoryStore in the stores attribute and create an endpoint for those which do not have one yet.
     */
    private syncHistoryStores(): void {
        for (let i = 0; i < this._historyStores.length; i++) {
            let sourceRoute = this._historyStores[i].source;
            if (!sourceRoute.registered && sourceRoute.valid) {
                console.log('New history store route found: /' + sourceRoute.uri, 'with method', sourceRoute.method);
                if (sourceRoute.method === Method.GET) {
                    this._app.get('/' + sourceRoute.uri, (req, res) => {
                        let startTime = req.query ? req.query.startTime : null;
                        let endTime = req.query ? req.query.endTime : null;
                        delete req.query.startTime;
                        delete req.query.endTime;

                        this._historyStores[i].readStore(startTime, endTime).then((result) => {
                            res.send(result);
                        });
                    });
                } else if (sourceRoute.method === Method.POST) {
                    this._app.post('/' + sourceRoute.uri, (req, res) => {
                        let startTime = req.body ? req.body.startTime : null;
                        let endTime = req.body ? req.body.endTime : null;
                        delete req.body.startTime;
                        delete req.body.endTime;

                        this._historyStores[i].readStore(startTime, endTime).then((result) => {
                            res.send(result);
                        });
                    });
                }
                sourceRoute.registered = true;
            }
        }
    }
}