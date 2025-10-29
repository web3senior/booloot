'use client'

import { useState, useEffect, useId, useRef, useCallback } from 'react'
import Link from 'next/link'
import moment from 'moment'
import txIcon from '@/../public/icons/tx.svg'
import { useParams, useRouter } from 'next/navigation'
import { useConnectorClient, useConnections, useClient, networks, useWaitForTransactionReceipt, useAccount, useDisconnect, Connector, useConnect, useWriteContract, useReadContract } from 'wagmi'
import { initGameContract, getFee, getBalance, getUniquePlayerCount, getPostCount, getVoteCountsForPoll, getVoterChoices } from '@/util/communication'
import { getProfile } from '@/util/api'
import PollTimer from '@/components/PollTimer'
import { useAuth } from '@/contexts/AuthContext'
import Web3 from 'web3'
import { isPollActive } from '@/util/utils'
import { useClientMounted } from '@/hooks/useClientMount'
import { config } from '@/config/wagmi'
import abi from '@/abi/game.json'
import { getActiveChain } from '@/util/communication'
import { toast } from '@/components/NextToast'
import Shimmer from '@/helper/Shimmer'
import { InlineLoading } from '@/components/Loading'
import Profile from '@/app/ui/Profile'
import { ShareIcon, RepostIcon, TipIcon, InfoIcon, BlueCheckMarkIcon, ThreeDotIcon } from '@/components/Icons'
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
  const [fee, setFee] = useState()
  const [contractBalance, setContractBalance] = useState(0)
  const [uniquePlayerCount, setUniquePlayerCount] = useState(0)

  const [showCommentModal, setShowCommentModal] = useState()
  const { web3, contract } = initGameContract()
  const giftModal = useRef()
  const giftModalMessage = useRef()
  const mounted = useClientMounted()
  const params = useParams()
  const router = useRouter()
  const activeChain = getActiveChain()
  const { address, isConnected } = useAccount()
  const { data: hash, isPending, writeContract } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const loadMorePosts = async (totalPoll) => {
    // 1. **Add a guard clause to prevent re-entry**
    if (isLoadedPoll) return

    // 2. Set to true *before* starting the async operation
    setIsLoadedPoll(true)

    try {
      let postsPerPage = 20
      let startIndex = totalPoll - postsLoaded - postsPerPage

      // **Stop loading if all posts are accounted for**
      if (postsLoaded >= totalPoll) {
        console.log('All polls loaded.')
        // We can return here, but still need to handle setIsLoadedPoll(false)
      }

      if (startIndex < 0) {
        // Check if we are trying to load past the first post
        postsPerPage = totalPoll - postsLoaded
        startIndex = 0
        if (postsPerPage <= 0) {
          // All loaded
          console.log('All polls loaded.')
          return // Exit early
        }
      }

      // ... (rest of your logic for calculating startIndex/postsPerPage) ...

      // 3. Fetch the next batch of polls
      console.log(startIndex + 1, postsPerPage)
      const newPosts = await getPosts(startIndex + 1, postsPerPage, address)
      console.log(`newPosts => `, newPosts)
      newPosts.reverse()

      if (Array.isArray(newPosts) && newPosts.length > 0) {
        setPosts((prevPolls) => ({ list: [...prevPolls.list, ...newPosts] }))
        setPostsLoaded((prevLoaded) => prevLoaded + newPosts.length)
      }
    } catch (error) {
      console.error('Error loading more polls:', error)
    } finally {
      // 4. **Crucial: Set to false in finally block**
      // This re-enables loading for the next scroll event.
      setIsLoadedPoll(false)
    }
  }

  const openModal = (e, item) => {
    e.target.innerText = `Sending...`
    setSelectedEmoji({ e: e.target, item: item, message: null })
    giftModal.current.showModal()
  }

  useEffect(() => {
    getFee().then((res) => {
      setFee(Number(res))
    })

    getBalance().then((res) => {
      setContractBalance(Number(res))
    })

    getUniquePlayerCount().then((res) => {
      setUniquePlayerCount(Number(res))
    })
    /**
     * 

     */
    // console.log(config)
    // getPostCount().then((count) => {
    //   const totalPoll = web3.utils.toNumber(count)
    //   setPostCount(totalPoll)
    //   if (postsLoaded === 0 && !isLoadedPoll) {
    //     loadMorePosts(totalPoll)
    //   }
    // })
  }, [showCommentModal]) // Added necessary dependencies  [isLoadedPoll, postsLoaded]

  return (
    <div className={`${styles.page} ms-motion-slideDownIn`}>
      {showCommentModal && <CommentModal item={showCommentModal} setShowCommentModal={setShowCommentModal} />}

      <div className={`__container ${styles.page__container} flex flex-column justify-content-center gap-1`} data-width={`small`}>
        <div className={`${styles.intro} flex flex-column align-items-center`}>
          <h1 className={`text-uppercase`}>{process.env.NEXT_PUBLIC_NAME}</h1>
          <small>GAME</small>
          <p className={`mt-20`}>
            Unlock your guaranteed prize for just <span>{fee ? `${web3.utils.fromWei(fee, `ether`)} ${activeChain[0].nativeCurrency.symbol}` : `reading...`}</span>. Every box is a winner! play now!
          </p>
        </div>

        <div className={`${styles.treasure} flex flex-column align-items-center`}>
          <div className={`flex align-items-center gap-050`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M7 21V19H11V15.9C10.1833 15.7167 9.45417 15.3708 8.8125 14.8625C8.17083 14.3542 7.7 13.7167 7.4 12.95C6.15 12.8 5.10417 12.2542 4.2625 11.3125C3.42083 10.3708 3 9.26667 3 8V7C3 6.45 3.19583 5.97917 3.5875 5.5875C3.97917 5.19583 4.45 5 5 5H7V3H17V5H19C19.55 5 20.0208 5.19583 20.4125 5.5875C20.8042 5.97917 21 6.45 21 7V8C21 9.26667 20.5792 10.3708 19.7375 11.3125C18.8958 12.2542 17.85 12.8 16.6 12.95C16.3 13.7167 15.8292 14.3542 15.1875 14.8625C14.5458 15.3708 13.8167 15.7167 13 15.9V19H17V21H7ZM7 10.8V7H5V8C5 8.63333 5.18333 9.20417 5.55 9.7125C5.91667 10.2208 6.4 10.5833 7 10.8ZM12 14C12.8333 14 13.5417 13.7083 14.125 13.125C14.7083 12.5417 15 11.8333 15 11V5H9V11C9 11.8333 9.29167 12.5417 9.875 13.125C10.4583 13.7083 11.1667 14 12 14ZM17 10.8C17.6 10.5833 18.0833 10.2208 18.45 9.7125C18.8167 9.20417 19 8.63333 19 8V7H17V10.8Z"
                fill="#FF601C"
              />
            </svg>

            <h2 className={`text-uppercase color-primary`}>treasure pool</h2>
          </div>

          <h1 className="text-white">
            {web3.utils.fromWei(contractBalance || 0, `ether`)} <small style={{fontSize:`12px`}}>{activeChain[0].nativeCurrency.symbol}</small>
          </h1>

          <div className={`flex align-items-center gap-025`}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_10795_3204)">
                <path
                  d="M0.398438 14.1686V13.1976C0.398438 12.6678 0.675101 12.2326 1.22843 11.892C1.78189 11.5516 2.50325 11.3814 3.3925 11.3814C3.53943 11.3814 3.68741 11.3859 3.83646 11.3951C3.98551 11.4043 4.13562 11.4221 4.2868 11.4487C4.13164 11.6968 4.0165 11.9544 3.94138 12.2213C3.86639 12.4883 3.8289 12.7622 3.8289 13.0429V14.1686H0.398438ZM5.17651 14.1686V13.0736C5.17651 12.7008 5.28117 12.36 5.49047 12.0513C5.69978 11.7424 6.00146 11.4732 6.39552 11.2436C6.78958 11.0138 7.25518 10.8416 7.79231 10.7268C8.32932 10.6118 8.91636 10.5544 9.55343 10.5544C10.2027 10.5544 10.7959 10.6118 11.3329 10.7268C11.8699 10.8416 12.3354 11.0138 12.7295 11.2436C13.1237 11.4732 13.4233 11.7424 13.6285 12.0513C13.8337 12.36 13.9363 12.7008 13.9363 13.0736V14.1686H5.17651ZM15.2839 14.1686V13.0453C15.2839 12.7458 15.2485 12.4635 15.1776 12.1984C15.1066 11.9335 15.0002 11.6836 14.8583 11.4487C15.0145 11.4221 15.1638 11.4043 15.3062 11.3951C15.4486 11.3859 15.5893 11.3814 15.7281 11.3814C16.6174 11.3814 17.3374 11.5496 17.8882 11.886C18.439 12.2224 18.7144 12.6596 18.7144 13.1976V14.1686H15.2839ZM6.43235 12.9741H12.6928V12.8898C12.6112 12.5682 12.2722 12.2977 11.6759 12.0782C11.0797 11.8586 10.3732 11.7489 9.55642 11.7489C8.73963 11.7489 8.03314 11.8586 7.43694 12.0782C6.84061 12.2977 6.50575 12.5682 6.43235 12.8898V12.9741ZM3.39031 10.6079C3.01497 10.6079 2.6943 10.4745 2.42832 10.2075C2.16234 9.94064 2.02935 9.61978 2.02935 9.24496C2.02935 8.86524 2.16288 8.54444 2.42992 8.28258C2.69683 8.02071 3.01769 7.88978 3.3925 7.88978C3.77222 7.88978 4.09428 8.02071 4.35867 8.28258C4.62319 8.54444 4.75545 8.86603 4.75545 9.24735C4.75545 9.61739 4.62458 9.93665 4.36285 10.2052C4.10125 10.4737 3.77707 10.6079 3.39031 10.6079ZM15.7281 10.6079C15.3565 10.6079 15.0364 10.4737 14.7679 10.2052C14.4994 9.93665 14.3652 9.61739 14.3652 9.24735C14.3652 8.86603 14.4994 8.54444 14.7679 8.28258C15.0364 8.02071 15.3569 7.88978 15.7295 7.88978C16.1135 7.88978 16.4364 8.02071 16.6982 8.28258C16.9601 8.54444 17.091 8.86524 17.091 9.24496C17.091 9.61978 16.9604 9.94064 16.6992 10.2075C16.438 10.4745 16.1143 10.6079 15.7281 10.6079ZM9.55921 9.95709C8.98557 9.95709 8.49715 9.75608 8.09393 9.35406C7.69071 8.95217 7.4891 8.46408 7.4891 7.88978C7.4891 7.30393 7.69005 6.81292 8.09194 6.41674C8.49396 6.02042 8.98212 5.82227 9.55642 5.82227C10.1421 5.82227 10.6331 6.02016 11.0295 6.41594C11.4256 6.81159 11.6237 7.30194 11.6237 7.88699C11.6237 8.46049 11.4259 8.94892 11.0303 9.35227C10.6345 9.75549 10.1441 9.95709 9.55921 9.95709ZM9.5602 8.76257C9.80375 8.76257 10.0095 8.67737 10.1774 8.50695C10.3454 8.3364 10.4294 8.12935 10.4294 7.8858C10.4294 7.64238 10.3457 7.43666 10.1784 7.26863C10.011 7.10073 9.80368 7.01678 9.55642 7.01678C9.31552 7.01678 9.1098 7.10047 8.93925 7.26783C8.7687 7.43507 8.68342 7.64238 8.68342 7.88978C8.68342 8.13067 8.7687 8.3364 8.93925 8.50695C9.1098 8.67737 9.31678 8.76257 9.5602 8.76257Z"
                  fill="#717680"
                />
              </g>
              <defs>
                <clipPath id="clip0_10795_3204">
                  <rect width="19.1123" height="19.1123" fill="white" />
                </clipPath>
              </defs>
            </svg>

            <small className={`text-uppercase`}>{uniquePlayerCount} players</small>
          </div>
        </div>

        <button>Connect wallet</button>
        <button onClick={() => router.push(`/leaderboard`)}>Leaderboard</button>

        <ul className={`${styles.usecase} flex flex-row align-items-center justify-content-between gap-050`}>
          <li className={`flex flex-column align-items-center gap-050`}>
            <div className={`${styles.usecase__icon}`}>
              <svg width="14" height="19" viewBox="0 0 14 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.598 15.5943L10.773 9.39425H6.773L7.498 3.71925L2.873 10.3943H6.348L5.598 15.5943ZM3.625 18.8365L4.625 11.8943H0L8.24025 0H9.471L8.48075 7.89425H13.9805L4.85575 18.8365H3.625Z" fill="#6B6B6B" />
              </svg>
            </div>

            <span>Instant</span>
          </li>

          <li className={`flex flex-column align-items-center gap-050`}>
            <div className={`${styles.usecase__icon}`}>
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M4.19225 17V15.5H7.75V12.073C6.90133 11.9025 6.15133 11.5455 5.5 11.002C4.84867 10.4583 4.38583 9.78075 4.1115 8.96925C2.95767 8.83208 1.984 8.34233 1.1905 7.5C0.396833 6.65767 0 5.65767 0 4.5V3.5C0 3.091 0.14775 2.73875 0.44325 2.44325C0.73875 2.14775 1.091 2 1.5 2H3.827V0H13.173V2H15.5C15.909 2 16.2613 2.14775 16.5568 2.44325C16.8523 2.73875 17 3.091 17 3.5V4.5C17 5.65767 16.6032 6.65767 15.8095 7.5C15.016 8.34233 14.0423 8.83208 12.8885 8.96925C12.6142 9.78075 12.1513 10.4583 11.5 11.002C10.8487 11.5455 10.0987 11.9025 9.25 12.073V15.5H12.8077V17H4.19225ZM3.827 7.35775V3.5H1.5V4.5C1.5 5.1975 1.71858 5.81 2.15575 6.3375C2.59292 6.865 3.15 7.20508 3.827 7.35775ZM8.5 10.6348C9.37817 10.6348 10.1233 10.3286 10.7355 9.71625C11.3477 9.10408 11.6538 8.35892 11.6538 7.48075V1.5H5.34625V7.48075C5.34625 8.35892 5.65233 9.10408 6.2645 9.71625C6.87667 10.3286 7.62183 10.6348 8.5 10.6348ZM13.173 7.35775C13.85 7.20508 14.4071 6.865 14.8443 6.3375C15.2814 5.81 15.5 5.1975 15.5 4.5V3.5H13.173V7.35775Z"
                  fill="#6B6B6B"
                />
              </svg>
            </div>
            <span>Prizes</span>
          </li>

          <li className={`flex flex-column align-items-center gap-050`}>
            <div className={`${styles.usecase__icon}`}>
              <svg width="18" height="17" viewBox="0 0 18 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M1.5 14.5V15.5V1.5V14.5ZM1.80775 17C1.30908 17 0.883083 16.8234 0.52975 16.4703C0.176583 16.1169 0 15.6909 0 15.1923V1.80775C0 1.30908 0.176583 0.883083 0.52975 0.52975C0.883083 0.176583 1.30908 0 1.80775 0H15.1923C15.6909 0 16.1169 0.176583 16.4703 0.52975C16.8234 0.883083 17 1.30908 17 1.80775V4.529H15.5V1.80775C15.5 1.71792 15.4712 1.64417 15.4135 1.5865C15.3558 1.52883 15.2821 1.5 15.1923 1.5H1.80775C1.71792 1.5 1.64417 1.52883 1.5865 1.5865C1.52883 1.64417 1.5 1.71792 1.5 1.80775V15.1923C1.5 15.2821 1.52883 15.3558 1.5865 15.4135C1.64417 15.4712 1.71792 15.5 1.80775 15.5H15.1923C15.2821 15.5 15.3558 15.4712 15.4135 15.4135C15.4712 15.3558 15.5 15.2821 15.5 15.1923V12.471H17V15.1923C17 15.6909 16.8234 16.1169 16.4703 16.4703C16.1169 16.8234 15.6909 17 15.1923 17H1.80775ZM9.80775 13C9.30908 13 8.88308 12.8234 8.52975 12.4703C8.17658 12.1169 8 11.6909 8 11.1923V5.80775C8 5.30908 8.17658 4.88308 8.52975 4.52975C8.88308 4.17658 9.30908 4 9.80775 4H16.1923C16.6909 4 17.1169 4.17658 17.4703 4.52975C17.8234 4.88308 18 5.30908 18 5.80775V11.1923C18 11.6909 17.8234 12.1169 17.4703 12.4703C17.1169 12.8234 16.6909 13 16.1923 13H9.80775ZM16.1923 11.5C16.2821 11.5 16.3558 11.4712 16.4135 11.4135C16.4712 11.3558 16.5 11.2821 16.5 11.1923V5.80775C16.5 5.71792 16.4712 5.64417 16.4135 5.5865C16.3558 5.52883 16.2821 5.5 16.1923 5.5H9.80775C9.71792 5.5 9.64417 5.52883 9.5865 5.5865C9.52883 5.64417 9.5 5.71792 9.5 5.80775V11.1923C9.5 11.2821 9.52883 11.3558 9.5865 11.4135C9.64417 11.4712 9.71792 11.5 9.80775 11.5H16.1923ZM12.5 10C12.9167 10 13.2708 9.85417 13.5625 9.5625C13.8542 9.27083 14 8.91667 14 8.5C14 8.08333 13.8542 7.72917 13.5625 7.4375C13.2708 7.14583 12.9167 7 12.5 7C12.0833 7 11.7292 7.14583 11.4375 7.4375C11.1458 7.72917 11 8.08333 11 8.5C11 8.91667 11.1458 9.27083 11.4375 9.5625C11.7292 9.85417 12.0833 10 12.5 10Z"
                  fill="#6B6B6B"
                />
              </svg>
            </div>
            <span>Secure</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

const CommentModal = ({ item, setShowCommentModal }) => {
  const [hasLiked, setHasLiked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const isMounted = useClientMounted()
  const [commentContent, setCommentContent] = useState('')
  const { address, isConnected } = useAccount()
  const activeChain = getActiveChain()
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

  const postComment = (e, id) => {
    e.stopPropagation()

    if (!isConnected) {
      console.log(`Please connect your wallet first`, 'error')
      return
    }

    writeContract({
      abi: abi,
      address: activeChain[1].comment,
      functionName: 'addComment',
      args: [web3.utils.toNumber(id), 0, commentContent, ''],
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

  useEffect(() => {
    // getHasLiked()
    //   .then((result) => {
    //     setHasLiked(result)
    //     setLoading(false)
    //   })
    //   .catch((err) => {
    //     console.log(err)
    //     setError(`⚠️`)
    //     setLoading(false)
    //   })
  }, [item])

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
            <h3>Post your reply</h3>
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
          <textarea autoFocus defaultValue={commentContent} onInput={(e) => setCommentContent(e.target.value)} placeholder={`Reply to ${item.creator.slice(0, 4)}…${item.creator.slice(38)}`} />
          <button className="btn" onClick={(e) => postComment(e, item.postId)}>
            Post comment
          </button>
        </footer>
      </div>
    </div>
  )
}
