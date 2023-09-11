#!/usr/bin/env node

import fs from "fs";
import { runTypeChain } from "typechain";

const CAYENNE_API = "https://lit-general-worker.getlit.dev/contract-addresses";
const SERRANO_API =
  "https://lit-general-worker.getlit.dev/serrano-contract-addresses";

const OUTDIR = "lit-contracts";

// Check for --update flag
let shouldUpdate = process.argv.includes("--update");

// Capture the index argument
let _index = 0; // default value
const indexArgIndex = process.argv.indexOf("--index");
if (indexArgIndex !== -1 && process.argv[indexArgIndex + 1]) {
  _index = parseInt(process.argv[indexArgIndex + 1], 10);
  if (isNaN(_index)) {
    console.error("Invalid index provided. Using default index: 0.");
    _index = 0;
  }
}

let network = "cayenne"; // default value
const networkArgIndex = process.argv.indexOf("--network");
if (networkArgIndex !== -1 && process.argv[networkArgIndex + 1]) {
  const providedNetwork = process.argv[networkArgIndex + 1];
  if (["cayenne", "serrano"].includes(providedNetwork)) {
    network = providedNetwork;
  } else {
    console.error(
      `Invalid network provided: ${providedNetwork}. Using default network: Cayenne.`
    );
  }
}

const API_URL = network === "cayenne" ? CAYENNE_API : SERRANO_API;

async function getContracts({ index }) {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    if (data.success !== true) {
      throw new Error(`❌ Error: Failed to fetch data. Response: ${data}`);
    }

    const contracts = data.data.map((item) => {
      const contract = item.contracts[index];

      return {
        date: contract.inserted_at,
        name: item.name,
        symbol: item.symbol,
        address: contract.address_hash,
        type: contract.type,
        ABIUrl: contract.ABIUrl,
      };
    });
    // .filter((item) => item.type === "contract");

    contracts.forEach((item) => {
      delete item.type;
    });

    for (const contract of contracts) {
      const res = await fetch(contract.ABIUrl);
      const data = await res.json();

      contract.ABI = JSON.parse(data.result);
      delete contract.ABIUrl;
    }

    return contracts;
  } catch (e) {
    throw new Error(`❌ Error: ${e}`);
  }
}

// create a directory if it doesn't exist
if (!fs.existsSync(OUTDIR)) {
  fs.mkdirSync(OUTDIR);
}

const data = await getContracts({ index: _index });

const maxNameLength = data.reduce((maxLength, contract) => {
  const contractName = contract.name.replace(" ", "");

  return Math.max(maxLength, contractName.length);
}, 0);

for (const contract of data) {
  const { name, ABI, date } = contract;

  const _name = name.replace(" ", "");

  const contractFilePath = `${OUTDIR}/${_name}.sol/${_name}.json`;

  if (fs.existsSync(contractFilePath)) {
    const existingContract = JSON.parse(
      fs.readFileSync(contractFilePath, "utf8")
    );

    if (new Date(date) > new Date(existingContract.date)) {
      if (!shouldUpdate) {
        console.log(
          "\x1b[33m%s\x1b[0m",
          `❓ There's a newer version of the contract "${name}". To update, run the script with --update flag.`
        );
        continue; // Skip the rest of the loop for this contract
      } else {
        // console.log(`...updating contract "${name}"...`);
      }
    } else {
      console.log(
        `✅ We have the latest version of the contract ${name.padEnd(
          maxNameLength
        )} (${new Date(date).toLocaleDateString()} ${new Date(
          date
        ).toLocaleTimeString()})`
      );
      continue; // Skip the rest of the loop for this contract
    }
  } else {
    shouldUpdate = true;
  }

  if (!fs.existsSync(`${OUTDIR}/${_name}.sol`)) {
    fs.mkdirSync(`${OUTDIR}/${_name}.sol`);
  }

  const contractInfo = JSON.stringify(
    {
      date: contract.date,
      address: contract.address,
      contractName: _name,
      abi: ABI,
    },
    null,
    2
  );

  console.log(`...generating contract & type for "${name}"`);

  // ===== Exports =====
  if (shouldUpdate) {
    // -- 1) export as a json file
    fs.writeFileSync(`${OUTDIR}/${_name}.sol/${_name}.json`, contractInfo);

    // -- 2) export as a js file
    fs.writeFileSync(
      `${OUTDIR}/${_name}.sol/${_name}Data.js`,
      `export const ${_name}Data = ${contractInfo}`
    );

    // -- 3) export as a ts file
    fs.writeFileSync(
      `${OUTDIR}/${_name}.sol/${_name}Data.ts`,
      `export const ${_name}Data = ${contractInfo}`
    );

    // -- 4) Generate typechain types
    await runTypeChain({
      cwd: process.cwd(),
      filesToProcess: [`${OUTDIR}/${_name}.sol/${_name}.json`],
      allFiles: [`${OUTDIR}/${_name}.sol/${_name}.json`],
      outDir: `${OUTDIR}/${_name}.sol`,
      target: "ethers-v5",
    });

    // -- 5) create a contract
    fs.writeFileSync(
      `${OUTDIR}/${_name}.sol/${_name}Contract.js`,
      `import { ethers } from "ethers";
import { ${_name}Data } from "./${_name}Data.js";

export const get${_name}Contract = (provider) => new ethers.Contract(
  ${_name}Data.address,
  ${_name}Data.abi,
  provider
);`
    );

    // -- 5b) create a ts contract
    fs.writeFileSync(
      `${OUTDIR}/${_name}.sol/${_name}Contract.ts`,
      `import { ethers } from "ethers";
import { ${_name}Data } from "./${_name}Data";
import { ${_name} } from "./${_name}";

export const get${_name}Contract = (provider: any) => {
  return new ethers.Contract(
    ${_name}Data.address,
    ${_name}Data.abi,
    provider
  ) as unknown as ${_name};
}`
    );

    // -- 6 create an index.ts file that exports everything
    fs.writeFileSync(
      `${OUTDIR}/${_name}.sol/index.ts`,
      `export * from "./${_name}Data";
export * from "./${_name}Contract";
export * from "./${_name}";`
    );

    // -- 6b create an index.js file that exports everything
    fs.writeFileSync(
      `${OUTDIR}/${_name}.sol/index.js`,
      `export * from "./${_name}Data.js";
export * from "./${_name}Contract.js";`
    );
  }
}

if (shouldUpdate) {
  // -- 5) create an types.ts file that exports all the contracts
  let typesFile = data
    .map((item) => {
      const { name } = item;
      return `export * from "./${name}.sol/${name}.ts";`;
    })
    .join("\n");

  fs.writeFileSync(`${OUTDIR}/types.ts`, typesFile);
  console.log("------------------");
  console.log("✅ Done!");
}
