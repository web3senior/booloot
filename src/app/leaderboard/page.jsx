'use client'

import { useState, useEffect, useId, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {useWaitForTransactionReceipt, useAccount, useWriteContract } from 'wagmi'
import { initGameContract, getVRFRequestPrice, getFee, getPlayersBatch, getUnclaimedWinnings, getBalance, getUniquePlayerCount, getAllPrizes, getFulfilled, getActiveChain } from '@/util/communication'
import { useClientMounted } from '@/hooks/useClientMount'
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
      <div className={`__container ${styles.page__container} `} data-width={`medium`}>
        <div className={`grid grid--fill gap-050`} style={{ '--data-width': `200px` }}>
       
          
            
              {players.list.length > 0 &&
                players.list
                  .sort((a, b) => Number(b.wins) - Number(a.wins))
                  .map((item, i) => (
                    <div key={i} className={`card`}>
                    <div className='card__body flex flex-column'>
                      <td>
                        {i===0?`🥇`: i===1?`🥈`:i===2?`🥉`:i}
                      </td>
                      <td>
                        User: <b><code className={``}>{`${item.player.slice(0, 4)}…${item.player.slice(38)}`}</code></b>
                      </td>
                      <td>
                        Total win: <b>{web3.utils.fromWei(item.wins, `ether`)} {activeChain[0].nativeCurrency.symbol}</b>
                      </td>
                      <td>Total play: <b>{item.played}</b></td>
                    </div>
                      </div>
                  ))}
          
     
        </div>
      </div>
    </div>
  )
}