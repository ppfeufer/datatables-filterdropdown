/* global describe, expect, test */

'use strict';

const {loadInternals} = require('./helpers/test-helpers');

describe('Feature: cssClasses on the select element', () => {
    test('parseInitArray sets cssClasses when provided as a string', () => {
        const internals = loadInternals();
        const init = {columns: [{idx: 0, cssClasses: 'my-custom-class'}]};
        const parsed = internals.parseInitArray(init);

        expect(parsed.columns[0]).toBeDefined();
        expect(parsed.columns[0].cssClasses).toBe('my-custom-class');
    });

    test('parseInitArray ignores cssClasses when not a string', () => {
        const internals = loadInternals();
        const init = {columns: [{idx: 0, cssClasses: {bad: 'value'}}]};
        const parsed = internals.parseInitArray(init);

        expect(parsed.columns[0]).toBeDefined();
        // default is null from _defaults().columnDef
        expect(parsed.columns[0].cssClasses).toBeNull();
    });

    test('additionalCssClasses string is computed with a leading space when cssClasses present', () => {
        const internals = loadInternals();
        const parsed = internals.parseInitArray({
            columns: [{
                idx: 0,
                cssClasses: 'extra-class'
            }]
        });
        const additionalCssClasses = parsed.columns[0].cssClasses ? ` ${parsed.columns[0].cssClasses}` : '';

        expect(additionalCssClasses).toBe(' extra-class');
    });

    test('additionalCssClasses is empty string when cssClasses is null', () => {
        const internals = loadInternals();
        const parsed = internals.parseInitArray({columns: [{idx: 0}]});
        const additionalCssClasses = parsed.columns[0].cssClasses ? ` ${parsed.columns[0].cssClasses}` : '';

        expect(additionalCssClasses).toBe('');
    });
});
