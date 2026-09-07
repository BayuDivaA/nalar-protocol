export const demoNftAbi = [
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      {
        name: "owner",
        type: "address",
      },
      {
        name: "operator",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
  },

  {
    type: "function",
    name: "safeMint",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },

  {
    type: "function",
    name: "maliciousApproval",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "operator",
        type: "address",
      },
    ],
    outputs: [],
  },
] as const;
