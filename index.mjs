#!/usr/bin/env node

import fs from "fs";
import { runTypeChain } from "typechain";

const API = "https://lit-general-worker.getlit.dev/contract-addresses";
const OUTDIR = "lit-contracts";

// Check for --update flag
let shouldUpdate = process.argv.includes("--update");

async function getContracts({ index }) {
  try {
    const res = await fetch(API);
    const data = await res.json();

    if (data.success !== true) {
      throw new Error(`❌ Error: Failed to fetch data. Response: ${data}`);
    }

    const contracts = data.data
      .map((item) => {
        const contract = item.contracts[index];

        return {
          date: contract.inserted_at,
          name: item.name,
          address: contract.address_hash,
          type: contract.type,
          ABIUrl: contract.ABIUrl,
        };
      })
      .filter((item) => item.type === "contract");

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

const data = await getContracts({ index: 1 });

const maxNameLength = data.reduce((maxLength, contract) => {
  return Math.max(maxLength, contract.name.length);
}, 0);

for (const contract of data) {
  const { name, ABI, date } = contract;

  const contractFilePath = `${OUTDIR}/${name}.sol/${name}.json`;

  if (fs.existsSync(contractFilePath)) {
    const existingContract = JSON.parse(
      fs.readFileSync(contractFilePath, "utf8")
    );

    if (new Date(date) > new Date(existingContract.date)) {
      if (!shouldUpdate) {
        console.log(
          "\x1b[33m%s\x1b[0m",
          `❓ There's a newer version of the contract ${name}. To update, run the script with --update flag.`
        );
        continue; // Skip the rest of the loop for this contract
      } else {
        // console.log(`...updating contract ${name}...`);
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

  if (!fs.existsSync(`${OUTDIR}/${name}.sol`)) {
    fs.mkdirSync(`${OUTDIR}/${name}.sol`);
  }

  const contractInfo = JSON.stringify(
    {
      date: contract.date,
      address: contract.address,
      contractName: name,
      abi: ABI,
    },
    null,
    2
  );

  console.log("...generating contract & type for", name);

  // ===== Exports =====
  if (shouldUpdate) {
    // -- 1) export as a json file
    fs.writeFileSync(`${OUTDIR}/${name}.sol/${name}.json`, contractInfo);

    // -- 2) export as a js file
    fs.writeFileSync(
      `${OUTDIR}/${name}.sol/${name}.data.js`,
      `export const data_${name} = ${contractInfo}`
    );

    // -- 3) export as a ts file
    fs.writeFileSync(
      `${OUTDIR}/${name}.sol/${name}.data.ts`,
      `export const data_${name} = ${contractInfo}`
    );

    // -- 4) Generate typechain types
    await runTypeChain({
      cwd: process.cwd(),
      filesToProcess: [`${OUTDIR}/${name}.sol/${name}.json`],
      allFiles: [`${OUTDIR}/${name}.sol/${name}.json`],
      outDir: `${OUTDIR}/${name}.sol`,
      target: "ethers-v5",
    });
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
