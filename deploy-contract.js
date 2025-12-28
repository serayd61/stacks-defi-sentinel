const { makeContractDeploy, broadcastTransaction, AnchorMode } = require('@stacks/transactions');
const { STACKS_MAINNET } = require('@stacks/network');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Kontrat kodu
const contractSource = `
;; SENTINEL Token (SNTL) - Simple Version v3
;; Clarity 2 Compatible

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))

(define-fungible-token sentinel)

(define-data-var token-name (string-ascii 32) "Sentinel Token")
(define-data-var token-symbol (string-ascii 10) "SNTL")
(define-data-var token-uri (optional (string-utf8 256)) (some u"https://defi-sentinel.app/token.json"))

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) err-not-token-owner)
    (try! (ft-transfer? sentinel amount sender recipient))
    (match memo m (print m) 0x)
    (ok true)))

(define-read-only (get-name) (ok (var-get token-name)))
(define-read-only (get-symbol) (ok (var-get token-symbol)))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-balance (who principal)) (ok (ft-get-balance sentinel who)))
(define-read-only (get-total-supply) (ok (ft-get-supply sentinel)))
(define-read-only (get-token-uri) (ok (var-get token-uri)))

(define-public (mint (amount uint) (to principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ft-mint? sentinel amount to)))

(define-read-only (get-info)
  {name: (var-get token-name), symbol: (var-get token-symbol), owner: contract-owner})
`;

async function deployContract(secretKey, contractName) {
  console.log('\nDeploying contract:', contractName);
  console.log('Network: Mainnet');
  
  const txOptions = {
    contractName: contractName,
    codeBody: contractSource,
    senderKey: secretKey,
    network: STACKS_MAINNET,
    anchorMode: AnchorMode.Any,
    fee: 50000n, // 0.05 STX
    clarityVersion: 2,
  };

  try {
    const transaction = await makeContractDeploy(txOptions);
    console.log('Transaction created, broadcasting...');
    
    const broadcastResponse = await broadcastTransaction(transaction, STACKS_MAINNET);
    
    if (broadcastResponse.error) {
      console.error('Broadcast error:', broadcastResponse.error);
      console.error('Reason:', broadcastResponse.reason);
    } else {
      console.log('\n✅ Transaction broadcast successful!');
      console.log('TX ID:', broadcastResponse.txid);
      console.log('\nView on explorer:');
      console.log('https://explorer.hiro.so/txid/' + broadcastResponse.txid + '?chain=mainnet');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  rl.close();
}

console.log('\n=== Stacks Contract Deployer ===');
console.log('This will deploy sentinel-token-v3 to MAINNET');
console.log('\n⚠️  Your private key will NOT be stored or logged.');

rl.question('\nEnter your Stacks private key (hex format): ', (secretKey) => {
  if (!secretKey || secretKey.length < 64) {
    console.log('Invalid private key');
    rl.close();
    return;
  }
  
  rl.question('Enter contract name (e.g., sentinel-token-v3): ', (contractName) => {
    if (!contractName) {
      contractName = 'sentinel-token-v3';
    }
    deployContract(secretKey, contractName);
  });
});
