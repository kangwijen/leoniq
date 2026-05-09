/* eslint-disable @typescript-eslint/no-require-imports */
const nextJest = require("next/jest")

const createJestConfig = nextJest({
  dir: "./",
})

const config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: [
    "<rootDir>/app/**/*.{js,jsx,ts,tsx}",
    "<rootDir>/components/**/*.{js,jsx,ts,tsx}",
    "<rootDir>/hooks/**/*.{js,jsx,ts,tsx}",
    "<rootDir>/lib/**/*.{js,jsx,ts,tsx}",
    "<rootDir>/worker/**/*.{js,jsx,ts,tsx}",
    "<rootDir>/proxy.ts",
    "!<rootDir>/**/*.d.ts",
    "!<rootDir>/**/node_modules/**",
    "!<rootDir>/components/ui/**",
    "!<rootDir>/lib/db/schema.ts",
  ],
  coverageThreshold: {
    global: {
      statements: 100,
      lines: 100,
      functions: 100,
      branches: 100,
    },
  },
}

module.exports = createJestConfig(config)
