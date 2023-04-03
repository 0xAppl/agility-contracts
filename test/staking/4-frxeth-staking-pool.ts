import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { ONE_DAY_IN_SECS, deployStakingPoolContractsFixture, expandTo18Decimals, expectBigNumberEquals} from '../utils';
import { StakingPool__factory } from '../../typechain/factories/contracts/StakingPool__factory';

const { provider } = ethers;
const dayjs = require('dayjs');

describe('frxETH Staking Pool', () => {

    it('Basic scenario works', async () => {

        const { agiCoin, esagiToken, stakingPoolFactory, frxETH, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);

        // Deploy a staking pool, starting 1 day later, and lasts for 7 days
        const rewardStartTime = (await time.latest()) + ONE_DAY_IN_SECS;
        const rewardDurationInDays = 7;
        await expect(stakingPoolFactory.connect(Alice).deployPool(frxETH.address, rewardStartTime, rewardDurationInDays))
          .to.emit(stakingPoolFactory, 'StakingPoolDeployed').withArgs(anyValue, frxETH.address, rewardStartTime, rewardDurationInDays);
        const frxETHStakingPool = StakingPool__factory.connect(await stakingPoolFactory.getStakingPoolAddress(frxETH.address), provider);
       
        // Trying to deposit rewards before start should fail
        const totalReward = expandTo18Decimals(7_000_000);
        await expect(agiCoin.connect(Alice).mint(Alice.address, totalReward)).not.to.be.reverted;
        await expect(stakingPoolFactory.connect(Alice).addRewards(frxETH.address, totalReward)).to.be.rejectedWith(
          /StakingPoolFactory::addRewards: not ready/,
        );

        // But user should be able to stake now (without rewards)
        let bobStakeAmount = ethers.utils.parseEther('9000');
        await expect(frxETH.connect(Alice).addMinter(Alice.address))
        .to.emit(frxETH, 'MinterAdded').withArgs(Alice.address);
      await expect(frxETH.connect(Alice).minter_mint(Bob.address, expandTo18Decimals(10_000)))
        .to.emit(frxETH, 'TokenMinterMinted').withArgs(Alice.address, Bob.address, expandTo18Decimals(10_000));
      await expect(frxETH.connect(Alice).minter_mint(Caro.address, expandTo18Decimals(10_000)))
        .to.emit(frxETH, 'TokenMinterMinted').withArgs(Alice.address, Caro.address, expandTo18Decimals(10_000));  
        await expect(frxETH.connect(Caro).approve(frxETHStakingPool.address, bobStakeAmount)).not.to.be.reverted;
        await expect(frxETH.connect(Bob).approve(frxETHStakingPool.address, bobStakeAmount)).not.to.be.reverted;
        await expect(frxETHStakingPool.connect(Bob).stake(bobStakeAmount)).not.to.be.reverted;
        expect(await frxETHStakingPool.totalSupply()).to.equal(bobStakeAmount);
        expect(await frxETHStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);

        // No rewards now
        await time.increase(ONE_DAY_IN_SECS / 2);
        expect(await frxETHStakingPool.earned(Bob.address)).to.equal(0);

        // Dave accidently transfer some staking token to this contract
        const daveTransferAmount = expandTo18Decimals(100);
        await expect(frxETH.connect(Alice).minter_mint(Dave.address, expandTo18Decimals(100)))
        .to.emit(frxETH, 'TokenMinterMinted').withArgs(Alice.address, Dave.address, expandTo18Decimals(100));
        await expect(frxETH.connect(Dave).transfer(frxETHStakingPool.address, daveTransferAmount)).not.to.be.reverted;

        // Fast-forward to reward start time, and deposit 7_000_000 $AGI as reward (1_000_000 per day)
        await time.increaseTo(rewardStartTime);

        // mint AGI and convert to esAGI
        await expect(agiCoin.connect(Alice).mint(Alice.address, totalReward)).to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Alice.address, totalReward);
        await expect(agiCoin.connect(Alice).approve(esagiToken.address, totalReward)).not.to.be.reverted;
        await expect(esagiToken.connect(Alice).convert(totalReward)).not.to.be.reverted;
        expect( await esagiToken.connect(Alice).balanceOf(Alice.address)).to.equal(totalReward);
        await expect(esagiToken.connect(Alice).approve(stakingPoolFactory.address, totalReward)).not.to.be.reverted;
        await expect(esagiToken.connect(Alice).updateTransferWhitelist(Alice.address, true)).not.to.be.reverted;
        await expect(stakingPoolFactory.connect(Alice).addRewards(frxETH.address, totalReward))
          .to.emit(frxETHStakingPool, 'RewardAdded').withArgs(totalReward);
        // Note: The exact `reward start time` is the block timestamp of `addRewards` transaction,
        // which does not exactly equal to `rewardStartTime`
        expect(await frxETHStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
        expect((await stakingPoolFactory.stakingPoolInfoByStakingToken(frxETH.address)).totalRewardsAmount).to.equal(totalReward);
        const caroStakeAmount = expandTo18Decimals(1_000);
        await expect(frxETH.connect(Caro).approve(frxETHStakingPool.address, caroStakeAmount)).not.to.be.reverted;
        await expect(frxETHStakingPool.connect(Caro).stake(caroStakeAmount)).not.to.be.reverted;
        expect(await frxETHStakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
        expect(await frxETHStakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);

        // 1_000_000 $LSD per day. Fast-forward to generate rewards
        await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS);
        const totalRewardPerDay = totalReward.div(rewardDurationInDays);
        expectBigNumberEquals(totalRewardPerDay.mul(9).div(10), await frxETHStakingPool.earned(Bob.address));
        expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await frxETHStakingPool.earned(Caro.address));

        // Dave has no rewards
        expect(await frxETHStakingPool.balanceOf(Dave.address)).to.equal(0);
        expect(await frxETHStakingPool.earned(Dave.address)).to.equal(0);

        // Caro claim $esAGI rewards
        await expect(esagiToken.connect(Alice).updateTransferWhitelist(frxETHStakingPool.address, true)).not.to.be.reverted;
        await expect(frxETHStakingPool.connect(Caro).getReward())
        .to.emit(frxETHStakingPool, 'RewardPaid').withArgs(Caro.address, anyValue);
        expect(await frxETHStakingPool.earned(Caro.address)).to.equal(0);
        expectBigNumberEquals(await esagiToken.balanceOf(Caro.address), totalRewardPerDay.mul(1).div(10));

        // Fast-forward 1 day. Bob's reward: 9/10 + 9/10;  Caro's reward: 1/10
        await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 2);
        expectBigNumberEquals(totalRewardPerDay.mul(18).div(10), await frxETHStakingPool.earned(Bob.address));
        expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await frxETHStakingPool.earned(Caro.address));

        // Bob withdraw part of his staking coin
        const bobWithdrawAmount = expandTo18Decimals(5000);
        bobStakeAmount = expandTo18Decimals(9000 - 5000);
        // Now Bob's effective staking is 4000 and Caro's effective staking is 1000
        await expect(frxETHStakingPool.connect(Bob).withdraw(expandTo18Decimals(10_000))).to.be.reverted;
        await expect(frxETHStakingPool.connect(Bob).withdraw(bobWithdrawAmount))
          .to.emit(frxETHStakingPool, 'Withdrawn').withArgs(Bob.address, bobWithdrawAmount);
        expect(await frxETHStakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
        expect(await frxETHStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
        expect(await frxETHStakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);

        // Fast-forward 1 day. Bob's reward: 9/10 + 9/10 + 8/10;  Caro's reward: 1/10 + 2/10
        await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 3);
        expectBigNumberEquals(totalRewardPerDay.mul(26).div(10), await frxETHStakingPool.earned(Bob.address));
        expectBigNumberEquals(totalRewardPerDay.mul(3).div(10), await frxETHStakingPool.earned(Caro.address));

        // 4 days remaining. Now admin could start another round of rewarding.
        // Remaining days are extended to 7;  Reward per day from now on: (7_000_000 * 4 / 7  + 14_000_000) / 7
        const round2TotalReward = expandTo18Decimals(14_000_000);
        const round2TotalRewardPerDay = totalReward.mul(4).div(7).add(round2TotalReward).div(rewardDurationInDays);

         // mint AGI and convert to esAGI
         await expect(agiCoin.connect(Alice).mint(Alice.address, round2TotalReward)).to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Alice.address, round2TotalReward);
         await expect(agiCoin.connect(Alice).approve(esagiToken.address, round2TotalReward)).not.to.be.reverted;
         await expect(esagiToken.connect(Alice).convert(round2TotalReward)).not.to.be.reverted;
         expect( await esagiToken.connect(Alice).balanceOf(Alice.address)).to.equal(round2TotalReward);
         await expect(esagiToken.connect(Alice).approve(stakingPoolFactory.address, round2TotalReward)).not.to.be.reverted;
         await expect(esagiToken.connect(Alice).updateTransferWhitelist(Alice.address, true)).not.to.be.reverted;
         await expect(stakingPoolFactory.connect(Alice).addRewards(frxETH.address, round2TotalReward))
           .to.emit(frxETHStakingPool, 'RewardAdded').withArgs(round2TotalReward);
        expect(await frxETHStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
        expect((await stakingPoolFactory.stakingPoolInfoByStakingToken(frxETH.address)).totalRewardsAmount).to.equal(totalReward.add(round2TotalReward));

        // Fast-forward 1 day. Now every day, Bob get 8/10 rewards, and Caro get 2/10 rewards
        await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 4);
        const round1BobReward = totalRewardPerDay.mul(26).div(10);
        const round2CaroReward = totalRewardPerDay.mul(3).div(10);
        expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(8).div(10)), await frxETHStakingPool.earned(Bob.address));
        expectBigNumberEquals(round2CaroReward.add(round2TotalRewardPerDay.mul(2).div(10)), await frxETHStakingPool.earned(Caro.address));

        // Caro exit staking
        await expect(frxETHStakingPool.connect(Caro).exit())
          .to.emit(frxETHStakingPool, 'Withdrawn').withArgs(Caro.address, caroStakeAmount)
          .to.emit(frxETHStakingPool, 'RewardPaid').withArgs(Caro.address, anyValue);
        expect(await frxETHStakingPool.totalSupply()).to.equal(bobStakeAmount);
        expect(await frxETHStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
        expect(await frxETHStakingPool.balanceOf(Caro.address)).to.equal(0);

        // Now bob get all the staking rewards
        await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 5);
        expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(18).div(10)), await frxETHStakingPool.earned(Bob.address));
        
        // Fast-forward to round 2 finish
        await time.increaseTo(await frxETHStakingPool.periodFinish());
        const bobRewardsTillRound2 = round1BobReward.add(round2TotalRewardPerDay.mul(68).div(10));
        expectBigNumberEquals(bobRewardsTillRound2, await frxETHStakingPool.earned(Bob.address));

        // Fast-forward 1 more day. No extra rewards are generated
        await time.increaseTo(await (await frxETHStakingPool.periodFinish()).add(ONE_DAY_IN_SECS));
        expectBigNumberEquals(bobRewardsTillRound2, await frxETHStakingPool.earned(Bob.address));

        // Admin start round 3
        const round3TotalReward = expandTo18Decimals(7_000_000);
        const round3TotalRewardPerDay = round3TotalReward.div(rewardDurationInDays);
        await expect(agiCoin.connect(Alice).mint(Alice.address, round3TotalReward)).to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Alice.address, round3TotalReward);
        await expect(agiCoin.connect(Alice).approve(esagiToken.address, round3TotalReward)).not.to.be.reverted;
        await expect(esagiToken.connect(Alice).convert(round3TotalReward)).not.to.be.reverted;
        expect( await esagiToken.connect(Alice).balanceOf(Alice.address)).to.equal(round3TotalReward);
        await expect(esagiToken.connect(Alice).approve(stakingPoolFactory.address, round3TotalReward)).not.to.be.reverted;
        await expect(esagiToken.connect(Alice).updateTransferWhitelist(Alice.address, true)).not.to.be.reverted;
        await expect(stakingPoolFactory.connect(Alice).addRewards(frxETH.address, round3TotalReward))
          .to.emit(frxETHStakingPool, 'RewardAdded').withArgs(round3TotalReward);
        expect(await frxETHStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
        expect((await stakingPoolFactory.stakingPoolInfoByStakingToken(frxETH.address)).totalRewardsAmount).to.equal(totalReward.add(round2TotalReward).add(round3TotalReward));

        // Fast-forward 1 more day. Bob gets all the reward
        await time.increase(ONE_DAY_IN_SECS);
        expectBigNumberEquals(bobRewardsTillRound2.add(round3TotalRewardPerDay), await frxETHStakingPool.earned(Bob.address));

        // Fast-forward to period finish
        await time.increaseTo(await frxETHStakingPool.periodFinish());

        // Admin should be able to withdraw redundant staking tokens
        await expect(stakingPoolFactory.connect(Bob).withdrawELRewards(frxETH.address, Bob.address))
          .to.be.rejectedWith(/Ownable: caller is not the owner/);
        await expect(frxETHStakingPool.connect(Bob).withdrawELRewards(Bob.address))
          .to.be.rejectedWith(/Caller is not RewardsDistribution contract/);
        await expect(stakingPoolFactory.connect(Alice).withdrawELRewards(frxETH.address, Dave.address))
          .to.emit(frxETHStakingPool, 'ELRewardWithdrawn').withArgs(Dave.address, daveTransferAmount);
        expect(await frxETH.balanceOf(Dave.address)).to.equal(daveTransferAmount);

        // Bob should be able to exit
        await expect(frxETHStakingPool.connect(Bob).exit())
          .to.emit(frxETHStakingPool, 'Withdrawn').withArgs(Bob.address, anyValue)
          .to.emit(frxETHStakingPool, 'RewardPaid').withArgs(Bob.address, anyValue);
        expect(await frxETHStakingPool.totalSupply()).to.equal(0);
        expect(await frxETHStakingPool.balanceOf(Bob.address)).to.equal(0);

        });


    it('Discontinued staking works', async () => {
      
      const { agiCoin, esagiToken, stakingPoolFactory, frxETH, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);

    // Deploy a staking pool, starting 1 day later, and lasts for 7 days
    const rewardStartTime = (await time.latest()) + ONE_DAY_IN_SECS;
    const rewardDurationInDays = 7;
    await expect(stakingPoolFactory.connect(Alice).deployPool(frxETH.address, rewardStartTime, rewardDurationInDays))
      .to.emit(stakingPoolFactory, 'StakingPoolDeployed').withArgs(anyValue, frxETH.address, rewardStartTime, rewardDurationInDays);
    const frxETHStakingPool = StakingPool__factory.connect(await stakingPoolFactory.getStakingPoolAddress(frxETH.address), provider);
    await expect(frxETH.connect(Alice).addMinter(Alice.address))
    .to.emit(frxETH, 'MinterAdded').withArgs(Alice.address);
    await expect(frxETH.connect(Alice).minter_mint(Bob.address, expandTo18Decimals(9_000)))
        .to.emit(frxETH, 'TokenMinterMinted').withArgs(Alice.address, Bob.address, expandTo18Decimals(9_000));
    await expect(frxETH.connect(Alice).minter_mint(Caro.address, expandTo18Decimals(9_000)))
        .to.emit(frxETH, 'TokenMinterMinted').withArgs(Alice.address, Caro.address, expandTo18Decimals(9_000));


    // Fast-forward to reward start time, and deposit 7_000_000 $LSD as reward (1_000_000 per day)
    await time.increaseTo(rewardStartTime);
    const totalReward = expandTo18Decimals(7_000_000);

    await expect(agiCoin.connect(Alice).mint(Alice.address, totalReward)).to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Alice.address, totalReward);
    await expect(agiCoin.connect(Alice).approve(esagiToken.address, totalReward)).not.to.be.reverted;
    await expect(esagiToken.connect(Alice).convert(totalReward)).not.to.be.reverted;
    expect( await esagiToken.connect(Alice).balanceOf(Alice.address)).to.equal(totalReward);
    await expect(esagiToken.connect(Alice).approve(stakingPoolFactory.address, totalReward)).not.to.be.reverted;
    await expect(esagiToken.connect(Alice).updateTransferWhitelist(Alice.address, true)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).addRewards(frxETH.address, totalReward))
      .to.emit(frxETHStakingPool, 'RewardAdded').withArgs(totalReward);
    // Note: The exact `reward start time` is the block timestamp of `addRewards` transaction,
    // which does not exactly equal to `rewardStartTime`
    expect(await frxETHStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
    expect((await stakingPoolFactory.stakingPoolInfoByStakingToken(frxETH.address)).totalRewardsAmount).to.equal(totalReward);

    // Fast-forward by one day, with no staking
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS);
    expect(await frxETHStakingPool.totalSupply()).to.equal(0);

    let bobStakeAmount = expandTo18Decimals(9_000);
    await expect(frxETH.connect(Bob).approve(frxETHStakingPool.address, bobStakeAmount)).not.to.be.reverted;
    await expect(frxETHStakingPool.connect(Bob).stake(bobStakeAmount)).not.to.be.reverted;
    expect(await frxETHStakingPool.totalSupply()).to.equal(bobStakeAmount);
    expect(await frxETHStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);

    // Fast-forward by one day
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 2);

    // Bob should get 1 day reward
    const totalRewardPerDay = totalReward.div(rewardDurationInDays);
    expectBigNumberEquals(totalRewardPerDay, await frxETHStakingPool.earned(Bob.address));

    // Fast-forward to end
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 8);

    // Bob exit
    await expect(esagiToken.connect(Alice).updateTransferWhitelist(frxETHStakingPool.address, true)).not.to.be.reverted;
    await expect(frxETHStakingPool.connect(Bob).exit())
    .to.emit(frxETHStakingPool, 'Withdrawn').withArgs(Bob.address, anyValue)
    .to.emit(frxETHStakingPool, 'RewardPaid').withArgs(Bob.address, anyValue);
    expect(await frxETHStakingPool.totalSupply()).to.equal(0);
    expect(await frxETHStakingPool.balanceOf(Bob.address)).to.equal(0);

    // 1 day rewards remains in the pool
    expectBigNumberEquals(totalRewardPerDay, await esagiToken.balanceOf(frxETHStakingPool.address));
    });

    it('Deploying StakingPool fails if called twice for same token', async () => {

      const { stakingPoolFactory, frxETH, Alice } = await loadFixture(deployStakingPoolContractsFixture);
  
      const rewardStartTime = (await time.latest()) + ONE_DAY_IN_SECS;
      const rewardDurationInDays = 7;
      await expect(stakingPoolFactory.connect(Alice).deployPool(frxETH.address, rewardStartTime, rewardDurationInDays))
        .to.emit(stakingPoolFactory, 'StakingPoolDeployed').withArgs(anyValue, frxETH.address, rewardStartTime, rewardDurationInDays);
  
      await expect(stakingPoolFactory.connect(Alice).deployPool(frxETH.address, rewardStartTime, rewardDurationInDays))
        .to.be.rejectedWith(
          /StakingPoolFactory::deployPool: already deployed/,
        );
  
    });

    it('Deploying StakingPool can only be called by the owner', async () => {

      const { stakingPoolFactory, frxETH, Bob } = await loadFixture(deployStakingPoolContractsFixture);
      const rewardStartTime = (await time.latest()) + ONE_DAY_IN_SECS;
      const rewardDurationInDays = 7;
      await expect(stakingPoolFactory.connect(Bob).deployPool(frxETH.address, rewardStartTime, rewardDurationInDays))
        .to.be.rejectedWith(
          /Ownable: caller is not the owner/,
        );
  
    });


    it('Ownership can be transferred', async () => {
      const { agiCoin, esagiToken, stakingPoolFactory, frxETH, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);
  
      // Bob should fail to deploy a pool
      const rewardStartTime = (await time.latest()) + ONE_DAY_IN_SECS;
      const rewardDurationInDays = 7;
      await expect(stakingPoolFactory.connect(Bob).deployPool(frxETH.address, rewardStartTime, rewardDurationInDays))
        .to.be.rejectedWith(/Ownable: caller is not the owner/);
  
      // Alice transfer ownership to Bob
      await expect(stakingPoolFactory.connect(Alice).transferOwnership(Bob.address))
        .to.emit(stakingPoolFactory, 'OwnershipTransferred').withArgs(Alice.address, Bob.address);
  
      // Alice lose ownership
      await expect(stakingPoolFactory.connect(Alice).deployPool(frxETH.address, rewardStartTime, rewardDurationInDays))
        .to.be.rejectedWith(/Ownable: caller is not the owner/);
  
      // Bob should be able to call admin functions
      await expect(stakingPoolFactory.connect(Bob).deployPool(frxETH.address, rewardStartTime, rewardDurationInDays))
        .to.emit(stakingPoolFactory, 'StakingPoolDeployed').withArgs(anyValue, frxETH.address, rewardStartTime, rewardDurationInDays);
      const frxETHStakingPool = StakingPool__factory.connect(await stakingPoolFactory.getStakingPoolAddress(frxETH.address), provider);
  
      const totalReward = expandTo18Decimals(1_000_000);
      await expect(agiCoin.connect(Alice).mint(Alice.address, totalReward)).to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Alice.address, totalReward);
      await expect(agiCoin.connect(Alice).mint(Bob.address, totalReward)).to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, totalReward);
      await time.increaseTo(rewardStartTime);
      await expect(agiCoin.connect(Alice).approve(esagiToken.address, totalReward)).not.to.be.reverted;
      await expect(agiCoin.connect(Bob).approve(esagiToken.address, totalReward)).not.to.be.reverted;

      await expect(esagiToken.connect(Alice).convert(totalReward)).not.to.be.reverted;
      expect( await esagiToken.connect(Alice).balanceOf(Alice.address)).to.equal(totalReward);
      await expect(esagiToken.connect(Bob).convert(totalReward)).not.to.be.reverted;
      expect( await esagiToken.connect(Bob).balanceOf(Bob.address)).to.equal(totalReward);

      await expect(esagiToken.connect(Alice).approve(stakingPoolFactory.address, totalReward)).not.to.be.reverted;
      await expect(esagiToken.connect(Bob).approve(stakingPoolFactory.address, totalReward)).not.to.be.reverted;

      await expect(esagiToken.connect(Alice).updateTransferWhitelist(Alice.address, true)).not.to.be.reverted;
      await expect(esagiToken.connect(Alice).updateTransferWhitelist(Bob.address, true)).not.to.be.reverted;
      // Only Bob should be able to add rewards or deposit el rewards
      await expect(stakingPoolFactory.connect(Alice).addRewards(frxETH.address, totalReward))
        .to.be.rejectedWith(/Ownable: caller is not the owner/);
      await expect(stakingPoolFactory.connect(Bob).addRewards(frxETH.address, totalReward))
        .to.emit(frxETHStakingPool, 'RewardAdded').withArgs(totalReward);
    });

});