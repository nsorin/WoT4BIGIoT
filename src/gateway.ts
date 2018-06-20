import express = require('express');
import sanitize = require('sanitize-filename');
import {GatewayRoute, Method} from "./gateway-route";
import {Configuration} from "./configuration";
import Thing, {Interaction} from "../thingweb.node-wot/packages/td-tools/src/thing-description";

export class Gateway {

    private config: Configuration;
    private app = express();
    private routes: Array<GatewayRoute>;
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
                });
            }
        });
    }

    public addSingleThings(thing: Array<Thing>) {

    }

    public addAggregatedThings(things: Array<Thing>) {

    }

    private addReadPropertyRoute(property: WoT.ThingProperty) {

    }

    private addWritePropertyRoute(property: WoT.ThingProperty) {

    }

    private addInvokeActionRoute(action: WoT.ThingAction) {

    }

    private syncRoutes() {
        for (let i = 0; i < this.routes.length; i++) {
            if (!this.routes[i].registered) {
                if (this.routes[i].method === Method.GET) {
                    this.app.get('/' + this.routes[i].uri, (req, res) => {
                        // return this.routes[i].accessCallback(req, res);
                    });
                } else if (this.routes[i].method === Method.POST) {
                    this.app.post('/' + this.routes[i].uri, (req, res) => {
                        // return this.routes[i].accessCallback(req, res);
                    });
                }
                // TODO Register offering
                this.routes[i].registered = true;
            }
        }
    }

}