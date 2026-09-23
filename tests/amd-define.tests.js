/* global jest, describe, it, expect, beforeEach, afterEach */

const {testedFile} = require('./helpers/test-helpers');

describe('AMD define branch', () => {
    'use strict';

    beforeEach(() => {
        jest.resetModules();
    });

    afterEach(() => {
        // Clean up globals we set for the AMD simulation
        try {
            delete global.define;
        } catch (e) { // eslint-disable-line no-unused-vars
            // ignore
        }

        try {
            delete global.window;
        } catch (e) { // eslint-disable-line no-unused-vars
            // ignore
        }

        try {
            delete global.document;
        } catch (e) { // eslint-disable-line no-unused-vars
            // ignore
        }

        try {
            delete global.__amdModuleResult;
        } catch (e) { // eslint-disable-line no-unused-vars
            // ignore
        }
    });

    it('registers plugin via AMD define and passes datatables.net to factory', () => {
        // Provide window/document so the module can reference them without throwing
        global.window = {};
        global.document = {};

        // Minimal fake DataTables object that the AMD loader would provide
        const fakeDt = {
            Api: class Api {
                constructor (s) {
                    this.settings = s;
                }
            },
            version: '2.0.0',
            util: {
                escapeRegex: (str) => (str ? String(str).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') : '')
            }
        };

        // Minimal jQuery-like stub to satisfy plugin during module initialization.
        // The plugin only registers event handlers and manipulates DOM via a few
        // methods on load; we provide safe no-op implementations.
        global.$ = global.jQuery = function () {
            return {
                on: () => {
                },
                find: () => ({html: () => ''}),
                prepend: () => {
                },
                append: () => {
                },
                empty: () => ({
                    append: () => {
                    }
                }),
                change: () => {
                },
                val: () => '',
                trigger: () => {
                },
                map: () => ({get: () => []}),
                get: () => []
            };
        };

        // Provide a minimal `fn.dataTable` shape so dtCompat detection doesn't warn
        global.jQuery.fn = global.jQuery.fn || {};
        global.jQuery.fn.dataTable = {
            Api: fakeDt.Api,
            version: fakeDt.version,
            util: fakeDt.util
        };

        let defineCalled = false;

        // Simulate an AMD define() function that calls the factory callback with our fake dt
        global.define = (deps, callback) => {
            expect(Array.isArray(deps)).toBe(true);
            expect(deps).toContain('datatables.net');
            defineCalled = true;

            const res = callback(fakeDt);
            // Capture the module result so we can inspect it
            global.__amdModuleResult = res;
            return res;
        };
        global.define.amd = true;

        // Require the module which should invoke our define shim
        require(testedFile);

        expect(defineCalled).toBe(true);

        const api = global.__amdModuleResult;
        expect(api).toBeDefined();
        expect(api.version).toBe('0.0.4');

        // The factory should have attached metadata to the provided DataTable object
        expect(fakeDt.filterDropDown).toBeDefined();
        expect(fakeDt.filterDropDown.version).toBe('0.0.4');
    });
});
