const {
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode,
} = require("@stacks/transactions");
const { STACKS_MAINNET } = require("@stacks/network");
const fs = require("fs");
const path = require("path");

const PRIVATE_KEY = "***REMOVED***";
const ADDRESS = "SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W";

async function deploy() {
  console.log("Deploying Sentinel Oracle Aggregator...\n");
  
  // Read contract source
  const contractPath = path.join(__dirname, "../contracts/sentinel-oracle-aggregator.clar");
  const contractSource = fs.readFileSync(contractPath, "utf8");
  
  // Get current nonce
  const nonceRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/nonces`);
  const nonceData = await nonceRes.json();
  const nonce = nonceData.possible_next_nonce;
  
  console.log(`Current nonce: ${nonce}`);
  console.log(`Contract size: ${contractSource.length} bytes\n`);
  
  try {
    const tx = await makeContractDeploy({
      contractName: "sentinel-oracle-aggregator-v1",
      codeBody: contractSource,
      senderKey: PRIVATE_KEY,
      network: STACKS_MAINNET,
      anchorMode: AnchorMode.Any,
      fee: 50000, // 0.05 STX for contract deploy
      nonce: nonce,
    });
    
    console.log("Broadcasting transaction...");
    const result = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });
    
    if (result.error) {
      console.log("Error:", result.error, result.reason);
    } else {
      console.log("\n✅ Contract deployed successfully!");
      console.log(`TX ID: ${result.txid}`);
      console.log(`Contract: ${ADDRESS}.sentinel-oracle-aggregator-v1`);
      console.log(`Explorer: https://explorer.stacks.co/txid/${result.txid}?chain=mainnet`);
    }
  } catch (error) {
    console.log("Deploy error:", error.message);
  }
}

deploy().catch(console.error);
