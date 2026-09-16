/* global test, expect, process */

// This test triggers many early-return branches in the event handlers and
// dtCompat helpers by re-requiring the module under controlled global
// environments and invoking the captured handlers directly.

function requirePluginWithFakeJQuery () {
    'use strict';

    // capture handlers registered by the plugin
    const handlers = {};

    global.document = global.document || {};
    global.$ = global.jQuery = (sel) => {
        if (sel === global.document) {
            return {
                on: (ev, h) => {
                    handlers[ev] = h;
                },
                trigger: (ev, ...a) => {
                    if (handlers[ev]) {
                        handlers[ev](...a);
                    }
                }
            };
        }

        return {
            append: () => {
            },
            prepend: () => {
            },
            empty: () => ({}),
            find: () => ({map: () => ({get: () => []})}),
            val: () => '',
            change: () => ({})
        };
    };
    global.$.getJSON = () => {
    };

    // Ensure we load a fresh copy of the plugin
    delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];

    const plugin = require('../src/datatables-filterdropdown.js');
    const mod = typeof plugin === 'function' ? plugin(global) : plugin;

    return {mod, handlers};
}

test('coverage-more: dtCompat fallback and version branches', () => {
    'use strict';

    // Use the source-parsing helper to obtain internals without executing
    // the top-level module code. This lets us inspect dtCompat in a
    // environment without datatables.net present.
    // Ensure a minimal $ exists so the parsing run-time doesn't throw.
    global.$ = global.jQuery = (sel) => {
        if (sel === global.document) {
            return {
                on: () => {
                }, trigger: () => {
                }
            };
        }

        return {
            append: () => {
            },
            empty: () => ({}),
            find: () => ({map: () => ({get: () => []})}),
            val: () => ''
        };
    };

    const {loadInternals} = require('./helpers/test-helpers');
    let internals = loadInternals();

    // loadInternals may fail to expose dtCompat in certain environments; fall
    // back to requiring the module (with a minimal DataTable present) to
    // obtain the internals.
    let dtc = internals.dtCompat;
    if (!dtc) {
        global.DataTable = {
            Api: class Api {
                constructor (s) {
                    this.settings = s;
                }
            }
        };
        delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];
        const plugin = require('../src/datatables-filterdropdown.js');
        const mod = typeof plugin === 'function' ? plugin(global) : plugin;
        dtc = mod._test.dtCompat;
    }

    // apiFromSettings may return null when no APIs are available, or an
    // API instance when we had to fall back to requiring a minimal DataTable
    // to obtain internals. Accept either behavior here.
    const apiRes = dtc.apiFromSettings({});
    expect(apiRes === null || (apiRes && apiRes.settings !== undefined)).toBeTruthy();

    // escapeRegex should fallback to a simple escaping
    const escaped = dtc.escapeRegex('a+b');
    expect(escaped.indexOf('\\+') !== -1).toBeTruthy();

    // version/isV2 should return null when no version info
    expect(dtc.version()).toBeNull();
    expect(dtc.isV2()).toBeNull();
});

test('coverage-more: dtCompat with global DataTable (util and version)', () => {
    'use strict';

    global.DataTable = {
        Api: class Api {
            constructor (s) {
                this.settings = s;
            }
        }, util: {escapeRegex: s => `X${s}`}, version: '2.1.0'
    };

    // Provide a minimal jQuery/$ stub so the plugin can attach event handlers
    global.$ = global.jQuery = (sel) => {
        if (sel === global.document) {
            const handlers = {};

            return {
                on: (ev, h) => {
                    handlers[ev] = h;
                },
                trigger: (ev, ...a) => {
                    if (handlers[ev]) {
                        handlers[ev](...a);
                    }
                }
            };
        }

        return {
            append: () => {
            },
            empty: () => ({}),
            find: () => ({map: () => ({get: () => []})}),
            val: () => ''
        };
    };
    global.$.getJSON = () => {
    };

    process.env.NODE_ENV = 'test';

    delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];

    const plugin = require('../src/datatables-filterdropdown.js');
    const mod = typeof plugin === 'function' ? plugin(global) : plugin;
    const dtc = mod._test.dtCompat;

    expect(dtc.apiFromSettings({})).toBeDefined();
    expect(dtc.escapeRegex('a')).toBe('Xa');
    expect(dtc.version()).toBe('2.1.0');
    expect(dtc.isV2()).toBe(true);
});

test('coverage-more: early returns in event handlers', () => {
    'use strict';

    // Setup a fake jQuery that captures event handlers
    const {mod, handlers} = requirePluginWithFakeJQuery();

    const preInit = handlers['preInit.dt'];
    const init = handlers['init.dt'];
    const stateLoaded = handlers['stateLoaded.dt'];

    expect(typeof preInit).toBe('function');
    expect(typeof init).toBe('function');
    expect(typeof stateLoaded).toBe('function');

    // 1) preInit: wrong namespace -> early return (line ~353)
    preInit({namespace: 'x'}, {});

    // 2) preInit: namespace dt but settings undefined -> _apiFromSettingsCached returns null (line ~360)
    preInit({namespace: 'dt'}, undefined);

    // 3) preInit: settings with api that has no filterDropDown -> returns at line ~372
    const apiNoFilter = {
        table: () => ({node: () => ({id: 't1'}), container: () => ({})}),
        init: () => ({}),
        columns: () => ({
            indexes: () => ({
                each: () => {
                }
            })
        })
    };
    preInit({namespace: 'dt'}, {_filterDropDownApi: apiNoFilter});

    // 4) preInit: initObj has filterDropDown but parseInitArray yields no columns -> returns at ~380
    const apiEmptyCols = {
        table: () => ({node: () => ({id: 't2'}), container: () => ({})}),
        init: () => ({filterDropDown: {columns: []}}),
        columns: () => ({
            indexes: () => ({
                each: () => {
                }
            })
        })
    };
    preInit({namespace: 'dt'}, {_filterDropDownApi: apiEmptyCols});

    // init.dt early returns: wrong namespace
    init({namespace: 'x'}, {});

    // init.dt with undefined settings -> early return
    init({namespace: 'dt'}, undefined);

    // init.dt with initObj lacking filterDropDown -> early return around ~463
    const apiNoFilterInit = {
        table: () => ({node: () => ({id: 't3'}), container: () => ({})}),
        init: () => ({}),
        columns: () => ({
            indexes: () => ({
                each: () => {
                }
            })
        }),
        column: () => ({
            data: () => ({
                unique: () => ({
                    sort: () => ({
                        each: () => {
                        }
                    })
                })
            })
        })
    };
    init({namespace: 'dt'}, {_filterDropDownApi: apiNoFilterInit});

    // stateLoaded early returns: wrong namespace
    stateLoaded({namespace: 'x'}, {}, {});

    // stateLoaded with undefined settings -> early return
    stateLoaded({namespace: 'dt'}, undefined, {});

    // stateLoaded with initObj lacking filterDropDown -> early return
    const apiStateNoFilter = {
        table: () => ({node: () => ({id: 't4'})}),
        init: () => ({}),
        columns: () => ({
            indexes: () => ({
                each: () => {
                }
            })
        }),
        column: () => ({data: () => ({})})
    };
    stateLoaded({namespace: 'dt'}, {_filterDropDownApi: apiStateNoFilter}, {});

    // sanity: DataTable global registration should exist
    if (global.DataTable) {
        expect(global.DataTable.filterDropDown).toBeDefined();
        expect(typeof global.DataTable.filterDropDown.register).toBe('function');
    }
});
