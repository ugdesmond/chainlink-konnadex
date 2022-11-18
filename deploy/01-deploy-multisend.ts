import "@nomiclabs/hardhat-ethers"
import verify from "../utils/verify"
import { DeployFunction } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { networkConfig, developmentChains } from "../helper-hardhat-config"
import { ethers } from "hardhat"

const deployMultiSender: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { getNamedAccounts, deployments, network, ethers } = hre
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const args: any[] = [
        networkConfig[network.name].salaryCharge,
        networkConfig[network.name].feeAmountConverter,
    ]
    console.log("..........Deploying MultiSender contract and waiting for confirmations...")
    const multiSender = await deploy("KonnadexMultiSender", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: networkConfig[network.name].blockConfirmations,
    })
    log(`FundMe deployed at ${multiSender.address}`)
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verify(multiSender.address, [args])
    }
    const balance0ETH: any = await ethers.provider.getBalance(deployer)

    console.log(
        ethers.utils.formatEther(balance0ETH) +
            "---------------------Deployement Completed-------------------",
        multiSender.address
    )
}

export default deployMultiSender
deployMultiSender.tags = ["all", "multisender"]
