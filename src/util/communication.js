import Web3 from 'web3'
import { config, CONTRACTS } from '@/config/wagmi'

import gameAbi from '@/abi/game.json'

/**
 * Get user selected chain
 * @returns Array [chainObject, contractAddress]
 */
export const getActiveChain = () => {
  const DEFAULT_CHAIN_ID = 5031

  if (typeof window !== 'undefined') {
    // Client-side execution: Read from localStorage
    const activeChain = localStorage.getItem(`${process.env.NEXT_PUBLIC_LOCALSTORAGE_PREFIX}active-chain`) || DEFAULT_CHAIN_ID.toString()
    const userSelectedChain = config.chains.filter((filterItem) => filterItem.id.toString() === activeChain.toString())

    // Ensure a chain was actually found
    if (userSelectedChain.length > 0) {
      return [userSelectedChain[0], CONTRACTS[`chain${userSelectedChain[0].id}`]]
    }
  }

  // Server-side execution OR localStorage failed to find a matching chain
  const defaultChain = config.chains.find((filterItem) => filterItem.id === DEFAULT_CHAIN_ID)

  if (defaultChain) {
    return [defaultChain, CONTRACTS[`chain${DEFAULT_CHAIN_ID}`]]
  }

  // Fallback if the default chain isn't even in config (should rarely happen)
  console.error('Default chain not found in config.')
  return [null, null]
}

/**
 * Initialize game contract
 */
export function initGameContract() {
  const activeChain = getActiveChain()
  const rpcUrl = activeChain[0].rpcUrls.default.http[0]
  const contractAddress = activeChain[1].game

  if (!rpcUrl) throw new Error('WEB3_RPC_URL is not defined in environment variables.')

  // Initialize Web3 with an HttpProvider for server-side connection
  const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl))

  // Create a Contract instance
  const contract = new web3.eth.Contract(gameAbi, contractAddress)
  return { web3, contract, contractAddress }
}

export async function getBalance() {
  const { web3, contract, contractAddress } = initGameContract()

  try {
    const balanceInWei = await web3.eth.getBalance(contractAddress)
    return balanceInWei
  } catch (error) {
    console.error('Error fetching contract data with Web3.js:', error)
    return { error }
  }
}

export async function getVRFRequestPrice() {
  const { web3, contract } = initGameContract()

  try {
    const result = await contract.methods.getVRFRequestPrice().call()
    return result
  } catch (error) {
    console.error('Error fetching contract data with Web3.js:', error)
    return { error }
  }
}

export async function getUniquePlayerCount() {
  const { web3, contract } = initGameContract()

  try {
    const result = await contract.methods.uniquePlayerCount().call()
    return result
  } catch (error) {
    console.error('Error fetching contract data with Web3.js:', error)
    return { error }
  }
}

export async function getFee() {
  const { web3, contract } = initGameContract()

  try {
    const result = await contract.methods.fee().call()
    return result
  } catch (error) {
    console.error('Error fetching contract data with Web3.js:', error)
    return { error }
  }
}

export async function getFulfilled() {
  const { web3, contract } = initGameContract()

  try {
    const result = await contract.methods.fulfilled().call()
    return result
  } catch (error) {
    console.error('Error fetching contract data with Web3.js:', error)
    return { error }
  }
}

export async function getAllPrizes() {
  const { web3, contract } = initGameContract()

  try {
    const result = await contract.methods.getAllPrizes().call()
    return result
  } catch (error) {
    console.error('Error fetching contract data with Web3.js:', error)
    return { error }
  }
}

export async function getUnclaimedWinnings(addr) {
  const { web3, contract } = initGameContract()

  try {
    const result = await contract.methods.unclaimedWinnings(addr).call()
    return result
  } catch (error) {
    console.error('Error fetching contract data with Web3.js:', error)
    return { error }
  }
}


export async function getPlayersBatch(index, size, address = `0x0000000000000000000000000000000000000000`) {
  const { web3, contract } = initGameContract()

  try {
    const result = await contract.methods.getPlayersBatch(index, size).call()
    return result
  } catch (error) {
    console.error('Error fetching contract data with Web3.js:', error)
    return { error }
  }
}


export async function getAllEvents() {
  const { web3, contract } = initGameContract()

  try {
    // Get the latest block number (optional, but good for defining a range)
    const latestBlock = await web3.eth.getBlockNumber()
    console.log(`Latest block: ${latestBlock}`)

    // Fetch all events from the contract
    const allEvents = await contract.getPastEvents('allEvents', {
      fromBlock: 0, // Start from block 0 or a specific block number
      toBlock: 'latest', // Go up to the latest block or a specific block number
    })

    console.log(`All historical events: count(${allEvents.length})`)
    allEvents.forEach((event) => {
      console.log('---')
      console.log(`Event Name: ${event.event}`)
      console.log(`Block Number: ${event.blockNumber}`)
      console.log(`Transaction Hash: ${event.transactionHash}`)
      console.log('Return Values:', event.returnValues)
    })
    return allEvents
  } catch (error) {
    console.error('Error fetching past events:', error)
  }
}

export async function getAllReacted() {
  const { web3, contract } = initGameContract()

  try {
    // Get the latest block number (optional, but good for defining a range)
    const latestBlock = await web3.eth.getBlockNumber()

    // Fetch specific events (e.g., 'Transfer' events)
    const reactEvents = await contract.getPastEvents('Reacted', {
      fromBlock: 0, // Example: fetch events from the last 1000 blocks
      toBlock: 'latest',
    })

    // reactEvents.forEach(event => {
    //     console.log('---');
    //     console.log(`Block Number: ${event.blockNumber}`);
    //     console.log(`From: ${event.returnValues.from}`);
    //     console.log(`To: ${event.returnValues.to}`);
    //     console.log(`Value: ${event.returnValues.value}`);
    // });
    return reactEvents
  } catch (error) {
    console.error('Error fetching past events:', error)
    return error
  }
}

export async function getLastGift() {
  const { web3, contract } = initGameContract()

  try {
    // Get the latest block number (optional, but good for defining a range)
    const latestBlock = await web3.eth.getBlockNumber()

    // Fetch specific events (e.g., 'Transfer' events)
    const reactEvents = await contract.getPastEvents('Reacted', {
      fromBlock: 0, // Example: fetch events from the last 1000 blocks
      toBlock: 'latest',
    })

    // reactEvents.forEach(event => {
    //     console.log('---');
    //     console.log(`Block Number: ${event.blockNumber}`);
    //     console.log(`From: ${event.returnValues.from}`);
    //     console.log(`To: ${event.returnValues.to}`);
    //     console.log(`Value: ${event.returnValues.value}`);
    // });
    return reactEvents
  } catch (error) {
    console.error('Error fetching past events:', error)
    return error
  }
}
