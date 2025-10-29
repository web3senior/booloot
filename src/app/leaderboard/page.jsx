'use client'

import { useState, useEffect, useId, useRef, useCallback } from 'react'
import BoolootIcon1 from '@/../public/icons/booloot-icon-1.svg'
import { useParams, useRouter } from 'next/navigation'
import { useConnectorClient, useConnections, useClient, networks, useWaitForTransactionReceipt, useAccount, useDisconnect, Connector, useConnect, useWriteContract, useReadContract } from 'wagmi'
import { initGameContract, getVRFRequestPrice, getFee, getPlayersBatch, getUnclaimedWinnings, getBalance, getUniquePlayerCount, getAllPrizes, getFulfilled, getActiveChain } from '@/util/communication'
import { useClientMounted } from '@/hooks/useClientMount'
import abi from '@/abi/game.json'
import Profile, { ProfileImage } from '@/app/ui/Profile'
import styles from './page.module.scss'

export default function Page() {
  const [uniquePlayerCount, setUniquePlayerCount] = useState(0)
  const [isLoadedPlayer, setIsLoadedPlayer] = useState(false)
  const [postsLoaded, setPostsLoaded] = useState(0)
  const [players, setPlayers] = useState({ list: [] })

  const [commentsLoaded, setcommentsLoaded] = useState(0)
  const [reactionCounter, setReactionCounter] = useState(0)
  const [replyCount, setReplyCount] = useState(0)

  const [showCommentModal, setShowCommentModal] = useState()
  const { web3, contract } = initGameContract()
  const giftModal = useRef()
  const giftModalMessage = useRef()
  const mounted = useClientMounted()
  const [chains, setChains] = useState()
  const params = useParams()
  const activeChain = getActiveChain()
  const { address, isConnected } = useAccount()
  const router = useRouter()
  const { data: hash, isPending, writeContract } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const loadMorePlayer = async (size) => {
    // 1. **Add a guard clause to prevent re-entry**
    if (isLoadedPlayer) return

    // 2. Set to true *before* starting the async operation
    setIsLoadedPlayer(true)

    try {
      let showingPlayerCount = 100
      let startIndex = size - commentsLoaded - showingPlayerCount

      // **Stop loading if all posts are accounted for**
      if (commentsLoaded >= size) {
        console.log('All polls loaded.')
        // We can return here, but still need to handle setIsLoadedPoll(false)
      }

      if (startIndex < 0) {
        // Check if we are trying to load past the first post
        showingPlayerCount = size - commentsLoaded
        startIndex = 0
        if (showingPlayerCount <= 0) {
          // All loaded
          console.log('All polls loaded.')
          return // Exit early
        }
      }

      // ... (rest of your logic for calculating startIndex/showingPlayerCount) ...

      // 3. Fetch the next batch of polls
      console.log(startIndex + 1, showingPlayerCount)
      const newPlayers = await getPlayersBatch(startIndex, showingPlayerCount)
      console.log(`newPlayers => `, newPlayers)
      newPlayers.reverse()

      if (Array.isArray(newPlayers) && newPlayers.length > 0) {
        setPlayers((prevComments) => ({ list: [...prevComments.list, ...newPlayers] }))
        setcommentsLoaded((prevLoaded) => prevLoaded + newPlayers.length)
      }
    } catch (error) {
      console.error('Error loading more polls:', error)
    } finally {
      // 4. **Crucial: Set to false in finally block**
      // This re-enables loading for the next scroll event.
      setIsLoadedPlayer(false)
    }
  }

  const openModal = (e, item) => {
    e.target.innerText = `Sending...`
    setSelectedEmoji({ e: e.target, item: item, message: null })
    giftModal.current.showModal()
  }

  useEffect(() => {
    getUniquePlayerCount().then((res) => {
      setUniquePlayerCount(Number(res))

      if (postsLoaded === 0 && !isLoadedPlayer) {
        loadMorePlayer(Number(res))
      }
    })
  }, []) // Added necessary dependencies  [isLoadedComment, commentsLoaded]

  return (
    <div className={`${styles.page} ms-motion-slideDownIn`}>
      {showCommentModal && <CommentModal item={showCommentModal.data} parentId={showCommentModal.parentId} type={showCommentModal.type} setShowCommentModal={setShowCommentModal} />}

      <div className={`__container ${styles.page__container} flex flex-column justify-content-center gap-1`} data-width={`medium`}>
        <div className={`grid grid--fill gap-050 w-100`} style={{ '--data-width': `400px` }}>
          <table className={``}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>User</th>
                <th>Total win</th>
                <th>Total play</th>
              </tr>
            </thead>
            <tbody>
              {players.list.length > 0 &&
                players.list
                  .sort((a, b) => Number(a.wins) - Number(chains.wins))
                  .map((item, i) => (
                    <tr key={i}>
                      <td>1</td>
                      <td>
                        <code className={``}>{`${item.player.slice(0, 4)}…${item.player.slice(38)}`}</code>
                      </td>
                      <td>
                        {web3.utils.fromWei(item.wins, `ether`)} {activeChain[0].nativeCurrency.symbol}
                      </td>
                      <td>{item.played}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}