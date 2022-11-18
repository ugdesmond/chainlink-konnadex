export interface networkConfigItem {
    blockConfirmations?: number
    salaryCharge?: number
    feeAmountConverter?: number
}

export interface networkConfigInfo {
    [key: string]: networkConfigItem
}
// Konnadex charge is (salarycharge/feeAmountConverter) * amountToPay
export const networkConfig: networkConfigInfo = {
    localhost: {
        blockConfirmations: 1,
        salaryCharge: 1,
        feeAmountConverter: 1000,
    },
    hardhat: {
        blockConfirmations: 1,
        salaryCharge: 1,
        feeAmountConverter: 1000,
    },
    gorli: {
        blockConfirmations: 6,
        salaryCharge: 1,
        feeAmountConverter: 1000,
    },
}

export const developmentChains = ["hardhat", "localhost"]
