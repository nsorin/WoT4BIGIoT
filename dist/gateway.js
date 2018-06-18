"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Gateway {
    constructor(config) {
        this.initComplete = false;
        this.config = config;
    }
    init() {
        return new Promise((resolve, reject) => {
            if (this.initComplete) {
                resolve(this);
            }
            else {
                //TODO: Init steps
            }
        });
    }
}
exports.Gateway = Gateway;
//# sourceMappingURL=gateway.js.map