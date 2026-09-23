/* global jest, describe, it, expect, beforeEach, __dirname */

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const {testedFile} = require('./helpers/test-helpers');

describe('Browser global branch', () => {
    'use strict';

    beforeEach(() => {
        jest.resetModules();
    });

    it('invokes factory in browser mode and attaches to window.DataTable', () => {
        const srcPath = path.resolve(__dirname, testedFile);
        const src = fs.readFileSync(srcPath, 'utf8');

        // Prepare a browser-like sandbox where define and exports are absent
        const fakeDataTable = {
            Api: class Api {
                constructor (s) {
                    this.settings = s;
                }
            },
            version: '2.1.0',
            util: {escapeRegex: (s) => (s ? String(s).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') : '')}
        };

        // Minimal jQuery-like stub used by the plugin during initialization
        const $stub = function () {
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

        const sandbox = {
            window: {},
            document: {},
            // Provide global $ and jQuery so the module can reference them
            $: $stub,
            jQuery: $stub
        };

        // Attach DataTable to window in the sandbox
        sandbox.window.DataTable = fakeDataTable;

        // jQuery.fn.dataTable shape
        sandbox.jQuery.fn = sandbox.jQuery.fn || {};
        sandbox.jQuery.fn.dataTable = {
            Api: fakeDataTable.Api,
            version: fakeDataTable.version,
            util: fakeDataTable.util
        };

        // Execute the source in the sandbox; the UMD wrapper should choose the browser branch
        vm.runInNewContext(src, sandbox, {filename: srcPath});

        // After execution, the sandbox.window.DataTable should have been augmented
        expect(sandbox.window.DataTable).toBeDefined();
        expect(sandbox.window.DataTable.filterDropDown).toBeDefined();
        expect(sandbox.window.DataTable.filterDropDown.version).toBe('0.0.4');
    });
});
