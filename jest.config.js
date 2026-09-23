// https://jestjs.io/docs/configuration

import {defineConfig} from 'jest';

export default defineConfig({
    collectCoverage: true,
    coverageDirectory: '<rootDir>/coverage/',
    coveragePathIgnorePatterns: [
        '<rootDir>/tests/helpers/'
    ],
    coverageReporters: [
        'cobertura',
        'html',
        'text'
    ],
    displayName: {
        name: 'DataTables FilterDropdown',
        color: 'blue'
    },
    testMatch: [
        '<rootDir>/tests/*.tests.js'
    ],
    testPathIgnorePatterns: [
        '<rootDir>/tests/helpers/'
    ],
    verbose: true
});
