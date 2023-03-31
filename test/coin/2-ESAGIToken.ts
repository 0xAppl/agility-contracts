import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { ONE_DAY_IN_SECS, deployStakingPoolContractsFixture, expandTo18Decimals, expectBigNumberEquals, nativeTokenAddress } from '../utils';
const { provider } = ethers;
const dayjs = require('dayjs');


describe('esAGIToken', () => {

  it('AGI convert to esAGI', async () => {
    const { agiCoin, esagiToken, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);
    // Bob: 10_000
    await expect(agiCoin.connect(Alice).mint(Bob.address, 10_000))
      .to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);
    expect(await agiCoin.totalSupply()).to.equal(10_000);
    expect(await agiCoin.balanceOf(Bob.address)).to.equal(10_000);
    // Approve contract esagi to call agi
    await expect(agiCoin.connect(Bob).approve(esagiToken.address, 10_000)).not.to.be.reverted;
    expect(await agiCoin.connect(Bob).allowance(Bob.address, esagiToken.address)).to.equal(10_000);
    // State should be kept
    expect(await agiCoin.balanceOf(Bob.address)).to.equal(10_000);
    await expect(esagiToken.connect(Bob).convert( 10_000)).not.to.be.reverted;
    expect( await esagiToken.connect(Bob).balanceOf(Bob.address)).to.equal(10_000);

  });


  it('Whitelist Transferable others Not Transferable', async () => {
    const { agiCoin, esagiToken, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);
    // Bob: 10_000
    await expect(agiCoin.connect(Alice).mint(Bob.address, 10_000))
      .to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);
    expect(await agiCoin.totalSupply()).to.equal(10_000);
    expect(await agiCoin.balanceOf(Bob.address)).to.equal(10_000);
    // Approve contract esagi to call agi
    await expect(agiCoin.connect(Bob).approve(esagiToken.address, 10_000)).not.to.be.reverted;
    expect(await agiCoin.connect(Bob).allowance(Bob.address, esagiToken.address)).to.equal(10_000);
    // State should be kept
    expect(await agiCoin.balanceOf(Bob.address)).to.equal(10_000);
    await expect(esagiToken.connect(Bob).convert( 10_000)).not.to.be.reverted;
    expect( await esagiToken.connect(Bob).balanceOf(Bob.address)).to.equal(10_000);
    await expect(esagiToken.connect(Alice).updateTransferWhitelist(Bob.address, true)).not.to.be.reverted;
    expect( await esagiToken.connect(Bob).isTransferWhitelisted(Bob.address)).to.equal(true);
    await expect(esagiToken.connect(Bob).transfer(Caro.address,10_000)).not.to.be.reverted;
    expect( await esagiToken.connect(Caro).balanceOf(Caro.address)).to.equal(10_000);
    await expect(esagiToken.connect(Caro).transfer(Dave.address,10_000)).to.be.reverted;
  });

  it('esAGI Redeem to AGI', async () => {
    const { agiCoin, esagiToken, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);
    // Bob: 10_000
    await expect(agiCoin.connect(Alice).mint(Bob.address, 10_000))
      .to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);
    expect(await agiCoin.totalSupply()).to.equal(10_000);
    expect(await agiCoin.balanceOf(Bob.address)).to.equal(10_000);
    // Approve contract esagi to call agi
    await expect(agiCoin.connect(Bob).approve(esagiToken.address, 10_000)).not.to.be.reverted;
    expect(await agiCoin.connect(Bob).allowance(Bob.address, esagiToken.address)).to.equal(10_000);
    // Bob: 10_000 esAGI
    expect(await agiCoin.balanceOf(Bob.address)).to.equal(10_000);
    await expect(esagiToken.connect(Bob).convert( 10_000)).not.to.be.reverted;
    expect( await esagiToken.connect(Bob).balanceOf(Bob.address)).to.equal(10_000);
    // Bob: redeem esAGI to AGI
    const redeemDurationInDays = 3;
    await expect(esagiToken.connect(Bob).redeem(10_000,  ONE_DAY_IN_SECS * redeemDurationInDays)).not.to.be.reverted;
    // Bob: cannot finalized redeem since time not reaached
    await time.increase(ONE_DAY_IN_SECS / 2);
    const redeemIndex = (await esagiToken.connect(Bob).getUserRedeemsLength(Bob.address)).toNumber() - 1
    await expect( esagiToken.connect(Bob).finalizeRedeem(redeemIndex)).to.be.revertedWith("finalizeRedeem: vesting duration has not ended yet");
    // Bob: can finalized redeem since time not reaached
    await time.increase(ONE_DAY_IN_SECS * 3);
    await expect( esagiToken.connect(Bob).finalizeRedeem(redeemIndex)).not.to.be.reverted;
    expect( await agiCoin.connect(Bob).balanceOf(Bob.address)).to.equal(5_000);
    
  })


  it('Cancel Redeem', async () => {
    const { agiCoin, esagiToken, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);
    // Bob: 10_000
    await expect(agiCoin.connect(Alice).mint(Bob.address, 10_000))
      .to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);
    expect(await agiCoin.totalSupply()).to.equal(10_000);
    expect(await agiCoin.balanceOf(Bob.address)).to.equal(10_000);
    // Approve contract esagi to call agi
    await expect(agiCoin.connect(Bob).approve(esagiToken.address, 10_000)).not.to.be.reverted;
    expect(await agiCoin.connect(Bob).allowance(Bob.address, esagiToken.address)).to.equal(10_000);
    // Bob: 10_000 esAGI
    expect(await agiCoin.balanceOf(Bob.address)).to.equal(10_000);
    await expect(esagiToken.connect(Bob).convert( 10_000)).not.to.be.reverted;
    expect( await esagiToken.connect(Bob).balanceOf(Bob.address)).to.equal(10_000);
    // Bob: redeem esAGI to AGI
    const redeemDurationInDays = 3;
    await expect(esagiToken.connect(Bob).redeem(10_000,  ONE_DAY_IN_SECS * redeemDurationInDays)).not.to.be.reverted;
    // Bob: can cancel  redeem since time not reaached
    await time.increase(ONE_DAY_IN_SECS / 2);
    const redeemIndex = (await esagiToken.connect(Bob).getUserRedeemsLength(Bob.address)).toNumber() - 1
    await expect( esagiToken.connect(Bob).cancelRedeem(redeemIndex)).not.to.be.reverted;
    expect( await esagiToken.connect(Bob).balanceOf(Bob.address)).to.equal(10_000);
  })


  it('Update Redeem Settings', async () => {
    const { agiCoin, esagiToken, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);
    const redeemDurationInDays = 3;
    await expect(esagiToken.connect(Alice).updateRedeemSettings(50, 100, 0, ONE_DAY_IN_SECS * redeemDurationInDays, 0)).not.to.be.reverted;
    expect( await esagiToken.connect(Bob).minRedeemRatio()).to.equal(50);
    expect( await esagiToken.connect(Bob).maxRedeemRatio()).to.equal(100);
    expect( await esagiToken.connect(Bob).minRedeemDuration()).to.equal(0);
    expect( await esagiToken.connect(Bob).maxRedeemDuration()).to.equal(ONE_DAY_IN_SECS * redeemDurationInDays);
  })


  it('Mulitple Redeem', async () => {
    const { agiCoin, esagiToken, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);
    // Bob: 10_000
    await expect(agiCoin.connect(Alice).mint(Bob.address, 10_000))
      .to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);
    expect(await agiCoin.totalSupply()).to.equal(10_000);
    expect(await agiCoin.balanceOf(Bob.address)).to.equal(10_000);
    // Approve contract esagi to call agi
    await expect(agiCoin.connect(Bob).approve(esagiToken.address, 10_000)).not.to.be.reverted;
    expect(await agiCoin.connect(Bob).allowance(Bob.address, esagiToken.address)).to.equal(10_000);
    // Bob: 10_000 esAGI
    expect(await agiCoin.balanceOf(Bob.address)).to.equal(10_000);
    await expect(esagiToken.connect(Bob).convert( 10_000)).not.to.be.reverted;
    expect( await esagiToken.connect(Bob).balanceOf(Bob.address)).to.equal(10_000);
    // Bob: redeem esAGI to AGI
    const redeemDurationIn3Days = 3;
    const redeemDurationIn14Days = 14;
    await expect(esagiToken.connect(Bob).redeem(5_000,  ONE_DAY_IN_SECS * redeemDurationIn3Days)).not.to.be.reverted;
    await expect(esagiToken.connect(Bob).redeem(5_000,  ONE_DAY_IN_SECS * redeemDurationIn14Days)).not.to.be.reverted;
    // Bob: cannot finalized redeem since time not reaached
    const redeemIndex = (await esagiToken.connect(Bob).getUserRedeemsLength(Bob.address)).toNumber() 
    console.log(redeemIndex)
    for(var i = 0; i < redeemIndex; i++){ 
      const redeemInfo = (await esagiToken.connect(Bob).getUserRedeem(Bob.address,i))
      console.log(redeemInfo)
      await time.increase(ONE_DAY_IN_SECS / 2);
      await expect(esagiToken.connect(Bob).finalizeRedeem(i)).to.be.revertedWith("finalizeRedeem: vesting duration has not ended yet");
    }
    // Bob: can finalized individual redeem since time has reaached
    await time.increase(ONE_DAY_IN_SECS * 14);
    await expect(esagiToken.connect(Bob).finalizeRedeem(0)).not.to.be.reverted;
    expect( await agiCoin.connect(Bob).balanceOf(Bob.address)).to.equal(2_500);
    const redeemIndex_update = (await esagiToken.connect(Bob).getUserRedeemsLength(Bob.address)).toNumber() - 1
    await time.increase(ONE_DAY_IN_SECS * 14);
    await expect(esagiToken.connect(Bob).finalizeRedeem(redeemIndex_update)).not.to.be.reverted;
    expect( await agiCoin.connect(Bob).balanceOf(Bob.address)).to.equal(7_500);
  })
});