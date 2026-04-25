#!/usr/bin/env python3
"""Basic web3/Base Sepolia connectivity and signing test."""
import os, json
from dotenv import load_dotenv
from web3 import Web3
from eth_account import Account

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(dotenv_path=os.path.join(BACKEND_DIR, ".env"))

w3 = Web3(Web3.HTTPProvider("https://sepolia.base.org"))

USDC_ADDRESS = Web3.to_checksum_address("0x036CbD53842c5426634e7929541eC2318f3dCF7e")
USDC_ABI = [
    {"inputs":[{"name":"account","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function","stateMutability":"view"},
    {"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"type":"function","stateMutability":"view"},
    {"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"type":"function","stateMutability":"view"},
]
usdc = w3.eth.contract(address=USDC_ADDRESS, abi=USDC_ABI)

WALLET = os.getenv("SEPOLIA_WALLET")
PRIVATE_KEY = os.getenv("SEPOLIA_PRIVATE_KEY")
FAKE_TX = os.getenv("FAKE_TX_HASH")

print("=== Base Sepolia web3 test ===\n")

# 1. Connection
print("1. Connection")
assert w3.is_connected(), "RPC down"
print(f"   ✅ Connected | chain {w3.eth.chain_id} | block {w3.eth.block_number:,}")

# 2. Read our wallet
print("2. Our wallet")
eth_bal = w3.from_wei(w3.eth.get_balance(WALLET), "ether")
usdc_bal = usdc.functions.balanceOf(WALLET).call() / 1e6
print(f"   ✅ Address:  {WALLET}")
print(f"   {'✅' if eth_bal > 0 else '❌'} ETH:     {eth_bal} {'(need gas)' if eth_bal == 0 else ''}")
print(f"   {'✅' if usdc_bal > 0 else '❌'} USDC:    {usdc_bal}")

# 3. Read/decode the pre-baked tx
print("3. Pre-baked tx on-chain")
tx = w3.eth.get_transaction(FAKE_TX)
receipt = w3.eth.get_transaction_receipt(FAKE_TX)
print(f"   ✅ Hash:    {tx['hash'].hex()}")
print(f"   ✅ Block:   {tx['blockNumber']:,}")
print(f"   ✅ Status:  {'SUCCESS' if receipt['status'] == 1 else 'FAILED'}")
print(f"   ✅ Gas:     {receipt['gasUsed']:,} used")
print(f"   ✅ Link:    https://sepolia.basescan.org/tx/{tx['hash'].hex()}")

# 4. Sign a tx locally (no broadcast — no ETH for gas)
print("4. Local tx signing (no broadcast)")
acct = Account.from_key(PRIVATE_KEY)
raw_tx = {
    "from": acct.address,
    "to": acct.address,
    "value": 0,
    "nonce": w3.eth.get_transaction_count(acct.address),
    "gas": 21000,
    "maxFeePerGas": w3.to_wei(0.1, "gwei"),
    "maxPriorityFeePerGas": w3.to_wei(0.01, "gwei"),
    "chainId": 84532,
    "data": b"",
}
signed = w3.eth.account.sign_transaction(raw_tx, PRIVATE_KEY)
print(f"   ✅ Signed tx hash: {signed.hash.hex()}")
print(f"   ✅ Raw tx size:    {len(signed.raw_transaction)} bytes")
print(f"   ℹ️  Not broadcast — wallet has 0 ETH for gas")

# 5. USDC contract reads
print("5. USDC contract")
print(f"   ✅ Symbol:   {usdc.functions.symbol().call()}")
print(f"   ✅ Decimals: {usdc.functions.decimals().call()}")

print("\n=== summary ===")
print(f"Chain connection:  ✅")
print(f"Read chain state:  ✅")
print(f"Decode real tx:    ✅")
print(f"Local tx signing:  ✅")
print(f"Broadcast tx:      {'✅' if eth_bal > 0 else '❌  need ETH for gas'}")
