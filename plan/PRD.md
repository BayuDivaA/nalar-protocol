# PRD — SHIELD

## AI Web3 Transaction Intelligence & Security

**Tagline:**
**Know what your transaction actually does.**

**Core principle:**
**Simulate before you sign. Understand after it happens.**

---

# 1. PRODUCT OVERVIEW

Shield adalah aplikasi Web3 Security & Intelligence yang membantu pengguna memahami aktivitas blockchain menggunakan kombinasi:

* BNB Smart Chain on-chain data
* Transaction simulation
* Smart contract analysis
* Wallet/address intelligence
* Contract deployer history
* Deterministic risk engine
* AI explanation menggunakan Oracle Cloud Infrastructure Generative AI

Shield memiliki dua pengalaman utama:

### PRE-TRANSACTION

Menjawab:

> "Apa yang akan terjadi kalau saya melakukan transaksi ini?"

### POST-TRANSACTION

Menjawab:

> "Apa yang sebenarnya terjadi setelah transaksi ini?"

Shield tidak menjadikan AI sebagai sumber kebenaran. Blockchain data dan security engine menghasilkan evidence; AI bertugas menerjemahkan evidence tersebut menjadi bahasa manusia yang mudah dipahami.

---

# 2. PROBLEM

Interaksi Web3 saat ini terlalu abstrak bagi mayoritas pengguna.

User mungkin melihat:

```text
Contract: 0xABC...
Function: execute()
Value: 0.08 BNB
Data: 0x...
```

Namun user tidak mengetahui:

* aset apa yang akan berpindah,
* siapa penerima dana,
* apakah NFT/token benar-benar diterima,
* apakah transaksi akan gagal,
* apakah kontrak meminta approval,
* apakah kontrak dapat di-upgrade,
* siapa pemilik/deployernya,
* apakah deployer mempunyai riwayat mencurigakan,
* dan apa konsekuensi sebenarnya dari transaksi tersebut.

Setelah transaksi terjadi, blockchain explorer juga menyajikan data dalam bentuk teknis yang sulit dipahami pengguna awam.

---

# 3. PRODUCT VISION

Shield menjadi:

> **An intelligence layer between users and blockchain transactions.**

Shield menerjemahkan blockchain menjadi:

```text
RAW BLOCKCHAIN DATA
        ↓
SECURITY ANALYSIS
        ↓
RISK EVIDENCE
        ↓
AI REASONING / EXPLANATION
        ↓
HUMAN LANGUAGE
```

---

# 4. PRODUCT GOALS

## Primary Goals

1. Mendeteksi perilaku transaksi berisiko sebelum user signing.
2. Mensimulasikan transaksi untuk melihat hasil yang mungkin terjadi.
3. Menjelaskan transaksi blockchain menggunakan bahasa manusia.
4. Menganalisis smart contract dan deployer.
5. Menjelaskan transaksi yang telah selesai.
6. Memberikan risk assessment berdasarkan evidence.
7. Mengurangi kemungkinan user melakukan transaksi berbahaya karena tidak memahami apa yang mereka sign.

## Non-Goals untuk MVP

Shield tidak akan:

* membuat wallet sendiri,
* menyimpan private key,
* menjadi blockchain explorer penuh,
* menjadi antivirus browser universal,
* mendukung semua chain,
* membuat LLM menentukan scam secara bebas,
* menjalankan full BNB archive node,
* membangun static analyzer Solidity lengkap sendiri.

---

# 5. TARGET USERS

## Primary

Web3 retail users yang:

* menggunakan wallet seperti MetaMask,
* melakukan mint NFT,
* melakukan swap,
* melakukan token approval,
* berinteraksi dengan contract yang belum dikenal.

## Secondary

Developer Web3 yang membutuhkan:

* transaction intelligence,
* contract intelligence,
* address intelligence,
* API security layer.

---

# 6. CORE FEATURE 1 — PRE-TRANSACTION PROTECTION

## Objective

Memberikan analisis sebelum transaksi ditandatangani.

User harus mendapatkan jawaban:

> "What will happen if I sign this?"

---

# 7. PRE-TRANSACTION FLOW

```text
USER
 ↓
Connect Wallet
 ↓
User initiates transaction
 ↓
Transaction Builder
 ↓
Shield Intercepts Transaction
 ↓
Decode
 ↓
Simulate
 ↓
Analyze Contract
 ↓
Analyze Asset Movement
 ↓
Analyze Deployer
 ↓
Calculate Risk
 ↓
AI Explanation
 ↓
SAFE / WARN / BLOCK
 ↓
User Decision
 ↓
Wallet Confirmation
```

---

# 8. PRE-TRANSACTION INPUT

Minimal transaction object:

```typescript
{
  chainId: number;
  from: string;
  to: string;
  value: bigint;
  data: string;
}
```

Contoh:

```json
{
  "chainId": 56,
  "from": "0xUSER",
  "to": "0xNFT_CONTRACT",
  "value": "80000000000000000",
  "data": "0xa0712d68..."
}
```

---

# 9. TRANSACTION DECODING

Shield harus mengubah calldata menjadi intent manusia.

Contoh:

```text
0xa0712d68...
```

menjadi:

```text
mint(1)
```

Output:

```text
ACTION:
Mint NFT

QUANTITY:
1

VALUE:
0.08 BNB
```

---

# 10. TRANSACTION SIMULATION

Simulation merupakan komponen paling penting dalam MVP.

Shield melakukan simulasi transaksi sebelum signing.

Simulation harus menghasilkan:

* success/failure
* revert reason
* gas estimation
* native asset balance changes
* ERC20 transfers
* ERC721 transfers
* ERC1155 transfers
* contract calls
* event logs jika tersedia
* unexpected asset movements

BNB Smart Chain menyediakan JSON-RPC API yang kompatibel dengan Geth untuk interaksi blockchain.

---

# 11. SIMULATION EXAMPLE

User mengira:

```text
Mint 1 NFT
0.08 BNB
```

Simulation menemukan:

```text
USER:
-0.08 BNB

NFT:
+0

UNKNOWN WALLET:
+0.08 BNB
```

Shield menghasilkan:

```text
CRITICAL RISK

The transaction succeeds, but the simulation
does not show an NFT being transferred to your wallet.

Your 0.08 BNB is transferred elsewhere.
```

---

# 12. CONTRACT INTELLIGENCE

Shield mengumpulkan:

* contract address
* verified/unverified status
* proxy status
* implementation address
* owner/admin
* upgradeability
* mint capability
* withdrawal capability
* pause capability
* blacklist capability
* fee configuration
* approval behavior

Output:

```text
CONTRACT

Verified:
YES

Upgradeable:
YES

Owner:
0xABC...

Owner privileges:
• Upgrade contract
• Withdraw funds
• Pause contract
```

---

# 13. DEPLOYER INTELLIGENCE

Shield harus mencari:

```text
Contract
   ↓
Deployer
   ↓
Historical activity
```

Evidence yang dikumpulkan:

* contracts deployed
* transaction count
* wallet age/first seen
* related addresses
* related contracts
* suspicious historical behavior
* repeated deployment patterns

Contoh:

```text
DEPLOYER INTELLIGENCE

Contracts deployed:
17

Flagged contracts:
3

Related contracts:
8

Assessment:
ELEVATED RISK
```

AI tidak boleh menyimpulkan:

> "This person is a scammer."

AI harus mengatakan:

> "This deployer has previously deployed several contracts associated with suspicious behavior."

---

# 14. RISK ENGINE

Risk calculation dilakukan secara deterministic.

LLM tidak menentukan score.

Suggested weighting:

```text
Transaction Simulation     35%
Contract Behavior          20%
Asset Movement             15%
Deployer Intelligence      15%
Address Intelligence       10%
External Reputation         5%
```

Risk levels:

```text
0–20      SAFE
21–40     LOW
41–60     MEDIUM
61–80     HIGH
81–100    CRITICAL
```

Risk result:

```json
{
  "score": 87,
  "severity": "HIGH",
  "recommendation": "REJECT"
}
```

---

# 15. AI EXPLANATION ENGINE

AI menerima evidence yang telah dihasilkan oleh backend.

AI tidak melakukan arbitrary blockchain reasoning.

Input:

```json
{
  "transactionIntent": "Mint 1 NFT",
  "simulation": {
    "success": true,
    "bnbSpent": "0.08",
    "nftReceived": 0
  },
  "contract": {
    "verified": false,
    "upgradeable": true,
    "ownerCanWithdraw": true
  },
  "deployer": {
    "contractsDeployed": 17,
    "flaggedContracts": 3
  },
  "riskScore": 87
}
```

AI menghasilkan:

```json
{
  "summary": "...",
  "whatWillHappen": "...",
  "whyItMatters": "...",
  "evidence": [],
  "recommendation": "reject"
}
```

---

# 16. ORACLE AI ARCHITECTURE

Oracle yang digunakan adalah:

**Oracle Cloud Infrastructure Generative AI**

OCI Generative AI merupakan managed service untuk menggunakan model AI dan mendukung chat, embeddings, reranking, structured outputs, tools, memory, serta agentic workloads.

OCI juga menyediakan OpenAI-compatible endpoint:

```text
https://inference.generativeai.<region>.oci.oraclecloud.com/openai/v1
```

dengan endpoint seperti:

```text
/responses
/chat/completions
```

dan dapat diakses menggunakan OCI API key atau OCI IAM authentication.

---

# 17. CARA AI ORACLE DIGUNAKAN DI APLIKASI

Frontend TIDAK langsung memanggil OCI.

Jangan:

```text
Browser
 ↓
OCI AI
```

Gunakan:

```text
Browser
 ↓
Your Backend
 ↓
Blockchain Analysis
 ↓
Risk Engine
 ↓
OCI Generative AI
 ↓
Backend
 ↓
Browser
```

Alasannya:

* API credential tidak bocor ke browser.
* AI hanya menerima evidence yang sudah tervalidasi.
* Risk engine tetap deterministic.
* Prompt dapat dikontrol dari server.
* AI response dapat divalidasi sebelum dikirim ke frontend.

---

# 18. AI PIPELINE

```text
USER REQUEST
     ↓
TRANSACTION DATA
     ↓
BLOCKCHAIN ANALYSIS
     ↓
STRUCTURED EVIDENCE
     ↓
RISK ENGINE
     ↓
RISK SCORE
     ↓
OCI GENERATIVE AI
     ↓
STRUCTURED EXPLANATION
     ↓
UI
```

---

# 19. AI SYSTEM PROMPT PRINCIPLE

AI harus memiliki aturan:

```text
You are a Web3 transaction translator.

You may only use evidence supplied by the security engine.

Do not invent:
- transaction behavior
- addresses
- contract functions
- ownership
- historical activity
- token movements

Explain technical blockchain activity in plain language.

Separate:
- observed facts
- risk indicators
- interpretation

Do not call something a scam unless the evidence explicitly supports that conclusion.

Always explain why the user should care.
```

---

# 20. POST-TRANSACTION EXPLANATION

User memasukkan:

```text
Transaction Hash
```

Shield mengambil:

* transaction
* receipt
* logs
* contract calls
* token transfers
* native asset movement
* interacted contracts
* relevant addresses

Kemudian AI menerjemahkan hasilnya.

---

# 21. POST-TRANSACTION OUTPUT

Contoh:

```text
WHAT HAPPENED?

You minted NFT #1842 from NFT123.

You paid:
0.08 BNB

You received:
1 NFT

Your BNB went to:
0xABC...

Additional actions:
No additional token approval detected.

Contract:
Upgradeable

Deployer:
Elevated risk
```

AI:

> "In simple terms, you paid 0.08 BNB and successfully received NFT #1842. The payment went to the NFT contract. We did not detect any additional token approval in this transaction."

---

# 22. ADDRESS ANALYSIS

Input:

```text
0xABC...
```

Output:

```text
ADDRESS INTELLIGENCE

Type:
EOA

First Seen:
2026-...

Transactions:
1,284

Contracts Deployed:
17

Flagged Relationships:
3

Risk:
ELEVATED
```

AI menjelaskan:

> "This address appears to have been active for several months and has deployed 17 contracts. Three associated contracts show suspicious indicators."

---

# 23. CONTRACT ANALYSIS

Input:

```text
0xABC...
```

Output:

```text
CONTRACT INTELLIGENCE

Contract type:
NFT

Verified:
YES

Proxy:
YES

Upgradeable:
YES

Owner:
0x123...

Owner privileges:
HIGH
```

AI menjelaskan konsekuensinya.

---

# 24. WALLET CONNECTION

Wallet connection diperlukan terutama untuk PRE-TRANSACTION.

Gunakan:

```text
RainbowKit
+
wagmi
+
viem
```

Architecture:

```text
RainbowKit
     ↓
wagmi
     ↓
viem
     ↓
Wallet
```

RainbowKit menyediakan wallet connection UI untuk React dan bekerja dengan wagmi/viem.

Wallet connection digunakan untuk:

* mendapatkan `from`
* membaca chain
* membaca balance
* mengetahui asset user
* membuat transaction context
* meminta signing setelah user melewati security check

POST-TRANSACTION tidak membutuhkan wallet connection.

User cukup memasukkan transaction hash.

---

# 25. TRANSACTION SIGNING FLOW

```text
USER
 ↓
CLICK MINT
 ↓
CREATE UNSIGNED TRANSACTION
 ↓
SHIELD ANALYSIS
 ↓
SIMULATION
 ↓
RISK ENGINE
 ↓
AI EXPLANATION
 ↓
┌────────────────────────┐
│ SAFE / WARN / BLOCK    │
└───────────┬────────────┘
            ↓
     USER DECISION
            ↓
      WALLET CONFIRM
            ↓
        BLOCKCHAIN
```

---

# 26. IMPORTANT UX DECISION

Warning harus muncul sebelum wallet confirmation.

Contoh:

```text
┌─────────────────────────────────────┐
│ 🔴 HIGH RISK                        │
│                                     │
│ You are trying to mint 1 NFT        │
│ for 0.08 BNB.                       │
│                                     │
│ Simulation result:                  │
│                                     │
│ -0.08 BNB                           │
│ +0 NFT                              │
│                                     │
│ The transaction succeeds, but the   │
│ NFT is not transferred to you.      │
│                                     │
│ RECOMMENDATION: REJECT              │
│                                     │
│ [ Reject ] [ Continue Anyway ]      │
└─────────────────────────────────────┘
```

Hanya setelah:

```text
Continue Anyway
```

wallet popup muncul.

---

# 27. INDEXING — PONDER

Ponder digunakan untuk historical blockchain intelligence.

MVP tahap awal:

```text
viem
+
RPC
```

sudah cukup.

Ponder ditambahkan untuk:

* deployer history
* contract creation
* token transfers
* address relationships
* historical activity
* cached intelligence

Architecture:

```text
BNB Chain
   ↓
Ponder
   ↓
PostgreSQL
   ↓
Address / Deployer Intelligence
```

Ponder merupakan framework indexing untuk EVM data dan dapat digunakan dengan TypeScript.

Untuk hackathon, jangan menjadikan Ponder sebagai blocker. Pasang setelah simulation dan risk engine sudah bekerja.

---

# 28. DATABASE

Minimum tables:

```text
addresses

contracts

transactions

token_transfers

address_relationships

risk_events

analysis_results
```

---

# 29. BACKEND STACK

```text
Node.js
TypeScript
Next.js API / backend service
viem
PostgreSQL
Ponder
OCI Generative AI
```

Backend responsibilities:

```text
1. Blockchain data retrieval
2. Transaction decoding
3. Simulation
4. Contract analysis
5. Address analysis
6. Deployer analysis
7. Risk calculation
8. AI explanation
9. Response validation
```

---

# 30. FRONTEND STACK

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
RainbowKit
wagmi
viem
TanStack Query
```

---

# 31. FRONTEND ROUTES

```text
/
```

Landing + main analyzer.

```text
/transaction
```

Transaction analysis.

```text
/address
```

Address intelligence.

```text
/contract
```

Contract intelligence.

```text
/demo/nft
```

Interactive NFT mint security demo.

---

# 32. API ENDPOINTS

### Analyze transaction before signing

```http
POST /api/transaction/analyze
```

### Analyze completed transaction

```http
GET /api/transaction/:hash
```

### Analyze address

```http
GET /api/address/:address
```

### Analyze contract

```http
GET /api/contract/:address
```

---

# 33. MVP DEMO

Demo harus memiliki dua scenario.

## SAFE SCENARIO

```text
NFT123

Mint:
0.05 BNB

Simulation:
✓ NFT received
✓ Expected payment
✓ No unexpected approval
✓ Normal contract behavior

Risk:
LOW
```

User dapat melanjutkan ke wallet.

---

# 34. MALICIOUS SCENARIO

```text
NFT123

Mint:
0.08 BNB

Simulation:
⚠ No NFT received
⚠ Unexpected fund destination
⚠ Privileged owner
⚠ Suspicious deployer history

Risk:
94 / 100

Recommendation:
REJECT
```

User melihat warning sebelum signing.

---

# 35. POST-TRANSACTION DEMO

User memasukkan hash.

Shield menampilkan:

```text
YOU PAID
0.08 BNB

YOU RECEIVED
NFT #1842

CONTRACT
NFT123

DEPLOYER
0xABC...

RISK
LOW

AI SUMMARY
"You successfully minted NFT #1842..."
```

---

# 36. PRODUCT ARCHITECTURE

```text
                         USER
                          │
                          ▼
                     NEXT.JS UI
                          │
              ┌───────────┴───────────┐
              │                       │
         RainbowKit               Analyzer
              │                       │
        wagmi + viem                  │
              │                       │
              └───────────┬───────────┘
                          ▼
                    BACKEND API
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
    BNB RPC          Ponder/DB        Security Engine
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
                     Risk Evidence
                          │
                          ▼
                  OCI Generative AI
                          │
                          ▼
                 Human Explanation
                          │
                          ▼
                        UI
```

---

# 37. DEVELOPMENT JOBLIST

## PHASE 1 — FOUNDATION

* [ ] Create Next.js project
* [ ] Configure TypeScript
* [ ] Configure Tailwind/shadcn
* [ ] Configure BNB Chain
* [ ] Configure viem
* [ ] Configure RainbowKit
* [ ] Configure wagmi
* [ ] Create PostgreSQL
* [ ] Create OCI environment

---

## PHASE 2 — BLOCKCHAIN ENGINE

* [ ] Implement BNB RPC client
* [ ] Get transaction
* [ ] Get transaction receipt
* [ ] Get contract code
* [ ] Get balance
* [ ] Decode calldata
* [ ] Parse logs
* [ ] Detect token transfer
* [ ] Detect NFT transfer

BNB Chain menyediakan JSON-RPC endpoints untuk akses data real-time blockchain.

---

## PHASE 3 — SIMULATION

* [ ] Implement transaction simulation
* [ ] Detect revert
* [ ] Detect revert reason
* [ ] Estimate gas
* [ ] Capture native balance changes
* [ ] Capture ERC20 changes
* [ ] Capture NFT changes
* [ ] Identify unexpected transfers
* [ ] Produce structured simulation result

---

## PHASE 4 — CONTRACT INTELLIGENCE

* [ ] Detect EOA vs contract
* [ ] Detect proxy
* [ ] Identify implementation
* [ ] Identify owner/admin
* [ ] Detect upgradeability
* [ ] Detect sensitive capabilities
* [ ] Build contract evidence object

---

## PHASE 5 — DEPLOYER INTELLIGENCE

* [ ] Resolve deployer
* [ ] Count deployed contracts
* [ ] Count transactions
* [ ] Find related contracts
* [ ] Find historical risk indicators
* [ ] Build deployer reputation object

---

## PHASE 6 — RISK ENGINE

* [ ] Define evidence schema
* [ ] Define scoring rules
* [ ] Implement severity levels
* [ ] Implement risk score
* [ ] Implement recommendation
* [ ] Write unit tests

---

## PHASE 7 — ORACLE AI

* [ ] Create OCI Generative AI resource/configuration
* [ ] Configure credentials
* [ ] Create backend AI client
* [ ] Create system prompt
* [ ] Create structured output schema
* [ ] Send evidence to OCI AI
* [ ] Validate model response
* [ ] Implement fallback if AI unavailable

OCI recommends IAM-based authentication for production workloads, while API keys are available for testing/early development.

---

## PHASE 8 — POST TRANSACTION

* [ ] Transaction hash input
* [ ] Fetch transaction
* [ ] Fetch receipt
* [ ] Parse events
* [ ] Build asset movement
* [ ] Analyze involved contracts
* [ ] Analyze relevant addresses
* [ ] Generate AI explanation

---

## PHASE 9 — WALLET

* [ ] Connect wallet
* [ ] Read address
* [ ] Read chain
* [ ] Read balance
* [ ] Build transaction
* [ ] Send transaction only after analysis
* [ ] Display transaction result

---

## PHASE 10 — FRONTEND

* [ ] Landing page
* [ ] Transaction analyzer
* [ ] Address analyzer
* [ ] Contract analyzer
* [ ] Risk visualization
* [ ] Simulation result card
* [ ] Human explanation card
* [ ] Demo NFT mint
* [ ] Wallet confirmation flow

---

# 38. FINAL MVP DEFINITION

Shield MVP dianggap selesai ketika:

### Test 1

User connects wallet.

```text
Connect
 ↓
Mint NFT
 ↓
Transaction analysis
 ↓
Simulation
 ↓
Risk result
 ↓
AI explanation
 ↓
Wallet confirmation
```

### Test 2

Malicious contract:

```text
Mint
 ↓
Simulation detects abnormal behavior
 ↓
HIGH/CRITICAL
 ↓
AI explains
 ↓
User rejects
```

### Test 3

Completed transaction:

```text
Transaction Hash
 ↓
Analyze
 ↓
Asset movement
 ↓
Contract
 ↓
Deployer
 ↓
AI explanation
```

---

# 39. HACKATHON DEMO STORY

Presentation harus seperti ini:

> "Imagine you're on an NFT website. The website tells you: Mint one NFT for 0.08 BNB."

Klik Mint.

> "But instead of asking the wallet to sign immediately, Shield simulates the transaction first."

Hasil:

```text
Website says:
Mint NFT

Simulation says:
You lose 0.08 BNB
You receive 0 NFT
```

> "Shield then investigates the contract and its deployer, calculates the risk, and uses AI to explain the findings in plain language."

Muncul:

```text
🔴 HIGH RISK

"This transaction appears to charge you
for an NFT, but our simulation does not
show an NFT reaching your wallet."
```

> "The user can now reject the transaction before signing."

Kemudian:

> "And if the user already signed a transaction, Shield can explain exactly what happened afterward."

Ini menjadi satu cerita utuh:

**BEFORE → PROTECT**

**AFTER → EXPLAIN**

---

# 40. CORE DIFFERENTIATOR

Shield bukan:

> AI membaca smart contract.

Shield bukan:

> Scam database.

Shield bukan:

> Blockchain explorer.

Shield adalah:

> **A transaction intelligence layer that turns blockchain execution and historical on-chain evidence into understandable decisions.**

---

# 41. PRODUCT NORTH STAR

Every transaction should answer five questions:

```text
1. What am I doing?

2. What will happen?

3. Who am I interacting with?

4. Why should I care?

5. Should I continue?
```

Pre-transaction menjawab kelimanya sebelum signing.

Post-transaction menjelaskan kembali kelimanya setelah execution.
