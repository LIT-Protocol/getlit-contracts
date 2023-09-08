# What

The `@getlit/contracts` script fetches contract data from the `https://lit-general-worker.getlit.dev/contract-addresses` API and generates contract files, including JSON, JS, and TypeScript files. It also produces typechain types for the contracts.

See [./lit-contracts](https://github.com/LIT-Protocol/getlit-contracts/tree/main/lit-contracts)

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

# Demo

## Init

[![npx @getlit/sdk](https://img.youtube.com/vi/RpsTJlOyOMA/0.jpg)](https://www.youtube.com/watch?v=RpsTJlOyOMA)

## Update

[![npx @getlit/sdk --update](https://img.youtube.com/vi/8eNQHYKCDNk/0.jpg)](https://www.youtube.com/watch?v=8eNQHYKCDNk)