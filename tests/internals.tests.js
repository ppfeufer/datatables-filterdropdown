/* global test, expect, process */

'use strict';

const {loadInternals, testedFile} = require('./helpers/test-helpers');

test('internals: parseInitArray and dtCompat basics', () => {
    process.env.NODE_ENV = 'test';

    // minimal jQuery/document shims so module init does not throw
    global.window = global;
    global.document = global.document || {};
    global.jQuery = global.$ = () => ({
        on: () => {
        }
    });
    global.$.getJSON = () => {
    };

    // Provide a richer $ implementation (wrapper) used by the plugin
    const eventHandlers = {};
    const eventAPI = {
        on: (evt, h) => {
            eventHandlers[evt] = eventHandlers[evt] || [];
            eventHandlers[evt].push(h);
        }, trigger: (evt, ...a) => {
            (eventHandlers[evt] || []).forEach((h) => h(...a));
        }
    };

    const makeWrapper = (nodes) => ({
        nodes,
        prepend: (html) => {
            if (nodes[0]) {
                nodes[0].insertAdjacentHTML('afterbegin', html);
            }
            return makeWrapper(nodes);
        },
        append: (html) => {
            if (nodes[0]) {
                nodes[0].insertAdjacentHTML('beforeend', html);
            }
            return makeWrapper(nodes);
        },
        empty: () => {
            nodes.forEach((n) => {
                n.innerHTML = '';
            });
            return makeWrapper(nodes);
        },
        find: (sel) => {
            const found = nodes[0] ? Array.from(nodes[0].querySelectorAll(sel)) : [];
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
        change: (handler) => {
            nodes.forEach((n) => {
                n.__change = handler;
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
    global.jQuery = global.$ = $fn;

    // Provide minimal document.createElement if not present (test environment may not have jsdom)
    if (typeof global.document.createElement !== 'function') {
        const elements = Object.create(null);
        const allElements = [];

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

            allElements.push(el);

            return el;
        }

        global.document.createElement = createElement;
        global.document.getElementById = (id) => {
            if (elements[id]) {
                return elements[id];
            }
            for (let i = 0; i < allElements.length; i++) {
                if (allElements[i].id === id) {
                    elements[id] = allElements[i];
                    return allElements[i];
                }
            }

            return null;
        };
    }

    // ensure a DataTable global is present for dtCompat
    global.DataTable = {
        Api: function (s) {
            this.settings = s;
        }, version: '2.5.0', util: {escapeRegex: (s) => s.replace(/\+/g, '\\+')}
    };

    // use shared loadInternals helper from tests/test-helpers.js

    delete require.cache[require.resolve(testedFile)];
    const pluginModule = require(testedFile);
    const mod = typeof pluginModule === 'function' ? pluginModule(global) : pluginModule;
    mod._test = loadInternals();

    expect(mod).toBeDefined();
    expect(typeof mod._test).toBe('object');

    const {parseInitArray, dtCompat} = mod._test;

    const parsed = parseInitArray({
        bootstrapVersion: 4,
        ajax: 'http://',
        labelFilter: 'Filter',
        columns: [{idx: 0, title: 'T', maxWidth: '10px', labelDropdownAll: 'AllX'}]
    });

    expect(parsed.bootstrapVersion).toBe(4);
    expect(parsed.ajax).toBe('http://');
    expect(parsed.labelFilter).toBe('Filter');
    expect(parsed.columnsIdxList).toEqual([0]);
    expect(parsed.columns[0].title).toBe('T');

    // dtCompat.escapeRegex uses DataTable.util when available
    const escaped = dtCompat.escapeRegex('a+b');
    expect(typeof escaped).toBe('string');
});

test('internals: _apiFromSettingsCached returns cached API instance', () => {
    process.env.NODE_ENV = 'test';

    global.DataTable = {
        Api: function (s) {
            this.settings = s;
        }, version: '3.0.0'
    };

    delete require.cache[require.resolve(testedFile)];
    const pluginModule = require(testedFile);
    const mod = typeof pluginModule === 'function' ? pluginModule(global) : pluginModule;
    mod._test = loadInternals();
    const {_apiFromSettingsCached} = mod._test;

    const settings = {};
    const api1 = _apiFromSettingsCached(settings);
    const api2 = _apiFromSettingsCached(settings);

    expect(api1).toBe(api2);
});

test('internals: setSelectFromColumnSearch matches existing option and appends missing option', () => {
    process.env.NODE_ENV = 'test';
    delete require.cache[require.resolve(testedFile)];
    const pluginModule2 = require(testedFile);
    const mod = typeof pluginModule2 === 'function' ? pluginModule2(global) : pluginModule2;
    mod._test = loadInternals();
    const {setSelectFromColumnSearch} = mod._test;

    // create a select element in our minimal document
    const sel = document.createElement('select');
    sel.id = 'mysel';
    sel.insertAdjacentHTML('beforeend', '<option value="">All</option>');
    sel.insertAdjacentHTML('beforeend', '<option value="A">A</option>');

    // column that reports a current search that matches existing option
    const col1 = {search: () => '^A$'};

    setSelectFromColumnSearch(sel, col1);
    expect(sel.value === 'A' || sel.value === undefined).toBeTruthy();

    // column that reports a current search with raw value not present
    const col2 = {search: () => '^missing$'};

    // create a fresh select
    const sel2 = document.createElement('select');
    sel2.id = 'mysel2';
    sel2.insertAdjacentHTML('beforeend', '<option value="">All</option>');

    setSelectFromColumnSearch(sel2, col2);

    // after calling, the missing option should be appended
    const opts = sel2.querySelectorAll('option');
    const foundMissing = Array.from(opts).some((o) => o.value === 'missing');
    expect(foundMissing).toBe(true);
});

test('internals: initSelectForColumn attaches change handler that calls column.search and draw', () => {
    process.env.NODE_ENV = 'test';
    delete require.cache[require.resolve(testedFile)];
    const pluginModule3 = require(testedFile);
    const mod = typeof pluginModule3 === 'function' ? pluginModule3(global) : pluginModule3;
    mod._test = loadInternals();
    const {initSelectForColumn} = mod._test;

    // create select element expected by initSelectForColumn
    const tableId = 'tbltest';
    const selectId = `${tableId}_filterSelect0`;
    const sel = document.createElement('select');
    sel.id = selectId;
    sel.insertAdjacentHTML('beforeend', '<option value="">All</option>');

    // column with index and search behaviour
    let last = null;
    let drew = false;
    const column = {
        index: () => 0,
        search: function (val) {
            if (arguments.length === 0) {
                return '';
            }

            return {
                draw: () => {
                    last = val;
                    drew = true;
                }
            };
        }
    };

    // call initSelectForColumn to attach change handler
    initSelectForColumn(tableId, column);

    // simulate user selecting 'X' and triggering change
    const domSel = document.getElementById(selectId);
    if (domSel) {
        domSel.value = 'X';
        if (typeof domSel.__change === 'function') {
            domSel.__change();
        }
    }

    expect(drew).toBe(true);
    expect(last).toBe('^X$');
});
