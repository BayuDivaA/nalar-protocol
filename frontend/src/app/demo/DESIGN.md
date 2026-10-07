---
name: NALAR Editions demo
description: A collection edition desk with two real Testnet transaction paths.
colors:
  paper: "#f6f4ec"
  sheet: "#fffdf8"
  ink: "#263a35"
  secondary: "#5f716b"
  line: "#cbd4cc"
  action: "#244b41"
  warning: "#855818"
typography:
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    lineHeight: "1.6"
rounded:
  control: "6px"
spacing:
  compact: "8px"
  grouped: "16px"
  separated: "32px"
---

# Design System: NALAR Editions

## Overview

An edition desk, not a second landing page or wallet dashboard. Judges choose a request, copy their mint intent, and inspect the actual transaction with NALAR. The user's existing N logo is the NFT artwork, stored by the contract rather than substituted with stock art. Mode: Operate. ENERGY 1 / RHYTHM 2 / MOTION 1.

## Colors

Keep the demo's existing warm paper, green-black text and deep green action. The on-chain N artwork retains its original navy and blue. Amber identifies the explicit approval exercise, not a fabricated NALAR verdict. This intentionally light collection surface is for a judge operating the mint flow; it does not alter the website's theme preference.

## Typography

Use the existing system sans stack, with a bold collection heading and sentence-case instructions. Reserve monospace for contract addresses, selectors, serials and hashes. Remove the unrelated serif marketing headline.

## Layout

The first viewport contains the collection title, a large artwork sheet and an adjacent mint desk. Request selection, live collection facts, intent and primary action form one reading path. The judge's short testing instructions sit beneath, not in a row of generic feature cards. On phones the actionable desk precedes the artwork, and details remain collapsed.

## Elevation & Depth

Flat paper and sheet contrast. Hairlines separate collection facts and the transaction inspector. No glass, glow, fake terminal or floating panel shadow.

## Shapes

Restrained control corners. The artwork keeps its real rectangular edition format. Native radio inputs, checkboxes and disclosure affordances stay recognizable.

## Components

- Request selection uses a native radio group. Normal mint and approval trap stay clearly separate, but neither displays a preset security verdict.
- The trap requires an explicit acknowledgement and discloses collection-wide permission. It is never disguised as a safe mint to the tester.
- Supply, maximum, price, artwork, collection address and operator are contract-derived. Unavailable data stays unavailable.
- Submission stages follow actual wallet requests and receipts. A returned hash is pending, not proof of mint success.
- Short state transitions explain selection and receipt feedback. Respect reduced motion and visible keyboard focus.

## Do's and Don'ts

- Do preserve the existing extension interception and security API flow.
- Do show where the transaction goes, which function runs and where approval differs from minting.
- Do keep full addresses available through accessible labels and Testnet explorer links.
- Don't claim an ALLOW/BLOCK result, completed mint or connected extension without its real source.
- Don't use Mainnet assets, seed a fake mint count, add random cartoon scenery or repeat the landing-page composition.

<!-- THESIS: One collection, two real requests. Reject the generic NFT dashboard. OWN-WORLD: Existing paper/green demo palette, flat edition sheet, bold sans. STORY: Choose a case, copy mint intent, send the actual request, inspect NALAR, verify the receipt. FIRST VIEWPORT: Collection headline above a large N artwork at left and a compact mint desk at right; primary action follows intent. FORM: Edition desk, grounded structure 5, surface seed 36076289; keeps the incumbent demo world, not the catalog challengers. -->
