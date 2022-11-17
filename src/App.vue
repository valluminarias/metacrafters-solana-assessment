<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js'

// create types
type DisplayEncoding = 'utf8' | 'hex'

type PhantomEvent = 'disconnect' | 'connect' | 'accountChanged'
type PhantomRequestMethod =
  | 'connect'
  | 'disconnect'
  | 'signTransaction'
  | 'signAllTransactions'
  | 'signMessage'

interface ConnectOpts {
  onlyIfTrusted: boolean
}

// create a provider interface (hint: think of this as an object) to store the Phantom Provider
interface PhantomProvider {
  publicKey: PublicKey | null
  isConnected: boolean | null
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>
  signMessage: (
    message: Uint8Array | string,
    display?: DisplayEncoding,
  ) => Promise<any>
  connect: (opts?: Partial<ConnectOpts>) => Promise<{ publicKey: PublicKey }>
  disconnect: () => Promise<void>
  on: (event: PhantomEvent, handler: (args: any) => void) => void
  request: (method: PhantomRequestMethod, params: any) => Promise<unknown>
}

const NETWORK = 'devnet'
const connection = ref<Connection | undefined>()
const provider = ref<PhantomProvider | undefined>()
const accountKeypair = ref<Keypair | undefined>()
const account = ref<PublicKey | undefined>()
const accountBalance = ref(0)
const phantomWallet = ref<PublicKey | undefined>()
const walletBalance = ref(0)
const processing = ref(false)

onMounted(() => {
  setTimeout(() => {
    getProvider()
    establishConnection()
  }, 10)
})

const getProvider = () => {
  if ('solana' in window) {
    // @ts-ignore
    const prov = window.solana as any
    if (prov.isPhantom) {
      provider.value = prov as PhantomProvider
    }
  }
}

const establishConnection = () => {
  connection.value = new Connection(clusterApiUrl(NETWORK), 'confirmed')
}

const createAccount = async () => {
  processing.value = true

  const keypair = Keypair.generate()

  accountKeypair.value = keypair
  account.value = keypair.publicKey

  await airdrop(account.value)
  accountBalance.value = (await fetchBalance(account.value)) || 0

  processing.value = false
}

const connectWallet = async () => {
  if (provider.value) {
    processing.value = true

    try {
      const res = await provider.value.connect()
      phantomWallet.value = res.publicKey

      walletBalance.value = (await fetchBalance(phantomWallet.value)) || 0
    } catch (err) {
      console.log(err)
    } finally {
      processing.value = false
    }
  }
}

const disconnectWallet = async () => {
  if (provider.value) {
    processing.value = true
    try {
      await provider.value.disconnect()
      console.log('wallet disconnected')

      phantomWallet.value = undefined
    } catch (err) {
      console.log(err)
    } finally {
      processing.value = false
    }
  }
}

const transferToNewWallet = async () => {
  if (!account.value || !phantomWallet.value) {
    alert('Account and Phantom Wallet are required!')
    return false
  }

  const from = account.value as PublicKey
  const to = phantomWallet.value as PublicKey

  const amount = 1.999 * LAMPORTS_PER_SOL // Deducted the possible transaction fee

  processing.value = true

  try {
    var transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports: amount,
      }),
    )

    // Sign transaction
    var signature = await sendAndConfirmTransaction(
      connection.value as Connection,
      transaction,
      [accountKeypair.value as Keypair],
    )

    Promise.all([
      (accountBalance.value =
        (await fetchBalance(account.value as PublicKey)) || 0),
      (walletBalance.value =
        (await fetchBalance(phantomWallet.value as PublicKey)) || 0),
    ])

    alert(`Transferred 2 SOL from ${from} to ${to} with signature ${signature}`)
  } catch (err) {
    console.log(err)
  } finally {
    processing.value = false
  }
}

const airdrop = async (key: PublicKey) => {
  if (!connection) {
    return false
  }

  const airDropSignature = await connection.value?.requestAirdrop(
    new PublicKey(key),
    2 * LAMPORTS_PER_SOL, // Added 100K lamports to cover transfer fee
  )

  return await connection.value?.confirmTransaction(airDropSignature as string)
}

const fetchBalance = async (key: PublicKey) => {
  if (!connection) {
    return 0
  }

  try {
    return await connection.value?.getBalance(key)
  } catch (err) {
    console.log(err)
  }
}

const balanceInSol = (amount: number) => {
  return amount / LAMPORTS_PER_SOL
}
</script>

<template>
  <header class="flex py-2 items-center">
    <h1 class="text-2xl">Solana Assessment</h1>

    <div class="flex-1">
      <em
        v-if="connection && provider"
        class="text-sm px-1 border rounded-md bg-green-200 text-green-700 float-right"
      >
        Connected
      </em>
    </div>
  </header>
  <hr />
  <main class="mt-8">
    <div v-if="connection && provider" class="space-y-4">
      <div class="card">
        <div v-if="account" class="flex flex-col">
          <span>Account: {{ account }}</span>
          <span>Balance: {{ balanceInSol(accountBalance) }} SOL</span>
        </div>
        <button
          class="btn mt-4"
          @click="createAccount()"
          :disabled="processing"
        >
          Create a new Solana account
        </button>
      </div>

      <div class="card">
        <div v-if="phantomWallet" class="flex flex-col">
          <span>Account: {{ phantomWallet }}</span>
          <span>Balance: {{ balanceInSol(walletBalance) }} SOL</span>
        </div>
        <button
          class="btn mt-4"
          @click="connectWallet()"
          :disabled="processing"
          v-if="!phantomWallet"
        >
          Connect to Phantom Wallet
        </button>
        <button
          class="btn mt-4"
          @click="disconnectWallet()"
          :disabled="processing"
          v-if="phantomWallet"
        >
          Disconnect
        </button>
      </div>

      <div class="card">
        <button
          class="btn"
          @click="transferToNewWallet()"
          :disabled="processing"
        >
          Transfer to new Wallet
        </button>
      </div>
    </div>

    <div v-if="!provider">
      <p>
        No provider found. Install
        <a href="https://phantom.app/" target="_blank">
          Phantom Browser extension
        </a>
      </p>
    </div>
  </main>
</template>

<style>
body {
  @apply h-screen w-full bg-green-700 text-white antialiased;
}

#app {
  @apply mt-10 w-[40rem] mx-auto;
}

.card {
  @apply px-4 rounded-md border py-6 whitespace-pre-wrap;
}

.btn {
  @apply bg-green-500 rounded-md px-4 py-2 border-b-green-600 border-b-2 shadow-lg text-green-50;
}

.btn:hover {
  @apply bg-green-300;
}

.btn:disabled {
  @apply bg-green-200 cursor-not-allowed;
}
</style>
