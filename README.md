# What

The `@getlit/contracts` script fetches contract data from the `https://lit-general-worker.getlit.dev/contract-addresses` API and generates contract files, including JSON, JS, and TypeScript files. It also produces typechain types for the contracts.

# Quick Start

```
npx @getlit/contracts
```

# Usage

To run the script:

```
npx @getlit/contracts [options]
```

## Options

- --`update`: Use this flag to update the contract files if a newer version is available.
- `--index`: Specify the index number to fetch a particular contract. By default, the index is set to `0`. (only 0, 1) atm.
