/* global test, expect, jest, process */

'use strict';

// dtCompat: apiFromSettings fallback and jQuery Api path
test('dtCompat: apiFromSettings fallback and jQuery Api path', () => {
    jest.isolateModules(() => {
        jest.resetModules();

        // Mock datatables.net so the plugin doesn't attempt to load the real package
        jest.mock('datatables.net', () => (root) => {
        }, {virtual: true});

        // Ensure previous globals are cleared
        delete global.jQuery;
        delete global.$;
        delete global.DataTable;

        // Provide a minimal $/jQuery stub (without fn.dataTable) so factory runs
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

        process.env.NODE_ENV = 'test';
        delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];
        const plugin = require('../src/datatables-filterdropdown.js');
        const mod = typeof plugin === 'function' ? plugin(global) : plugin;
        const dtc = mod._test.dtCompat;

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        expect(dtc.apiFromSettings({})).toBeNull();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();

        // Now provide jQuery.fn.dataTable.Api to exercise jQuery-api branch
        global.jQuery.fn = {
            dataTable: {
                Api: function (s) {
                    this.settings = s;
                }
            }
        };
        // Re-require plugin to capture dtCompat with jQuery present
        delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];
        const plugin2 = require('../src/datatables-filterdropdown.js');
        const mod2 = typeof plugin2 === 'function' ? plugin2(global) : plugin2;
        const dtc2 = mod2._test.dtCompat;

        const api = dtc2.apiFromSettings({foo: 'bar'});
        expect(api).toBeDefined();
        expect(api.settings).toEqual({foo: 'bar'});
    });
});

// dtCompat: escapeRegex fallback and version branches
test('dtCompat: escapeRegex fallback and version branches', () => {
    jest.isolateModules(() => {
        jest.resetModules();
        jest.mock('datatables.net', () => (root) => { /* noop */
        }, {virtual: true});

        // minimal $ stub
        global.$ = global.jQuery = (sel) => (sel === global.document ? {
            on: () => {
            }, trigger: () => {
            }
        } : {
            append: () => {
            },
            empty: () => ({}),
            find: () => ({map: () => ({get: () => []})}),
            val: () => ''
        });

        process.env.NODE_ENV = 'test';
        delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];
        const plugin = require('../src/datatables-filterdropdown.js');
        const mod = typeof plugin === 'function' ? plugin(global) : plugin;
        const dtc = mod._test.dtCompat;

        const escaped = dtc.escapeRegex('a+b?');
        expect(escaped.includes('\\+')).toBeTruthy();
        expect(escaped.includes('\\?')).toBeTruthy();

        // Provide jQuery.fn.dataTable.version
        delete global.jQuery;
        delete global.$;
        // Minimal document implementation for DOM operations
        if (typeof global.document === 'undefined') {
            const elements = Object.create(null);
            const allElements = [];

            function createElement (tag) { // jshint ignore:line
                const el = {
                    tagName: String(tag).toUpperCase(),
                    id: '',
                    innerHTML: '',
                    children: [],
                    value: '',
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
                                const txtMatch = />([\s\S]*?)<\s*\/option/.exec(html);
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

                allElements.push(el);

                return el;
            }

            global.document = {
                createElement,
                getElementById: (id) => elements[id] || null
            };
        }

        global.$ = global.jQuery = (sel) => (sel === global.document ? {
            on: () => {
            }, trigger: () => {
            }
        } : {
            append: () => {
            },
            empty: () => ({}),
            find: () => ({map: () => ({get: () => []})}),
            val: () => ''
        });
        global.jQuery.fn = {dataTable: {version: '3.2.1'}};
        delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];
        const plugin2 = require('../src/datatables-filterdropdown.js');
        const mod2 = typeof plugin2 === 'function' ? plugin2(global) : plugin2;
        expect(mod2._test.dtCompat.version()).toBe('3.2.1');

        // Provide DataTable.version
        delete global.jQuery;
        delete global.$;
        // Ensure minimal $ exists so top-level plugin code doesn't throw
        global.$ = global.jQuery = (sel) => (sel === global.document ? {
            on: () => {
            }, trigger: () => {
            }
        } : {
            append: () => {
            },
            empty: () => ({}),
            find: () => ({map: () => ({get: () => []})}),
            val: () => ''
        });
        global.DataTable = {version: '2.0.0'};
        delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];
        const plugin3 = require('../src/datatables-filterdropdown.js');
        const mod3 = typeof plugin3 === 'function' ? plugin3(global) : plugin3;
        expect(mod3._test.dtCompat.version()).toBe('2.0.0');
    });
});

/**
 * This test uses the jsdom environment so DOM APIs are available.
 */
test('setSelectFromColumnSearch: early return on falsy args and append missing option', () => {
    jest.isolateModules(() => {
        jest.resetModules();
        jest.mock('datatables.net', () => (root) => {
        }, {virtual: true});

        delete global.jQuery;
        delete global.$;
        // Provide a jQuery-like wrapper that can interact with our minimal DOM
        const eventHandlers = {};
        const eventAPI = {
            on: (evt, h) => {
                eventHandlers[evt] = eventHandlers[evt] || [];
                eventHandlers[evt].push(h);
            }, trigger: (evt, ...a) => {
                (eventHandlers[evt] || []).forEach(h => h(...a));
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
                nodes.forEach(n => {
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

                nodes.forEach(n => {
                    n.value = v;
                });

                return makeWrapper(nodes);
            },
            change: (handler) => {
                nodes.forEach(n => {
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

        process.env.NODE_ENV = 'test';
        delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];
        const plugin = require('../src/datatables-filterdropdown.js');
        const mod = typeof plugin === 'function' ? plugin(global) : plugin;
        const {setSelectFromColumnSearch} = mod._test;

        expect(() => setSelectFromColumnSearch(null, null)).not.toThrow();

        const sel = document.createElement('select');
        sel.id = 'm1';
        sel.insertAdjacentHTML('beforeend', '<option value="">All</option>');

        const column = {search: () => '^missing$'};
        setSelectFromColumnSearch(sel, column);
        const opts = sel.querySelectorAll('option');
        const found = Array.from(opts).some(o => o.value === 'missing');
        expect(found).toBe(true);
    });
});

test('DataTable.filterDropDown.register returns true when attached', () => {
    jest.isolateModules(() => {
        jest.resetModules();
        jest.mock('datatables.net', () => (root) => {
            root.DataTable = root.DataTable || {};
        }, {virtual: true});

        // ensure DataTable present so plugin attaches
        global.DataTable = {
            Api: function () {
            }
        };
        global.$ = global.jQuery = (sel) => (sel === global.document ? {
            on: () => {
            }, trigger: () => {
            }
        } : {
            append: () => {
            },
            empty: () => ({}),
            find: () => ({map: () => ({get: () => []})}),
            val: () => ''
        });

        process.env.NODE_ENV = 'test';
        delete require.cache[require.resolve('../src/datatables-filterdropdown.js')];
        const plugin = require('../src/datatables-filterdropdown.js');
        const mod = typeof plugin === 'function' ? plugin(global) : plugin;

        expect(global.DataTable.filterDropDown).toBeDefined();
        expect(typeof global.DataTable.filterDropDown.register).toBe('function');
        expect(global.DataTable.filterDropDown.register()).toBe(true);
    });
});
