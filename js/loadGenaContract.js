CONFIG = {
  CONTRACT_ADDRESS: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  RECIPIENT_ADDRESS: "0x604512a8a123dd26774303e7795895513854fb04",
  USDC_ADDRESS: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  GENA_REWARD: "100",
  INFURA_ID: "f131b9d834df427ab57867e0af3e5d95"
};

const CONTRACT_ADDRESS = CONFIG.CONTRACT_ADDRESS;
const RECIPIENT_ADDRESS = CONFIG.RECIPIENT_ADDRESS;
const USDC_ADDRESS = CONFIG.USDC_ADDRESS;
const GENA_REWARD = CONFIG.GENA_REWARD;
const INFURA_ID = CONFIG.INFURA_ID;

const ROLES = {
  MINTER_ROLE: "0x" + ethers.id("MINTER_ROLE").substring(2),
  PAUSER_ROLE: "0x" + ethers.id("PAUSER_ROLE").substring(2),
  DEFAULT_ADMIN_ROLE: "0x" + "0".repeat(64)
};


const CONTRACT_ABI = [
  {"inputs":[],"name":"MINTER_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"burn","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"pause","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"unpause","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {
    "inputs": [],
    "name": "paused",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];


let contract;
let provider;
let signer;
let userAccount;

async function connectWallet() {
  

  try {
    await web3Modal.clearCachedProvider();
    const instance = await web3Modal.connect();
    provider = new ethers.BrowserProvider(instance);
    signer = await provider.getSigner();
    userAccount = await signer.getAddress();

    const network = await provider.getNetwork();
    const balance = await provider.getBalance(userAccount);

    const walletInput = document.getElementById("wallet");
    if (walletInput) walletInput.value = userAccount;

    const infoSpan = document.getElementById("walletInfo");
    if (infoSpan) {
      infoSpan.textContent = `Connected: ${userAccount.slice(0, 6)}... | ETH: ${Number(ethers.formatEther(balance)).toFixed(4)}`;
    }

    console.log(`Connected wallet: ${userAccount}`);
  } catch (err) {
    console.error("Connection failed:", err);
    alert("Wallet connection failed.");
  }
}

async function init() {
  console.log("Initializing admin...");

  //await connectWallet();
  if (!signer || !userAccount) {
    alert("Wallet connection failed, cannot initialize admin.");
    return;
  }

  if (!contract) {
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    console.log(`Contract connected at ${CONTRACT_ADDRESS}`);
  }

  await updateTotalSupply();
  await updatePauseState();

  // hook admin buttons
  document.getElementById("pauseButton").addEventListener("click", pauseContract);
  document.getElementById("unpauseButton").addEventListener("click", unpauseContract);
  document.getElementById("mintButton").addEventListener("click", mintTokens);
  document.getElementById("burnButton").addEventListener("click", burnTokens);
  document.getElementById("transferButton").addEventListener("click", transferTokens);
  document.getElementById("grantButton").addEventListener("click", grantRole);
  document.getElementById("revokeButton").addEventListener("click", revokeRole);

  // hook donation calculator if index.html present
  const cryptoSelect = document.getElementById("crypto");
  if (cryptoSelect) {
    cryptoSelect.addEventListener("change", async function() {
      const crypto = this.value;
      const ethEquivalent = document.getElementById("ethEquivalent");
      const usdInput = document.getElementById("usdAmount");
      if (crypto === "ETH") {
        usdInput.addEventListener("input", async () => {
          const usd = parseFloat(usdInput.value);
          const ethPrice = await getEthPrice();
          if (ethPrice && usd > 0) {
            ethEquivalent.textContent = `≈ ${(usd/ethPrice).toFixed(6)} ETH`;
          } else {
            ethEquivalent.textContent = "";
          }
        });
      } else {
        ethEquivalent.textContent = "";
      }
    });
  }
}

async function handleDonation(e) {
  e.preventDefault();

  const amountUsd = document.getElementById("usdAmount").value;
  const crypto = document.getElementById("crypto").value;
  const recipient = RECIPIENT_ADDRESS;
  const amountNumber = Number(amountUsd);

  if (!userAccount) {
    alert("Please connect your wallet first.");
    return;
  }

  if (!crypto || amountNumber <= 0) {
    alert("Please select a crypto and enter a valid amount.");
    return;
  }

  try {
    if (crypto === "ETH") {
      const ethPrice = await getEthPrice();
      if (!ethPrice) throw new Error("Could not fetch ETH price.");
      const ethAmount = (amountNumber/ethPrice).toFixed(6);
      const tx = await signer.sendTransaction({
        to: recipient,
        value: ethers.parseEther(ethAmount)
      });
      await tx.wait();
    } else if (crypto === "USDC") {
      const usdcAbi = [
        "function transfer(address to, uint amount) public returns (bool)"
      ];
      const usdc = new ethers.Contract(USDC_ADDRESS, usdcAbi, signer);
      const value = ethers.parseUnits(amountUsd, 6);
      const tx = await usdc.transfer(recipient, value);
      await tx.wait();
    }

    // reward message
    let rewardGENA = GENA_REWARD * amountNumber;
    alert(`Thank you for supporting! Your $${amountNumber} donation helps innovation thrive. You will receive ${rewardGENA} GENA tokens in the next distribution.`);

    // optional on-chain mint
    // const rewardAmount = ethers.parseUnits(rewardGENA.toString(), 18);
    // await contract.mint(userAccount, rewardAmount);

  } catch (err) {
    console.error(err);
    alert(`Donation failed: ${err.message}`);
  }
}

async function getEthPrice() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const data = await res.json();
    return data.ethereum.usd;
  } catch (err) {
    console.error("Price fetch failed:", err);
    return null;
  }
}

async function pauseContract() {
  await contract.pause();
  alert("Contract paused.");
  await updatePauseState();
}


async function unpauseContract() {
  await contract.unpause();
  alert("Contract unpaused.");
  await updatePauseState();
}


async function updatePauseState() {
  if (!contract) return;
  try {
    const isPaused = await contract.paused();
    const stateEl = document.getElementById("contractState");
    if (stateEl) {
      stateEl.textContent = isPaused ? "Paused" : "Active";
      stateEl.style.color = isPaused ? "red" : "green";
    }

    // enable/disable buttons
    document.getElementById("pauseButton").disabled = isPaused;
    document.getElementById("unpauseButton").disabled = !isPaused;

    // optionally disable mint/transfer while paused:
    document.getElementById("mintButton").disabled = isPaused;
    document.getElementById("burnButton").disabled = isPaused;
    document.getElementById("transferButton").disabled = isPaused;

  } catch (err) {
    console.error("Failed to fetch paused state", err);
  }
}


async function mintTokens() {
  try {
    const to = document.getElementById("mintTo").value;
    const amount = document.getElementById("mintAmount").value;

    if (!to || !ethers.isAddress(to)) {
      alert("Please enter a valid recipient address.");
      return;
    }
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      alert("Please enter a valid amount to mint.");
      return;
    }

    const mintAmount = ethers.parseUnits(amount, 18);

    const totalSupply = await contract.totalSupply();
    const cap = await contract.cap();  // assuming you implemented cap()
    const remaining = cap - totalSupply;

    if (mintAmount > remaining) {
      alert(`Minting would exceed the max cap. Only ${ethers.formatUnits(remaining, 18)} GENA left to mint.`);
      return;
    }

    const tx = await contract.mint(to, mintAmount);
    await tx.wait();

    await updateTotalSupply();
    alert(`Successfully minted ${amount} GENA to ${to}`);
  } catch (err) {
    console.error(err);
    alert(`Error minting: ${err.reason || err.message}`);
  }
}


async function burnTokens() {
  const amount = document.getElementById("burnAmount").value;
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    alert("Please enter a valid burn amount.");
    return;
  }

  const confirmBurn = confirm(`Are you sure you want to permanently burn ${amount} GENA from your wallet? This cannot be undone.`);
  if (!confirmBurn) {
    return;
  }

  try {
    const value = ethers.parseUnits(amount, 18);
    await contract.burn(value);
    await updateTotalSupply();
    alert(`Successfully burned ${amount} GENA from your wallet.`);
  } catch (err) {
    console.error(err);
    alert(`Error burning tokens: ${err.message}`);
  }
}


async function transferTokens() {
  const to = document.getElementById("transferTo").value;
  const amount = document.getElementById("transferAmount").value;
  const value = ethers.parseUnits(amount, 18);
  await contract.transfer(to, value);
  alert(`Transferred ${amount} GENA to ${to}`);
}

async function grantRole() {
  const roleName = document.getElementById("grantRole").value.trim().toUpperCase();
  const address = document.getElementById("grantTo").value;
  if (!ROLES[roleName]) {
    alert(`Invalid role: ${roleName}`);
    return;
  }
  await contract.grantRole(ROLES[roleName], address);
  alert(`Granted ${roleName} to ${address}`);
}

async function revokeRole() {
  const roleName = document.getElementById("revokeRole").value.trim().toUpperCase();
  const address = document.getElementById("revokeFrom").value;
  if (!ROLES[roleName]) {
    alert(`Invalid role: ${roleName}`);
    return;
  }
  await contract.revokeRole(ROLES[roleName], address);
  alert(`Revoked ${roleName} from ${address}`);
}

async function updateTotalSupply() {
  if (!contract) return;
  const supply = await contract.totalSupply();
  const decimals = await contract.decimals();
  document.getElementById("totalSupply").innerText = ethers.formatUnits(supply, decimals);
}

// expose to HTML
window.connectWallet = connectWallet;
window.pauseContract = pauseContract;
window.unpauseContract = unpauseContract;
window.mintTokens = mintTokens;
window.transferTokens = transferTokens;
window.grantRole = grantRole;
window.revokeRole = revokeRole;

window.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connectWallet");
  if (connectBtn) {
    connectBtn.addEventListener("click", async () => {

      const providerOptions = {
        injected: {
          display: {
            name: "MetaMask",
            description: "Connect with the MetaMask browser extension"
          },
          package: null
        },
        walletconnect: {
          package: window.WalletConnectProvider.default,
          options: {
            infuraId: INFURA_ID
          }
        }
      };

        web3Modal = new window.Web3Modal.default({
          cacheProvider: false,
          disableInjectedProvider: false,
          providerOptions
        });


      await connectWallet(); // ✅ show wallet selection popup
      await init();          // ✅ only run if wallet was selected
    });
  }

  const donationForm = document.getElementById("donationForm");
  if (donationForm) {
    donationForm.addEventListener("submit", handleDonation);
  }
});


