'use client'

import { useState, useEffect, useId, useRef, useCallback } from 'react'
import Link from 'next/link'
import boo from '@/../public/boo.svg'
import somnia from '@/../public/somnia.svg'
import BoolootIcon1 from '@/../public/icons/booloot-icon-1.svg'
import { useParams, useRouter } from 'next/navigation'
import { useConnectorClient, useConnections, useClient, networks, useWaitForTransactionReceipt, useAccount, useDisconnect, Connector, useConnect, useWriteContract, useReadContract } from 'wagmi'
import { initGameContract, getVRFRequestPrice, getFee, getUnclaimedWinnings, getBalance, getUniquePlayerCount, getAllPrizes, getFulfilled, getActiveChain } from '@/util/communication'
import { useClientMounted } from '@/hooks/useClientMount'
import abi from '@/abi/game.json'
import { toast } from '@/components/NextToast'
import styles from './page.module.scss'

export default function Page() {
  const [fee, setFee] = useState()
  const [contractBalance, setContractBalance] = useState(0)
  const [uniquePlayerCount, setUniquePlayerCount] = useState(0)
  const [prizes, setPrizes] = useState(0)
  const [VRFRequestPrice, setVRFRequestPrice] = useState()
  const [unclaimedWinnings, setUnclaimedWinnings] = useState()
  const [isGameStarted, setIsGameStarted] = useState(false)

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
  const { data: hash, isPending: isSigning, error: submitError, writeContract } = useWriteContract()
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash,
  })

  const play = (e) => {
    if (!isGameStarted) {
      toast(`First, start the game`)
      return
    }

    if (!isConnected) {
      console.log(`Please connect your wallet first`, 'error')
      return
    }

    writeContract({
      abi,
      address: activeChain[1].game,
      functionName: 'play',
      args: [],
      value: `${VRFRequestPrice + fee}`, // In wei
    })
  }

  const claim = (e) => {
    if (!isConnected) {
      console.log(`Please connect your wallet first`, 'error')
      return
    }

    writeContract({
      abi,
      address: activeChain[1].game,
      functionName: 'claimWinnings',
      args: [],
    })
  }

  const start = (e) => {
    setIsGameStarted(true)
  }

  useEffect(() => {
    getVRFRequestPrice().then((res) => {
      console.log(web3.utils.fromWei(res, `ether`))
      setVRFRequestPrice(Number(res))
    })

    getFulfilled().then((res) => {
      console.log(res)
    })

    getFee().then((res) => {
      setFee(Number(res))
    })

    getBalance().then((res) => {
      setContractBalance(Number(res))
    })

    getUniquePlayerCount().then((res) => {
      setUniquePlayerCount(Number(res))
    })

    getUnclaimedWinnings(address).then((res) => {
      setUnclaimedWinnings(Number(res))
    })

    getAllPrizes().then((res) => {
      setPrizes(res)
    })
  }, []) // Added necessary dependencies  [isLoadedComment, commentsLoaded]

  return (
    <div className={`${styles.page} ms-motion-slideDownIn`}>
      {showCommentModal && <CommentModal item={showCommentModal.data} parentId={showCommentModal.parentId} type={showCommentModal.type} setShowCommentModal={setShowCommentModal} />}

      <div className={`${styles.treasure} mt-50 text-white`}>
        <div className={`__container flex flex-row align-items-start justify-content-between gap-025`} data-width={`xxxlarge`}>
          <div className={`flex flex-column align-items-start  gap-025`}>
            <div className={`flex flex-row align-items-center  gap-025`}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M2.81019 11.3956V10.3901H5.19505V8.09289C4.62617 7.9786 4.12342 7.73929 3.68681 7.37497C3.25021 7.01053 2.93995 6.55633 2.75606 6.01235C1.98261 5.92041 1.32993 5.59211 0.798027 5.02747C0.266009 4.46283 0 3.7925 0 3.01648V2.34615C0 2.07199 0.0990411 1.83586 0.297124 1.63778C0.495206 1.4397 0.73133 1.34066 1.00549 1.34066H2.56535V0H8.83025V1.34066H10.3901C10.6643 1.34066 10.9004 1.4397 11.0985 1.63778C11.2966 1.83586 11.3956 2.07199 11.3956 2.34615V3.01648C11.3956 3.7925 11.1296 4.46283 10.5976 5.02747C10.0657 5.59211 9.41299 5.92041 8.63954 6.01235C8.45565 6.55633 8.1454 7.01053 7.70879 7.37497C7.27218 7.73929 6.76944 7.9786 6.20055 8.09289V10.3901H8.58541V11.3956H2.81019ZM2.56535 4.93212V2.34615H1.00549V3.01648C1.00549 3.48404 1.15202 3.89462 1.44506 4.24821C1.73811 4.60181 2.11154 4.82978 2.56535 4.93212ZM5.6978 7.12879C6.28646 7.12879 6.78597 6.92356 7.19632 6.51309C7.60668 6.10274 7.81185 5.60323 7.81185 5.01457V1.00549H3.58375V5.01457C3.58375 5.60323 3.78893 6.10274 4.19928 6.51309C4.60963 6.92356 5.10914 7.12879 5.6978 7.12879ZM8.83025 4.93212C9.28407 4.82978 9.6575 4.60181 9.95054 4.24821C10.2436 3.89462 10.3901 3.48404 10.3901 3.01648V2.34615H8.83025V4.93212Z"
                  fill="white"
                />
              </svg>

              <span className={`text-uppercase`}>treasure pool</span>
            </div>

            <h1>
              {web3.utils.fromWei(contractBalance || 0, `ether`)} <small style={{ fontSize: `12px` }}>{activeChain[0].nativeCurrency.symbol}</small>
            </h1>

            <Link target={`_blank`} href={`${activeChain[0].blockExplorers.default.url}/address/${activeChain[1].game}`} className={`flex align-items-center gap-025`}>
              📜 Contract
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M2.80775 10C2.57758 10 2.38542 9.92292 2.23125 9.76875C2.07708 9.61458 2 9.42242 2 9.19225V2.80775C2 2.57758 2.07708 2.38542 2.23125 2.23125C2.38542 2.07708 2.57758 2 2.80775 2H5.61538V2.5H2.80775C2.73075 2.5 2.66021 2.53204 2.59613 2.59613C2.53204 2.66021 2.5 2.73075 2.5 2.80775V9.19225C2.5 9.26925 2.53204 9.33979 2.59613 9.40388C2.66021 9.46796 2.73075 9.5 2.80775 9.5H9.19225C9.26925 9.5 9.33979 9.46796 9.40388 9.40388C9.46796 9.33979 9.5 9.26925 9.5 9.19225V6.38462H10V9.19225C10 9.42242 9.92292 9.61458 9.76875 9.76875C9.61458 9.92292 9.42242 10 9.19225 10H2.80775ZM4.86925 7.48462L4.51538 7.13075L9.14613 2.5H7V2H10V5H9.5V2.85387L4.86925 7.48462Z"
                  fill="white"
                />
              </svg>
            </Link>
          </div>

          <div className={`flex flex-column align-items-start  gap-025`}>
            <div className={`flex flex-row align-items-center  gap-025`}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M8 5.5C8.14167 5.5 8.26042 5.45208 8.35625 5.35625C8.45208 5.26042 8.5 5.14167 8.5 5C8.5 4.85833 8.45208 4.73958 8.35625 4.64375C8.26042 4.54792 8.14167 4.5 8 4.5C7.85833 4.5 7.73958 4.54792 7.64375 4.64375C7.54792 4.73958 7.5 4.85833 7.5 5C7.5 5.14167 7.54792 5.26042 7.64375 5.35625C7.73958 5.45208 7.85833 5.5 8 5.5ZM4 4.5H6.5V3.5H4V4.5ZM2.25 10.5C1.96667 9.55 1.6875 8.60208 1.4125 7.65625C1.1375 6.71042 1 5.74167 1 4.75C1 3.98333 1.26667 3.33333 1.8 2.8C2.33333 2.26667 2.98333 2 3.75 2H6.25C6.49167 1.68333 6.78542 1.4375 7.13125 1.2625C7.47708 1.0875 7.85 1 8.25 1C8.45833 1 8.63542 1.07292 8.78125 1.21875C8.92708 1.36458 9 1.54167 9 1.75C9 1.8 8.99375 1.85 8.98125 1.9C8.96875 1.95 8.95417 1.99583 8.9375 2.0375C8.90417 2.12917 8.87292 2.22292 8.84375 2.31875C8.81458 2.41458 8.79167 2.5125 8.775 2.6125L9.9125 3.75H11V7.2375L9.5875 7.7L8.75 10.5H6V9.5H5V10.5H2.25ZM3 9.5H4V8.5H7V9.5H8L8.775 6.925L10 6.5125V4.75H9.5L7.75 3C7.75 2.83333 7.76042 2.67292 7.78125 2.51875C7.80208 2.36458 7.83333 2.20833 7.875 2.05C7.63333 2.11667 7.42083 2.23125 7.2375 2.39375C7.05417 2.55625 6.92083 2.75833 6.8375 3H3.75C3.26667 3 2.85417 3.17083 2.5125 3.5125C2.17083 3.85417 2 4.26667 2 4.75C2 5.56667 2.1125 6.36458 2.3375 7.14375C2.5625 7.92292 2.78333 8.70833 3 9.5Z"
                  fill="white"
                />
              </svg>

              <span className={`text-uppercase`}>uncliamed prize</span>
            </div>

            <h1>
              {web3.utils.fromWei(unclaimedWinnings || 0, `ether`)} <small style={{ fontSize: `12px` }}>{activeChain[0].nativeCurrency.symbol}</small>
            </h1>

            <button onClick={() => claim()} className={`${styles.claim}`}>
              💸 Claim
            </button>
          </div>
        </div>
      </div>

      <div className={`__container ${styles.page__container} flex flex-column justify-content-center gap-1`} data-width={`small`}>
        <figure className={`flex flex-column align-items-center gap-1`}>
          <img alt={`Boo`} src={boo.src} />
          <figcaption>Start game to play!</figcaption>
        </figure>

        <button onClick={() => start()} disabled={isGameStarted} className={`${styles.start} d-f-c gap-050`}>
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.15678 4.125H3.97132C4.10372 4.125 4.17568 3.96235 4.08933 3.85694L3.67198 3.43225C3.60866 3.35394 3.49641 3.35695 3.43309 3.43526L3.03589 3.85995C2.9553 3.96537 3.02725 4.125 3.15678 4.125Z" fill="white" />
            <path d="M8.09632 4.125H7.28177C7.15225 4.125 7.0803 3.96537 7.16089 3.85995L7.55809 3.43526C7.62141 3.35695 7.73366 3.35394 7.79698 3.43225L8.21433 3.85694C8.30068 3.96235 8.22872 4.125 8.09632 4.125Z" fill="white" />
            <path
              d="M8.62694 4.875H7.64553C7.51542 5.06298 7.27007 5.30467 6.8723 5.30467C6.54516 5.30467 6.28494 5.06298 6.1288 4.875H5.12137C4.99126 5.06298 4.7459 5.30467 4.34813 5.30467C4.021 5.30467 3.76077 5.06298 3.60464 4.875H2.62695C2.62695 6.12036 3.56003 7.17104 4.82769 7.48657C4.95408 7.29859 5.20315 7.04012 5.61208 7.04012C5.9578 7.04012 6.22918 7.30866 6.37787 7.5C7.67155 7.19789 8.62694 6.13715 8.62694 4.875Z"
              fill="white"
            />
            <path
              d="M6.37695 0.75V0.229562C6.37695 0.0287934 6.07941 -0.0765279 5.9025 0.0649976L5.0393 0.75H4.09357C3.31597 0.756577 2.56124 1.0138 1.94147 1.48346C1.32169 1.95312 0.869945 2.61016 0.653316 3.357L0.149692 5.0925C-0.012047 5.63842 -0.043236 6.2147 0.0586395 6.77489C0.160515 7.33507 0.392604 7.86348 0.736191 8.3175C1.06652 8.76292 1.49678 9.12458 1.99237 9.37338C2.48796 9.62218 3.03503 9.75118 3.58957 9.75H7.66619C8.21716 9.75134 8.76086 9.62419 9.25409 9.37865C9.74733 9.1331 10.1765 8.77593 10.5076 8.3355C10.8505 7.88641 11.0841 7.36352 11.1896 6.80837C11.2951 6.25322 11.2697 5.68112 11.1154 5.1375L10.6343 3.40088C10.4258 2.64339 9.9757 1.97465 9.35249 1.49621C8.72928 1.01777 7.96697 0.755773 7.18132 0.75H6.37695ZM4.09357 1.5H7.18132C7.80292 1.5052 8.40584 1.71308 8.89856 2.09209C9.39127 2.4711 9.74685 3.00053 9.91131 3.6L10.3928 5.33737C10.5155 5.76964 10.5358 6.22456 10.452 6.66603C10.3683 7.1075 10.1827 7.52337 9.91019 7.88062C9.64896 8.22886 9.31011 8.51136 8.92056 8.70568C8.53102 8.89999 8.10151 9.00077 7.66619 9H3.58957C3.15146 9.00067 2.71932 8.89852 2.32788 8.70176C1.93645 8.505 1.59665 8.21912 1.33582 7.86713C1.06292 7.50605 0.878571 7.08597 0.797612 6.64066C0.716654 6.19536 0.741342 5.73727 0.869691 5.30325L1.37369 3.56775C1.54419 2.9763 1.90094 2.45564 2.39095 2.08312C2.88096 1.7106 3.47807 1.5061 4.09357 1.5Z"
              fill="white"
            />
          </svg>
          Start game
          {VRFRequestPrice && ` (fee: ${web3.utils.fromWei(VRFRequestPrice + fee, `ether`)} ${activeChain[0].nativeCurrency.symbol})`}
        </button>

        {isConfirmed && <p className="text-center badge badge-success">Done</p>}
        <p className={`text-center`}>{isSigning ? `Signing...` : isConfirming ? 'Confirming...' : `Click to Open Your Mystery Box! Every entry guarantees a prize. 💰`}</p>

        <div className={`grid grid--fill gap-050 w-100`} style={{ '--data-width': `80px` }}>
          {prizes &&
            prizes.map((prize, i) => (
              <div key={i} className={`${styles.box} d-f-c`} onClick={() => play()}>
                <figure>
                  <img alt={`Somnia`} src={somnia.src} />
                </figure>
              </div>
            ))}
        </div>

        <details open>
          <summary>How to Play Booloot</summary>
          <div>
            <ul>
              <li>
                💰 <b>Pay the Fee:</b> Send the required fee to start a round.
              </li>
              <li>
                🔒 <b>Wait for Draw:</b> A secure, random system selects your prize.
              </li>
              <li>
                🏆 <b>Check Balance:</b> Your winnings and any refunds are credited instantly.
              </li>
              <li>
                💸 <b>Withdraw Funds:</b> Claim your accumulated ETH whenever you are ready.
              </li>
            </ul>
          </div>
        </details>

        <details>
          <summary>Prizes</summary>
          <div>
            <ul>
              {prizes &&
                prizes
                  .sort((a, b) => Number(b) - Number(a))
                  .map((prize, i) => (
                    <li key={i}>
                      <code>{web3.utils.fromWei(prize, `ether`)} STT</code>
                    </li>
                  ))}
            </ul>
          </div>
        </details>
      </div>
    </div>
  )
}

const randomIcon = () => {
  return <img alt={`Booloot icon`} src={BoolootIcon1.src} />
}

// const CommentModal = ({ item, type, parentId = 0, setShowCommentModal }) => {
//   const [hasLiked, setHasLiked] = useState(false)
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState(null)
//   const isMounted = useClientMounted()
//   const [commentContent, setCommentContent] = useState('')
//   const { address, isConnected } = useAccount()
//   const { web3, contract } = initGameContract()
//   const { data: hash, isPending: isSigning, error: submitError, writeContract } = useWriteContract()
//   const {
//     isLoading: isConfirming,
//     isSuccess: isConfirmed,
//     error: receiptError,
//   } = useWaitForTransactionReceipt({
//     hash,
//   })

//   const getHasLiked = async () => {
//     return isConnected ? await getHasLikedPost(id, address) : false
//   }

//   const postComment = (e) => {
//     e.stopPropagation()

//     if (!isConnected) {
//       console.log(`Please connect your wallet first`, 'error')
//       return
//     }
//     console.log(parentId)
//     writeContract({
//       abi: abi,
//       address: process.env.NEXT_PUBLIC_CONTRACT_POST_COMMENT,
//       functionName: 'addComment',
//       args: [web3.utils.toNumber(item.postId), parentId, commentContent, ''],
//     })
//   }

//   const unlikePost = (e, id) => {
//     e.stopPropagation()

//     if (!isConnected) {
//       console.log(`Please connect your wallet first`, 'error')
//       return
//     }

//     writeContract({
//       abi,
//       address: process.env.NEXT_PUBLIC_CONTRACT_POST,
//       functionName: 'unlikePost',
//       args: [id],
//     })
//   }

//   useEffect(() => {}, [item])

//   // if (loading) {
//   //   return <InlineLoading />
//   // }

//   if (error) {
//     return <span>{error}</span>
//   }

//   return (
//     <div className={`${styles.commentModal} animate fade`} onClick={() => setShowCommentModal()}>
//       <div className={`${styles.commentModal__container}`} onClick={(e) => e.stopPropagation()}>
//         <header className={`${styles.commentModal__container__header}`}>
//           <div className={``} aria-label="Close" onClick={() => setShowCommentModal()}>
//             Cancel
//           </div>
//           <div className={`flex-1`}>
//             <h3>Post your {type === `post` ? `comment` : `reply`}</h3>
//           </div>
//           <div className={`pointer`} onClick={(e) => updateStatus(e)}>
//             {isSigning ? `Signing...` : isConfirming ? 'Confirming...' : status && status.content !== '' ? `Update` : `Share`}
//           </div>
//         </header>

//         <main className={`${styles.commentModal__container__main}`}>
//           <article className={`${styles.commentModal__post}`}>
//             <section className={`flex flex-column align-items-start justify-content-between`}>
//               <header className={`${styles.commentModal__post__header}`}>
//                 <Profile creator={item.creator} createdAt={item.createdAt} />
//               </header>
//               <main className={`${styles.commentModal__post__main} w-100 flex flex-column grid--gap-050`}>
//                 <div
//                   className={`${styles.post__content} `}
//                   // onClick={(e) => e.stopPropagation()}
//                   id={`post${item.postId}`}
//                 >
//                   {item.content}
//                 </div>
//               </main>
//             </section>
//           </article>
//         </main>

//         <footer className={`${styles.commentModal__footer}  flex flex-column align-items-start`}>
//           <ConnectedProfile addr={address} />
//           <textarea autoFocus defaultValue={commentContent} onInput={(e) => setCommentContent(e.target.value)} placeholder={`${type === `post` ? `Comment` : `Reply`} to ${item.creator.slice(0, 4)}…${item.creator.slice(38)}`} />
//           <button className="btn" onClick={(e) => postComment(e)}>
//             Post {type === `post` ? `comment` : `reply`}
//           </button>
//         </footer>
//       </div>
//     </div>
//   )
// }
