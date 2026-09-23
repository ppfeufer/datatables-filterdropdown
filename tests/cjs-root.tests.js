/* global jest, describe, it, expect, beforeEach, afterEach */

const {testedFile} = require('./helpers/test-helpers');

describe('CommonJS root handling', () => {
    'use strict';

    beforeEach(() => {
        jest.resetModules();

        // Ensure `window` is not defined so module uses the CommonJS factory branch
        try {
            delete global.window;
        } catch (e) { // eslint-disable-line no-unused-vars
        }
    });

    afterEach(() => {
        // cleanup any globals we set
        try {
            delete global.window;
        } catch (e) { // eslint-disable-line no-unused-vars
        }

        try {
            delete global.document;
        } catch (e) { // eslint-disable-line no-unused-vars
        }

        try {
            delete global.$;
        } catch (e) { // eslint-disable-line no-unused-vars
        }

        try {
            delete global.jQuery;
        } catch (e) { // eslint-disable-line no-unused-vars
        }
    });

    it('calling CommonJS factory without root throws (hits the if (!root) branch)', () => {
        const factory = require(testedFile);

        expect(typeof factory).toBe('function');

        // Calling without root should attempt to reference `window` and throw
        expect(() => {
            factory();
        }).toThrow();
    });

    it('calling CommonJS factory with a valid root returns API and attaches to DataTable', () => {
        // Provide a minimal root object with DataTable so cjsRequires will not try to require datatables.net
        const fakeDt = {
            Api: function (s) {
                this.settings = s;
            },
            version: '2.0.0',
            util: {escapeRegex: (s) => (s ? String(s).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') : '')}
        };

        const root = {
            document: {},
            DataTable: fakeDt
        };

        // Minimal jQuery stub used by the plugin during initialization
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
        global.jQuery.fn = global.jQuery.fn || {};
        global.jQuery.fn.dataTable = {
            Api: fakeDt.Api,
            version: fakeDt.version,
            util: fakeDt.util
        };

        const factory = require(testedFile);

        expect(typeof factory).toBe('function');

        const api = factory(root);

        expect(api).toBeDefined();
        expect(api.version).toBe('0.0.4');

        // The passed DataTable object should have been augmented with filterDropDown
        expect(root.DataTable.filterDropDown).toBeDefined();
        expect(root.DataTable.filterDropDown.version).toBe('0.0.4');
    });
});
