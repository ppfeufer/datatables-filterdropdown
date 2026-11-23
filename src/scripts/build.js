#!/usr/bin/env node

/**
 * Build script for datatables-filterdropdown.js.
 *
 * This script reads the source file,
 * removes test-only code blocks and istanbul ignore comments,
 * collapses multiple empty lines,
 * and writes the cleaned content to the destination file.
 *
 * Usage: node build.js [sourcePath] [destPath]
 *
 * Defaults:
 *  sourcePath: projectRoot/src/datatables-filterdropdown.js
 *  destPath: projectRoot/dist/datatables-filterdropdown.js
 */

/* global process */

'use strict';

import fs from 'fs/promises';
import path from 'path';

const projectRoot = process.cwd();
const fileName = 'datatables-filterdropdown.js';

const DEFAULT_SOURCE = path.resolve(projectRoot, 'src', fileName);
const DEFAULT_DESTINATION = path.resolve(projectRoot, 'dist', fileName);

const loadGuardOpen = `((globalObject) => {
    'use strict';

    if (globalObject.__ppfeuferDataTablesFilterDropdownLoaded__) {
        console.warn('DataTables FilterDropdown already loaded. Skipping duplicate load.');

        return;
    }

    Object.defineProperty(globalObject, '__ppfeuferDataTablesFilterDropdownLoaded__', {
        configurable: false,
        enumerable: false,
        value: true,
        writable: false
    });

`;
const loadGuardClose = `})(typeof globalThis !== 'undefined' ? globalThis : window);
`;

(async () => {
    try {
        const src = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SOURCE;
        const dest = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_DESTINATION;

        console.log(`Building: ${src} -> ${dest}`);

        let sourceFileContent = await fs.readFile(src, 'utf8');

        // Normalize line endings to \n for consistent processing
        sourceFileContent = sourceFileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Remove the test-only block between the markers (inclusive).
        // Use a token search that is robust to indentation and minor variations.
        const startToken = 'START TEST ONLY';
        const endToken = 'END TEST ONLY';
        const startPos = sourceFileContent.indexOf(startToken);
        const endPos = sourceFileContent.indexOf(endToken, startPos !== -1 ? startPos : 0);

        if (startPos !== -1 && endPos !== -1) {
            // Find the start of the line that contains the start token
            const lineStart = sourceFileContent.lastIndexOf('\n', startPos) + 1;
            // Find the end of the line that contains the end token
            const lineEndIdx = sourceFileContent.indexOf('\n', endPos);
            const lineEnd = lineEndIdx === -1 ? sourceFileContent.length : lineEndIdx + 1;

            sourceFileContent = sourceFileContent.slice(0, lineStart) + sourceFileContent.slice(lineEnd);

            console.log('Removed test-only block.');
        } else {
            console.log('No test-only block found.');
        }

        // Remove any standalone istanbul ignore comments (these should not
        // appear in production builds). Remove the entire line (including the
        // trailing newline) so we don't leave empty lines behind.
        sourceFileContent = sourceFileContent.replace(/^[ \t]*\/\/\s*istanbul ignore next\s*(?:\r?\n|$)/gm, '');

        // Collapse multiple consecutive empty lines (including lines with only spaces/tabs)
        // into a single empty line. We treat an "empty line" as a blank line between
        // code lines, meaning we want at most one blank line (i.e. two consecutive \n).
        // Replace two or more consecutive blank lines with exactly one empty
        // line while preserving indentation of the following non-empty line.
        // The pattern matches a newline followed by one-or-more sequences of
        // (optional spaces/tabs then newline). This ensures we only consume
        // truly blank lines (those that end with a newline) and never eat the
        // leading spaces of the next non-empty line.
        sourceFileContent = sourceFileContent.replace(/\n(?:[ \t]*\n){1,}/g, '\n\n');

        // Ensure there is no empty line immediately before the final closing `});`.
        // Collapse any blank lines that occur directly before the last `});`
        // so the file ends with the previous statement, a single newline, then `});`.
        sourceFileContent = sourceFileContent.replace(/\n(?:[ \t]*\n)+([ \t]*}\);[ \t]*\n?)$/, '\n$1');

        const factoryStart = sourceFileContent.indexOf('// UMD / module wrapper: support ESM, CommonJS and browser globals');

        if (factoryStart === -1) {
            throw new Error('Could not find the factory comment in the source file.');
        }

        sourceFileContent = `${sourceFileContent.slice(0, factoryStart)}${loadGuardOpen}${sourceFileContent.slice(factoryStart)}`;

        const content = `${sourceFileContent}${loadGuardClose}`;

        // Ensure destination directory exists
        await fs.mkdir(path.dirname(dest), {recursive: true});

        // Write the cleaned content to the destination file
        await fs.writeFile(dest, content, 'utf8');

        console.log('Build complete.');
    } catch (err) {
        console.error('Build failed:', err);

        process.exitCode = 1;
    }
})();
