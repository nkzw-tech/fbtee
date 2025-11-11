# Contributing to fbtee

Thank you for your interest in contributing to fbtee! This guide will help you get started with development.

## Prerequisites

- **Node.js**: Version 24.0.0 or higher
- **pnpm**: Version 10.0.0 or higher

## Getting Started

To set up the project and run tests:

```bash
# Install dependencies
pnpm install

# Build the example project (required before running tests)
cd example
pnpm install
pnpm fbtee:all
cd ..

# Run tests
pnpm test
```

The example build step is **required** before running tests, as the test suite depends on the generated translation artifacts.
