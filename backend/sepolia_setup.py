# sepolia_setup.py
import os
from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv, set_key

load_dotenv()

# ── 1. Generate wallet ─────────────────────────────────────────────────────
account = Account.create()
print(f"✅ Wallet address: {account.address}")
print(f"🔑 Private key:    {account.key.hex()}")
print(f"\n⚠️  Save the private key somewhere — you need it to re-run")

# ── 2. Connect to Base Sepolia ─────────────────────────────────────────────
w3 = Web3(Web3.HTTPProvider("https://sepolia.base.org"))
assert w3.is_connected(), "RPC connection failed"
print(f"\n✅ Connected to Base Sepolia (chain {w3.eth.chain_id})")

# ── 3. Check ETH balance ───────────────────────────────────────────────────
balance = w3.eth.get_balance(account.address)
print(f"💰 ETH balance: {w3.from_wei(balance, 'ether')} ETH")

if balance == 0:
    print("\n❌ No ETH — hit a faucet first:")
    print(f"   https://faucet.quicknode.com/base/sepolia")
    print(f"   Wallet: {account.address}")
    print("\nThen re-run this script with your private key set in .env as SEPOLIA_PRIVATE_KEY")
    set_key(".env", "SEPOLIA_WALLET", account.address)
    set_key(".env", "SEPOLIA_PRIVATE_KEY", account.key.hex())
    exit(0)

# ── 4. Send a self-transfer (creates the pre-baked tx hash) ───────────────
USDC_CONTRACT = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
USDC_ABI = [{"inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],
             "name":"transfer","outputs":[{"name":"","type":"bool"}],
             "type":"function","stateMutability":"nonpayable"}]

# Load private key if re-running
private_key = os.getenv("SEPOLIA_PRIVATE_KEY") or account.key.hex()
sender = Account.from_key(private_key)

usdc = w3.eth.contract(address=Web3.to_checksum_address(USDC_CONTRACT), abi=USDC_ABI)

# Check USDC balance
usdc_balance = usdc.functions.balanceOf(sender.address).call()
print(f"💵 USDC balance: {usdc_balance / 1e6} USDC")

if usdc_balance == 0:
    print("\n❌ No USDC — claim from Circle faucet:")
    print(f"   https://faucet.circle.com  (select Base Sepolia)")
    print(f"   Wallet: {sender.address}")
    print("\nThen re-run this script.")
    exit(0)

# Send 1 USDC to self (burns no real value, just creates a tx on-chain)
tx = usdc.functions.transfer(
    sender.address,  # send to self
    1_000_000        # 1 USDC (6 decimals)
).build_transaction({
    "from": sender.address,
    "nonce": w3.eth.get_transaction_count(sender.address),
    "gas": 100_000,
    "maxFeePerGas": w3.to_wei(0.1, "gwei"),
    "maxPriorityFeePerGas": w3.to_wei(0.01, "gwei"),
    "chainId": 84532,
})

signed = w3.eth.account.sign_transaction(tx, private_key)
tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

print(f"\n✅ Transaction confirmed!")
print(f"   TX hash:      {tx_hash.hex()}")
print(f"   Block number: {receipt['blockNumber']}")
print(f"   Explorer:     https://sepolia.basescan.org/tx/{tx_hash.hex()}")

# ── 5. Write to .env automatically ────────────────────────────────────────
set_key(".env", "SEPOLIA_WALLET", sender.address)
set_key(".env", "SEPOLIA_PRIVATE_KEY", private_key)
set_key(".env", "FAKE_TX_HASH", tx_hash.hex())
set_key(".env", "FAKE_BLOCK_NUMBER", str(receipt['blockNumber']))

print(f"\n✅ .env updated — you're done!")
