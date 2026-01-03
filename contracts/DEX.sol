// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DEX is ERC20 {
    IERC20 public tokenA;
    IERC20 public tokenB;

    uint256 public reserveA;
    uint256 public reserveB;

    uint256 public fee = 30; // 0.3% fee, scaled to 1000

    event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidity);
    event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidity);
    event Swap(address indexed swapper, uint256 amountIn, uint256 amountOut, bool isAForB);

    constructor(address _tokenA, address _tokenB) ERC20("LP Token", "LPT") {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    // Add liquidity
    function addLiquidity(uint256 amountA, uint256 amountB) external returns (uint256 liquidity) {
        require(amountA > 0 && amountB > 0, "Amounts must be greater than 0");

        if (totalSupply() == 0) {
            liquidity = sqrt(amountA * amountB / 1e18);
        } else {
            uint256 liquidityA = amountA * totalSupply() / reserveA;
            uint256 liquidityB = amountB * totalSupply() / reserveB;
            liquidity = liquidityA < liquidityB ? liquidityA : liquidityB;
        }

        _mint(msg.sender, liquidity);

        reserveA += amountA;
        reserveB += amountB;

        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);

        emit LiquidityAdded(msg.sender, amountA, amountB, liquidity);
    }

    // Remove liquidity
    function removeLiquidity(uint256 liquidity) external returns (uint256 amountA, uint256 amountB) {
        require(balanceOf(msg.sender) >= liquidity, "Insufficient liquidity");

        amountA = liquidity * reserveA / totalSupply();
        amountB = liquidity * reserveB / totalSupply();

        _burn(msg.sender, liquidity);

        reserveA -= amountA;
        reserveB -= amountB;

        tokenA.transfer(msg.sender, amountA);
        tokenB.transfer(msg.sender, amountB);

        emit LiquidityRemoved(msg.sender, amountA, amountB, liquidity);
    }

    // Swap token A for token B
    function swapAForB(uint256 amountAIn) external returns (uint256 amountBOut) {
        require(amountAIn > 0, "Amount must be greater than 0");

        amountBOut = getAmountOut(amountAIn, reserveA, reserveB);

        reserveA += amountAIn;
        reserveB -= amountBOut;

        tokenA.transferFrom(msg.sender, address(this), amountAIn);
        tokenB.transfer(msg.sender, amountBOut);

        emit Swap(msg.sender, amountAIn, amountBOut, true);
    }

    // Swap token B for token A
    function swapBForA(uint256 amountBIn) external returns (uint256 amountAOut) {
        require(amountBIn > 0, "Amount must be greater than 0");

        amountAOut = getAmountOut(amountBIn, reserveB, reserveA);

        reserveB += amountBIn;
        reserveA -= amountAOut;

        tokenB.transferFrom(msg.sender, address(this), amountBIn);
        tokenA.transfer(msg.sender, amountAOut);

        emit Swap(msg.sender, amountBIn, amountAOut, false);
    }

    // View function to calculate output amount with fee
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public view returns (uint256) {
        require(amountIn > 0, "Amount must be greater than 0");
        uint256 amountInWithFee = amountIn * (1000 - fee) / 1000;
        uint256 amountOut = amountInWithFee * reserveOut / (reserveIn + amountInWithFee);
        return amountOut;
    }

    // Get reserves
    function getReserves() external view returns (uint256, uint256) {
        return (reserveA, reserveB);
    }

    // Get LP balance
    function getLiquidity(address user) external view returns (uint256) {
        return balanceOf(user);
    }

    // Price of token B in terms of token A
    function getPrice() external view returns (uint256) {
        require(reserveA > 0, "Reserve A is zero");
        return reserveB * 1e18 / reserveA;
    }

    // Internal integer square root function
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
