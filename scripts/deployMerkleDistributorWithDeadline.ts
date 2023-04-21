import { ethers, upgrades } from "hardhat";

async function main() {
    const MerkleDistributorWithDeadline = await ethers.getContractFactory('MerkleDistributorWithDeadline')
    const merkleDistributorWithDeadline = await MerkleDistributorWithDeadline.deploy(
    //   USDC
    //   '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //   '0xbe154afea9ba1e08729654a19c53952a892d6b37fe0b5d1bdf8ac4f51d03a426',
    //   1688493524
    "0xa49573920bd91e61bd46669059E80288FB44FAa0",
    "0x4811e2910555d8c307c10a260760635e704392f9ac12c6af0559774667f4723f",
    1691961430
    )
    console.log(`merkleDistributorWithDeadline deployed at ${merkleDistributorWithDeadline.address}`)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});