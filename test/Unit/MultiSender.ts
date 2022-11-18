import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { BigNumber } from "ethers"
import { network, deployments, ethers } from "hardhat"
import { convertToBigNumber, calculateCharge } from "../../shared/util"

import { developmentChains, networkConfig } from "../../../helper-hardhat-config"
import { KonnadexMultiSender, Wusdt } from "../../../typechain-types"
!developmentChains.includes(network.name)
    ? describe.skip
    : describe("<<<<<<<<<<<<<<MultiSender Unit Test Started>>>>>>>>>>>>>", function () {
          let konnadexMultiSender: KonnadexMultiSender
          let deployer: SignerWithAddress
          let ada: SignerWithAddress
          let obi: SignerWithAddress
          let emeka: SignerWithAddress
          let wusdtToken: Wusdt
          let tokenSymbol = ""
          beforeEach(async () => {
              const accounts = await ethers.getSigners()
              deployer = accounts[0]
              ada = accounts[1]
              obi = accounts[2]
              emeka = accounts[3]
              await deployments.fixture(["all"])
              konnadexMultiSender = await ethers.getContract("KonnadexMultiSender")
              wusdtToken = await ethers.getContract("Wusdt")
              konnadexMultiSender = konnadexMultiSender.connect(deployer)
              wusdtToken = wusdtToken.connect(deployer)
              tokenSymbol = ethers.utils.hexZeroPad(
                  ethers.utils.toUtf8Bytes(await wusdtToken.name()),
                  8
              )
              // whitelist token
              await konnadexMultiSender.addToken(tokenSymbol, wusdtToken.address)
          })

          describe("constructor", function () {
              it("initialize  multisender correctly", async () => {
                  const salaryCharge = await konnadexMultiSender.getSalaryCharge()
                  const feeConverter = await konnadexMultiSender.getFeeConverter()
                  expect(salaryCharge).to.equal(
                      convertToBigNumber(networkConfig[network.name].salaryCharge || 0)
                  )
                  expect(feeConverter).to.equal(
                      convertToBigNumber(networkConfig[network.name].feeAmountConverter || 0)
                  )
              })
          })

          describe("Set token", function () {
              it("should revert if not called by owner", async function () {
                  await expect(
                      konnadexMultiSender.connect(ada).addToken(tokenSymbol, wusdtToken.address)
                  ).to.be.revertedWith("NotOwner")
              })

              it("should revert if token already set", async function () {
                  await expect(
                      konnadexMultiSender.addToken(tokenSymbol, wusdtToken.address)
                  ).to.be.revertedWith("TokenExists")
              })

              it("should remove token", async function () {
                  await expect(
                      konnadexMultiSender.addToken(tokenSymbol, wusdtToken.address)
                  ).not.to.be.revertedWith("TokenNotFound")
              })
          })

          describe("distribute token", function () {
              const referenceId =
                  "0x5553445400000000000000000000000000000000000000000000000000000000"
              let arrayAccount: string[] = []
              let arrayAmount: BigNumber[] = []
              beforeEach(() => {
                  arrayAmount = []
                  arrayAccount = []
              })

              it("should pay with empty address", async function () {
                  arrayAmount.push(convertToBigNumber(10))
                  await expect(
                      konnadexMultiSender
                          .connect(emeka)
                          .distributeToken(referenceId, tokenSymbol, arrayAccount, arrayAmount)
                  ).to.be.revertedWith("ReceiverAddressLengthNotEqualWithSalaryAmountLength")
              })

              it("should get token balance", async function () {
                  expect(
                      await konnadexMultiSender.connect(deployer).getTokenBalance(tokenSymbol)
                  ).to.be.equal(0)
              })

              it("should pay with insufficient balance", async function () {
                  //no konnadex fee was included in the transfer
                  //fund senders wallet wusdt
                  await wusdtToken.connect(deployer).transfer(emeka.address, convertToBigNumber(4))
                  //spendable money wusdt
                  await wusdtToken
                      .connect(emeka)
                      .approve(
                          konnadexMultiSender.address,
                          await wusdtToken.balanceOf(emeka.address)
                      )
                  arrayAmount.push(convertToBigNumber(4))
                  arrayAccount.push(obi.address)
                  await expect(
                      konnadexMultiSender
                          .connect(emeka)
                          .distributeToken(referenceId, tokenSymbol, arrayAccount, arrayAmount)
                  ).to.be.revertedWith("InsufficientBalance")
              })

              it("should pay with invalid address ", async function () {
                  //no konnadex fee was included in the transfer
                  //fund senders wallet wusdt
                  await wusdtToken.connect(deployer).transfer(emeka.address, convertToBigNumber(10))
                  //spendable money wusdt
                  await wusdtToken
                      .connect(emeka)
                      .approve(konnadexMultiSender.address, convertToBigNumber(5))
                  arrayAmount.push(convertToBigNumber(4))
                  arrayAccount.push("0x0000000000000000000000000000000000000000")
                  await expect(
                      konnadexMultiSender
                          .connect(emeka)
                          .distributeToken(referenceId, tokenSymbol, arrayAccount, arrayAmount)
                  ).to.be.revertedWith("Address invalid")
              })

              it("should pay multiple staff with wusdt", async function () {
                  const salaryCharge = await konnadexMultiSender.getSalaryCharge()
                  const feeConverter = await konnadexMultiSender.getFeeConverter()
                  const adaSalaryAmount: number = 10.523
                  const obiSalaryAmount: number = 100.434

                  //fund senders wallet wusdt
                  await wusdtToken
                      .connect(deployer)
                      .transfer(emeka.address, convertToBigNumber(1000))
                  //spendable money wusdt
                  await wusdtToken
                      .connect(emeka)
                      .approve(konnadexMultiSender.address, convertToBigNumber(500))
                  const payerInitialBalance = await wusdtToken.balanceOf(emeka.address)
                  //deployer balance after transfering 600wusdt to emeka
                  const deployerBalance = await wusdtToken.balanceOf(deployer.address)

                  arrayAccount.push(obi.address)
                  arrayAccount.push(ada.address)
                  arrayAmount.push(convertToBigNumber(obiSalaryAmount))
                  arrayAmount.push(convertToBigNumber(adaSalaryAmount))
                  const feeAmount = calculateCharge(
                      salaryCharge,
                      feeConverter,
                      convertToBigNumber(adaSalaryAmount).add(convertToBigNumber(obiSalaryAmount))
                  )

                  await expect(
                      konnadexMultiSender
                          .connect(emeka)
                          .distributeToken(referenceId, tokenSymbol, arrayAccount, arrayAmount)
                  )
                      .to.emit(konnadexMultiSender, "BulkPaymentSuccessful")
                      .withArgs(
                          referenceId,
                          wusdtToken.address,
                          emeka.address,
                          arrayAccount.length,
                          (
                              await wusdtToken.balanceOf(obi.address)
                          ).add(await wusdtToken.balanceOf(ada.address)),
                          feeAmount,
                          deployer.address
                      )
                  //after salary payment confirm obi and ada balance
                  expect(convertToBigNumber(adaSalaryAmount)).equal(
                      await wusdtToken.balanceOf(ada.address)
                  )
                  expect(convertToBigNumber(obiSalaryAmount)).equal(
                      await wusdtToken.balanceOf(obi.address)
                  )
                  const totalSalaryPaid = (await wusdtToken.balanceOf(obi.address)).add(
                      await wusdtToken.balanceOf(ada.address)
                  )
                  // confirm emeka balance after salary payment
                  expect(
                      payerInitialBalance.sub(
                          (await wusdtToken.balanceOf(obi.address))
                              .add(await wusdtToken.balanceOf(ada.address))
                              .add(calculateCharge(salaryCharge, feeConverter, totalSalaryPaid))
                      )
                  ).equal(await wusdtToken.balanceOf(emeka.address))

                  //confirm deployer konnadex recieved the exact charge.
                  expect(feeAmount.add(deployerBalance)).equal(
                      await wusdtToken.balanceOf(deployer.address)
                  )
              })

              it("should pay multiple staff with native token", async function () {
                  const salaryCharge = await konnadexMultiSender.getSalaryCharge()
                  const feeConverter = await konnadexMultiSender.getFeeConverter()
                  const adaSalaryAmount: number = 10.523
                  const obiSalaryAmount: number = 100.434

                  const payerInitialBalance = await emeka.getBalance()
                  const adaInitialBalance = await ada.getBalance()
                  const obiInitialBalance = await obi.getBalance()

                  const deployerInitialBalance = await deployer.getBalance()

                  arrayAccount.push(obi.address)
                  arrayAccount.push(ada.address)
                  arrayAmount.push(convertToBigNumber(obiSalaryAmount))
                  arrayAmount.push(convertToBigNumber(adaSalaryAmount))
                  const feeAmount = calculateCharge(
                      salaryCharge,
                      feeConverter,
                      convertToBigNumber(adaSalaryAmount).add(convertToBigNumber(obiSalaryAmount))
                  )
                  const totalAmountToSendToContract = convertToBigNumber(adaSalaryAmount)
                      .add(feeAmount)
                      .add(convertToBigNumber(obiSalaryAmount))

                  await expect(
                      konnadexMultiSender
                          .connect(emeka)
                          .distributeNativeCoin(referenceId, arrayAccount, arrayAmount, {
                              value: totalAmountToSendToContract,
                          })
                  )
                      .to.emit(konnadexMultiSender, "BulkPaymentSuccessful")
                      .withArgs(
                          referenceId,
                          konnadexMultiSender.address,
                          emeka.address,
                          arrayAccount.length,
                          convertToBigNumber(adaSalaryAmount).add(
                              convertToBigNumber(obiSalaryAmount)
                          ),
                          feeAmount,
                          deployer.address
                      )

                  // //after salary payment confirm obi and ada balance
                  expect(convertToBigNumber(adaSalaryAmount).add(adaInitialBalance)).equal(
                      await ada.getBalance()
                  )
                  expect(convertToBigNumber(obiSalaryAmount).add(obiInitialBalance)).equal(
                      await obi.getBalance()
                  )

                  // confirm emeka balance after salary payment
                  //cant confirm emeka balance bc of gas fee has been paid..which cannot be calculated
                  expect(payerInitialBalance).gt(await emeka.getBalance())

                  //confirm deployer konnadex recieved the exact charge.
                  expect(feeAmount.add(deployerInitialBalance)).equal(await deployer.getBalance())
              })
          })
      })
