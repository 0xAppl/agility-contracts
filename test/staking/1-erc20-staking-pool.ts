import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { ONE_DAY_IN_SECS, deployStakingPoolContractsFixture, expandTo18Decimals, expectBigNumberEquals, nativeTokenAddress } from '../utils';
import { StakingPool__factory } from '../../typechain/factories/contracts/StakingPool__factory';


const { provider } = ethers;
const dayjs = require('dayjs');

describe('Staking Pool', () => {

    it('Basic scenario works', async () => {

        const { agiCoin, esagiToken, stakingPoolFactory, erc20, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);

        // Deploy a staking pool, starting 1 day later, and lasts for 7 days
        const rewardStartTime = (await time.latest()) + ONE_DAY_IN_SECS;
        const rewardDurationInDays = 7;
        await expect(stakingPoolFactory.connect(Alice).deployPool(erc20.address, rewardStartTime, rewardDurationInDays))
          .to.emit(stakingPoolFactory, 'StakingPoolDeployed').withArgs(anyValue, erc20.address, rewardStartTime, rewardDurationInDays);
        const erc20StakingPool = StakingPool__factory.connect(await stakingPoolFactory.getStakingPoolAddress(erc20.address), provider);   
        
        // Trying to deposit rewards before start should fail
        const totalReward = expandTo18Decimals(7_000_000);
        await expect(agiCoin.connect(Alice).mint(Alice.address, totalReward)).not.to.be.reverted;
        await expect(stakingPoolFactory.connect(Alice).addRewards(nativeTokenAddress, totalReward)).to.be.rejectedWith(
          /StakingPoolFactory::addRewards: not ready/,
        );

        // But user should be able to stake now (without rewards)
        await expect(erc20.connect(Alice).mint(Bob.address, expandTo18Decimals(10_000))).not.to.be.reverted;
        await expect(erc20.connect(Alice).mint(Caro.address, expandTo18Decimals(10_000))).not.to.be.reverted;
        expect(await erc20.connect(Alice).balanceOf(Bob.address)).to.equal(expandTo18Decimals(10_000));
        expect(await erc20.connect(Alice).balanceOf(Caro.address)).to.equal(expandTo18Decimals(10_000));

        let bobStakeAmount = expandTo18Decimals(9_000);
        await expect(erc20.connect(Bob).approve(erc20StakingPool.address, bobStakeAmount)).not.to.be.reverted;
        await expect(erc20StakingPool.connect(Bob).stake(bobStakeAmount)).not.to.be.reverted;
        expect(await erc20StakingPool.totalSupply()).to.equal(bobStakeAmount);
        expect(await erc20StakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);

        // No rewards now
        await time.increase(ONE_DAY_IN_SECS / 2);
        expect(await erc20StakingPool.earned(Bob.address)).to.equal(0);

        // Dave accidently transfer some staking token to this contract
        const daveTransferAmount = expandTo18Decimals(100);
        await expect(erc20.connect(Alice).mint(Dave.address, daveTransferAmount)).not.to.be.reverted;
        await expect(erc20.connect(Dave).transfer(erc20StakingPool.address, daveTransferAmount)).not.to.be.reverted;

        // Fast-forward to reward start time, and deposit 7_000_000 $AGI as reward (1_000_000 per day)
        await time.increaseTo(rewardStartTime);

        // mint AGI and convert to esAGI
        await expect(agiCoin.connect(Alice).mint(Alice.address, totalReward)).to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Alice.address, totalReward);
        await expect(agiCoin.connect(Alice).approve(esagiToken.address, totalReward)).not.to.be.reverted;
        await expect(esagiToken.connect(Alice).convert(totalReward)).not.to.be.reverted;
        expect( await esagiToken.connect(Alice).balanceOf(Alice.address)).to.equal(totalReward);
        await expect(esagiToken.connect(Alice).approve(stakingPoolFactory.address, totalReward)).not.to.be.reverted;
        await expect(esagiToken.connect(Alice).updateTransferWhitelist(Alice.address, true)).not.to.be.reverted;
        await expect(stakingPoolFactory.connect(Alice).addRewards(erc20.address, totalReward))
          .to.emit(erc20StakingPool, 'RewardAdded').withArgs(totalReward);
        // Note: The exact `reward start time` is the block timestamp of `addRewards` transaction,
        // which does not exactly equal to `rewardStartTime`
        expect(await erc20StakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
        expect((await stakingPoolFactory.stakingPoolInfoByStakingToken(erc20.address)).totalRewardsAmount).to.equal(totalReward);
        const caroStakeAmount = expandTo18Decimals(1_000);
        await expect(erc20.connect(Caro).approve(erc20StakingPool.address, caroStakeAmount)).not.to.be.reverted;
        await expect(erc20StakingPool.connect(Caro).stake(caroStakeAmount)).not.to.be.reverted;
        expect(await erc20StakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
        expect(await erc20StakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);

        // 1_000_000 $LSD per day. Fast-forward to generate rewards
        await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS);
        const totalRewardPerDay = totalReward.div(rewardDurationInDays);
        expectBigNumberEquals(totalRewardPerDay.mul(9).div(10), await erc20StakingPool.earned(Bob.address));
        expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await erc20StakingPool.earned(Caro.address));

        // Dave has no rewards
        expect(await erc20StakingPool.balanceOf(Dave.address)).to.equal(0);
        expect(await erc20StakingPool.earned(Dave.address)).to.equal(0);

        // Caro claim $esAGI rewards
        await expect(esagiToken.connect(Alice).updateTransferWhitelist(erc20StakingPool.address, true)).not.to.be.reverted;
        await expect(erc20StakingPool.connect(Caro).getReward())
        .to.emit(erc20StakingPool, 'RewardPaid').withArgs(Caro.address, anyValue);
        expect(await erc20StakingPool.earned(Caro.address)).to.equal(0);
        expectBigNumberEquals(await esagiToken.balanceOf(Caro.address), totalRewardPerDay.mul(1).div(10));

        // Fast-forward 1 day. Bob's reward: 9/10 + 9/10;  Caro's reward: 1/10
        await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 2);
        expectBigNumberEquals(totalRewardPerDay.mul(18).div(10), await erc20StakingPool.earned(Bob.address));
        expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await erc20StakingPool.earned(Caro.address));

        // Bob withdraw part of his staking coin
        const bobWithdrawAmount = expandTo18Decimals(5000);
        bobStakeAmount = expandTo18Decimals(9000 - 5000);
        // Now Bob's effective staking is 4000 and Caro's effective staking is 1000
        await expect(erc20StakingPool.connect(Bob).withdraw(expandTo18Decimals(10_000))).to.be.reverted;
        await expect(erc20StakingPool.connect(Bob).withdraw(bobWithdrawAmount))
          .to.emit(erc20StakingPool, 'Withdrawn').withArgs(Bob.address, bobWithdrawAmount);
        expect(await erc20StakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
        expect(await erc20StakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
        expect(await erc20StakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);

        // Fast-forward 1 day. Bob's reward: 9/10 + 9/10 + 8/10;  Caro's reward: 1/10 + 2/10
        await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 3);
        expectBigNumberEquals(totalRewardPerDay.mul(26).div(10), await erc20StakingPool.earned(Bob.address));
        expectBigNumberEquals(totalRewardPerDay.mul(3).div(10), await erc20StakingPool.earned(Caro.address));

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
         await expect(stakingPoolFactory.connect(Alice).addRewards(erc20.address, round2TotalReward))
           .to.emit(erc20StakingPool, 'RewardAdded').withArgs(round2TotalReward);
        expect(await erc20StakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
        expect((await stakingPoolFactory.stakingPoolInfoByStakingToken(erc20.address)).totalRewardsAmount).to.equal(totalReward.add(round2TotalReward));

        // Fast-forward 1 day. Now every day, Bob get 8/10 rewards, and Caro get 2/10 rewards
        await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 4);
        const round1BobReward = totalRewardPerDay.mul(26).div(10);
        const round2CaroReward = totalRewardPerDay.mul(3).div(10);
        expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(8).div(10)), await erc20StakingPool.earned(Bob.address));
        expectBigNumberEquals(round2CaroReward.add(round2TotalRewardPerDay.mul(2).div(10)), await erc20StakingPool.earned(Caro.address));

        // Caro exit staking
        await expect(erc20StakingPool.connect(Caro).exit())
          .to.emit(erc20StakingPool, 'Withdrawn').withArgs(Caro.address, caroStakeAmount)
          .to.emit(erc20StakingPool, 'RewardPaid').withArgs(Caro.address, anyValue);
        expect(await erc20StakingPool.totalSupply()).to.equal(bobStakeAmount);
        expect(await erc20StakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
        expect(await erc20StakingPool.balanceOf(Caro.address)).to.equal(0);

        // Now bob get all the staking rewards
        await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 5);
        expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(18).div(10)), await erc20StakingPool.earned(Bob.address));
        
        // Fast-forward to round 2 finish
        await time.increaseTo(await erc20StakingPool.periodFinish());
        const bobRewardsTillRound2 = round1BobReward.add(round2TotalRewardPerDay.mul(68).div(10));
        expectBigNumberEquals(bobRewardsTillRound2, await erc20StakingPool.earned(Bob.address));

        // Fast-forward 1 more day. No extra rewards are generated
        await time.increaseTo(await (await erc20StakingPool.periodFinish()).add(ONE_DAY_IN_SECS));
        expectBigNumberEquals(bobRewardsTillRound2, await erc20StakingPool.earned(Bob.address));

        // Admin start round 3
        const round3TotalReward = expandTo18Decimals(7_000_000);
        const round3TotalRewardPerDay = round3TotalReward.div(rewardDurationInDays);
        await expect(agiCoin.connect(Alice).mint(Alice.address, round3TotalReward)).to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Alice.address, round3TotalReward);
        await expect(agiCoin.connect(Alice).approve(esagiToken.address, round3TotalReward)).not.to.be.reverted;
        await expect(esagiToken.connect(Alice).convert(round3TotalReward)).not.to.be.reverted;
        expect( await esagiToken.connect(Alice).balanceOf(Alice.address)).to.equal(round3TotalReward);
        await expect(esagiToken.connect(Alice).approve(stakingPoolFactory.address, round3TotalReward)).not.to.be.reverted;
        await expect(esagiToken.connect(Alice).updateTransferWhitelist(Alice.address, true)).not.to.be.reverted;
        await expect(stakingPoolFactory.connect(Alice).addRewards(erc20.address, round3TotalReward))
          .to.emit(erc20StakingPool, 'RewardAdded').withArgs(round3TotalReward);
        expect(await erc20StakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
        expect((await stakingPoolFactory.stakingPoolInfoByStakingToken(erc20.address)).totalRewardsAmount).to.equal(totalReward.add(round2TotalReward).add(round3TotalReward));

        // Fast-forward 1 more day. Bob gets all the reward
        await time.increase(ONE_DAY_IN_SECS);
        expectBigNumberEquals(bobRewardsTillRound2.add(round3TotalRewardPerDay), await erc20StakingPool.earned(Bob.address));

        // Fast-forward to period finish
        await time.increaseTo(await erc20StakingPool.periodFinish());

        // Admin should be able to withdraw redundant staking tokens
        await expect(stakingPoolFactory.connect(Bob).withdrawELRewards(erc20.address, Bob.address))
          .to.be.rejectedWith(/Ownable: caller is not the owner/);
        await expect(erc20StakingPool.connect(Bob).withdrawELRewards(Bob.address))
          .to.be.rejectedWith(/Caller is not RewardsDistribution contract/);
        await expect(stakingPoolFactory.connect(Alice).withdrawELRewards(erc20.address, Dave.address))
          .to.emit(erc20StakingPool, 'ELRewardWithdrawn').withArgs(Dave.address, daveTransferAmount);
        expect(await erc20.balanceOf(Dave.address)).to.equal(daveTransferAmount);

        // Bob should be able to exit
        await expect(erc20StakingPool.connect(Bob).exit())
          .to.emit(erc20StakingPool, 'Withdrawn').withArgs(Bob.address, anyValue)
          .to.emit(erc20StakingPool, 'RewardPaid').withArgs(Bob.address, anyValue);
        expect(await erc20StakingPool.totalSupply()).to.equal(0);
        expect(await erc20StakingPool.balanceOf(Bob.address)).to.equal(0);

        });



});