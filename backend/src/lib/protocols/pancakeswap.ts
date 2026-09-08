export const pancakeswapUniversalRouterAbi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      {
        name: "commands",
        type: "bytes",
      },
      {
        name: "inputs",
        type: "bytes[]",
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      {
        name: "commands",
        type: "bytes",
      },
      {
        name: "inputs",
        type: "bytes[]",
      },
      {
        name: "deadline",
        type: "uint256",
      },
    ],
    outputs: [],
  },
] as const;
