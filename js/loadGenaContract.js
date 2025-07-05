/*CONFIG = {
  CONTRACT_ADDRESS: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  RECIPIENT_ADDRESS: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  USDC_ADDRESS: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  GENA_REWARD: "100"
};*/

const CONTRACT_ADDRESS = CONFIG.CONTRACT_ADDRESS;
const RECIPIENT_ADDRESS = CONFIG.RECIPIENT_ADDRESS;
const USDC_ADDRESS = CONFIG.USDC_ADDRESS;
const GENA_REWARD = CONFIG.GENA_REWARD;

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
  {"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

let contract;
let provider;
let signer;
let userAccount;

async function connectWallet() {
  if (typeof window.ethereum !== "undefined") {
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      signer = await provider.getSigner();
      userAccount = await signer.getAddress();

      const network = await provider.getNetwork();
      console.log(`Connected to chain ID ${network.chainId}`);  // purely informational

      // update UI
      const addrFields = document.querySelectorAll(".wallet-address");
      addrFields.forEach(el => el.textContent = userAccount);

      // update donation page wallet input
      const walletInput = document.getElementById("wallet");
      if (walletInput) {
        walletInput.value = userAccount;
      }

      // update admin page #walletAddress if present
      const walletAddrLabel = document.getElementById("walletAddress");
      if (walletAddrLabel) {
        walletAddrLabel.textContent = userAccount;
      }

      console.log(`Connected wallet: ${userAccount}`);
      alert(`Connected wallet: ${userAccount}`);

      return userAccount;
    } catch (err) {
      console.error(err);
      alert("Failed to connect wallet or permission denied.");
    }
  } else {
    alert("Please install MetaMask.");
  }
}

async function init() {
  console.log("Initializing admin...");

  await connectWallet();
  if (!signer || !userAccount) {
    alert("Wallet connection failed, cannot initialize admin.");
    return;
  }

  if (!contract) {
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    console.log(`Contract connected at ${CONTRACT_ADDRESS}`);
  }

  await updateTotalSupply();

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
}

async function unpauseContract() {
  await contract.unpause();
  alert("Contract unpaused.");
}

async function mintTokens() {
  const to = document.getElementById("mintTo").value;
  const amount = document.getElementById("mintAmount").value;
  const value = ethers.parseUnits(amount, 18);
  await contract.mint(to, value);
  await updateTotalSupply();
  alert(`Minted ${amount} GENA to ${to}`);
}

async function burnTokens() {
  const amount = document.getElementById("burnAmount").value;
  const value = ethers.parseUnits(amount, 18);
  await contract.burn(value);
  await updateTotalSupply();
  alert(`Burned ${amount} GENA`);
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
    connectBtn.addEventListener("click", init);
  }

  const donationForm = document.getElementById("donationForm");
  if (donationForm) {
    donationForm.addEventListener("submit", handleDonation);
  }
});

