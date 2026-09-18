# NALAR PROTOCOL — PROJECT CONTEXT

## 1. PROJECT OVERVIEW

Nalar Protocol adalah Web3 transaction security protocol.

Tujuan utamanya:

> Membantu manusia memahami apa yang sebenarnya mereka tanda tangani di blockchain sebelum transaksi diteruskan ke wallet.

Nalar bukan sekadar AI scam detector.

Nalar adalah security layer yang berada di antara user/dApp dan wallet.

Nalar menganalisis:

- user intent
- transaction
- simulation
- transaction effects
- contract state
- contract privileges
- token behavior
- on-chain evidence
- scam intelligence
- intent match
- risk
- policy

Kemudian menghasilkan keputusan:

ALLOW
REVIEW
BLOCK

Prinsip utama:

AI / intelligence layer bukan final security authority.

AI dan BNB Intelligence digunakan sebagai:

- investigator
- evidence enrichment
- contract inspection
- state reading
- explanation

Keputusan security final harus tetap berasal dari deterministic security engine berdasarkan evidence dan analysis yang tersedia.

---

# 2. CORE PROBLEM

Transaksi Web3 biasanya terlihat seperti:

to:
0x...

value:
1000000000000000

data:
0x...

Bagi user biasa, informasi tersebut tidak menjawab:

"What am I actually signing?"

Nalar mengubah transaksi teknis menjadi penjelasan yang dapat dimengerti manusia.

Contoh:

USER INTENT

"Swap 0.001 tBNB to NDEMO"

kemudian Nalar membaca transaksi aktual:

ACTUAL TRANSACTION

SWAP
WBNB → NDEMO
PancakeSwap

kemudian Nalar memeriksa:

- transaction decoding
- simulation
- transaction effects
- contract state
- token configuration
- owner privileges
- scam intelligence
- on-chain evidence
- intent match

dan menghasilkan:

BLOCK
CRITICAL
100 / 100

Reason:

"Current sell tax is excessive."

---

# 3. CORE PRODUCT PRINCIPLE

Nalar bukan:

User
→ AI
→ Safe / Scam

Arsitektur yang benar:

Human Intent
↓
Transaction
↓
Decode
↓
Simulate
↓
Analyze Effects
↓
Inspect Contract / State
↓
Collect Evidence
↓
Compare Intent
↓
Calculate Risk
↓
Evaluate Policy
↓
Deterministic Security Decision
↓
ALLOW / REVIEW / BLOCK

AI dapat membantu investigasi dan penjelasan.

AI tidak boleh dianggap sebagai satu-satunya decision maker.

---

# 4. HIGH-LEVEL ARCHITECTURE

USER
↓
dApp / Web Application
↓
Wallet Provider
↓
NALAR EXTENSION
↓
Nalar Backend
↓
Security Decision
↓
ALLOW / REVIEW / BLOCK
↓
Wallet

Browser extension bertugas:

- intercept wallet transaction
- meminta user intent
- menampilkan analysis progress
- mengirim transaction ke backend
- menampilkan security result
- memblokir / meminta review / meneruskan transaksi

Backend bertugas:

- memahami intent
- decode transaction
- simulate transaction
- analyze effects
- inspect state
- scam intelligence
- calculate risk
- compare intent
- evaluate policy
- membuat final security decision
- membuat explanation

---

# 5. EXISTING BACKEND FLOW

Security endpoint:

POST /api/transactions/security-check

Request schema:

{
  "intent": "Swap 0.001 tBNB to NDEMO",
  "transaction": {
    "chainId": 97,
    "from": "0x...",
    "to": "0x...",
    "value": "0",
    "data": "0x..."
  }
}

Important:

chainId:
number

value:
string containing decimal digits

data:
hex string

The backend currently expects BNB Testnet:

chainId = 97

Do not invent a new request schema unless explicitly required.

---

# 6. BACKEND SECURITY FLOW

Current conceptual execution order:

1. Parse user intent
2. Normalize user intent
3. Analyze transaction intelligence
4. Decode transaction
5. Simulate transaction
6. Analyze transaction effects
7. Enrich swap effects
8. Resolve current blockchain/effect state
9. Audit swap tokens
10. Build transaction scam context
11. Calculate deterministic risk
12. Compare user intent with actual effects
13. Evaluate security policy
14. Make final security decision
15. Generate security explanation

---

# 7. INTENT ENGINE

The user can describe their intent in natural language.

Example:

"Swap 0.001 tBNB to NDEMO"

Nalar converts that into normalized intent data.

Intent is used as an explicit reference point.

The system compares:

WHAT THE USER SAID

versus

WHAT THE TRANSACTION ACTUALLY DOES

This is one of the core differentiators of Nalar.

---

# 8. TRANSACTION INTELLIGENCE

Nalar decodes the transaction and tries to understand:

- protocol
- function
- selector
- arguments
- classification
- action

Example:

Transaction:
SWAP

Protocol:
PancakeSwap

Function:
execute

The system should translate technical transaction information into understandable language.

---

# 9. SIMULATION

Nalar simulates the transaction before forwarding it.

Simulation is used to determine whether execution can happen safely.

If simulation fails, the transaction can become an immediate security failure / BLOCK.

Simulation result includes concepts such as:

success
gas estimate
error

---

# 10. EFFECT ANALYSIS

Nalar analyzes what the transaction actually changes.

Examples:

- swap
- approval
- token movement
- permissions
- contract state changes

For swaps, Nalar enriches information such as:

tokenIn
tokenOut
protocol
recipient

---

# 11. CONTRACT / TOKEN SCAM INTELLIGENCE

Nalar has scam intelligence for token-related transactions.

The system can inspect token contract information such as:

- owner
- buy tax
- sell tax
- paused state
- trading enabled state
- max transaction
- max wallet
- upgradeability
- other contract privileges

The system can also read real on-chain contract state using BNB intelligence / BNB MCP.

Important:

On-chain reads are evidence.

They should not automatically become a final decision without deterministic security analysis.

---

# 12. BNB INTELLIGENCE / BNB MCP

Nalar uses BNB intelligence as an investigator/evidence enrichment layer.

It can perform contract reads such as:

owner
paused
tradingEnabled
buyTax
sellTax
maxTx
maxWallet

Example real evidence:

CURRENT_SELL_TAX = 9800
unit = PERCENT

This represents a configured 98% sell tax in the demo contract.

Important limitation:

The demo NDEMO token stores a sellTax value of 9800 but does not actually enforce a 98% transfer tax in its transfer logic.

Therefore UI copy must say:

"Nalar detected an on-chain configured 98% sell tax"

NOT:

"Selling the token will definitely lose 98%"

Do not claim behavior that has not been proven by simulation/code.

---

# 13. DETERMINISTIC RISK ENGINE

The security engine evaluates findings.

Example thresholds currently used for sell tax:

HIGH:
3000 BPS

CRITICAL:
9000 BPS

Scam findings can produce:

LOW
MEDIUM
HIGH
CRITICAL

The scam risk can be merged into the deterministic risk engine.

---

# 14. EVIDENCE CORRELATION

Nalar does not only look at one isolated finding.

It can correlate findings.

Example:

Owner controls tax

- Excessive sell tax

→
OWNER_CONTROLLED_EXCESSIVE_SELL_TAX

This can become a CRITICAL finding.

Another example:

Trading capability

- Trading disabled

Another example:

Upgradeability

- Owner control

The system should communicate the correlated reason in human language.

---

# 15. SECURITY DECISION

Final decision is:

ALLOW
REVIEW
BLOCK

Current important rule:

If scam analysis contains a CRITICAL finding:

→ BLOCK

If overall deterministic risk reaches CRITICAL:

→ BLOCK

The decision engine should remain deterministic.

Do not move final decision-making into an LLM.

---

# 16. SECURITY RESPONSE

The backend response can contain:

decision
riskScore
riskLevel
intentMatch
intent
actual
transactionSummary
simulation
policy
effects
scamAnalysis
scamAnalyses
transactionScamContext
stateDiff
comparison
reasons
explanation
contract
transaction

Optional fields must be handled safely.

Never assume:
scamAnalyses always exists.

---

# 17. EXTENSION ARCHITECTURE

The extension is a Chrome/Chromium MV3 extension.

Conceptually:

extension/
├── manifest.json
├── background.js
├── content.js
├── dist/
│   └── injected.js
├── src/
│   ├── background/
│   │   └── background.js
│   ├── content/
│   │   └── content.js
│   ├── injected/
│   │   ├── constants.js
│   │   ├── index.js
│   │   ├── messaging.js
│   │   ├── providers.js
│   │   ├── state.js
│   │   ├── storage.js
│   │   ├── transaction.js
│   │   ├── utils.js
│   │   └── ui/
│   │       ├── common.js
│   │       ├── intent.js
│   │       ├── analysis.js
│   │       └── decision.js
│   └── popup/
│       ├── popup.html
│       ├── popup.css
│       └── popup.js
└── package.json

---

# 18. EXTENSION PROVIDER SUPPORT

The extension currently supports:

- window.ethereum
- Rabby
- EIP-6963 providers

It uses WeakSet/double-wrap protection.

Only intercept:

eth_sendTransaction

Do not intercept unrelated wallet methods.

---

# 19. TRANSACTION FLOW IN EXTENSION

The flow is:

dApp
↓
eth_sendTransaction
↓
injected.js intercepts
↓
check protection status
↓
show intent dialog
↓
save user intent
↓
show analysis loading UI
↓
send TX_REQUEST
↓
content.js
↓
background.js
↓
POST /api/transactions/security-check
↓
backend analyzes
↓
security result
↓
background.js
↓
content.js
↓
TX_RESULT
↓
injected.js
↓
decision UI

---

# 20. SECURITY BEHAVIOR IN EXTENSION

BLOCK:

Never forward transaction to wallet.

REVIEW:

Show reasons.
Require explicit user confirmation.
Only then forward to wallet.

ALLOW:

Show result.
User continues.
Then forward transaction to wallet.

Protection disabled:

Forward transaction normally.

UI refactoring must never break these guarantees.

---

# 21. CURRENT MALICIOUS DEMO TOKEN

Current demo malicious token:

NDEMO

Contract:

0xe56E18ff683AbF6E1aA01804FaCaeB3694FDdd35

Contract concept:

NalarDemoToken

Configured state:

buyTax = 0
sellTax = 9800

Owner:

0x53E993819F2Bc45A029615e8634BDdEEab4F7817

This contract is used to demonstrate Nalar detecting dangerous on-chain token configuration.

Expected Nalar result:

riskScore:
100

riskLevel:
CRITICAL

finding:
EXCESSIVE_SELL_TAX

decision:
BLOCK

reason:
Current sell tax is excessive.

UI should explain:

"Current sell tax is excessive."

Then show supporting evidence:

Current Sell Tax:
98.00%

Current Buy Tax:
0.00%

BNB Intelligence:
ON-CHAIN EVIDENCE

Do not claim that the actual transfer function charges 98% because this demo contract does not enforce the tax.

---

# 22. EXTENSION UI GOAL

The extension UI should feel like a premium security product.

Style:

- modern
- minimal
- quiet
- technical
- premium
- trustworthy

Avoid:

- AI slop
- cyberpunk
- neon
- glassmorphism
- excessive gradients
- giant shield icons
- fake AI imagery
- excessive cards
- fake statistics
- fake telemetry

The user should immediately understand:

WHAT THEY ASKED
WHAT WILL HAPPEN
WHAT NALAR FOUND
WHY IT MATTERS
WHAT NALAR DECIDED

The reason should be more prominent than the score.

---

# 23. DECISION UI PRIORITY

Information order:

1. Decision
2. Risk
3. User intent
4. Actual transaction
5. Why
6. Evidence
7. Technical details
8. Next action

Example:

TRANSACTION BLOCKED

CRITICAL RISK
100 / 100

YOUR REQUEST
Swap 0.001 tBNB to NDEMO

WHAT WILL HAPPEN
Swap WBNB → NDEMO

WHY IT WAS STOPPED
Current sell tax is excessive.

EVIDENCE
Current sell tax: 98.00%
Current buy tax: 0.00%
On-chain state: confirmed

TECHNICAL DETAILS
collapsed by default

Transaction was not forwarded to your wallet.

---

# 24. WEBSITE / FRONTEND

The project also has an existing frontend.

The frontend currently contains a consumer/demo experience.

The desired structure:

/
= Nalar Protocol landing page

/demo
= existing consumer/security demo

The landing page should explain:

- what Nalar is
- why it exists
- what problem it solves
- how it works
- how intent is used
- how transaction analysis works
- how evidence is collected
- how ALLOW / REVIEW / BLOCK works
- how to use the product
- how the system works technically at a high level

The landing page should lead naturally to:

/demo

Do not replace or destroy the existing demo.

---

# 25. LANDING PAGE DESIGN DIRECTION

Nalar website should be:

- modern
- minimal
- premium
- technical
- editorial
- security-focused

Support:

Dark mode
Light mode

Avoid:

- generic SaaS hero
- giant gradient
- AI brain
- 3D shield
- blockchain illustration
- floating crypto coins
- generic feature-card grid

Instead, demonstrate the actual product.

Hero concept:

KNOW WHAT
YOU'RE SIGNING.

Then show an interactive transaction/security flow:

Intent
↓
Transaction
↓
Simulation
↓
Contract inspection
↓
Evidence
↓
Decision

The product itself should be the main visual element.

---

# 26. NALAR PRODUCT PHILOSOPHY

Nalar is about translating blockchain behavior into human understanding.

Three important words:

PROTECT
TRANSLATE
DECIDE

Protect:
stop dangerous transactions.

Translate:
explain technical transaction behavior in human language.

Decide:
use deterministic security logic to decide ALLOW / REVIEW / BLOCK.

The conceptual value proposition:

"Security for transactions humans can understand."

Or:

"Know what you're signing."

---

# 27. IMPORTANT IMPLEMENTATION RULES FOR AI

When working on this project:

1. Read existing code before modifying it.

2. Preserve working functionality.

3. Do not rebuild existing systems without reason.

4. Do not invent APIs.

5. Do not invent backend fields.

6. Do not invent security evidence.

7. Do not turn AI into the final security authority.

8. Do not expose raw internal errors to users.

9. Do not create fake metrics.

10. Do not add UI elements simply because they look impressive.

11. Keep security decisions deterministic.

12. Make technical information understandable to normal users.

13. Preserve BLOCK / REVIEW / ALLOW guarantees.

14. Prefer small, modular changes.

15. Verify build and tests after changes.

---

# 28. CURRENT PRODUCT STATUS

The project already has:

- Nalar backend security engine
- transaction intelligence
- transaction simulation
- intent analysis
- intent comparison
- effects analysis
- risk engine
- scam intelligence
- BNB on-chain investigation
- deterministic BLOCK / REVIEW / ALLOW
- Chrome/MV3 extension
- wallet provider interception
- intent UI
- analysis/loading UI
- decision UI
- existing frontend demo
- NDEMO malicious token test fixture

The next major product work is primarily:

- stabilize extension ↔ backend integration
- polish extension UX
- build proper Nalar Protocol landing page
- connect landing page to existing /demo
- maintain dark/light themes
- improve reason/evidence explanation
- prepare product for hackathon/demo presentation

---

# 29. GOLDEN RULE

Whenever modifying Nalar, remember:

Nalar is not an AI that tells users whether crypto is safe.

Nalar is a transaction security protocol that:

UNDERSTANDS INTENT
↓
UNDERSTANDS TRANSACTION
↓
INSPECTS EXECUTION
↓
READS EVIDENCE
↓
CORRELATES RISK
↓
EXPLAINS THE RESULT
↓
MAKES A DETERMINISTIC SECURITY DECISION

The ultimate user experience should answer one question:

"Do I understand what I am about to sign, and has Nalar found a reason to stop it?"

saya sedang bangun aplikasi, kira2 seperti ini aplikasinya
