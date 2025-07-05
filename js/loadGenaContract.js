// FIXED CONTRACT ADDRESS (placeholder)
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
; 

// CLEAN ABI (only the actual ABI array, no artifact metadata)
const CONTRACT_ABI = [
  {
  "inputs": [],
  "name": "MINTER_ROLE",
  "outputs": [
    { "internalType": "bytes32", "name": "", "type": "bytes32" }
  ],
  "stateMutability": "view",
  "type": "function"
},
{
  "inputs": [
    { "internalType": "uint256", "name": "value", "type": "uint256" }
  ],
  "name": "burn",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
},
  {
  "inputs": [],
  "name": "totalSupply",
  "outputs": [
    { "internalType": "uint256", "name": "", "type": "uint256" }
  ],
  "stateMutability": "view",
  "type": "function"
},
{
  "inputs": [],
  "name": "decimals",
  "outputs": [
    { "internalType": "uint8", "name": "", "type": "uint8" }
  ],
  "stateMutability": "view",
  "type": "function"
},
  {
    "inputs": [
      { "internalType": "string", "name": "name", "type": "string" },
      { "internalType": "string", "name": "symbol", "type": "string" },
      { "internalType": "uint256", "name": "cap", "type": "uint256" },
      { "internalType": "uint256", "name": "initialSupply", "type": "uint256" }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  { "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "spender", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }
    ], "name": "Approval", "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "pause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unpause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "mint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "value", "type": "uint256" }
    ],
    "name": "transfer",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "role", "type": "bytes32" },
      { "internalType": "address", "name": "account", "type": "address" }
    ],
    "name": "grantRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "role", "type": "bytes32" },
      { "internalType": "address", "name": "account", "type": "address" }
    ],
    "name": "revokeRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// removed INFURA_PROJECT_ID since you never defined GenaToken.INFURA_PROJECT_ID

let provider, signer, contract;

async function init() {
  if (window.ethereum) {
    console.log("MetaMask detected, connecting...");
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    const userAddress = await signer.getAddress();
    document.getElementById("walletAddress").innerText = userAddress;
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    console.log(`Connected to ${userAddress}`);
    await updateTotalSupply();

    // hook buttons only after connection
    document.getElementById("pauseButton").addEventListener("click", pauseContract);
    document.getElementById("unpauseButton").addEventListener("click", unpauseContract);
    document.getElementById("mintButton").addEventListener("click", mintTokens);
    document.getElementById("burnButton").addEventListener("click", burnTokens);
    document.getElementById("transferButton").addEventListener("click", transferTokens);
    document.getElementById("grantButton").addEventListener("click", grantRole);
    document.getElementById("revokeButton").addEventListener("click", revokeRole);
  } else {
    alert("MetaMask is required to connect to the Hardhat local node.");
  }
}

async function pauseContract() {
  await contract.pause();
  alert("Contract paused.");
}

async function unpauseContract() {
  await contract.unpause();
  alert("Contract unpaused.");
}

async function transferTokens() {
  const to = document.getElementById("transferTo").value;
  const amount = document.getElementById("transferAmount").value;
  const value = ethers.parseUnits(amount, 18);
  await contract.transfer(to, value);
  await updateTotalSupply();

  alert(`Transferred ${amount} GENA tokens to ${to}`);
}

async function updateTotalSupply() {
  if (!contract) return;
  const supply = await contract.totalSupply();
  const decimals = await contract.decimals();
  const adjusted = ethers.formatUnits(supply, decimals);
  document.getElementById("totalSupply").innerText = adjusted;
}

async function mintTokens() {
  try {
    const to = document.getElementById("mintTo").value;
    const amount = document.getElementById("mintAmount").value;
    const value = ethers.parseUnits(amount, 18);
    await contract.mint(to, value);
    await updateTotalSupply();
    alert(`Minted ${amount} tokens to ${to}`);
  } catch (err) {
    console.error(err);
    alert(`Error minting: ${err.reason || err.message}`);
  }
}


async function burnTokens() {
  const amount = document.getElementById('burnAmount').value;
  const value = ethers.parseUnits(amount, 18);
  await contract.burn(value);
  await updateTotalSupply();

  alert(`Burned ${amount} GENA tokens from your account`);
}

async function grantRole() {
  const roleName = document.getElementById("grantRole").value.trim().toUpperCase();
  const address = document.getElementById("grantTo").value;
  const roleHash = await contract[roleName]();
  await contract.grantRole(roleHash, address);
  alert(`Granted ${roleName} to ${address}`);
}

async function revokeRole() {
  const roleName = document.getElementById("revokeRole").value.trim().toUpperCase();
  const address = document.getElementById("revokeFrom").value;
  const roleHash = await contract[roleName]();
  await contract.revokeRole(roleHash, address);
  alert(`Revoked ${roleName} from ${address}`);
}

window.pauseContract = pauseContract;
window.unpauseContract = unpauseContract;
window.mintTokens = mintTokens;
window.transferTokens = transferTokens;
window.grantRole = grantRole;
window.revokeRole = revokeRole;

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("connectWallet").addEventListener("click", init);
});
