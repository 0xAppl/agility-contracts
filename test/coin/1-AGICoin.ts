import _ from 'lodash';
import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployStakingPoolContractsFixture } from '../utils';

describe('AGICoin', () => {

  it('Mintable, transferable and burnable', async () => {

    const { agiCoin, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);

    // Bob: 10_000
    await expect(agiCoin.connect(Alice).mint(Bob.address, 10_000))
      .to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);
    expect(await agiCoin.totalSupply()).to.equal(10_000);
    expect(await agiCoin.balanceOf(Bob.address)).to.equal(10_000);

    // Bob: 10_000, Caro: 1_000
    await expect(agiCoin.connect(Alice).mint(Caro.address, 1_000))
      .to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Caro.address, 1_000);
    expect(await agiCoin.totalSupply()).to.equal(10_000 + 1_000);
    expect(await agiCoin.balanceOf(Caro.address)).to.equal(1_000);

    // Bob: 10_000, Caro: 900, Dave: 100
    await expect(agiCoin.connect(Caro).transfer(Dave.address, 100))
      .to.emit(agiCoin, 'Transfer').withArgs(Caro.address, Dave.address, 100);
    expect(await agiCoin.balanceOf(Caro.address)).to.equal(900);
    expect(await agiCoin.balanceOf(Dave.address)).to.equal(100);

    // Bob: 10_000, Caro: 800, Dave: 100
    await expect(agiCoin.connect(Caro).burn(100))
      .to.emit(agiCoin, 'Transfer').withArgs(Caro.address, ethers.constants.AddressZero, 100);
    expect(await agiCoin.balanceOf(Caro.address)).to.equal(800);

    // Bob: 10_000, Caro: 700, Dave: 200
    await expect(agiCoin.connect(Caro).approve(Dave.address, 100))
      .to.emit(agiCoin, 'Approval').withArgs(Caro.address, Dave.address, 100);
    await expect(agiCoin.connect(Dave).transferFrom(Caro.address, Dave.address, 100))
      .to.emit(agiCoin, 'Transfer').withArgs(Caro.address, Dave.address, 100);
    expect(await agiCoin.balanceOf(Caro.address)).to.equal(700);
    expect(await agiCoin.balanceOf(Dave.address)).to.equal(200);

  });


  it('Pausable', async () => {

    const { agiCoin, Alice, Bob, Caro } = await loadFixture(deployStakingPoolContractsFixture);

    await expect(agiCoin.connect(Alice).mint(Bob.address, 10_000))
      .to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);

    await expect(agiCoin.connect(Alice).mint(Caro.address, 1_000))
      .to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Caro.address, 1_000);

    await expect(agiCoin.connect(Bob).transfer(Caro.address, 1_000))
      .to.emit(agiCoin, 'Transfer').withArgs(Bob.address, Caro.address, 1_000);

    await expect(agiCoin.connect(Alice).pause())
      .to.emit(agiCoin, 'Paused').withArgs(Alice.address);

    await expect(agiCoin.connect(Alice).mint(Caro.address, 1_000)).to.be.rejectedWith(
      /Pausable: paused/,
    );

    await expect(agiCoin.connect(Bob).transfer(Caro.address, 1_000)).to.be.rejectedWith(
      /Pausable: paused/,
    );

    await expect(agiCoin.connect(Bob).burn(100)).to.be.rejectedWith(
      /Pausable: paused/,
    );

    await expect(agiCoin.connect(Alice).unpause())
      .to.emit(agiCoin, 'Unpaused').withArgs(Alice.address);

    await expect(agiCoin.connect(Alice).mint(Caro.address, 1_000))
      .to.emit(agiCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Caro.address, 1_000);

    await expect(agiCoin.connect(Bob).transfer(Caro.address, 1_000))
      .to.emit(agiCoin, 'Transfer').withArgs(Bob.address, Caro.address, 1_000);

    await expect(agiCoin.connect(Caro).burn(100))
      .to.emit(agiCoin, 'Transfer').withArgs(Caro.address, ethers.constants.AddressZero, 100);

  });

  it('Convert to esAGI', async () => {
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
  })

});