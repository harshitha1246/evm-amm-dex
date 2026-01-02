const hre = require("hardhat");

async function main() {
  console.log("Deploying DEX with MockERC20 tokens...");

  // Deploy MockERC20 tokens
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const tokenA = await MockERC20.deploy("Token A", "TKA");
  const tokenB = await MockERC20.deploy("Token B", "TKB");

  await tokenA.deployed();
  await tokenB.deployed();

  console.log("Token A deployed to:", tokenA.address);
  console.log("Token B deployed to:", tokenB.address);

  // Deploy DEX
  const DEX = await hre.ethers.getContractFactory("DEX");
  const dex = await DEX.deploy(tokenA.address, tokenB.address);
  await dex.deployed();

  console.log("DEX deployed to:", dex.address);

  // Approve DEX to spend tokens
  const approveAmount = hre.ethers.utils.parseEther("1000000");
  await tokenA.approve(dex.address, approveAmount);
  await tokenB.approve(dex.address, approveAmount);

  console.log("Approvals completed");
  console.log("\n=== Deployment Summary ===");
  console.log("Token A (TKA):", tokenA.address);
  console.log("Token B (TKB):", tokenB.address);
  console.log("DEX Contract:", dex.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
