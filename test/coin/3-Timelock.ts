import _ from 'lodash';
import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ONE_DAY_IN_SECS, deployStakingPoolContractsFixture, expandTo18Decimals, expectBigNumberEquals, nativeTokenAddress } from '../utils';

describe('Timelock_AGICoin', () => {

  it('Mintable, transferable and burnable', async () => {

    const { agiCoin, timelock, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);

    const txResponse = await agiCoin.connect(Alice).mint(Bob.address, 10_000)
    expect(await agiCoin.balanceOf(Bob.address)).to.equal(10_000);
    await agiCoin.connect(Alice).transferOwnership(timelock.address)
    expect(await agiCoin.owner()).to.equal(timelock.address);

    const QueueTime = (await time.latest()) + ONE_DAY_IN_SECS/2;
    let data = txResponse.data
    await timelock.connect(Alice).queue(agiCoin.address, 0, "", data, QueueTime)
    await time.increase(ONE_DAY_IN_SECS / 2) + 1;
    await timelock.connect(Alice).execute(agiCoin.address, 0, "", data, QueueTime)
    expect(await agiCoin.balanceOf(Bob.address)).to.equal(20_000);

  });

});