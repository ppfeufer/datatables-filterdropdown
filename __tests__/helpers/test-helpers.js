/* global process */

const loadInternals = () => {
    'use strict';

    const file = '../../src/datatables-filterdropdown.js';

    // Ensure module is loaded fresh under test env so it can attach _test.
    delete require.cache[require.resolve(file)];

    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const hadDT = typeof global.DataTable !== 'undefined';

    if (!hadDT) {
        // Provide a minimal DataTable implementation. Keep Api as a proper
        // constructor (class) so callers that use `new DataTable.Api(...)`
        // continue to work. Arrow functions cannot be used as constructors.
        global.DataTable = {
            Api: class Api {
                constructor (s) {
                    this.settings = s;
                }
            },
            util: {
                escapeRegex: (s) => String(s).replace(/\+/g, '\\+')
            },
            version: null
        };
    }

    // Provide a minimal jQuery/$ stub so the plugin's top-level initialization
    // that uses $ does not throw during require(). We'll restore it later.
    const hadJQ = typeof global.jQuery !== 'undefined' || typeof global.$ !== 'undefined';

    if (!hadJQ) {
        const handlers = {};
        const docApi = {
            on: (ev, h) => {
                handlers[ev] = h;
            }, trigger: (ev, ...a) => {
                if (handlers[ev]) {
                    handlers[ev](...a);
                }
            }
        };
        const makeWrapper = () => ({
            append: () => {
            },
            prepend: () => {
            },
            empty: () => ({
                append: () => {
                }
            }),
            find: () => ({map: () => ({get: () => []})}),
            val: () => '',
            change: () => ({})
        });
        const stub = (sel) => {
            if (sel === global.document) {
                return docApi;
            }

            return makeWrapper();
        };

        stub.getJSON = () => {
        };

        global.$ = global.jQuery = stub;
    }

    try {
        const plugin = require(file);
        const mod = typeof plugin === 'function' ? plugin(global) : plugin;

        if (!mod || !mod._test) {
            throw new Error('Module did not expose _test. Ensure source exports internals for tests');
        }

        return mod._test;
    } finally {
        // cleanup temporary globals
        if (!hadDT) {
            delete global.DataTable;
        }

        if (!hadJQ) {
            delete global.$;
            delete global.jQuery;
        }

        process.env.NODE_ENV = prevEnv;
    }
};

module.exports = {loadInternals};
