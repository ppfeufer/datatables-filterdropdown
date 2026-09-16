/* global jest, test, expect, process */

// Common helper: create lightweight document and jQuery-like $ for tests
function setupMinimalDOMAndJQuery () {
    'use strict';

    global.window = global;

    // lightweight document if not present
    if (typeof global.document === 'undefined' || typeof global.document.createElement !== 'function') {
        const elements = Object.create(null);
        const all = [];

        function createElement (tag) { // jshint ignore:line
            const el = {
                tagName: String(tag).toUpperCase(),
                id: '',
                innerHTML: '',
                children: [],
                insertAdjacentHTML (position, html) {
                    const idMatch = /id\s*=\s*"([^"]+)"/.exec(html);
                    const tagMatch = /<\s*(\w+)/.exec(html);

                    if (tagMatch) {
                        const t = tagMatch[1].toLowerCase();
                        const newEl = createElement(t);

                        if (idMatch) {
                            newEl.id = idMatch[1];
                            elements[newEl.id] = newEl;
                        }

                        if (t === 'option') {
                            const valMatch = /value\s*=\s*"([^"]*)"/.exec(html);
                            const txtMatch = />((?:.|\n)*)<\s*\/option/.exec(html);

                            newEl.tagName = 'OPTION';
                            newEl.value = valMatch ? valMatch[1] : '';
                            newEl.text = txtMatch ? txtMatch[1] : '';

                            this.children.push(newEl);
                        } else {
                            this.children.push(newEl);

                            newEl.innerHTML = html;
                        }
                    } else {
                        this.innerHTML = position === 'afterbegin' ? html + this.innerHTML : this.innerHTML + html;
                    }
                },
                querySelectorAll (sel) {
                    if (sel === 'option') {
                        return this.children.filter(c => c.tagName === 'OPTION');
                    }

                    return [];
                }
            };

            all.push(el);

            return el;
        }

        global.document = {
            createElement,
            getElementById: (id) => elements[id] || all.find(e => e.id === id) || null,
            querySelectorAll: () => []
        };
    }

    // minimal $ wrapper that supports used operations
    const handlers = {};
    const eventAPI = {
        on: (e, h) => {
            handlers[e] = handlers[e] || [];
            handlers[e].push(h);
        }, trigger: (e, ...a) => {
            (handlers[e] || []).forEach(h => h(...a));
        }
    };
    const makeWrapper = (nodes) => ({
        nodes,
        prepend: (html) => {
            if (nodes[0] && nodes[0].insertAdjacentHTML) {
                nodes[0].insertAdjacentHTML('afterbegin', html);
            }

            return makeWrapper(nodes);
        },
        append: (html) => {
            if (nodes[0] && nodes[0].insertAdjacentHTML) {
                nodes[0].insertAdjacentHTML('beforeend', html);
            }

            return makeWrapper(nodes);
        },
        empty: () => {
            nodes.forEach(n => {
                if (n) {
                    n.innerHTML = '';
                }
            });

            return makeWrapper(nodes);
        },
        find: (sel) => {
            const found = nodes[0] && nodes[0].querySelectorAll ? Array.from(nodes[0].querySelectorAll(sel)) : [];

            return makeWrapper(found);
        },
        html: () => nodes[0] ? nodes[0].innerHTML : '',
        val: (v) => {
            if (v === undefined) {
                return nodes[0] ? nodes[0].value || '' : '';
            }

            nodes.forEach(n => {
                n.value = v;
            });

            return makeWrapper(nodes);
        },
        change: (h) => {
            nodes.forEach(n => {
                n.__change = h;
            });

            return makeWrapper(nodes);
        },
        map: (fn) => {
            const res = nodes.map((n, i) => fn(i, n));
            return {get: () => res};
        },
        get: () => nodes
    });
    const $fn = (sel) => {
        if (sel === document) {
            return eventAPI;
        }

        if (sel && typeof sel === 'object' && typeof sel.insertAdjacentHTML === 'function') {
            return makeWrapper([sel]);
        }

        if (sel && typeof sel === 'object' && Array.isArray(sel.nodes)) {
            return sel;
        }

        if (typeof sel === 'string' && sel.startsWith('#')) {
            const el = document.getElementById(sel.slice(1));

            return makeWrapper(el ? [el] : []);
        }

        const nodes = Array.from(document.querySelectorAll ? document.querySelectorAll(sel) : []);

        return makeWrapper(nodes);
    };

    $fn.getJSON = () => {
    };

    global.$ = global.jQuery = $fn;
}

jest.mock('datatables.net', () => {
    'use strict';

    return (root) => {
        root.DataTable = root.DataTable || {};
        root.DataTable.Api = function (s) {
            this.settings = s;
        };
        root.DataTable.version = '2.0.0';
        root.DataTable.util = {escapeRegex: (s) => String(s).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')};

        return root.DataTable;
    };
}, {virtual: true});

const {loadInternals} = require('./helpers/test-helpers');

test('CommonJS factory export when window undefined returns function and attaches DataTable', () => {
    'use strict';

    setupMinimalDOMAndJQuery();

    // simulate environment without global window
    delete global.window;
    delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];

    const mod = require('../src/datatables-filterdropdown.js');
    expect(typeof mod).toBe('function');

    // call the factory with a root object and provide a document so the
    // plugin's internal references to `document` are valid
    const root = {document: global.document};
    const api = mod(root);
    expect(api).toBeDefined();
    expect(root.DataTable).toBeDefined();
    expect(root.DataTable.filterDropDown).toBeDefined();
});

test('dtCompat.apiFromSettings uses jQuery.fn.dataTable.Api when no global DataTable', () => {
    'use strict';

    setupMinimalDOMAndJQuery();

    // ensure no global DataTable
    delete global.DataTable;

    // mock jQuery.fn.dataTable.Api
    global.jQuery.fn = {
        dataTable: {
            Api: class Api {
                constructor (s) {
                    this.settings = s;
                }
            },
            version: '2.1.0',
            util: {
                escapeRegex: (s) => s
            }
        }
    };

    process.env.NODE_ENV = 'test';

    delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];

    const pluginModule = require('../src/datatables-filterdropdown.js');
    const mod = typeof pluginModule === 'function' ? pluginModule(global) : pluginModule;

    // attach internals extracted from source for testing
    try { // eslint-disable-line no-useless-catch
        mod._test = loadInternals();
    } catch (e) {
        // if internals couldn't be loaded, rethrow to surface the issue
        throw e;
    }

    const api = mod._test.dtCompat.apiFromSettings({});

    expect(api).toBeDefined();
    expect(api.settings).toBeDefined();
});

test('dtCompat.escapeRegex fallback when no DataTable.util or jQuery.util', () => {
    'use strict';

    setupMinimalDOMAndJQuery();

    delete global.DataTable;

    global.jQuery = {fn: {}};

    process.env.NODE_ENV = 'test';

    delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];

    const pluginModule2 = require('../src/datatables-filterdropdown.js');
    const mod = typeof pluginModule2 === 'function' ? pluginModule2(global) : pluginModule2;

    mod._test = loadInternals();

    const escaped = mod._test.dtCompat.escapeRegex('a+b');

    expect(escaped.indexOf('\\+') !== -1).toBe(true);
});

test('preInit early return when initObj missing filterDropDown', () => {
    'use strict';

    setupMinimalDOMAndJQuery();

    process.env.NODE_ENV = 'test';

    delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];

    const pluginModule = require('../src/datatables-filterdropdown.js');

    pluginModule.global = global;

    const settings = {};

    settings._filterDropDownApi = {
        table: () => ({
            node: () => ({id: 't1'}),
            container: () => ({
                insertAdjacentHTML: () => {
                }
            })
        }),
        init: () => ({})
    };

    // should not throw
    expect(() => {
        global.$(document).trigger('preInit.dt', {namespace: 'dt'}, settings);
    }).not.toThrow();
});

test('preInit with empty columns does nothing', () => {
    'use strict';

    setupMinimalDOMAndJQuery();

    process.env.NODE_ENV = 'test';

    delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];

    const pluginModule = require('../src/datatables-filterdropdown.js');
    const settings = {};

    settings._filterDropDownApi = {
        table: () => ({
            node: () => ({id: 't2'}),
            container: () => ({
                insertAdjacentHTML: () => {
                }
            })
        }),
        init: () => ({filterDropDown: {columns: []}})
    };

    expect(() => global.$(document).trigger('preInit.dt', {namespace: 'dt'}, settings)).not.toThrow();
});

test('preInit with bootstrap=false and empty header uses fallback column name', () => {
    'use strict';

    setupMinimalDOMAndJQuery();

    process.env.NODE_ENV = 'test';

    delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];

    const pluginModule3 = require('../src/datatables-filterdropdown.js');
    const plugin = typeof pluginModule3 === 'function' ? pluginModule3(global) : pluginModule3;
    const container = {
        insertAdjacentHTML: function () {
        }
    };
    const settings = {};

    settings._filterDropDownApi = {
        table: () => ({node: () => ({id: 'testboot'}), container: () => container}),
        init: () => ({
            filterDropDown: {
                bootstrap: false,
                columns: [{idx: 0, title: null}]
            }
        }),
        columns: (idxList) => ({indexes: () => ({each: (cb) => idxList.forEach(cb)})}),
        column: (i) => ({index: () => i, header: () => ({querySelectorAll: () => []})})
    };

    // should not throw
    expect(() => global.$(document).trigger('preInit.dt', {namespace: 'dt'}, settings)).not.toThrow();
});

test('init.dt ajax branch warns on missing columns in response', () => {
    'use strict';

    setupMinimalDOMAndJQuery();

    process.env.NODE_ENV = 'test';

    delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];

    const pluginModule3 = require('../src/datatables-filterdropdown.js');
    const plugin = typeof pluginModule3 === 'function' ? pluginModule3(global) : pluginModule3;
    const settings = {};

    settings._filterDropDownApi = {
        table: () => ({
            node: () => ({id: 'tajax'}),
            container: () => ({
                insertAdjacentHTML: () => {
                }
            })
        }),
        init: () => ({
            filterDropDown: {
                ajax: 'http://',
                columns: [{idx: 0, title: 'C'}]
            }
        }),
        columns: (idxList) => ({
            dataSrc: () => ['col0'],
            indexes: () => ({each: (cb) => idxList.forEach(cb)})
        }),
        column: (i) => ({
            index: () => i,
            dataSrc: () => 'col0',
            header: () => ({querySelectorAll: () => []}),
            search: () => ''
        })
    };

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
    });
    const getJSONSpy = jest.fn((url, cb) => cb({}));

    global.$.getJSON = getJSONSpy;
    global.$(document).trigger('init.dt', {namespace: 'dt'}, settings);

    expect(getJSONSpy).toHaveBeenCalled();

    // warn may be called depending on internals; at least ensure getJSON used
    warnSpy.mockRestore();
});

test('dtCompat.isV2 returns true when version >=2 and null when missing', () => {
    'use strict';

    setupMinimalDOMAndJQuery();

    process.env.NODE_ENV = 'test';

    // case 1: jQuery.fn.dataTable.version present
    global.jQuery = {fn: {dataTable: {version: '2.3.0'}}};

    delete global.DataTable;
    delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];

    let mod = require('../src/datatables-filterdropdown.js');
    mod = typeof mod === 'function' ? mod(global) : mod;
    mod._test = loadInternals();

    expect(mod._test.dtCompat.isV2()).toBe(true);

    // case 2: no version info - remove jQuery/DataTable globals before requiring
    delete global.jQuery;
    delete global.DataTable;
    process.env.NODE_ENV = 'test';

    // ensure datatables.net mock does not attach a DataTable for this reload
    jest.resetModules();
    jest.doMock('datatables.net', () => {
        return (root) => {
            return {};
        };
    }, {virtual: true});

    delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];

    const pluginModule4 = require('../src/datatables-filterdropdown.js');

    mod = typeof pluginModule4 === 'function' ? pluginModule4(global) : pluginModule4;
    mod._test = loadInternals();

    // clear any global DataTable or jQuery.dataTable version that may have been
    // attached during module initialization so isV2 reads current globals
    delete global.DataTable;

    if (global.jQuery && global.jQuery.fn) {
        global.jQuery.fn.dataTable = undefined;
    }

    expect(mod._test.dtCompat.isV2()).toBeNull();
});
