import {Thing} from "../thingweb.node-wot/packages/td-tools";
import {Configuration} from "./configuration";

export class ThingAnalyzer {

    private config: Configuration;

    constructor(config: Configuration) {
        this.config = config;
    }

    /**
     * Check if a Thing can be registered on the marketplace right away (if not, a gateway is needed)
     * @param {Thing} thing
     * @return {boolean}
     */
    public isThingDirectlyCompatible(thing: Thing): boolean {
        if (this.config.moreLogs) console.log('Checking thing for direct compatibility:', thing.name);
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

    /**
     * Compare two things to see if they can be aggregated together.
     * @param {Thing} thing1
     * @param {Thing} thing2
     * @return {boolean}
     */
    public areThingsIdentical(thing1: Thing, thing2: Thing): boolean {
        return thing1.name === thing2.name
            // Exactly same interactions
            && Object.keys(thing1.properties).length === Object.keys(thing2.properties).length
            && Object.keys(thing1.actions).length === Object.keys(thing2.actions).length
            && this.areInteractionsIdentical(thing1.properties, thing2.properties)
            && this.areInteractionsIdentical(thing1.actions, thing2.actions)
            && this.areSemanticTypesIdentical(thing1['@type'], thing2['@type']);
    }

    /**
     * Compares two maps of interactions to see if they are identical.
     * @param interactions1
     * @param interactions2
     * @return {boolean}
     */
    private areInteractionsIdentical(interactions1: any, interactions2: any): boolean {
        for (let key in interactions1) {
            if (interactions1.hasOwnProperty(key) && interactions2.hasOwnProperty(key)) {
                if (JSON.stringify(interactions1[key].input) !== JSON.stringify(interactions2[key].input)
                    || JSON.stringify(interactions1[key].output) !== JSON.stringify(interactions2[key].output)
                    || interactions1[key].type !== interactions2[key].type
                    || interactions1[key].writable !== interactions2[key].writable
                    || interactions1[key].observable !== interactions2[key].observable
                    || interactions1[key].const !== interactions2[key].const
                    // Semantic types
                    || !this.areSemanticTypesIdentical(interactions1[key]['@type'], interactions2[key]['@type'])
                ) {
                    return false;
                }
            }
            else {
                return false;
            }
        }
        return true;
    }

    /**
     * Compare two arrays of semantic types to see if they are identical.
     * @param {Array<string>} types1
     * @param {Array<string>} types2
     * @return {boolean}
     */
    private areSemanticTypesIdentical(types1: string | Array<string>, types2: string | Array<string>) : boolean {
        if (typeof types1 !== typeof types1) {
            return false;
        }
        if (types1 && types2) {
            if (Array.isArray(types1) && Array.isArray(types2)) {
                if (types1.length !== types2.length) {
                    return false;
                }
                for (let i = 0; i < types1.length; i++) {
                    if (types2.indexOf(types1[i]) === -1) {
                        return false;
                    }
                }
            } else {
                return types1 === types2;
            }
        }
        return true;
    }

    /**
     * Check if a Property is compatible with the Offering model.
     * @param {ThingProperty} property
     * @return {boolean}
     */
    private isPropertyDirectlyCompatible(property: any): boolean {
        // Check forms: At least one should be compatible
        let formsOk = false;
        for (let i = 0; i < property.forms.length; i++) {
            formsOk = formsOk || this.isFormCompatible(property.forms[i]);
        }
        if (!formsOk) {
            if (this.config.moreLogs) console.log("Property", property.label, "not compatible: no valid form.");
            return false;
        }
        // Check schema
        return this.isOutputSchemaCompatible(property) && !(property.writable && !this.isInputSchemaCompatible(property));
    }

    /**
     * Check if an Action is compatible with the Offering model.
     * @param {ThingAction} action
     * @return {boolean}
     */
    private isActionDirectlyCompatible(action: any): boolean {
        // Check forms: At least one should be compatible
        let formsOk = false;
        for (let i = 0; i < action.forms.length; i++) {
            formsOk = formsOk || this.isFormCompatible(action.forms[i]);
        }
        if (!formsOk) {
            if (this.config.moreLogs) console.log("Action", action.label, "not compatible: no valid form.");
            return false;
        }
        // Check inputSchema and outputSchema
        return this.isInputSchemaCompatible(action.input) && this.isOutputSchemaCompatible(action.output);
    }

    /**
     * Check if an interaction Form is compatible with the Offering model.
     * @param {Form} form
     * @return {boolean}
     */
    private isFormCompatible(form: WoT.Form): boolean {
        // COAP and HTTP PUT are not compatible yet
        return form.hasOwnProperty['coap:methodCode'] ||
            (form.hasOwnProperty['http:methodName'] && form['http:methodName'] === "PUT");
    }

    /**
     * Check if an output schema is compatible with the Offering model.
     * @param {DataSchema} schema
     * @return {boolean}
     */
    private isOutputSchemaCompatible(schema: WoT.DataSchema): boolean {
        if (schema.type !== 'array' || !(Boolean(schema['items'])) || schema['items'].type !== 'object') {
            if (this.config.moreLogs) console.log('Output is not an array: no direct compatibility!');
            return false;
        }
        for (let i = 0; i < schema['items']['properties'].length; i++) {
            let field = schema['items']['properties'][i];
            if (field.schema.type === 'object' || field.schema.type === 'array') {
                if (this.config.moreLogs) console.log('An output field has a complex type: no direct compatibility! (field:', field.name, ')');
                return false;
            }
        }
        return true;
    }

    /**
     * Check if an input schema is compatible with the Offering model.
     * @param {DataSchema} schema
     * @return {boolean}
     */
    private isInputSchemaCompatible(schema: any): boolean {
        if (!schema) return true;
        if (schema.type !== 'object') {
            if (this.config.moreLogs) console.log('Input is not an object: no direct compatibility!');
            return false;
        }
        for (let i = 0; i < schema['properties'].length; i++) {
            let field = schema['properties'][i];
            if (field.schema.type === 'object' || field.schema.type === 'array') {
                if (this.config.moreLogs) console.log('An input field has a complex type: no direct compatibility! (field:', field.name, ')');
                return false;
            }
        }
        return true;
    }
}