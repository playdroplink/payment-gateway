const hre = require("hardhat");

async function main() {
  console.log("Deploying PaymentGateway contract...");

  const PaymentGateway = await hre.ethers.getContractFactory("PaymentGateway");
  const paymentGateway = await PaymentGateway.deploy();

  await paymentGateway.waitForDeployment();

  const address = await paymentGateway.getAddress();
  console.log("PaymentGateway deployed to:", address);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    address: address,
    timestamp: new Date().toISOString()
  };

  console.log("\nDeployment Information:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

