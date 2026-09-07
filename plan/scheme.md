<!-- shield-backend -->
│
├── src/
│   ├── index.ts
│   ├── app.ts
│   ├── config.ts
│   ├── schemas.ts
│   │
│   ├── routes/
│   │   ├── health.ts
│   │   └── transaction.ts
│   │
│   └── lib/
│       ├── bsc.ts
│       ├── types.ts
│       ├── simulate.ts
│       ├── contract.ts
│       ├── risk.ts
│       └── ai.ts
│
├── .env.example
├── package.json
├── tsconfig.json
└── README.md



<!-- SIMULATION > EVIDENCE > RISK ENGINE > AI EXPLANATION -->

Simulation : Viem (RPC)
EVIDENCE : 
Risk Engine : 
AI Explanation : OCI AI




<!-- MILESTONE > Setelah itu baru sambungkan Next.js + RainbowKit + wagmi + viem, sehingga flow akhirnya menjadi: -->

Connect Wallet
       ↓
Mint
       ↓
Unsigned Transaction
       ↓
Hono Backend
       ↓
Simulation
       ↓
Risk
       ↓
OCI AI
       ↓
Warning UI
       ↓
User confirms
       ↓
Wallet signing
       ↓
BNB Chain

<!-- Simulator -->
wallet
  ↓
TxSentry
  ↓
eth_call
  ↓
BNB node
  ↓
execute mentally / virtually
  ↓
throw away state changes