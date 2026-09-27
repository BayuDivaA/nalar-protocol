# Real-wallet release check (not yet executed)

Use a disposable Chrome profile, the unpacked `extension/` directory, and test accounts only. Never paste a seed phrase into this project or approve a transaction with valuable assets.

1. Start `bun server.js` from `third-party-dapp/`, then open `http://localhost:4000/` in Chrome.
2. Repeat each check separately with MetaMask and Rabby. Connect the wallet to BNB Testnet (97), open NALAR, set BNB Testnet, save a specific intent, close and reopen the popup. Verify the intent, network, and Active/Pause state persist.
3. Select the normal mint, malicious approval, and review scenarios. Verify the wallet never opens before NALAR finishes analysis; BLOCK never forwards; REVIEW and ALLOW require an explicit Continue click. Cancel at the wallet confirmation screen.
4. While NALAR is analyzing, switch the wallet to BNB Mainnet (56) or another chain. Continue must not forward the old request. Start a new request only after the chain is revalidated.
5. Reject `wallet_switchEthereumChain` in the wallet. Verify NALAR keeps the previous selected network and does not forward the transaction. Repeat with the wallet disconnected and with the RPC unavailable.
6. On Mainnet, verify only network selection, explorer links, and fail-closed behavior until the canonical backend URL passes a live Chain ID 56 analysis. Do not submit the Testnet demo contract transaction on Mainnet.
7. Remove the saved intent in the popup. Verify only the current site's intent disappears, including after the popup reopens.

Record wallet version, extension version, selected chain, observed NALAR decision, whether the wallet prompt opened, and any console error for each check. Mainnet release remains gated until both wallet runs pass.

Security boundary to resolve before claiming a tamper-resistant firewall: `injected.js` currently accepts `TX_RESULT` through page-visible `window.postMessage`. A hostile dApp can observe the request ID and send a forged result with the same message shape. This cannot be proved safe by mock-wallet tests; authorization must move to a channel the page cannot forge, or the product must avoid claiming that it can enforce a block against a malicious page.
