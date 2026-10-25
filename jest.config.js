/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/test/**/*.test.ts'],
    transform: {
        '^.+\\.tsx?$': ['@swc/jest', {
            jsc: {
                parser: {
                    syntax: 'typescript',
                    decorators: false,
                },
                target: 'es2020',
            },
            module: {
                type: 'commonjs',
            },
        }],
    },
    testTimeout: 30000,
    collectCoverageFrom: [
        'controllers/**/*.ts',
        'middleware/**/*.ts',
        'routes/**/*.ts',
    ],
};