import {Configuration} from "./configuration";
import {GatewayRoute} from "./gateway-route";
import dateTime = require('node-datetime');
import fs = require('fs');
import path = require('path');
import readline = require('readline');

export class HistoryStore {

    private config: Configuration;
    private memoryStore = [];
    public readonly source: GatewayRoute;
    private readonly fileStream: fs.WriteStream;

    public static readonly DATE_FIELD_NAME = 'date';
    public static readonly VALUES_FIELD_NAME = 'values';

    private static readonly STORES_PATH = path.resolve(__dirname, '../stores');
    private static readonly STORES_EXTENSION = '.store';
    private static readonly START_FIELD = {name: "startTime", rdfUri: "http://schema.big-iot.org/mobility/startTime"};
    private static readonly END_FIELD = {name: "endTime", rdfUri: "http://schema.big-iot.org/mobility/endTime"};
    private static readonly DATE_FIELD = {name: HistoryStore.DATE_FIELD_NAME, rdfUri: "http://schema.big-iot.org/common/measurementTime"};

    constructor(config: Configuration, source: GatewayRoute) {
        this.config = config;
        this.source = source;

        this.fileStream = fs.createWriteStream(path.resolve(HistoryStore.STORES_PATH, this.source.uri + HistoryStore.STORES_EXTENSION), {flags: 'a'});

        this.source.convertedInputSchema.push(HistoryStore.START_FIELD);
        this.source.convertedInputSchema.push(HistoryStore.END_FIELD);
        this.source.convertedOutputSchema.push(HistoryStore.DATE_FIELD);



        if (this.config.history.onDisk) {
            setInterval(() => {
                this.callSource((result) => this.writeStoreOnDisk(result));
            }, this.config.history.period);
        } else {
            setInterval(() => {
                this.callSource((result) => this.writeStore(result));
            }, this.config.history.period);
        }
    }

    public readStore(startTime?, endTime?): Promise<any> {
        return this.config.history.onDisk ? this.readOnDisk(startTime, endTime) : this.read(startTime, endTime);
    }

    private read(startTime?, endTime?) {
        return new Promise((resolve, reject) => {
            // Deep copy of the array to keep the state at the time the function is called
            //TODO Remove this hack
            let returnValue = JSON.parse(JSON.stringify(this.memoryStore));
            if (startTime) {
                // Remove values before start time
                let initialLength = returnValue.length;
                let i;
                for (i = 0; i < returnValue.length; i++) {
                    // First time the date is more than requested start, remove everything before
                    if (returnValue[i].date >= startTime) {
                        returnValue = returnValue.slice(i, returnValue.length);
                        break;
                    }
                }
                if (i === initialLength) {
                    resolve([]);
                }
            }
            if (endTime) {
                // Remove values after start time
                for (let i = 0; i < returnValue.length; i++) {
                    // First time the date is more than requested start, remove everything before
                    if (returnValue[i].date > endTime) {
                        resolve(returnValue.slice(0, i));
                    }
                }
            }
            resolve(returnValue);
        });
    }

    private readOnDisk(startTime?, endTime?) {
        return new Promise((resolve, reject) => {
            let reader = readline.createInterface({input: fs.createReadStream(this.fileStream.path)});
            let result = [];
            reader.on('line', (line) => {
                try {
                    let lineObject = JSON.parse(line);
                    if ((!startTime || startTime <= lineObject.date) && (!endTime || endTime >= lineObject.date)) {
                        result.push(lineObject);
                    }
                } catch (e) {
                    console.log('Could not parse line of store:', line);
                }
            }).on('close', (line) => {
                resolve(result);
            });
        });
    }

    private callSource(callback) {
        let newObject = {[HistoryStore.DATE_FIELD_NAME]: dateTime.create().format('Y-m-dTH:M:S')};
        this.source.access({}).then((data) => {
            if (data.length === 1) {
                Object.assign(newObject, data[0]);
            } else {
                newObject[HistoryStore.VALUES_FIELD_NAME] = data;
            }
            callback(newObject);
        });
    }

    private writeStore(newObject) {
        this.memoryStore.push(newObject);
        if (this.memoryStore.length > this.config.history.limit) {
            this.memoryStore.shift();
        }
    }

    private writeStoreOnDisk(newObject) {
        this.fileStream.write(JSON.stringify(newObject) + '\n');
    }

}