import { encodeFunctionData } from 'viem'
import { securityAbi } from '../lib/abis'

const data = encodeFunctionData({
    abi: securityAbi,
    functionName: 'setApprovalForAll',
    args: [
        '0x3333333333333333333333333333333333333333',
        true,
    ],
})

console.log(data)