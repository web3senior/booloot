'use client'

import { useState, useEffect, useId, useRef, useCallback } from 'react'
import Link from 'next/link'
import moment from 'moment'
import boo from '@/../public/boo.svg'
import somnia from '@/../public/somnia.svg'
import BoolootIcon1 from '@/../public/icons/booloot-icon-1.svg'
import { useParams, useRouter } from 'next/navigation'
import { useConnectorClient, useConnections, useClient, networks, useWaitForTransactionReceipt, useAccount, useDisconnect, Connector, useConnect, useWriteContract, useReadContract } from 'wagmi'
import { initGameContract, getVRFRequestPrice, getFee, getPlayersBatch, getUnclaimedWinnings, getBalance, getUniquePlayerCount, getAllPrizes, getFulfilled, getActiveChain } from '@/util/communication'
import { getProfile } from '@/util/api'
import PollTimer from '@/components/PollTimer'
import { useAuth } from '@/contexts/AuthContext'
import Web3 from 'web3'
import { isPollActive } from '@/util/utils'
import { useClientMounted } from '@/hooks/useClientMount'
import { config } from '@/config/wagmi'
import abi from '@/abi/game.json'
import { parseEther, parseGwei } from 'viem'
import { toast } from '@/components/NextToast'
import Shimmer from '@/helper/Shimmer'
import { InlineLoading } from '@/components/Loading'
import Profile, { ProfileImage } from '@/app/ui/Profile'
import { CommentIcon, ShareIcon, RepostIcon, TipIcon, InfoIcon, BlueCheckMarkIcon } from '@/components/Icons'
import styles from './page.module.scss'

moment.defineLocale('en-short', {
  relativeTime: {
    future: 'in %s',
    past: '%s', //'%s ago'
    s: '1s',
    ss: '%ds',
    m: '1m',
    mm: '%dm',
    h: '1h',
    hh: '%dh',
    d: '1d',
    dd: '%dd',
    M: '1mo',
    MM: '%dmo',
    y: '1y',
    yy: '%dy',
  },
})

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

const randomIcon = () => {
  return <img alt={`Booloot icon`} src={BoolootIcon1.src} />
}

const CommentModal = ({ item, type, parentId = 0, setShowCommentModal }) => {
  const [hasLiked, setHasLiked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const isMounted = useClientMounted()
  const [commentContent, setCommentContent] = useState('')
  const { address, isConnected } = useAccount()
  const { web3, contract } = initGameContract()
  const { data: hash, isPending: isSigning, error: submitError, writeContract } = useWriteContract()
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash,
  })

  const getHasLiked = async () => {
    return isConnected ? await getHasLikedPost(id, address) : false
  }

  const postComment = (e) => {
    e.stopPropagation()

    if (!isConnected) {
      console.log(`Please connect your wallet first`, 'error')
      return
    }
    console.log(parentId)
    writeContract({
      abi: abi,
      address: process.env.NEXT_PUBLIC_CONTRACT_POST_COMMENT,
      functionName: 'addComment',
      args: [web3.utils.toNumber(item.postId), parentId, commentContent, ''],
    })
  }

  const unlikePost = (e, id) => {
    e.stopPropagation()

    if (!isConnected) {
      console.log(`Please connect your wallet first`, 'error')
      return
    }

    writeContract({
      abi,
      address: process.env.NEXT_PUBLIC_CONTRACT_POST,
      functionName: 'unlikePost',
      args: [id],
    })
  }

  useEffect(() => {}, [item])

  // if (loading) {
  //   return <InlineLoading />
  // }

  if (error) {
    return <span>{error}</span>
  }

  return (
    <div className={`${styles.commentModal} animate fade`} onClick={() => setShowCommentModal()}>
      <div className={`${styles.commentModal__container}`} onClick={(e) => e.stopPropagation()}>
        <header className={`${styles.commentModal__container__header}`}>
          <div className={``} aria-label="Close" onClick={() => setShowCommentModal()}>
            Cancel
          </div>
          <div className={`flex-1`}>
            <h3>Post your {type === `post` ? `comment` : `reply`}</h3>
          </div>
          <div className={`pointer`} onClick={(e) => updateStatus(e)}>
            {isSigning ? `Signing...` : isConfirming ? 'Confirming...' : status && status.content !== '' ? `Update` : `Share`}
          </div>
        </header>

        <main className={`${styles.commentModal__container__main}`}>
          <article className={`${styles.commentModal__post}`}>
            <section className={`flex flex-column align-items-start justify-content-between`}>
              <header className={`${styles.commentModal__post__header}`}>
                <Profile creator={item.creator} createdAt={item.createdAt} />
              </header>
              <main className={`${styles.commentModal__post__main} w-100 flex flex-column grid--gap-050`}>
                <div
                  className={`${styles.post__content} `}
                  // onClick={(e) => e.stopPropagation()}
                  id={`post${item.postId}`}
                >
                  {item.content}
                </div>
              </main>
            </section>
          </article>
        </main>

        <footer className={`${styles.commentModal__footer}  flex flex-column align-items-start`}>
          <ConnectedProfile addr={address} />
          <textarea autoFocus defaultValue={commentContent} onInput={(e) => setCommentContent(e.target.value)} placeholder={`${type === `post` ? `Comment` : `Reply`} to ${item.creator.slice(0, 4)}…${item.creator.slice(38)}`} />
          <button className="btn" onClick={(e) => postComment(e)}>
            Post {type === `post` ? `comment` : `reply`}
          </button>
        </footer>
      </div>
    </div>
  )
}
