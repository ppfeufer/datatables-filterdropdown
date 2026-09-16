import {defineConfig} from 'jest';

export default defineConfig({
    collectCoverage: true,
    coverageReporters: [
        'cobertura',
        'html',
        'text'
    ],
    verbose: true,
    modulePathIgnorePatterns: [
        '<rootDir>/__tests__/helpers',
        '<rootDir>/__tests__/test-helpers.js'
    ],
});
