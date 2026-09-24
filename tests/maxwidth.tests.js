/* global jest, test, expect, process */

'use strict';

// Test that the preInit.dt handler applies max-width CSS when configured

const {testedFile} = require('./helpers/test-helpers');

// Provide a datatables.net mock similar to other tests so the CommonJS
// branch that requires it does not fail when the module is not installed.
jest.mock('datatables.net', () => {
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

// Copy of the minimal DOM and jQuery setup used across other tests but
// extended with a `css` implementation so we can verify applied styles.
const setupMinimalDOMAndJQuery = () => {
    global.window = global;

    // lightweight document if not present
    if (typeof global.document === 'undefined' || typeof global.document.createElement !== 'function') {
        const elements = Object.create(null);
        const all = [];

        const createElement = (tag) => {
            const el = {
                tagName: String(tag).toUpperCase(),
                id: '',
                innerHTML: '',
                children: [],
                style: {},
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
                            const txtMatch = />([.\n]*)<\s*\/option/.exec(html);

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
                        return this.children.filter((c) => c.tagName === 'OPTION');
                    }

                    return [];
                }
            };

            all.push(el);

            return el;
        };

        global.document = {
            createElement,
            getElementById: (id) => elements[id] || all.find((e) => e.id === id) || null,
            querySelectorAll: () => []
        };
    }

    // minimal $ wrapper that supports used operations and a `css` method
    const handlers = {};
    const eventAPI = {
        on: (e, h) => {
            handlers[e] = handlers[e] || [];
            handlers[e].push(h);
        }, trigger: (e, ...a) => {
            (handlers[e] || []).forEach((h) => h(...a));
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
            nodes.forEach((n) => {
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

            nodes.forEach((n) => {
                n.value = v;
            });

            return makeWrapper(nodes);
        },
        change: (h) => {
            nodes.forEach((n) => {
                n.__change = h;
            });

            return makeWrapper(nodes);
        },
        map: (fn) => {
            const res = nodes.map((n, i) => fn(i, n));
            return {get: () => res};
        },
        get: () => nodes,
        css: (prop, val) => {
            nodes.forEach((n) => {
                n.style = n.style || {};
                n.style[prop] = val;
            });

            return makeWrapper(nodes);
        }
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
};

test('preInit applies max-width when configured', () => {
    setupMinimalDOMAndJQuery();

    process.env.NODE_ENV = 'test';

    // load plugin
    delete require.cache[require.resolve(testedFile)];
    const pluginModule = require(testedFile);
    const plugin = typeof pluginModule === 'function' ? pluginModule(global) : pluginModule;

    // construct settings exposing the minimal API used by preInit
    const settings = {};

    const container = document.createElement('div');

    settings._filterDropDownApi = {
        table: () => ({
            node: () => ({id: 'tmax'}),
            container: () => container
        }),
        init: () => ({
            filterDropDown: {
                bootstrap: true,
                columns: [{
                    idx: 0,
                    title: 'C',
                    maxWidth: '150px',
                    labelDropdownAll: 'All'
                }]
            }
        }),
        columns: (idxList) => ({indexes: () => ({each: (cb) => idxList.forEach(cb)})}),
        column: (i) => ({index: () => i, header: () => ({querySelectorAll: () => []})})
    };

    // Trigger preInit which should create the select and set the style
    expect(() => global.$(document).trigger('preInit.dt', {namespace: 'dt'}, settings)).not.toThrow();

    const selectEl = document.getElementById('tmax_filterSelect0');

    expect(selectEl).toBeDefined();
    expect(selectEl.style['max-width']).toBe('150px');

    // Directly test the predicate and CSS application using internals so the
    // test doesn't depend on the whole preInit DOM flow.
    const {loadInternals} = require('./helpers/test-helpers');
    const internals = loadInternals();

    // Case: maxWidth set
    const initWithMax = {columns: [{idx: 0, maxWidth: '120px'}]};
    const fdWithMax = internals.parseInitArray(initWithMax);
    const selWithMax = document.createElement('select');
    const $selWithMax = global.$(selWithMax);

    if (fdWithMax.columns[0].maxWidth !== null) {
        $selWithMax.css('max-width', fdWithMax.columns[0].maxWidth);
    }

    expect(selWithMax.style['max-width']).toBe('120px');

    // Case: maxWidth null
    const initNull = {columns: [{idx: 0, maxWidth: null}]};
    const fdNull = internals.parseInitArray(initNull);
    const selNull = document.createElement('select');
    const $selNull = global.$(selNull);

    if (fdNull.columns[0].maxWidth !== null) {
        $selNull.css('max-width', fdNull.columns[0].maxWidth);
    }

    expect(selNull.style['max-width']).toBeUndefined();
});
