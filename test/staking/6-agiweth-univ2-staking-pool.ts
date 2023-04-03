import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { ONE_DAY_IN_SECS, deployStakingPoolContractsFixture, expandTo18Decimals, expectBigNumberEquals } from '../utils';
import { StakingPool__factory } from '../../typechain/factories/contracts/StakingPool__factory';
import { UniswapV2Factory__factory } from '../../typechain/factories/contracts/test/UniswapV2Factory.sol/UniswapV2Factory__factory';
import { UniswapV2Router02__factory } from '../../typechain/factories/contracts/test/UniswapV2Router02.sol/UniswapV2Router02__factory';
import { UniswapV2Pair__factory } from '../../typechain/factories/contracts/test/UniswapV2Factory.sol/UniswapV2Pair__factory';

const { provider } = ethers;

describe('agi-weth LP Staking Pool', () => {

  it('Basic scenario works', async () => {

    const {agiCoin, esagiToken,  stakingPoolFactory, weth, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);
    const UniswapV2Factory = await ethers.getContractFactory('UniswapV2Factory');
    const UniswapV2FactoryContract = await UniswapV2Factory.deploy(ethers.constants.AddressZero);
    const uniswapV2Factory = UniswapV2Factory__factory.connect(UniswapV2FactoryContract.address, provider);

    // console.log(await provider.getBalance(Alice.address));
    const UniswapV2Router02 = await ethers.getContractFactory('UniswapV2Router02');
    const UniswapV2Router02Contract = await UniswapV2Router02.deploy(uniswapV2Factory.address, weth.address);
    const uniswapV2Router02 = UniswapV2Router02__factory.connect(UniswapV2Router02Contract.address, provider);
    const uniPairEthAmount = ethers.utils.parseEther('1');
    const uniPairAgiAmount = expandTo18Decimals(1_000_000);
    const uniPairDeadline = (await time.latest()) + ONE_DAY_IN_SECS;
    await expect(agiCoin.connect(Alice).mint(Alice.address, uniPairAgiAmount)).not.to.be.reverted;
    await expect(agiCoin.connect(Alice).approve(uniswapV2Router02.address, uniPairAgiAmount)).not.to.be.reverted;
    
    // Note: Update this value to the code hash used in test/UniswapV2Router02.sol:UniswapV2Library.pairFor()
    // const UniswapV2Pair = await ethers.getContractFactory('UniswapV2Pair');
    // console.log(ethers.utils.keccak256(UniswapV2Pair.bytecode));
    let trans = await uniswapV2Router02.connect(Alice).addLiquidityETH(agiCoin.address, uniPairAgiAmount, uniPairAgiAmount, uniPairEthAmount, Alice.address, uniPairDeadline, {
      value: uniPairEthAmount
    });
    await trans.wait();
    const uniPairAddress = await uniswapV2Factory.getPair(agiCoin.address, weth.address);
    const agiweth = UniswapV2Pair__factory.connect(uniPairAddress, provider);

    // Deploy a staking pool, starting 1 day later, and lasts for 7 days
    const rewardStartTime = (await time.latest()) + ONE_DAY_IN_SECS;
    const rewardDurationInDays = 7;
    await expect(stakingPoolFactory.connect(Alice).deployPool(agiweth.address, rewardStartTime, rewardDurationInDays))
        .to.emit(stakingPoolFactory, 'StakingPoolDeployed').withArgs(anyValue, agiweth.address, rewardStartTime, rewardDurationInDays);
    const agiwethStakingPool = StakingPool__factory.connect(await stakingPoolFactory.getStakingPoolAddress(agiweth.address), provider);
  
    // Trying to deposit rewards before start should fail
    const totalReward = expandTo18Decimals(7_000_000);
    await expect(agiCoin.connect(Alice).mint(Alice.address, totalReward)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).addRewards(agiwethStakingPool.address, totalReward)).to.be.rejectedWith(
      /StakingPoolFactory::addRewards: not ready/,
    );

    // But user should be able to stake now (without rewards)
    await expect(agiweth.connect(Alice).transfer(Bob.address, expandTo18Decimals(100)))
      .to.emit(agiweth, 'Transfer').withArgs(Alice.address, Bob.address, expandTo18Decimals(100));
    await expect(agiweth.connect(Alice).transfer(Caro.address, expandTo18Decimals(100)))
      .to.emit(agiweth, 'Transfer').withArgs(Alice.address, Caro.address, expandTo18Decimals(100));

    let bobStakeAmount = expandTo18Decimals(90);
    await expect(agiweth.connect(Bob).approve(agiwethStakingPool.address, bobStakeAmount)).not.to.be.reverted;
    await expect(agiwethStakingPool.connect(Bob).stake(bobStakeAmount)).not.to.be.reverted;
    expect(await agiwethStakingPool.totalSupply()).to.equal(bobStakeAmount);
    expect(await agiwethStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);

    // No rewards now
    await time.increase(ONE_DAY_IN_SECS / 2);
    expect(await agiwethStakingPool.earned(Bob.address)).to.equal(0);

    // Dave accidently transfer some staking token to this contract
    const daveTransferAmount = expandTo18Decimals(10);
    await expect(agiweth.connect(Alice).transfer(Dave.address, daveTransferAmount))
      .to.emit(agiweth, 'Transfer').withArgs(Alice.address, Dave.address, daveTransferAmount);
    await expect(agiweth.connect(Dave).transfer(agiwethStakingPool.address, daveTransferAmount)).not.to.be.reverted;

    // Fast-forward to reward start time, and deposit 7_000_000 $Agi as reward (1_000_000 per day)
    await time.increaseTo(rewardStartTime);
    await expect(agiCoin.connect(Alice).mint(Alice.address, totalReward)).to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Alice.address, totalReward);
    await expect(agiCoin.connect(Alice).approve(esagiToken.address, totalReward)).not.to.be.reverted;
    await expect(esagiToken.connect(Alice).convert(totalReward)).not.to.be.reverted;
    expect( await esagiToken.connect(Alice).balanceOf(Alice.address)).to.equal(totalReward);
    await expect(esagiToken.connect(Alice).approve(stakingPoolFactory.address, totalReward)).not.to.be.reverted;
    await expect(esagiToken.connect(Alice).updateTransferWhitelist(Alice.address, true)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).addRewards(agiweth.address, totalReward))
      .to.emit(agiwethStakingPool, 'RewardAdded').withArgs(totalReward);
    // Note: The exact `reward start time` is the block timestamp of `addRewards` transaction,
    // which does not exactly equal to `rewardStartTime`
    expect(await agiwethStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
    expect((await stakingPoolFactory.stakingPoolInfoByStakingToken(agiweth.address)).totalRewardsAmount).to.equal(totalReward);
    
    const caroStakeAmount = expandTo18Decimals(10);
    await expect(agiweth.connect(Caro).approve(agiwethStakingPool.address, caroStakeAmount)).not.to.be.reverted;
    await expect(agiwethStakingPool.connect(Caro).stake(caroStakeAmount)).not.to.be.reverted;
    expect(await agiwethStakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await agiwethStakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);

    // 1_000_000 $Agi per day. Fast-forward to generate rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS);
    // await time.increase(ONE_DAY_IN_SECS);
    const totalRewardPerDay = totalReward.div(rewardDurationInDays);
    expectBigNumberEquals(totalRewardPerDay.mul(9).div(10), await agiwethStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await agiwethStakingPool.earned(Caro.address));

    // Dave has no rewards
    expect(await agiwethStakingPool.balanceOf(Dave.address)).to.equal(0);
    expect(await agiwethStakingPool.earned(Dave.address)).to.equal(0);

    // Caro claim $ESAGI rewards
    await expect(esagiToken.connect(Alice).updateTransferWhitelist(agiwethStakingPool.address, true)).not.to.be.reverted;
    await expect(agiwethStakingPool.connect(Caro).getReward())
      .to.emit(agiwethStakingPool, 'RewardPaid').withArgs(Caro.address, anyValue);
    expect(await agiwethStakingPool.earned(Caro.address)).to.equal(0);
    expectBigNumberEquals(await esagiToken.balanceOf(Caro.address), totalRewardPerDay.mul(1).div(10));

    // Fast-forward 1 day. Bob's reward: 9/10 + 9/10;  Caro's reward: 1/10
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 2);
    expectBigNumberEquals(totalRewardPerDay.mul(18).div(10), await agiwethStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await agiwethStakingPool.earned(Caro.address));

    // Bob withdraw part of his staking coin
    const bobWithdrawAmount = expandTo18Decimals(50);
    bobStakeAmount = expandTo18Decimals(90 - 50);
    // Now Bob's effective staking is 40 and Caro's effective staking is 10
    await expect(agiwethStakingPool.connect(Bob).withdraw(expandTo18Decimals(100))).to.be.reverted;
    await expect(agiwethStakingPool.connect(Bob).withdraw(bobWithdrawAmount))
      .to.emit(agiwethStakingPool, 'Withdrawn').withArgs(Bob.address, bobWithdrawAmount);
    expect(await agiwethStakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await agiwethStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await agiwethStakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);
    
    // Fast-forward 1 day. Bob's reward: 9/10 + 9/10 + 8/10;  Caro's reward: 1/10 + 2/10
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 3);
    expectBigNumberEquals(totalRewardPerDay.mul(26).div(10), await agiwethStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(3).div(10), await agiwethStakingPool.earned(Caro.address));

    // 4 days remaining. Now admin could start another round of rewarding.
    // Remaining days are extended to 7;  Reward per day from now on: (7_000_000 * 4 / 7  + 14_000_000) / 7
    const round2TotalReward = expandTo18Decimals(14_000_000);
    const round2TotalRewardPerDay = totalReward.mul(4).div(7).add(round2TotalReward).div(rewardDurationInDays);
    await expect(agiCoin.connect(Alice).mint(Alice.address, round2TotalReward)).to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Alice.address, round2TotalReward);
    await expect(agiCoin.connect(Alice).approve(esagiToken.address, round2TotalReward)).not.to.be.reverted;
    await expect(esagiToken.connect(Alice).convert(round2TotalReward)).not.to.be.reverted;
    expect( await esagiToken.connect(Alice).balanceOf(Alice.address)).to.equal(round2TotalReward);
    await expect(esagiToken.connect(Alice).approve(stakingPoolFactory.address, round2TotalReward)).not.to.be.reverted;
    await expect(esagiToken.connect(Alice).updateTransferWhitelist(Alice.address, true)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).addRewards(agiweth.address, round2TotalReward))
      .to.emit(agiwethStakingPool, 'RewardAdded').withArgs(round2TotalReward);
   expect(await agiwethStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
   expect((await stakingPoolFactory.stakingPoolInfoByStakingToken(agiweth.address)).totalRewardsAmount).to.equal(totalReward.add(round2TotalReward));

    // Fast-forward 1 day. Now every day, Bob get 8/10 rewards, and Caro get 2/10 rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 4);
    const round1BobReward = totalRewardPerDay.mul(26).div(10);
    const round2CaroReward = totalRewardPerDay.mul(3).div(10);
    expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(8).div(10)), await agiwethStakingPool.earned(Bob.address));
    expectBigNumberEquals(round2CaroReward.add(round2TotalRewardPerDay.mul(2).div(10)), await agiwethStakingPool.earned(Caro.address));

    // Caro exit staking
    await expect(agiwethStakingPool.connect(Caro).exit())
      .to.emit(agiwethStakingPool, 'Withdrawn').withArgs(Caro.address, caroStakeAmount)
      .to.emit(agiwethStakingPool, 'RewardPaid').withArgs(Caro.address, anyValue);
    expect(await agiwethStakingPool.totalSupply()).to.equal(bobStakeAmount);
    expect(await agiwethStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await agiwethStakingPool.balanceOf(Caro.address)).to.equal(0);
  
    // Now bob get all the staking rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 5);
    expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(18).div(10)), await agiwethStakingPool.earned(Bob.address));
    
    // Fast-forward to round 2 finish
    await time.increaseTo(await agiwethStakingPool.periodFinish());
    const bobRewardsTillRound2 = round1BobReward.add(round2TotalRewardPerDay.mul(68).div(10));
    expectBigNumberEquals(bobRewardsTillRound2, await agiwethStakingPool.earned(Bob.address));

    // Fast-forward 1 more day. No extra rewards are generated
    await time.increaseTo(await (await agiwethStakingPool.periodFinish()).add(ONE_DAY_IN_SECS));
    expectBigNumberEquals(bobRewardsTillRound2, await agiwethStakingPool.earned(Bob.address));

    // Admin start round 3
    const round3TotalReward = expandTo18Decimals(7_000_000);
    const round3TotalRewardPerDay = round3TotalReward.div(rewardDurationInDays);
    await expect(agiCoin.connect(Alice).mint(Alice.address, round3TotalReward)).to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Alice.address, round3TotalReward);
    await expect(agiCoin.connect(Alice).approve(esagiToken.address, round3TotalReward)).not.to.be.reverted;
    await expect(esagiToken.connect(Alice).convert(round3TotalReward)).not.to.be.reverted;
    expect( await esagiToken.connect(Alice).balanceOf(Alice.address)).to.equal(round3TotalReward);
    await expect(esagiToken.connect(Alice).approve(stakingPoolFactory.address, round3TotalReward)).not.to.be.reverted;
    await expect(esagiToken.connect(Alice).updateTransferWhitelist(Alice.address, true)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).addRewards(agiweth.address, round3TotalReward))
      .to.emit(agiwethStakingPool, 'RewardAdded').withArgs(round3TotalReward);
    expect(await agiwethStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
    expect((await stakingPoolFactory.stakingPoolInfoByStakingToken(agiweth.address)).totalRewardsAmount).to.equal(totalReward.add(round2TotalReward).add(round3TotalReward));

    // Fast-forward 1 more day. Bob gets all the reward
    await time.increase(ONE_DAY_IN_SECS);
    expectBigNumberEquals(bobRewardsTillRound2.add(round3TotalRewardPerDay), await agiwethStakingPool.earned(Bob.address));

    // Fast-forward to period finish
    await time.increaseTo(await agiwethStakingPool.periodFinish());

    // Admin should be able to withdraw redundant staking tokens
    await expect(stakingPoolFactory.connect(Bob).withdrawELRewards(agiweth.address, Bob.address))
      .to.be.rejectedWith(/Ownable: caller is not the owner/);
    await expect(agiwethStakingPool.connect(Bob).withdrawELRewards(Bob.address))
      .to.be.rejectedWith(/Caller is not RewardsDistribution contract/);
    await expect(stakingPoolFactory.connect(Alice).withdrawELRewards(agiweth.address, Dave.address))
      .to.emit(agiwethStakingPool, 'ELRewardWithdrawn').withArgs(Dave.address, daveTransferAmount);
    expect(await agiweth.balanceOf(Dave.address)).to.equal(daveTransferAmount);

    // Bob should be able to exit
    await expect(agiwethStakingPool.connect(Bob).exit())
      .to.emit(agiwethStakingPool, 'Withdrawn').withArgs(Bob.address, anyValue)
      .to.emit(agiwethStakingPool, 'RewardPaid').withArgs(Bob.address, anyValue);
    expect(await agiwethStakingPool.totalSupply()).to.equal(0);
    expect(await agiwethStakingPool.balanceOf(Bob.address)).to.equal(0);
  })
})