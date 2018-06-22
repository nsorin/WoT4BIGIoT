import express = require('express');
import {GatewayRoute, Method} from "./gateway-route";
import {Configuration} from "./configuration";
import Thing from "../thingweb.node-wot/packages/td-tools/src/thing-description";

export class Gateway {

    private config: Configuration;
    private app = express();
    private routes: Array<GatewayRoute> = [];
    private initComplete = false;

    constructor(config: Configuration) {
        this.config = config;
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
                        this.routes.push(new GatewayRoute([things[i]], [j], true));
                    }
                }
                this.routes.push(new GatewayRoute([things[i]], propertyIndexes));
            } else {
                for (let j in things[i].properties) {
                    this.routes.push(new GatewayRoute([things[i]], [j]));
                    if (things[i].properties[j].writable) {
                        this.routes.push(new GatewayRoute([things[i]], [j], true));
                    }
                }
            }
            for (let j in things[i].actions) {
                this.routes.push(new GatewayRoute([things[i]], [], false, j));
            }
        }
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
                        this.routes.push(new GatewayRoute(things, [j], true));
                    }
                }
                this.routes.push(new GatewayRoute(things, propertyIndexes));
            } else {
                for (let j in thing.properties) {
                    this.routes.push(new GatewayRoute(things, [j]));
                    if (thing.properties[j].writable) {
                        this.routes.push(new GatewayRoute(things, [j], true));
                    }
                }
            }
            for (let j in thing.actions) {
                this.routes.push(new GatewayRoute(things, [], false, j));
            }
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
                        // TODO: Prepare req to separate id and params
                        let id = req.query ? req.query.id : null;
                        delete req.query.id;
                        this.routes[i].access(req.query, id).then((result) => {
                            res.send(result);
                        }).catch((err) => {
                            res.status(400).send({ error: err });
                        });
                    });
                } else if (this.routes[i].method === Method.POST) {
                    this.app.post('/' + this.routes[i].uri, (req, res) => {
                        // TODO: Prepare req to separate id and params
                        let id = req.body ? req.body.id : null;
                        delete req.body.id;
                        this.routes[i].access(req.body, id).then((result) => {
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

}