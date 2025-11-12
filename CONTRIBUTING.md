# Contributing to fbtee

Thank you for your interest in contributing to fbtee! This guide will help you get started with development.

## Prerequisites

- **Node.js**: Version 24.0.0 or higher
- **pnpm**: Version 10.0.0 or higher

```bash
pnpm env use --global 24
nvm use 24
```

## Getting Started

To set up the project and run tests:

```bash
pnpm install

# Build everything required for unit tests
pnpm build:all

pnpm test
```

The example build step is **required** before running tests, as the test suite depends on the generated translation artifacts.
