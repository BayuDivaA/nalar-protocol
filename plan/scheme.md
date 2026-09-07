<!-- shield-backend -->

│
├── src/
│ ├── index.ts
│ ├── app.ts
│ ├── config.ts
│ ├── schemas.ts
│ │
│ ├── routes/
│ │ ├── health.ts
│ │ └── transaction.ts
│ │
│ └── lib/
│ ├── bsc.ts
│ ├── types.ts
│ ├── simulate.ts
│ ├── contract.ts
│ ├── risk.ts
│ └── ai.ts
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

<!-- EXPLANATION -->

Intent Engine
AI → memahami apa yang user mau

Security Engine
Code → menentukan aman atau tidak

Explanation Engine
AI → menjelaskan kenapa transaksi diblokir

Simulation tells us whether a transaction can execute. TxSentry determines whether it should execute

┌──────────────────────────┐
│ Intent Comparison │
│ "Apakah melakukan hal │
│ yang diminta user?" │
└────────────┬─────────────┘
│
▼
intentMatch

┌──────────────────────────┐
│ Simulation │
│ "Apakah transaksi dapat │
│ dieksekusi?" │
└────────────┬─────────────┘
│
▼
simulation.success

┌──────────────────────────┐
│ Security Decision │
│ "Boleh diteruskan atau │
│ harus diblokir?" │
└──────────────────────────┘
