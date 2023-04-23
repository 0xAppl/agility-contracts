import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
const dayjs = require('dayjs');
dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";
// Goerli
const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);
const deployer = new ethers.Wallet(privateKey, provider);
const agiwethLPtoken = "" // agiwethLP token address
const rewardssymbols = ["esagi"]
const rewardstokens = [""] // esagi token address
const rewardsmanager = [deployer.address]
const rewardsrate = [1] //rewards per sec 


async function main() {
  const LockedLPPool = await ethers.getContractFactory('AGILITYFarm');
  const contract = await LockedLPPool.deploy(deployer.address, agiwethLPtoken, rewardssymbols, rewardstokens,rewardsmanager,rewardsrate);
  console.log(`Deployed LockedLPPool to ${contract.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});