import { expect } from 'chai'
import { ethers, upgrades } from 'hardhat';
import { StakingPoolFactory__factory } from '../typechain/factories/contracts/StakingPoolFactory__factory';
import { WETH9__factory } from '../typechain/factories/contracts/test/WETH9__factory';
import { StETH__factory } from '../typechain/factories/contracts/test/StETH__factory';
import { FrxETH__factory } from '../typechain/factories/contracts/test/frxETH.sol/FrxETH__factory';
import { SfrxETH__factory } from '../typechain/factories/contracts/test/sfrxETH.sol/SfrxETH__factory';
import { AGICoin__factory } from '../typechain/factories/contracts/AGICoin__factory';
import { ESAGIToken__factory } from '../typechain/factories/contracts/ESAGIToken__factory';
import { TestERC20__factory } from '../typechain/factories/contracts/test/TestERC20__factory';


const { provider, BigNumber } = ethers;

export const ONE_DAY_IN_SECS = 24 * 60 * 60;

export const nativeTokenAddress = '0x0000000000000000000000000000000000000000';

export async function deployStakingPoolContractsFixture() {
  const  [Alice, Bob, Caro, Dave]  = await ethers.getSigners();

  const AGICoin = await ethers.getContractFactory('AGICoin');
  const AGICoinContract = await AGICoin.deploy();
  const agiCoin = AGICoin__factory.connect(AGICoinContract.address, provider);

  const ESAGIToken = await ethers.getContractFactory('ESAGIToken');
  const ESAGITokenContract = await ESAGIToken.deploy(agiCoin.address);
  const esagiToken = ESAGIToken__factory.connect(ESAGITokenContract.address, provider);

  const WETH9 = await ethers.getContractFactory('WETH9');
  const WETH9Contract = await WETH9.deploy();
  const weth = WETH9__factory.connect(WETH9Contract.address, provider);

  const StETH = await ethers.getContractFactory('StETH');
  const StETHContract = await StETH.deploy();
  const stETH = StETH__factory.connect(StETHContract.address, provider);

  const FrxETH = await ethers.getContractFactory('frxETH');
  const FrxETHContract = await FrxETH.deploy(Alice.address, Alice.address);
  const frxETH = FrxETH__factory.connect(FrxETHContract.address, provider);

  const SfrxETH = await ethers.getContractFactory('sfrxETH');
  const SfrxETHContract = await SfrxETH.deploy(frxETH.address, 604800); // 7 days
  const sfrxETH = SfrxETH__factory.connect(SfrxETHContract.address, provider);

  const StakingPoolFactory = await ethers.getContractFactory('StakingPoolFactory');
  const stakingPoolFactoryContract = await StakingPoolFactory.deploy(esagiToken.address, weth.address);
  const stakingPoolFactory = StakingPoolFactory__factory.connect(stakingPoolFactoryContract.address, provider);

  const TestERC20 = await ethers.getContractFactory('TestERC20');
  const erc20Proxy = await upgrades.deployProxy(TestERC20, ['Test ERC20', 'ERC20']);
  const erc20 = TestERC20__factory.connect(erc20Proxy.address, provider);

  return { agiCoin, esagiToken, stakingPoolFactory, erc20, weth, stETH, frxETH, sfrxETH,  Alice, Bob, Caro, Dave };
}

export function expandTo18Decimals(n: number) {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18));
}

// ensure result is within .01%
export function expectBigNumberEquals(expected: BigNumber, actual: BigNumber) {
  const equals = expected.sub(actual).abs().lte(expected.div(10000));
  if (!equals) {
    console.log(`BigNumber does not equal. expected: ${expected.toString()}, actual: ${actual.toString()}`);
  }
  expect(equals).to.be.true;
}