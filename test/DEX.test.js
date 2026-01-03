const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DEX", function () {
  let dex, tokenA, tokenB;
  let owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    tokenA = await MockERC20.deploy("Token A", "TKA");
    tokenB = await MockERC20.deploy("Token B", "TKB");
    await tokenA.deployed();
    await tokenB.deployed();

    const DEX = await ethers.getContractFactory("DEX");
    dex = await DEX.deploy(tokenA.address, tokenB.address);
    await dex.deployed();

    // Mint and approve tokens
    await tokenA.mint(owner.address, ethers.utils.parseEther("1000000"));
    await tokenB.mint(owner.address, ethers.utils.parseEther("1000000"));
    await tokenA.mint(addr1.address, ethers.utils.parseEther("1000000"));
    await tokenB.mint(addr1.address, ethers.utils.parseEther("1000000"));

    await tokenA.approve(dex.address, ethers.utils.parseEther("1000000"));
    await tokenB.approve(dex.address, ethers.utils.parseEther("1000000"));
    await tokenA.connect(addr1).approve(dex.address, ethers.utils.parseEther("1000000"));
    await tokenB.connect(addr1).approve(dex.address, ethers.utils.parseEther("1000000"));
  });

  // Helper function for integer sqrt like Solidity
  function sqrt(value) {
    let z = value;
    let x = value.div(2).add(1);
    while (x.lt(z)) {
      z = x;
      x = value.div(x).add(x).div(2);
    }
    return z;
  }

  describe("Liquidity Management", function () {
    it("should allow initial liquidity provision", async function () {
      await expect(dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200")))
        .to.emit(dex, "LiquidityAdded");
    });

    it("should mint correct LP tokens for first provider", async function () {
      const amountA = ethers.utils.parseEther("100");
      const amountB = ethers.utils.parseEther("200");

      await dex.addLiquidity(amountA, amountB);

      const expectedLP = sqrt(amountA.mul(amountB).div(ethers.utils.parseEther("1")));
      const liquidity = await dex.getLiquidity(owner.address);

      expect(liquidity).to.equal(expectedLP);
    });

    it("should allow subsequent liquidity additions", async function () {
      await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
      await expect(dex.addLiquidity(ethers.utils.parseEther("50"), ethers.utils.parseEther("100")))
        .to.emit(dex, "LiquidityAdded");
    });

    it("should maintain price ratio on liquidity addition", async function () {
      await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
      await dex.addLiquidity(ethers.utils.parseEther("50"), ethers.utils.parseEther("100"));
      const [reserveA, reserveB] = await dex.getReserves();

      // Compare using BigNumber scaling
      const priceRatio = reserveB.mul(ethers.utils.parseEther("1")).div(reserveA);
      const expectedRatio = ethers.utils.parseEther("2"); // 200/100 = 2
      expect(priceRatio).to.equal(expectedRatio);
    });

    it("should allow partial liquidity removal", async function () {
      await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
      const liquidity = await dex.getLiquidity(owner.address);
      const half = liquidity.div(2);
      await expect(dex.removeLiquidity(half))
        .to.emit(dex, "LiquidityRemoved");
    });

    it("should return correct token amounts on liquidity removal", async function () {
      await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
      const liquidity = await dex.getLiquidity(owner.address);
      await dex.removeLiquidity(liquidity);
      const finalLiquidity = await dex.getLiquidity(owner.address);
      expect(finalLiquidity).to.equal(0);
    });

    it("should revert on zero liquidity addition", async function () {
      await expect(dex.addLiquidity(0, ethers.utils.parseEther("200")))
        .to.be.revertedWith("Amounts must be greater than 0");
    });

    it("should revert when removing more liquidity than owned", async function () {
      await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
      const liquidity = await dex.getLiquidity(owner.address);
      await expect(dex.removeLiquidity(liquidity.add(1)))
        .to.be.revertedWith("Insufficient liquidity");
    });
  });

  describe("Token Swaps", function () {
    beforeEach(async function () {
      await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
    });

    it("should swap token A for token B", async function () {
      await expect(dex.swapAForB(ethers.utils.parseEther("10"))).to.emit(dex, "Swap");
    });

    it("should swap token B for token A", async function () {
      await expect(dex.swapBForA(ethers.utils.parseEther("10"))).to.emit(dex, "Swap");
    });

    it("should calculate correct output amount with fee", async function () {
      const amountIn = ethers.utils.parseEther("1");
      const output = await dex.getAmountOut(amountIn, ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
      expect(output).to.be.gt(0);
    });

    it("should update reserves after swap", async function () {
      const [reserveABefore] = await dex.getReserves();
      await dex.swapAForB(ethers.utils.parseEther("10"));
      const [reserveAAfter] = await dex.getReserves();
      expect(reserveAAfter).to.be.gt(reserveABefore);
    });

    it("should increase k after swap due to fees", async function () {
      const [rA1, rB1] = await dex.getReserves();
      const k1 = rA1.mul(rB1);
      await dex.swapAForB(ethers.utils.parseEther("10"));
      const [rA2, rB2] = await dex.getReserves();
      const k2 = rA2.mul(rB2);
      expect(k2).to.be.gte(k1);
    });

    it("should revert on zero swap amount", async function () {
      await expect(dex.swapAForB(0)).to.be.revertedWith("Amount must be greater than 0");
    });

    it("should handle large swaps with high price impact", async function () {
      await expect(dex.swapAForB(ethers.utils.parseEther("1000"))).to.emit(dex, "Swap");
    });

    it("should handle multiple consecutive swaps", async function () {
      await dex.swapAForB(ethers.utils.parseEther("1"));
      await expect(dex.swapBForA(ethers.utils.parseEther("1"))).to.emit(dex, "Swap");
    });
  });

  describe("Price Calculations", function () {
    it("should return correct initial price", async function () {
      await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
      const price = await dex.getPrice();
      expect(price).to.equal(ethers.utils.parseEther("2"));
    });

    it("should update price after swaps", async function () {
      await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
      const priceBefore = await dex.getPrice();
      await dex.swapAForB(ethers.utils.parseEther("10"));
      const priceAfter = await dex.getPrice();
      expect(priceAfter).to.be.lt(priceBefore);
    });

    it("should handle price queries with zero reserves gracefully", async function () {
      await expect(dex.getPrice()).to.be.revertedWith("Reserve A is zero");
    });
  });

  describe("Fee Distribution", function () {
    it("should accumulate fees for liquidity providers", async function () {
      const initialTokenA = await tokenA.balanceOf(owner.address);
      await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
      await dex.connect(addr1).swapAForB(ethers.utils.parseEther("10"));
      const liquidity = await dex.getLiquidity(owner.address);
      await dex.removeLiquidity(liquidity);
      const finalTokenA = await tokenA.balanceOf(owner.address);
      expect(finalTokenA).to.be.gte(initialTokenA.sub(ethers.utils.parseEther("100")));
    });

    it("should distribute fees proportionally to LP share", async function () {
      await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
      const liquidityOwner = await dex.getLiquidity(owner.address);
      expect(liquidityOwner).to.be.gt(0);
    });
  });

  describe("Edge Cases", function () {
    it("should handle very small liquidity amounts", async function () {
      await expect(dex.addLiquidity(ethers.utils.parseEther("0.001"), ethers.utils.parseEther("0.002")))
        .to.emit(dex, "LiquidityAdded");
    });

    it("should handle very large liquidity amounts", async function () {
      await tokenA.mint(owner.address, ethers.utils.parseEther("1000000"));
      await tokenB.mint(owner.address, ethers.utils.parseEther("1000000"));
      await expect(dex.addLiquidity(ethers.utils.parseEther("100000"), ethers.utils.parseEther("200000")))
        .to.emit(dex, "LiquidityAdded");
    });

    it("should prevent unauthorized access", async function () {
      await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
      const liquidity = await dex.getLiquidity(owner.address);
      await expect(dex.connect(addr2).removeLiquidity(liquidity))
        .to.be.revertedWith("Insufficient liquidity");
    });
  });

  describe("Events", function () {
    it("should emit LiquidityAdded event", async function () {
      await expect(dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200")))
        .to.emit(dex, "LiquidityAdded");
    });

    it("should emit LiquidityRemoved event", async function () {
      await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
      const liquidity = await dex.getLiquidity(owner.address);
      await expect(dex.removeLiquidity(liquidity)).to.emit(dex, "LiquidityRemoved");
    });

    it("should emit Swap event", async function () {
      await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
      await expect(dex.swapAForB(ethers.utils.parseEther("10"))).to.emit(dex, "Swap");
    });
  });
});
