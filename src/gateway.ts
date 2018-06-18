import {Configuration} from "./configuration";

export class Gateway {

    private config: Configuration;

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
                //TODO: Init steps
            }
        });
    }

}