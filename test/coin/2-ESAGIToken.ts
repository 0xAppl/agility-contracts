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
    const rewardStartTime = (await time.latest()) + ONE_DAY_IN_SECS;
    const rewardDurationInDays = 3;
    await expect(esagiToken.connect(Bob).redeem(10_000,  ONE_DAY_IN_SECS * rewardDurationInDays)).not.to.be.reverted;
    // Bob: cannot finalized redeem since time not reaached
    await time.increase(ONE_DAY_IN_SECS / 2);
    const redeemIndex = (await esagiToken.connect(Bob).getUserRedeemsLength(Bob.address)).toNumber() - 1
    await expect( esagiToken.connect(Bob).finalizeRedeem(redeemIndex)).to.be.revertedWith("finalizeRedeem: vesting duration has not ended yet");
    // Bob: can finalized redeem since time not reaached
    await time.increase(ONE_DAY_IN_SECS * 3);
    await expect( esagiToken.connect(Bob).finalizeRedeem(redeemIndex)).not.to.be.reverted;
    expect( await agiCoin.connect(Bob).balanceOf(Bob.address)).to.equal(5_000);
    
  })



});