import { defineChain } from 'viem'
import { http, createConfig } from 'wagmi'
import { somniaTestnet } from 'wagmi/chains'
import { injected, metaMask, safe, walletConnect } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID || ``

export const CONTRACTS = {
  chain50312: {
    game: '',
  },
  chain5031: {
    game: '0xD8f7DF0aBD834eDcb3e4FC83A11175eB77449f3B',
  },
}

// Define a new chain
export const somniaMainnet = defineChain({
  id: 5031,
  name: 'Somnia Mainnet',
  nativeCurrency: { name: 'Somnia', symbol: 'SOMI', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://api.infra.mainnet.somnia.network/'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.somnia.network' },
  },
  contracts: {
    ensRegistry: {
      address: '0x0',
    },
    ensUniversalResolver: {
      address: '0x0',
      blockCreated: 0,
    },
    multicall3: {
      address: '0x0',
      blockCreated: 0,
    },
  },
})

// Faucet
somniaMainnet.faucetUrl = `https://cloud.google.com/application/web3/faucet`

// Icon
somniaMainnet.icon = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"> <g clip-path="url(#clip0_10733_2635)"> <path d="M0 0H18V18H0V0Z" fill="url(#paint0_linear_10733_2635)"/> <path d="M13.4802 6.78073V6.79073L13.0302 6.94073C12.501 7.0614 11.9522 7.06822 11.4202 6.96073C10.4902 6.76073 9.74021 6.26073 9.18021 5.46073C9.17041 5.44338 9.15566 5.42936 9.13785 5.42045C9.12003 5.41154 9.09996 5.40816 9.08021 5.41073C9.03021 5.41073 9.00021 5.44073 9.00021 5.48073C8.96934 6.76104 8.46437 7.98433 7.58312 8.91361C6.70187 9.84289 5.50708 10.412 4.23021 10.5107C3.91998 9.54256 3.91477 8.50245 4.21526 7.53121C4.51575 6.55998 5.10744 5.70455 5.91021 5.08073C6.60108 4.52788 7.42801 4.17116 8.30424 4.04799C9.18047 3.92483 10.0737 4.03976 10.8902 4.38073C12.0208 4.8327 12.9436 5.68781 13.4802 6.78073Z" fill="url(#paint1_linear_10733_2635)"/> <path d="M4.51989 11.2202C4.51902 11.2187 4.51855 11.217 4.51855 11.2152C4.51855 11.2135 4.51902 11.2118 4.51989 11.2102H4.52989L4.96989 11.0702C5.49833 10.9459 6.04719 10.9357 6.57989 11.0402C7.50989 11.2402 8.25989 11.7402 8.81989 12.5402C8.82969 12.5576 8.84444 12.5716 8.86225 12.5805C8.88007 12.5894 8.90014 12.5928 8.91989 12.5902C8.96989 12.5902 8.99989 12.5602 8.99989 12.5202C9.03076 11.2399 9.53574 10.0166 10.417 9.08735C11.2982 8.15807 12.493 7.58895 13.7699 7.49023C14.0801 8.4584 14.0853 9.49852 13.7848 10.4697C13.4844 11.441 12.8927 12.2964 12.0899 12.9202C11.399 13.4731 10.5721 13.8298 9.69586 13.953C8.81963 14.0761 7.9264 13.9612 7.10989 13.6202C5.97934 13.1683 5.05652 12.3131 4.51989 11.2202Z" fill="url(#paint2_linear_10733_2635)"/> </g> <defs> <linearGradient id="paint0_linear_10733_2635" x1="3.35" y1="3.12" x2="21.9" y2="24.43" gradientUnits="userSpaceOnUse"> <stop stop-color="#1A1E21"/> <stop offset="1" stop-color="#06060A"/> </linearGradient> <linearGradient id="paint1_linear_10733_2635" x1="12.1202" y1="3.65073" x2="6.86021" y2="10.1807" gradientUnits="userSpaceOnUse"> <stop stop-color="#2F28F1"/> <stop offset="0.65" stop-color="#3FC4ED"/> <stop offset="1" stop-color="#44C0EE"/> </linearGradient> <linearGradient id="paint2_linear_10733_2635" x1="13.9999" y1="9.57023" x2="6.99989" y2="14.6902" gradientUnits="userSpaceOnUse"> <stop stop-color="#F50947"/> <stop offset="1" stop-color="#4D6CF3"/> </linearGradient> <clipPath id="clip0_10733_2635"> <rect width="18" height="18" fill="white"/> </clipPath> </defs> </svg>`
somniaTestnet.icon = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"> <g clip-path="url(#clip0_10733_2635)"> <path d="M0 0H18V18H0V0Z" fill="url(#paint0_linear_10733_2635)"/> <path d="M13.4802 6.78073V6.79073L13.0302 6.94073C12.501 7.0614 11.9522 7.06822 11.4202 6.96073C10.4902 6.76073 9.74021 6.26073 9.18021 5.46073C9.17041 5.44338 9.15566 5.42936 9.13785 5.42045C9.12003 5.41154 9.09996 5.40816 9.08021 5.41073C9.03021 5.41073 9.00021 5.44073 9.00021 5.48073C8.96934 6.76104 8.46437 7.98433 7.58312 8.91361C6.70187 9.84289 5.50708 10.412 4.23021 10.5107C3.91998 9.54256 3.91477 8.50245 4.21526 7.53121C4.51575 6.55998 5.10744 5.70455 5.91021 5.08073C6.60108 4.52788 7.42801 4.17116 8.30424 4.04799C9.18047 3.92483 10.0737 4.03976 10.8902 4.38073C12.0208 4.8327 12.9436 5.68781 13.4802 6.78073Z" fill="url(#paint1_linear_10733_2635)"/> <path d="M4.51989 11.2202C4.51902 11.2187 4.51855 11.217 4.51855 11.2152C4.51855 11.2135 4.51902 11.2118 4.51989 11.2102H4.52989L4.96989 11.0702C5.49833 10.9459 6.04719 10.9357 6.57989 11.0402C7.50989 11.2402 8.25989 11.7402 8.81989 12.5402C8.82969 12.5576 8.84444 12.5716 8.86225 12.5805C8.88007 12.5894 8.90014 12.5928 8.91989 12.5902C8.96989 12.5902 8.99989 12.5602 8.99989 12.5202C9.03076 11.2399 9.53574 10.0166 10.417 9.08735C11.2982 8.15807 12.493 7.58895 13.7699 7.49023C14.0801 8.4584 14.0853 9.49852 13.7848 10.4697C13.4844 11.441 12.8927 12.2964 12.0899 12.9202C11.399 13.4731 10.5721 13.8298 9.69586 13.953C8.81963 14.0761 7.9264 13.9612 7.10989 13.6202C5.97934 13.1683 5.05652 12.3131 4.51989 11.2202Z" fill="url(#paint2_linear_10733_2635)"/> </g> <defs> <linearGradient id="paint0_linear_10733_2635" x1="3.35" y1="3.12" x2="21.9" y2="24.43" gradientUnits="userSpaceOnUse"> <stop stop-color="#1A1E21"/> <stop offset="1" stop-color="#06060A"/> </linearGradient> <linearGradient id="paint1_linear_10733_2635" x1="12.1202" y1="3.65073" x2="6.86021" y2="10.1807" gradientUnits="userSpaceOnUse"> <stop stop-color="#2F28F1"/> <stop offset="0.65" stop-color="#3FC4ED"/> <stop offset="1" stop-color="#44C0EE"/> </linearGradient> <linearGradient id="paint2_linear_10733_2635" x1="13.9999" y1="9.57023" x2="6.99989" y2="14.6902" gradientUnits="userSpaceOnUse"> <stop stop-color="#F50947"/> <stop offset="1" stop-color="#4D6CF3"/> </linearGradient> <clipPath id="clip0_10733_2635"> <rect width="18" height="18" fill="white"/> </clipPath> </defs> </svg>`

export const config = createConfig({
  chains: [somniaMainnet],
  connectors: [injected(), walletConnect({ projectId }), metaMask()], //, safe()
  transports: {
    [somniaMainnet.id]: http(),
    // [somniaTestnet.id]: http(),
  },
})
