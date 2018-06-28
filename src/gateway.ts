import express = require('express');
import {GatewayRoute, Method} from "./gateway-route";
import {Configuration} from "./configuration";
import Thing from "../thingweb.node-wot/packages/td-tools/src/thing-description";
import {HistoryStore} from "./history-store";
import {OfferingManager} from "./offering-manager";

export class Gateway {

    private readonly config: Configuration;
    private readonly offeringManager: OfferingManager;
    private app = express();
    private routes: Array<GatewayRoute> = [];
    private historyStores: Array<HistoryStore> = [];
    private initComplete = false;

    constructor(config: Configuration, offeringManager: OfferingManager) {
        this.config = config;
        this.offeringManager = offeringManager;
    }

    /**
     * Initialize the Gateway. If init as already been performed, skip it.
     * @return {Promise<any>}
     */
    public init(): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this.initComplete) {
                resolve(this);
            } else {
                this.app.use(express.json());
                this.app.use(express.urlencoded({extended: true}));
                console.log('Starting gateway server...');
                this.app.listen(this.config.gateway.port, this.config.gateway.host, () => {
                    console.log("Started gateway server at http://%s:%s",
                        this.config.gateway.host, this.config.gateway.port);
                    this.initComplete = true;
                    resolve(this);
                });
            }
        });
    }

    public addSingleThings(things: Array<Thing>) {
        console.log('Received', things.length, 'to add without aggregation');
        let alreadyUsedNames: Array<string> = [];
        for (let i = 0; i < things.length; i++) {

            // Rename duplicates
            let fakeIndex = 0;
            while (alreadyUsedNames.indexOf(things[i].name) > -1) {
                console.log('Current thing name:', things[i].name, 'is already in use.');
                let fakeIndexString = String(fakeIndex);
                if (fakeIndex === 0) {
                    things[i].name = things[i].name + (++fakeIndex);
                } else {
                    things[i].name = things[i].name.slice(0, -1 * fakeIndexString.length) + (++fakeIndex);
                }
            }
            alreadyUsedNames.push(things[i].name);

            if (this.config.useMerge) {
                let propertyIndexes = [];
                for (let j in things[i].properties) {
                    propertyIndexes.push(j);
                    if (things[i].properties[j].writable) {
                        let newRoute = new GatewayRoute([things[i]], [j], true);
                        this.routes.push(newRoute);
                        this.offeringManager.addOfferingForRoute(newRoute, [things[i]], [j], true);
                    }
                }
                let newRoute = new GatewayRoute([things[i]], propertyIndexes);
                if (this.config.useHistory) {
                    this.historyStores.push(new HistoryStore(this.config, newRoute));
                } else {
                    this.routes.push(newRoute);
                }
                this.offeringManager.addOfferingForRoute(newRoute, [things[i]], propertyIndexes);
            } else {
                for (let j in things[i].properties) {
                    let newRoute = new GatewayRoute([things[i]], [j]);
                    if (this.config.useHistory) {
                        this.historyStores.push(new HistoryStore(this.config, newRoute));
                    } else {
                        this.routes.push(newRoute);
                    }
                    this.offeringManager.addOfferingForRoute(newRoute, [things[i]], [j]);
                    if (things[i].properties[j].writable) {
                        let newWriteRoute = new GatewayRoute([things[i]], [j], true);
                        this.routes.push(newWriteRoute);
                        this.offeringManager.addOfferingForRoute(newWriteRoute, [things[i]], [j], true);
                    }
                }
            }
            for (let j in things[i].actions) {
                let newRoute = new GatewayRoute([things[i]], [], false, j);
                this.routes.push(newRoute);
                this.offeringManager.addOfferingForRoute(newRoute, [things[i]], [], false, j);
            }
        }
        if (this.config.useHistory) this.syncHistoryStores();
        this.syncRoutes();
    }

    public addAggregatedThings(things: Array<Thing>) {
        console.log('Received', things.length, 'to add with aggregation');
        if (things.length > 0) {
            // All things are identical - use first one as reference:
            let thing = things[0];
            if (this.config.useMerge) {
                let propertyIndexes = [];
                for (let j in thing.properties) {
                    propertyIndexes.push(j);
                    if (thing.properties[j].writable) {
                        let newRoute = new GatewayRoute(things, [j], true);
                        this.routes.push(newRoute);
                        this.offeringManager.addOfferingForRoute(newRoute, things, [j], true);
                    }
                }
                if (this.config.useHistory) {
                    let newRoute = new GatewayRoute(things, propertyIndexes);
                    this.historyStores.push(new HistoryStore(this.config, newRoute));
                    this.offeringManager.addOfferingForRoute(newRoute, things, propertyIndexes);
                } else {
                    let newRoute = new GatewayRoute(things, propertyIndexes, false, undefined,
                        this.config.aggregation.usePropertyFilters);
                    this.routes.push(newRoute);
                    this.offeringManager.addOfferingForRoute(newRoute, things, propertyIndexes);
                }
            } else {
                for (let j in thing.properties) {
                    if (this.config.useHistory) {
                        let newRoute = new GatewayRoute(things, [j]);
                        this.historyStores.push(new HistoryStore(this.config, newRoute));
                        this.offeringManager.addOfferingForRoute(newRoute, things, [j]);
                    } else {
                        let newRoute = new GatewayRoute(things, [j], false, undefined,
                            this.config.aggregation.usePropertyFilters);
                        this.routes.push(newRoute);
                        this.offeringManager.addOfferingForRoute(newRoute, things, [j]);
                    }
                    if (thing.properties[j].writable) {
                        let newWriteRoute = new GatewayRoute(things, [j], true);
                        this.routes.push(newWriteRoute);
                        this.offeringManager.addOfferingForRoute(newWriteRoute, things, [j], true);
                    }
                }
            }
            for (let j in thing.actions) {
                let newRoute = new GatewayRoute(things, [], false, j);
                this.routes.push(newRoute);
                this.offeringManager.addOfferingForRoute(newRoute, things, [], false, j);
            }
            if (this.config.useHistory) this.syncHistoryStores();
            this.syncRoutes();
        }
    }

    private syncRoutes() {
        console.log('Syncing routes');
        for (let i = 0; i < this.routes.length; i++) {
            if (!this.routes[i].registered && this.routes[i].valid) {
                console.log('New route found: /' + this.routes[i].uri, 'with method', this.routes[i].method);
                if (this.routes[i].method === Method.GET) {
                    this.app.get('/' + this.routes[i].uri, (req, res) => {
                        // Separate id, filters and params
                        let id = req.query ? req.query.id : null;
                        delete req.query.id;

                        let filters = {};
                        if (this.config.useAggregate && this.config.aggregation.usePropertyFilters) {
                            for (let j = 0; j < this.routes[i].propertyFiltersSchema.length; j++) {
                                let filterName = this.routes[i].propertyFiltersSchema[j].name;
                                if (req.query[filterName]) {
                                    filters[filterName] = req.query[filterName];
                                    delete req.query[filterName];
                                }
                            }
                        }

                        this.routes[i].access(req.query, id, filters).then((result) => {
                            res.send(result);
                        }).catch((err) => {
                            res.status(400).send({ error: err });
                        });
                    });
                } else if (this.routes[i].method === Method.POST) {
                    this.app.post('/' + this.routes[i].uri, (req, res) => {
                        // Separate id, filters and params
                        let id = req.body ? req.body.id : null;
                        delete req.body.id;

                        let filters = {};
                        if (this.config.useAggregate && this.config.aggregation.usePropertyFilters) {
                            for (let j = 0; j < this.routes[i].propertyFiltersSchema.length; j++) {
                                let filterName = this.routes[i].propertyFiltersSchema[j].name;
                                if (req.body[filterName]) {
                                    filters[filterName] = req.body[filterName];
                                    delete req.body[filterName];
                                }
                            }
                        }

                        this.routes[i].access(req.body, id, filters).then((result) => {
                            res.send(result);
                        }).catch((err) => {
                            res.status(400).send({ error: err });
                        });
                    });
                }
                // TODO Register offering
                this.routes[i].registered = true;
            }
        }
    }

    private syncHistoryStores() {
        for (let i = 0; i < this.historyStores.length; i++) {
            let sourceRoute = this.historyStores[i].source;
            if (!sourceRoute.registered && sourceRoute.valid) {
                console.log('New history store route found: /' + sourceRoute.uri, 'with method', sourceRoute.method);
                if (sourceRoute.method === Method.GET) {
                    this.app.get('/' + sourceRoute.uri, (req, res) => {
                        let startTime = req.query ? req.query.startTime : null;
                        let endTime = req.query ? req.query.endTime : null;
                        delete req.query.startTime;
                        delete req.query.endTime;

                        this.historyStores[i].readStore(startTime, endTime).then((result) => {
                           res.send(result);
                        });
                    });
                } else if (sourceRoute.method === Method.POST) {
                    this.app.post('/' + sourceRoute.uri, (req, res) => {
                        let startTime = req.body ? req.body.startTime : null;
                        let endTime = req.body ? req.body.endTime : null;
                        delete req.body.startTime;
                        delete req.body.endTime;

                        this.historyStores[i].readStore(startTime, endTime).then((result) => {
                            res.send(result);
                        });
                    });
                }
                // TODO Register offering
                sourceRoute.registered = true;
            }
        }
    }

}