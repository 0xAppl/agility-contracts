import { ethers, upgrades } from "hardhat";

async function main() {
    const MerkleDistributorWithDeadline = await ethers.getContractFactory('MerkleDistributorWithDeadline')
    const merkleDistributorWithDeadline = await MerkleDistributorWithDeadline.deploy(
    //goerli AGI
    "0xa49573920bd91e61bd46669059E80288FB44FAa0",
    // merkle root
    "0x4811e2910555d8c307c10a260760635e704392f9ac12c6af0559774667f4723f",
    // deadline timestamp
    1691961430
    )
    console.log(`merkleDistributorWithDeadline deployed at ${merkleDistributorWithDeadline.address}`)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});