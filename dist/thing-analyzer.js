"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ThingAnalyzer {
    constructor(config) {
        this.config = config;
    }
    isThingDirectlyCompatible(thing) {
        if (this.config.moreLogs)
            console.log('Checking thing for direct compatibility:', thing.name);
        // Check properties
        for (let i in thing.properties) {
            if (thing.properties.hasOwnProperty(i)) {
                if (!this.isPropertyDirectlyCompatible(thing.properties[i])) {
                    return false;
                }
            }
        }
        // Check actions
        for (let i in thing.actions) {
            if (thing.actions.hasOwnProperty(i)) {
                if (!this.isActionDirectlyCompatible(thing.actions[i])) {
                    return false;
                }
            }
        }
        //TODO: Check events (currently not supported)
        return true;
    }
    isPropertyDirectlyCompatible(property) {
        // Check forms: At least one should be compatible
        let formsOk = false;
        for (let i = 0; i < property.forms.length; i++) {
            formsOk = formsOk || this.isFormCompatible(property.forms[i]);
        }
        if (!formsOk) {
            if (this.config.moreLogs)
                console.log("Property", property.label, "not compatible: no valid form.");
            return false;
        }
        // Check schema
        return this.isOutputSchemaCompatible(property) && !(property.writable && !this.isInputSchemaCompatible(property));
    }
    isActionDirectlyCompatible(action) {
        // Check forms: At least one should be compatible
        let formsOk = false;
        for (let i = 0; i < action.forms.length; i++) {
            formsOk = formsOk || this.isFormCompatible(action.forms[i]);
        }
        if (!formsOk) {
            if (this.config.moreLogs)
                console.log("Action", action.label, "not compatible: no valid form.");
            return false;
        }
        // Check inputSchema and outputSchema
        return this.isInputSchemaCompatible(action.input) && this.isOutputSchemaCompatible(action.output);
    }
    isFormCompatible(form) {
        // COAP and HTTP PUT are not compatible yet
        return form.hasOwnProperty['coap:methodCode'] ||
            (form.hasOwnProperty['http:methodName'] && form['http:methodName'] === "PUT");
    }
    isOutputSchemaCompatible(schema) {
        if (schema.type !== 'array' || !(Boolean(schema['items'])) || schema['items'].type !== 'object') {
            if (this.config.moreLogs)
                console.log('Output is not an array: no direct compatibility!');
            return false;
        }
        for (let i = 0; i < schema['items'].properties.length; i++) {
            let field = schema['items'].properties[i];
            if (field.schema.type === 'object' || field.schema.type === 'array') {
                if (this.config.moreLogs)
                    console.log('An output field has a complex type: no direct compatibility! (field:', field.name, ')');
                return false;
            }
        }
        return true;
    }
    isInputSchemaCompatible(schema) {
        if (!schema)
            return true;
        if (schema.type !== 'object') {
            if (this.config.moreLogs)
                console.log('Input is not an object: no direct compatibility!');
            return false;
        }
        for (let i = 0; i < schema['properties'].length; i++) {
            let field = schema['properties'][i];
            if (field.schema.type === 'object' || field.schema.type === 'array') {
                if (this.config.moreLogs)
                    console.log('An input field has a complex type: no direct compatibility! (field:', field.name, ')');
                return false;
            }
        }
        return true;
    }
}
exports.ThingAnalyzer = ThingAnalyzer;
//# sourceMappingURL=thing-analyzer.js.map