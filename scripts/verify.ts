const Hre = require("hardhat");

async function main() {

    await Hre.run("verify:verify", {
      //Deployed contract Template1155 address
      address: "0x77df09dC157c565110BF57099744b34Ba2Ea6432",
      //Path of your main contract.
      contract: "contracts/NFTContract.sol:ChronNFT",
    });

    await Hre.run("verify:verify", {
      //Deployed contract Template721 address
      address: "0x8ABb0Ab7e764A5B9CB00985F347f58cDb2579247",
      //Path of your main contract.
      contract: "contracts/chronfactory.sol:chronFactory",
    });

    await Hre.run("verify:verify", {
      //Deployed contract Factory address
      address: "0x68ee540a36F0d514B77210338cB82220527C52C7",
      //Path of your main contract.
      contract: "contracts/marketPlace.sol:Marketplace",
    });

    // await Hre.run("verify:verify", {
    //   //Deployed contract Marketplace address
    //   address: "0xd50F438b0a04D29d64Eb62ADe83Aa0f5a7EAfec9",
    //   //Path of your main contract.
    //   contract: "contracts/SingleMarket.sol:SingleMarket",
    // });

    // await Hre.run("verify:verify",{
    //   //Deployed contract MarketPlace proxy
    //   address: "0x79475e917e705799184b13Fbb31DA8e886Be55F5",
    //   //Path of your main contract.
    //   contract: "contracts/OwnedUpgradeabilityProxy.sol:OwnedUpgradeabilityProxy"
    // });


    // await Hre.run("verify:verify",{
    //   //Deployed contract Factory proxy
    //   address: "0xDa9e500b5Ab914Dab5391b177798DA62Edbc1331",
    //   //Path of your main contract.
    //   contract: "contracts/OwnedUpgradeabilityProxy.sol:OwnedUpgradeabilityProxy"
    // });
}
main()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});