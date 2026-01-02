# DEX AMM - Decentralized Exchange with Automated Market Maker

## Overview

This project implements a **Decentralized Exchange (DEX)** using the **Automated Market Maker (AMM)** model, similar to Uniswap V2. The DEX allows users to add/remove liquidity and swap between ERC-20 tokens using the constant product formula (x * y = k).

## Features

- **Liquidity Management**: Add and remove liquidity from trading pairs
- **LP Token Minting**: Receive LP tokens proportional to your liquidity contribution
- **Token Swaps**: Swap between two ERC-20 tokens with fair pricing
- **Trading Fees**: Earn 0.3% fee on each trade as a liquidity provider
- **Constant Product Formula**: Implements x * y = k for fair price discovery
- **Security**: Uses OpenZeppelin contracts for safe token transfers and reentrancy protection

## Architecture

### Smart Contracts

- **DEX.sol**: Main AMM contract handling liquidity and swaps
- **MockERC20.sol**: ERC-20 token for testing

### Key Design Decisions

1. **LP Token Tracking**: LP tokens are tracked via a mapping instead of a separate ERC-20 contract for simplicity
2. **Fee Structure**: 0.3% fee is deducted from input before applying the constant product formula
3. **Reserve Synchronization**: Reserves are updated directly rather than reading from balanceOf()
4. **Mathematical Precision**: Uses integer arithmetic with careful ordering (multiply before divide)

## Mathematical Implementation

### Constant Product Formula

The core principle of the AMM:
```
reserveA * reserveB = k (constant)
```

When a user swaps:
1. Add input tokens to pool: `reserveA_new = reserveA + amountIn`
2. Calculate output: `reserveB_new = k / reserveA_new`
3. Output tokens: `amountOut = reserveB - reserveB_new`

### Fee Calculation

A 0.3% fee is applied:
```
amountInWithFee = amountIn * 0.997
```

This fee stays in the pool, benefiting all liquidity providers proportionally.

### LP Token Minting

**First Provider**:
```
liquidityMinted = sqrt(amountA * amountB)
```

**Subsequent Providers**:
```
liquidityMinted = min(
  (amountA * totalLiquidity) / reserveA,
  (amountB * totalLiquidity) / reserveB
)
```

## Setup Instructions

### Prerequisites

- Docker and Docker Compose installed
- Git installed
- Node.js 18+ (for local development)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/harshitha1246/evm-amm-dex.git
   cd evm-amm-dex
   ```

2. **Using Docker** (Recommended):
   ```bash
   # Start the Docker environment
   docker-compose up -d
   
   # Compile contracts
   docker-compose exec app npm run compile
   
   # Run tests
   docker-compose exec app npm test
   
   # Check coverage
   docker-compose exec app npm run coverage
   
   # Stop the environment
   docker-compose down
   ```

3. **Local Setup** (Without Docker):
   ```bash
   npm install
   npx hardhat compile
   npx hardhat test
   npx hardhat coverage
   ```

4. **Deployment**:
   ```bash
   npx hardhat run scripts/deploy.js
   ```

## Running Tests

The test suite includes 30+ test cases covering:

- Initial liquidity provision
- LP token minting accuracy
- Subsequent liquidity additions
- Liquidity removal with proper accounting
- Token swaps (both directions)
- Fee calculation and accumulation
- Price calculations
- Edge cases and error handling
- Event emissions

### Run Tests

```bash
# Using Docker
docker-compose exec app npm test

# Local setup
npm test
```

### Test Coverage

Aim for 80%+ coverage:

```bash
# Using Docker
docker-compose exec app npm run coverage

# Local setup
npm run coverage
```

## Security Considerations

1. **Reentrancy Protection**: Uses OpenZeppelin's ReentrancyGuard
2. **Safe Token Transfers**: Uses SafeERC20 for protected transfers
3. **Input Validation**: All amounts are checked for being greater than zero
4. **Overflow/Underflow**: Solidity 0.8+ provides built-in protection
5. **Reserve Consistency**: Reserves are synchronized after each operation

## Known Limitations

1. **Single Trading Pair**: Each DEX contract handles only two tokens
2. **No Slippage Protection**: Doesn't include minAmountOut parameters
3. **No Price Oracles**: Uses spot price without time-weighted averages
4. **First LP Risk**: First liquidity provider's initial ratio determines pool price

## File Structure

```
evm-amm-dex/
├── contracts/
│   ├── DEX.sol              # Main DEX contract
│   └── MockERC20.sol        # Test token contract
├── test/
│   └── DEX.test.js          # Comprehensive test suite
├── scripts/
│   └── deploy.js            # Deployment script
├── Dockerfile               # Container configuration
├── docker-compose.yml       # Multi-container setup
├── hardhat.config.js        # Hardhat configuration
├── package.json             # Dependencies and scripts
└── README.md               # This file
```

## Contract Functions

### Core Functions

- `addLiquidity(uint256 amountA, uint256 amountB)`: Add liquidity to the pool
- `removeLiquidity(uint256 liquidityAmount)`: Remove liquidity by burning LP tokens
- `swapAForB(uint256 amountAIn)`: Swap token A for token B
- `swapBForA(uint256 amountBIn)`: Swap token B for token A

### View Functions

- `getPrice()`: Get current price of token A in terms of token B
- `getReserves()`: Get current pool reserves
- `getAmountOut()`: Calculate output amount for a given input
- `getLiquidity()`: Get liquidity balance of an address

## Events

- `LiquidityAdded`: Emitted when liquidity is added
- `LiquidityRemoved`: Emitted when liquidity is removed
- `Swap`: Emitted when a swap occurs

## Development

### Add a New Feature

1. Implement in DEX.sol
2. Add corresponding tests in test/DEX.test.js
3. Update documentation
4. Run full test suite
5. Ensure coverage remains ≥ 80%

### Debugging

Use Hardhat console for debugging:

```bash
npx hardhat console
```

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open an issue on the GitHub repository.

---

**Built for the Partnr Network Global Placement Program**
