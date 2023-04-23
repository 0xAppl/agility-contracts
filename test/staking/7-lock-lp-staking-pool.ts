import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { ONE_DAY_IN_SECS, deployStakingPoolContractsFixture, expandTo18Decimals, expectBigNumberEquals, nativeTokenAddress } from '../utils';
import { AGILITYFarm__factory } from '../../typechain/factories/contracts/LockFarm.sol/AGILITYFarm__factory';
import { UniswapV2Factory__factory } from '../../typechain/factories/contracts/test/UniswapV2Factory.sol/UniswapV2Factory__factory';
import { UniswapV2Router02__factory } from '../../typechain/factories/contracts/test/UniswapV2Router02.sol/UniswapV2Router02__factory';
import { UniswapV2Pair__factory } from '../../typechain/factories/contracts/test/UniswapV2Factory.sol/UniswapV2Pair__factory';
import { notDeepEqual } from 'assert';

const { provider } = ethers;

describe('agi-weth LP Staking Pool', () => {

  it('Basic scenario works', async () => {

    const { agiCoin, timelock, esagiToken, stakingPoolFactory, erc20, weth, stETH, frxETH, sfrxETH,  Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);
    // create univ2 LP token
    const UniswapV2Factory = await ethers.getContractFactory('UniswapV2Factory');
    const UniswapV2FactoryContract = await UniswapV2Factory.deploy(ethers.constants.AddressZero);
    const uniswapV2Factory = UniswapV2Factory__factory.connect(UniswapV2FactoryContract.address, provider);
    const UniswapV2Router02 = await ethers.getContractFactory('UniswapV2Router02');
    const UniswapV2Router02Contract = await UniswapV2Router02.deploy(uniswapV2Factory.address, weth.address);
    const uniswapV2Router02 = UniswapV2Router02__factory.connect(UniswapV2Router02Contract.address, provider);
    const uniPairEthAmount = ethers.utils.parseEther('1');
    const uniPairAgiAmount = expandTo18Decimals(1_000_000);
    const uniPairDeadline = (await time.latest()) + ONE_DAY_IN_SECS;
    await expect(agiCoin.connect(Alice).mint(Alice.address, uniPairAgiAmount)).not.to.be.reverted;
    await expect(agiCoin.connect(Alice).approve(uniswapV2Router02.address, uniPairAgiAmount)).not.to.be.reverted;
    let trans = await uniswapV2Router02.connect(Alice).addLiquidityETH(agiCoin.address, uniPairAgiAmount, uniPairAgiAmount, uniPairEthAmount, Alice.address, uniPairDeadline, {
        value: uniPairEthAmount
    });
    await trans.wait();
    const uniPairAddress = await uniswapV2Factory.getPair(agiCoin.address, weth.address);
    const agiweth = UniswapV2Pair__factory.connect(uniPairAddress, provider);

    // Deploy Locked LP Pool
    const LockedLPPool = await ethers.getContractFactory('AGILITYFarm');
    const rewardsRate = expandTo18Decimals(1);
    const lockedLPPoolContract = await LockedLPPool.deploy(Alice.address, agiweth.address, ["ESAGI"], [esagiToken.address], [Alice.address], [rewardsRate]); // address _owner, address _stakingToken, string[] memory _rewardSymbols, address[] memory _rewardTokens,  address[] memory _rewardManagers, uint256[] memory _rewardRates
    const lockedLPPool = AGILITYFarm__factory.connect(lockedLPPoolContract.address, provider);

    // Mint Rewards Token (erc20)
    const totalReward = expandTo18Decimals(7_000_000);
    await agiCoin.connect(Alice).mint(Alice.address, totalReward)
    // Approve contract esagi to call agi
    await expect(agiCoin.connect(Alice).approve(esagiToken.address, totalReward)).not.to.be.reverted;
    expect(await agiCoin.connect(Alice).allowance(Alice.address, esagiToken.address)).to.equal(totalReward);
    // State should be kept
    expect(await agiCoin.balanceOf(Alice.address)).to.equal(totalReward);
    await expect(esagiToken.connect(Alice).convert( totalReward)).not.to.be.reverted;
    expect( await esagiToken.connect(Alice).balanceOf(Alice.address)).to.equal(totalReward);
    // whitelist alice address to transfer esagi
    await expect(esagiToken.connect(Alice).updateTransferWhitelist(Alice.address, true)).not.to.be.reverted;
    await expect(esagiToken.connect(Alice).updateTransferWhitelist(lockedLPPool.address, true)).not.to.be.reverted;
    // transfer esagi to Locked Pool
    await (esagiToken.connect(Alice).transfer(lockedLPPool.address, totalReward))
    expect( await esagiToken.connect(Alice).balanceOf(lockedLPPool.address)).to.equal(totalReward);

    // User should be able to stake now 
    await expect(agiweth.connect(Alice).transfer(Bob.address, expandTo18Decimals(100)))
      .to.emit(agiweth, 'Transfer').withArgs(Alice.address, Bob.address, expandTo18Decimals(100));
    await expect(agiweth.connect(Alice).transfer(Caro.address, expandTo18Decimals(100)))
      .to.emit(agiweth, 'Transfer').withArgs(Alice.address, Caro.address, expandTo18Decimals(100));

    // Bob stake 30 LP for 1 day 
    const bob_stake_amount = expandTo18Decimals(30)
    await agiweth.connect(Bob).approve(lockedLPPool.address, expandTo18Decimals(100))
    await lockedLPPool.connect(Bob).stakeLocked(bob_stake_amount, 86400)
    expect(await lockedLPPool.connect(Bob).lockedLiquidityOf(Bob.address)).to.equal(bob_stake_amount);
    await time.increase(ONE_DAY_IN_SECS / 2); //time pass by 1/2 day
    // Bob can claim his rewards now but cannot withdraw LP
    let rewards_ = await lockedLPPool.connect(Bob).earned(Bob.address)
    await expect(lockedLPPool.connect(Bob).getReward()).not.to.be.reverted;
    let rewards = await esagiToken.connect(Bob).balanceOf(Bob.address) 
    let stake_history = await lockedLPPool.connect(Bob).lockedStakesOf(Bob.address)
    // console.log(stake_history[0]['kek_id'])
    await expect(lockedLPPool.connect(Bob).withdrawLocked(stake_history[0]['kek_id'])).to.be.reverted;
    await time.increase(ONE_DAY_IN_SECS / 2); //time pass by 1 day
    // Bob can withdraw LP and all rewards
    await expect(lockedLPPool.connect(Bob).withdrawLocked(stake_history[0]['kek_id'])).not.to.be.reverted;
    expect (await agiweth.connect(Bob).balanceOf(Bob.address) ).to.equal(expandTo18Decimals(100))
   
    // Bob be able to stake LP in batches for multiple times
    // Bob stake 30 LP for 1 day 
    await agiweth.connect(Bob).approve(lockedLPPool.address, expandTo18Decimals(100))
    await lockedLPPool.connect(Bob).stakeLocked(bob_stake_amount, 86400 * 1)
    // Bob stake 30 LP for 15 day
    await lockedLPPool.connect(Bob).stakeLocked(bob_stake_amount, 86400 * 15)
    // Bob stake 30 LP for 30 day
    await lockedLPPool.connect(Bob).stakeLocked(bob_stake_amount, 86400 * 30)
    expect(await lockedLPPool.connect(Bob).lockedLiquidityOf(Bob.address)).to.equal(expandTo18Decimals(90));


  });

})