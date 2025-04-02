import { RPC_URL, RPC_AUTH } from './constants.js'
import {
  getIndexProviderPeerId,
  MINER_TO_PEERID_CONTRACT_ADDRESS,
  MINER_TO_PEERID_CONTRACT_ABI
  , ethers
} from '../vendor/deno-deps.js'

// Initialize your ethers contract instance
const fetchRequest = new ethers.FetchRequest(RPC_URL)
fetchRequest.setHeader('Authorization', `Bearer ${RPC_AUTH}`)
const provider = new ethers.JsonRpcProvider(fetchRequest)
const smartContractClient = new ethers.Contract(
  MINER_TO_PEERID_CONTRACT_ADDRESS,
  MINER_TO_PEERID_CONTRACT_ABI,
  provider
)

/**
 * @param {string} minerId - The ID of the miner.
 * @param {object} options - Options for the function.
 * @param {number} options.maxAttempts - The maximum number of attempts to fetch the peer ID.
 * @returns {Promise<string>} The peer ID of the miner.
 */
export async function getMinerPeerId (minerId, { maxAttempts = 5 } = {}) {
  const { peerId } = await getIndexProviderPeerId(minerId, smartContractClient, {
    rpcUrl: RPC_URL,
    rpcAuth: RPC_AUTH,
    maxAttempts
  })
  return peerId
}
