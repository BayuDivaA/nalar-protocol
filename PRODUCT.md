# NALAR PROTOCOL: PRODUCT CONTEXT

<!-- impeccable:product-schema 1 -->

## 1. PROJECT OVERVIEW

Nalar Protocol adalah lapisan pemeriksaan transaksi Web3 yang saat ini terdiri dari browser extension Manifest V3, backend security-check, dan website demo. Extension yang aktif mengintersep `eth_sendTransaction` sebelum request diteruskan ke wallet.

Implementasi saat ini: extension menggunakan JavaScript pada Manifest V3 (bukan React/Vite), dengan bundle Framer Motion untuk animasi; backend menggunakan TypeScript, Bun, Hono, dan viem; frontend menggunakan Next.js, React, dan Tailwind CSS. Ketiganya adalah bagian berbeda dari produk yang sama.

Tujuan utamanya:

> Membantu manusia memahami apa yang sebenarnya mereka tanda tangani di blockchain sebelum transaksi diteruskan ke wallet.

Nalar bukan sekadar AI scam detector.

Nalar adalah security layer yang berada di antara dApp dan wallet ketika proteksi extension aktif. Saat proteksi dijeda, request diteruskan tanpa pemeriksaan Nalar.

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

## 2. CORE PROBLEM

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

Jika bukti yang tersedia menghasilkan finding CRITICAL, contoh ini dapat berakhir dengan BLOCK. Skor dan alasan yang ditampilkan berasal dari analisis transaksi tersebut, bukan angka tetap untuk semua swap NDEMO. Nilai `sellTax` yang terbaca adalah konfigurasi kontrak, bukan bukti jumlah token yang pasti hilang saat menjual.

---

## 3. CORE PRODUCT PRINCIPLE

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

## 4. HIGH-LEVEL ARCHITECTURE

USER / dApp
↓
`eth_sendTransaction` pada provider yang dibungkus `injected.js`
↓
`bridge.js` → `background.js` → Nalar Backend
↓
ALLOW / REVIEW / BLOCK ditampilkan di halaman
↓
Wallet hanya menerima request setelah pengguna memilih lanjut pada ALLOW atau REVIEW

Browser extension bertugas:

- intercept wallet transaction
- meminta user intent
- menampilkan analysis progress
- mengirim transaction ke backend
- menampilkan security result
- memblokir / meminta review / meneruskan transaksi
- menyimpan pilihan network, status proteksi, tema, dan intent per situs di `chrome.storage.local`

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

## 5. EXISTING BACKEND FLOW

Security endpoint:

POST /api/transactions/security-check

Request schema (nilai alamat dan calldata di bawah hanya placeholder):

```json
{
  "intent": "Swap 0.001 tBNB to NDEMO",
  "transaction": {
    "chainId": 97,
    "from": "0x...",
    "to": "0x...",
    "value": "1000000000000000",
    "data": "0x..."
  }
}
```

Important:

chainId:
number

value:
string containing decimal digits

data:
hex string

Kode backend dan extension lokal mengenali BNB Testnet (Chain ID 97) serta BNB Mainnet (Chain ID 56). Konfigurasi extension berada di `extension/config.js`; konfigurasi backend berada di `backend/src/config/networks.ts`. Network wallet, network pilihan extension, dan `transaction.chainId` harus cocok sebelum analisis. Explorer mengikuti chain yang dipilih.

Status deployment tidak boleh disamakan dengan kemampuan kode lokal. Pemeriksaan terakhir yang tercatat pada 27 September 2026 menunjukkan endpoint canonical `https://nalar-protocol.vercel.app/api/transactions/security-check` masih menolak Chain ID 56. Build terpisah `dpl_25vacgbP7UNunm4dA1J4pZKLgVpq` pernah lulus smoke test Mainnet, tetapi catatan itu tidak membuktikan endpoint canonical saat ini sudah diperbarui. Validasi ulang deployment dan uji wallet MetaMask/Rabby diperlukan sebelum menyatakan Mainnet siap dipakai. Kegagalan analisis wajib atau respons backend yang tidak valid tidak boleh berubah menjadi ALLOW.

Do not invent a new request schema unless explicitly required.

---

## 6. BACKEND SECURITY FLOW

Alur pada `backend/src/routes/security.ts`:

1. Parse user intent
2. Normalize user intent
3. Analyze transaction intelligence
4. Decode transaction
5. Simulate transaction
6. Analyze transaction effects
7. Enrich swap effects
8. Investigate target dan counterparty melalui BNB MCP jika diaktifkan
9. Resolve current blockchain/effect state dan audit swap tokens
10. Build transaction scam context serta transaction-threat findings
11. Gabungkan base risk, scam risk, dan transaction-threat risk
12. Compare user intent with actual effects
13. Evaluate security policy
14. Make final deterministic security decision
15. Generate security explanation; gunakan deterministic explanation bila AI gagal

---

## 7. INTENT ENGINE

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

Jika intent terlalu samar atau detail penting tidak dapat diverifikasi, comparison menghasilkan `UNCERTAIN`, bukan `MATCH`. Decision engine menempatkan kasus tanpa kecocokan terverifikasi dalam REVIEW atau BLOCK sesuai risk/policy; tidak boleh otomatis ALLOW.

---

## 8. TRANSACTION INTELLIGENCE

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

## 9. SIMULATION

Nalar simulates the transaction before forwarding it.

Simulation memeriksa hasil eksekusi terhadap state blockchain pada saat pemeriksaan. Simulasi berhasil tidak menjamin transaksi aman, maupun hasilnya sama ketika akhirnya ditambang.

If simulation fails, the transaction can become an immediate security failure / BLOCK.

Simulasi jual bertingkat untuk menilai sellability setelah pembelian belum tersedia pada adapter RPC saat ini. Kegagalan membaca saldo pada simulasi jual tidak boleh otomatis disebut honeypot; statusnya ditandai tidak tersedia.

Simulation result includes concepts such as:

success
gas estimate
error

---

## 10. EFFECT ANALYSIS

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

## 11. CONTRACT / TOKEN SCAM INTELLIGENCE

Nalar has scam intelligence for token-related transactions.

Cakupan audit berasal dari transaksi aktif: token input/output dan perantara swap, token approval, kontrak transfer yang terdekode, serta spender/operator yang dikonfirmasi sebagai kontrak oleh investigasi MCP. Address dideduplikasi per request dan chain. Audit kontrak tambahan tidak mengarang simulasi jual tanpa konteks swap. Ini bukan pemindaian seluruh address atau seluruh data scam di jaringan; registry reputasi, liquidity dan holder concentration hanya digunakan bila provider benar-benar memasok bukti tersebut.

Jika ABI, RPC, atau MCP menyediakan bukti yang dapat dibaca, sistem dapat memeriksa informasi kontrak seperti:

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

## 12. BNB INTELLIGENCE / BNB MCP

Nalar uses BNB intelligence as an investigator/evidence enrichment layer.

It can perform contract reads such as:

owner
paused
tradingEnabled
buyTax
sellTax
maxTx
maxWallet

Contoh state NDEMO yang dibaca melalui BNB MCP adalah `sellTax() = 9800`. Itu adalah nilai konfigurasi on-chain, bukan hasil simulasi penjualan. Materi demo yang ada menyatakan nilai tersebut tidak diterapkan sebagai potongan transfer oleh kontrak demo.

Batas penting pada implementasi saat ini: `BnbAgentInvestigator` memberi unit `PERCENT` pada hasil mentah `sellTax()` dan `buyTax()` tanpa membuktikan satuan getter dari kontrak. Jalur RPC biasa hanya menetapkan `BPS` bila nama getter menyatakannya secara eksplisit, seperti `sellTaxBps`. Karena itu `9800` tidak boleh otomatis dijelaskan kepada pengguna sebagai "98%" atau "9800%" tanpa verifikasi semantik kontrak. Finding dan copy yang bergantung pada satuan ini perlu ditinjau sebelum dipakai sebagai klaim persentase yang pasti.

Security Evidence hanya menampilkan finding yang sudah dinormalisasi. Respons mentah MCP, `transactionHashes`, gas, dan payload besar tidak ditampilkan sebagai bukti utama; nilai teknis yang relevan berada di Technical Details. Status kontrak dari MCP dipakai konsisten: `isContract: true` tidak boleh bersamaan dengan klaim target adalah EOA. Jika status target tidak terbaca, analisis BNB MCP yang aktif mengembalikan `ANALYSIS_UNAVAILABLE`.

---

## 13. DETERMINISTIC RISK ENGINE

The security engine evaluates findings.

Threshold pada `privilege-analysis.ts` hanya berlaku bila satuan tax evidence diketahui (`BPS` atau `PERCENT`):

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

Analisis state membaca semua observasi yang tersedia, bukan berhenti pada entri pertama yang UNKNOWN atau tidak memiliki satuan. Nilai numerik malformed tidak menghapus temuan valid lainnya. Konfigurasi buy/sell tax dengan satuan eksplisit, paused=true dan tradingEnabled=false dapat menghasilkan temuan; state OWNER sendiri tidak membuktikan kontrol terhadap capability. Inspeksi kontrak tidak lengkap, implementasi proxy atau access capability tidak diketahui, restriction yang teramati, serta liquidity rendah/holder concentration tinggi yang benar-benar dilaporkan provider meminta REVIEW jika tidak ada kondisi yang sudah mewajibkan BLOCK. Approval tetap memakai baseline risk existing; risiko scam digabung dengan max, bukan dihitung sebagai tambahan approval kedua.

---

## 14. EVIDENCE CORRELATION

Nalar does not only look at one isolated finding.

It can correlate findings.

Example:

Verified owner control atas mekanisme tax

- Excessive sell tax dengan satuan yang diketahui

→
OWNER_CONTROLLED_EXCESSIVE_SELL_TAX

Ini dapat menjadi finding CRITICAL. `owner()` dan keberadaan fungsi `setSellTax()` saja belum membuktikan siapa yang dapat memanggil fungsi tersebut; capability dan access-control evidence harus dipisahkan.

Another example:

Trading capability

- Trading disabled

Another example:

Upgradeability

- Owner control

The system should communicate the correlated reason in human language.

---

## 15. SECURITY DECISION

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

## 16. SECURITY RESPONSE

The backend response can contain:

ok
checkedAt
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
transactionThreats
transactionThreatRisk
bnbIntelligence

Optional fields must be handled safely.

Respons gagal (`ok: false`) menggunakan error seperti `UNSUPPORTED_CHAIN`, `NETWORK_CONNECTION_FAILED`, atau `ANALYSIS_UNAVAILABLE` dan tidak berisi keputusan ALLOW. Beberapa field pada respons sukses juga bersifat opsional, khususnya pada jalur simulation failure; jangan mengasumsikan `scamAnalyses` selalu ada.

Request dengan `Accept: text/event-stream` mendapat event `progress` (stage, status, chainId, optional address) dan satu event final `result` dengan payload JSON existing. Request biasa tetap mendapat JSON. Loading extension mengikuti event ini, bukan timer; stream terputus, malformed atau chain yang berbeda tidak menghasilkan keputusan aman. Deployment backend harus diperbarui agar progres per tahap tersedia; server JSON-only tetap memakai loading indeterminate. Hasil menampilkan kelompok evidence per address, dan teks AI ditandai `[AI]` berdasarkan `explanation.meta.generator`, terpisah dari verdict engine.

---

## 17. EXTENSION ARCHITECTURE

Extension saat ini adalah Chrome/Chromium Manifest V3, dengan file aktif berikut:

```text
extension/
├── manifest.json
├── config.js
├── injected.js
├── bridge.js
├── background.js
├── popup.html
├── popup.js
├── popup.css
├── ui.css
├── motion-ui.entry.js
├── motion-ui.js
└── package.json
```

`injected.js` berjalan pada page/main world dan membungkus provider. `bridge.js` berjalan sebagai content script, meneruskan pesan berdasarkan request ID. `background.js` menyimpan intent per origin, memvalidasi network, dan memanggil backend. Popup mengatur network, status proteksi, tema, serta intent situs aktif. `motion-ui.js` dibundel dari `motion-ui.entry.js` dan memakai Framer Motion untuk presentasi. Tidak ada struktur `extension/src/`, `content.js`, atau `dist/injected.js` dalam extension aktif.

---

## 18. EXTENSION PROVIDER SUPPORT

The extension currently supports:

- window.ethereum
- Rabby
- EIP-6963 providers

It uses WeakSet/double-wrap protection.

Only intercept:

eth_sendTransaction

Do not intercept unrelated wallet methods.

Network yang dikonfigurasi: BNB Testnet (`97`, `tBNB`, `https://testnet.bscscan.com`) dan BNB Mainnet (`56`, `BNB`, `https://bscscan.com`). Pemilihan network di popup memeriksa dan, bila diminta, mencoba mengganti chain wallet sebelum menyimpan pilihan. Pilihan terakhir bertahan di `chrome.storage.local`. Dukungan kode lokal tidak dengan sendirinya membuktikan backend production atau wallet nyata sudah siap untuk Mainnet.

---

## 19. TRANSACTION FLOW IN EXTENSION

The flow is:

dApp
↓
eth_sendTransaction
↓
`injected.js` intercepts
↓
check protection status and wallet/selected network
↓
show intent dialog
↓
save user intent for current origin
↓
show analysis loading UI
↓
send TX_REQUEST
↓
`bridge.js`
↓
`background.js` validates chain and request
↓
POST /api/transactions/security-check
↓
backend analyzes
↓
security result
↓
`background.js`
↓
`bridge.js`
↓
TX_RESULT
↓
`injected.js` matches request ID
↓
decision UI

---

## 20. SECURITY BEHAVIOR IN EXTENSION

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

Protection active with unknown/mismatched/unsupported network, RPC failure, backend failure, invalid response, analysis timeout, or unreadable required MCP target status: do not forward automatically. Show recovery options (retry, cancel, or switch network where available). Counterparty MCP inspection is optional enrichment; if unavailable, it must not be described as verified-safe evidence. Re-check network before forwarding an ALLOW or REVIEW request.

Popup reopening preserves the selected network, protection state, theme, and saved intent for the current site. The popup is not the transaction result screen; the intent, analysis, and decision overlays appear on the dApp page.

UI refactoring must never break these guarantees.

---

## 21. CURRENT MALICIOUS DEMO TOKEN

Current demo malicious token:

NDEMO

Contract:

0xe56E18ff683AbF6E1aA01804FaCaeB3694FDdd35

Contract concept:

NalarDemoToken

Configured state:

buyTax = 0
sellTax = 9800

Owner yang diharapkan dalam tes on-chain terakhir, bukan jaminan state saat ini:

0x53E993819F2Bc45A029615e8634BDdEEab4F7817

Kontrak ini digunakan dalam tes integrasi untuk menunjukkan pembacaan konfigurasi on-chain dan finding `EXCESSIVE_SELL_TAX`. Tes security-check untuk skenario NDEMO mengharapkan `BLOCK` dan menemukan state `CURRENT_SELL_TAX = 9800`; tes audit token dapat memiliki skor berbeda dari hasil endpoint karena konteks risk berbeda. Jangan menulis `100 / 100` sebagai hasil tetap semua transaksi NDEMO.

UI harus menyebut sumbernya sebagai konfigurasi on-chain dan tidak menjanjikan kerugian transfer tertentu. Satuan angka `9800` perlu diverifikasi sebelum diubah menjadi persentase di copy atau evidence. Kontrak demo yang didokumentasikan tidak menerapkan nilai ini sebagai potongan transfer.

---

## 22. EXTENSION UI GOAL

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

## 23. DECISION UI PRIORITY

Urutan decision overlay saat ini:

1. Decision dan risk di header
2. WHY, memakai penjelasan dari hasil security check
3. Intent vs actual
4. What this means, bila tersedia
5. Security Evidence berisi finding yang sudah dinormalisasi, bukan respons mentah MCP
6. Technical Details terlipat secara default, termasuk chain, alamat, fungsi, selector, simulation, dan status MCP yang tersedia
7. Tombol tindakan sesuai ALLOW, REVIEW, atau BLOCK

Alamat EVM yang ditampilkan dapat dibuka di explorer sesuai Chain ID aktif. Jangan memalsukan evidence yang tidak tersedia atau menampilkan raw JSON/array MCP sebagai finding pengguna.

---

## 24. WEBSITE / FRONTEND

Frontend Next.js yang ada memiliki route:

- `/`: landing page Nalar Protocol dengan animasi alur pemeriksaan, decision explorer, arsitektur, dan tautan ke demo/install.
- `/demo`: satu alur mint NFT pada BNB Testnet. Halaman membaca nama koleksi dan harga dari kontrak, lalu mengirim request transaksi ke wallet agar intersepsi extension dapat dicoba.
- `/demo/external-dapp`: mengarahkan pengguna ke `/demo`.
- `/install`: petunjuk memasang extension sebagai unpacked Chromium extension dari arsip GitHub.

Landing page yang sudah ada menjelaskan:

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

Landing page mengarahkan pengguna ke:

/demo

dan `/install`.

Do not replace or destroy the existing demo.

### Website feature: On-chain Explainer

Status: diimplementasikan sebagai tool read-only pada `/address`, terpisah dari extension. Tool ini menerjemahkan data address dan tx hash di BNB Chain ke bahasa awam; bukan pemeriksaan keamanan atau pemberi keputusan transaksi. Ringkasan awal berbahasa Inggris, dengan pilihan tampilan Bahasa Indonesia.

**Cakupan awal**

- Pengguna dapat memasukkan address EVM atau tx hash pada BNB Mainnet (Chain ID 56) atau BNB Testnet (Chain ID 97). Jaringan dipilih secara eksplisit sebelum pemeriksaan; data dari dua jaringan tidak boleh tercampur.
- Tidak perlu menghubungkan wallet atau menyiapkan intent/transaksi. Jaringan lain dan format address non-EVM ditandai belum didukung, bukan diberi hasil spekulatif.
- Address kontrak/token dapat dijelaskan dari keberadaan kode, ABI yang tersedia, daftar fungsi (maksimal 24 entri yang ditampilkan), state read-only, dan bukti BNB MCP bila tersedia. ABI bukan source code penuh dan daftar fungsi tidak membuktikan implementasi atau izin akses. Data yang tidak tersedia tetap ditandai tidak diketahui.
- Untuk address tanpa kode yang terbaca, jelaskan hanya fakta tersebut dan data lain yang benar-benar tersedia. Jangan menyimpulkan bahwa address itu pasti milik pengguna biasa, identitas pemiliknya, atau aman untuk menerima dana.
- Tx hash menampilkan pihak pengirim/penerima dari transaksi aktual, nilai BNB langsung, selector dan argumen fungsi bila ABI tersedia, status receipt bila sudah ada, block, waktu, biaya, serta tautan explorer. Input transaksi adalah permintaan, bukan bukti semua efek token. BNB MCP hanya memperkaya bila hash dan konteks transaksi cocok.

**Alur pengguna**

1. Pengguna membuka On-chain Explainer dari landing page, memilih jaringan, lalu memasukkan address atau tx hash.
2. Sistem memvalidasi format dan membaca bukti secara read-only dari jaringan yang dipilih. BNB MCP dapat memperkaya bukti bila tersedia; kegagalannya tidak boleh ditutupi.
3. Halaman menampilkan pengantar faktual, sumber tiap fakta, waktu pembacaan, hal yang belum diketahui, dan explorer pada jaringan yang benar. Untuk kontrak, daftar fungsi ABI dapat dibuka; output mentah MCP tidak ditampilkan.
4. AI menerjemahkan bukti ke bahasa sehari-hari dalam Inggris dan Indonesia. Chat lanjutan hanya menjawab berdasarkan bukti untuk objek dan jaringan yang sedang dipilih. Jika bukti tidak cukup, AI menyatakannya terus terang.
5. Saat pengguna mengganti address, tx hash, atau jaringan, konteks penjelasan dan chat lama tidak boleh terbawa sebagai bukti untuk pemeriksaan baru.

**Batas penjelasan**

- Tidak ada `ALLOW`, `REVIEW`, `BLOCK`, risk score, label `SAFE`/`SCAM`, atau saran pasti untuk membeli, mengirim, maupun menandatangani transaksi.
- Status verifikasi source menunjukkan tingkat kecocokan source dengan bytecode menurut penyedia data, bukan audit atau jaminan kontrak aman. Address tanpa kode saat diperiksa juga bukan bukti pasti bahwa address tersebut EOA.
- Konfigurasi kontrak tidak boleh diterjemahkan menjadi perilaku atau kerugian yang pasti. Contoh: nilai mentah `sellTax() = 9800` tidak boleh disebut `98%` sebelum satuan dan penerapannya terbukti.
- Meskipun dapat membaca tx hash yang sudah ada, fitur ini tidak melakukan simulasi, tidak membandingkan intent dengan transaksi, dan tidak menghasilkan keputusan keamanan. Pengguna yang ingin memeriksa sebelum signing diarahkan ke extension.

**Kondisi gagal dan privasi**

- Address tidak valid, jaringan tidak didukung, RPC/MCP tidak tersedia, bukti kosong, atau AI gagal harus menghasilkan pesan yang menjelaskan keterbatasan dan langkah berikutnya; tidak boleh menghasilkan fakta atau kesimpulan palsu. Ringkasan fakta yang sudah terverifikasi boleh tetap ditampilkan saat AI gagal.
- Sebelum penggunaan, jelaskan bahwa address dan pertanyaan chat diproses oleh layanan website. Riwayat chat tidak disimpan permanen tanpa persetujuan pengguna; kebijakan retensi perlu ditetapkan sebelum rilis.

**Kriteria keberhasilan v1:** pengguna dapat memahami fakta yang tersedia beserta sumbernya, melihat batas pengetahuan sistem, dan mengajukan pertanyaan lanjutan tanpa menerima verdict keamanan. Alur extension, backend security-check, dan keputusan deterministiknya tetap tidak berubah.

---

## 25. LANDING PAGE DESIGN DIRECTION

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

Hero yang sudah diimplementasikan:

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

Visual alur Nalar adalah elemen utama. Halaman juga memiliki contoh NDEMO dan penjelasan BNB MCP sebagai sumber evidence, bukan penentu keputusan. Contoh interaktif pada landing page adalah ilustrasi produk; angka di sana bukan hasil analisis live dari wallet pengguna.

---

## 26. NALAR PRODUCT PHILOSOPHY

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

## 27. IMPORTANT IMPLEMENTATION RULES FOR AI

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

## 28. CURRENT PRODUCT STATUS

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
- NDEMO sebagai kasus uji konfigurasi token on-chain

Yang sudah ada pada kode lokal: pemilihan BNB Testnet/Mainnet di extension, penyimpanan intent per situs dan penghapusannya, status Active/Pause, tema, tautan explorer, fail-closed saat analisis/network tidak valid, landing page `/`, halaman `/install`, `/demo`, serta `/demo/external-dapp`.

Yang masih perlu diverifikasi atau diperbaiki sebelum mengklaim siap production:

- Pastikan endpoint canonical menggunakan backend yang mendukung Chain ID 56; catatan deployment lama tidak cukup untuk memastikan status saat ini.
- Jalankan QA alur nyata dengan MetaMask dan Rabby, termasuk perubahan chain di tengah analisis, penolakan switch, serta popup yang dibuka ulang. Tes mock belum membuktikan kompatibilitas wallet nyata.
- Verifikasi satuan getter `sellTax()`/`buyTax()` per kontrak. Implementasi MCP saat ini melabeli nilai mentah sebagai `PERCENT`; jangan mengklaim angka tax atau kerugian aktual sebelum semantiknya terbukti.
- Pertahankan pemisahan spender approval, recipient transfer, target contract, dan evidence MCP pada setiap request. Perbaikan pemetaan lokal sudah ada, tetapi transaksi pengguna yang spesifik tetap memerlukan payload/hash untuk diverifikasi.
- Pastikan penjelasan untuk hasil `UNCERTAIN` dan evidence yang tidak tersedia tidak terdengar seperti kecocokan atau keamanan yang telah terbukti.

---

## 29. GOLDEN RULE

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
