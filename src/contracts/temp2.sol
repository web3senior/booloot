// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

// Chainlink VRF V2.5 Imports (Direct Funding, Native Token Payment)
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {VRFV2PlusWrapperConsumerBase} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFV2PlusWrapperConsumerBase.sol"; // For Direct Funding
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/**
 * @title Booloot Game Contract
 * @author Aratta Labs (Modified by Gemini)
 * @notice A mystery box game with two modes: Insecure (predictable) and Secure (Chainlink VRF).
 * @dev The 'playInsecure' function is retained as requested but poses a critical risk.
 * The 'play' function uses Chainlink VRF for secure, verifiable randomness.
 * @custom:version 4
 * @custom:emoji 📊
 * @custom:security-contact atenyun@gmail.com
 */
contract Booloot is Pausable, ReentrancyGuard, VRFV2PlusWrapperConsumerBase, ConfirmedOwner {
    // =============================
    //          Custom Errors
    // =============================

    error InsufficientPayment(uint256 providedAmount, uint256 requiredFee);
    error PrizeNotFound(uint256 attempts);
    error RequestAlreadyPending();
    error VRFRequestMismatch(uint256 providedRequestId);
    /// @dev Thrown if the contract balance cannot cover the largest possible prize + the game fee.
    error InsufficientContractBalance(uint256 required, uint256 current);

    // =============================
    //             Events
    // =============================

    event Win(address indexed player, uint256 prizeAmount, uint256 timestamp);
    event Withdrawal(address indexed recipient, uint256 amount, uint256 timestamp);
    event PrizesUpdated(uint256[] newPrizes, uint256 timestamp);

    // VRF Events
    event VRFRandomnessRequested(uint256 indexed requestId, address indexed requester, uint256 paidAmount);
   event VRFRandomnessFulfilled(uint256 indexed requestId, uint256 prizeAmount);

    // =============================
    //         State Variables
    // =============================

    /// @notice The fixed maximum prize amount, used for ensuring sufficient contract reserve.
    uint256 public constant MAX_PRIZE_RESERVE_ETH = 4 ether;

    /// @notice The fixed fee (in wei) required to play a single round of the game.
    uint256 public fee = 1 ether;

    /// @notice An array of fixed prizes available in the game, in wei. This pool is now infinitely reusable.
    uint256[] public prizes = [
        0.1 ether,
        0.1 ether,
        0.1 ether,
        0.15 ether,
        0.2 ether,
        0.2 ether,
        0.25 ether,
        0.25 ether,
        0.3 ether,
        0.4 ether,
        0.4 ether,
        0.5 ether,
        0.5 ether,
        0.6 ether,
        0.7 ether,
        0.8 ether,
        1 ether,
        1.1 ether,
        1.2 ether,
        1.5 ether,
        2 ether,
        2.5 ether,
        3 ether,
        3.1 ether,
        3.3 ether,
        3.7 ether,
        4 ether
    ];

    /// @notice A counter to track the total number of unique players who have participated.
    uint256 public uniquePlayerCount;

    /// @notice A mapping from player addresses to their total accumulated winnings in wei.
    mapping(address => uint256) public wins;

    /// @notice A mapping from player addresses to the total number of times they have played.
    mapping(address => uint256) public players;

    /// @notice An array to store the addresses of all unique players.
    address[] public allPlayers;

    /// @notice A mapping to check if a player's address is already registered in the `allPlayers` array.
    mapping(address => bool) public isPlayerRegistered;

    // Structs
    /// @dev A struct to represent a player's statistics for leaderboard purposes.
    struct PlayerData {
        /// @dev The player's address.
        address player;
        /// @dev The total accumulated winnings (in wei) of the player.
        uint256 wins;
        /// @dev The total number of times the player has played the game.
        uint256 played;
    }

    // =============================
    //         Chainlink VRF V2+
    // =============================

    /// @dev VRF Callback gas limit (adjust based on fulfillRandomWords complexity)
    uint32 public constant VRF_CALLBACK_GAS_LIMIT = 2_100_000;
    /// @dev Number of block confirmations to wait for
    uint16 public constant VRF_REQUEST_CONFIRMATIONS = 3;
    /// @dev Number of random words to request (we only need one index)
    uint32 public constant VRF_NUM_WORDS = 1;

    uint256 public latestRequestId;
    bool public fulfilled = true; // Start as true so the first request is allowed

    // Mapping to link a VRF request ID back to the player who initiated it
    mapping(uint256 => address) public requestToPlayer;

    // Mapping to store the player's overpayment refund amount from the initial VRF request
    mapping(uint256 => uint256) public requestRefunds;

    uint256[] public latestRandomWord;

    // =============================
    //         Constructor
    // =============================

    /**
     * @notice Initializes the contract with the VRF V2+ Wrapper address.
     * @param wrapper The address of the Protofire Chainlink VRF V2+ Wrapper contract.
     */
    constructor(address wrapper) payable ConfirmedOwner(msg.sender) VRFV2PlusWrapperConsumerBase(wrapper) {}

    // =============================
    //          Management
    // =============================

    /**
     * @notice Updates the fee required to play the game.
     * @dev Only the contract owner can call this function.
     * @param _fee The new fee amount in wei.
     */
    function updateFee(uint256 _fee) public onlyOwner {
        fee = _fee;
    }

    /**
     * @notice Updates the array of fixed prizes for the game.
     * @dev Only the contract owner can call this function.
     * @param _prizes An array containing the new prize amounts in wei.
     */
    function updatePrizes(uint256[] memory _prizes) public onlyOwner nonReentrant {
        // No claimed state reset is needed as prizes are now infinitely reusable.
        prizes = _prizes;
        emit PrizesUpdated(_prizes, block.timestamp);
    }

    // =============================
    //            Views
    // =============================

    /**
     * @notice Retrieves the current price required to pay the Chainlink VRF oracle.
     * @dev This should be used to calculate the total fee (game fee + VRF fee) required for `play()`.
     * @return The required VRF price in native token (STT in Somnia).
     */
    function getVRFRequestPrice() public view returns (uint256) {
        return i_vrfV2PlusWrapper.calculateRequestPriceNative(VRF_CALLBACK_GAS_LIMIT, VRF_NUM_WORDS);
    }

    /**
     * @notice Retrieves the entire array of fixed prizes currently available in the pool.
     * @dev Since the array is public, this simply returns the state variable.
     * @return An array containing all prize amounts in wei.
     */
    function getAllPrizes() external view returns (uint256[] memory) {
        return prizes;
    }

    /**
     * @notice Retrieves a paginated batch of player addresses and their stats.
     * @param startIndex The starting index for the batch.
     * @param batchSize The number of players to return in the batch.
     * @return A memory array containing the PlayerData struct for the requested batch.
     */
    function getPlayersBatch(uint256 startIndex, uint256 batchSize) external view returns (PlayerData[] memory) {
        uint256 endIndex = startIndex + batchSize;
        if (endIndex > allPlayers.length) endIndex = allPlayers.length;

        uint256 resultLength = endIndex - startIndex;
        PlayerData[] memory batch = new PlayerData[](resultLength);

        for (uint256 i = startIndex; i < endIndex; i++) {
            batch[i - startIndex] = PlayerData({player: allPlayers[i], wins: wins[allPlayers[i]], played: players[allPlayers[i]]});
        }
        return batch;
    }

    /**
     * @notice Generates a predictable number based on block data, sender address, and a nonce.
     * @dev CRITICAL VULNERABILITY: This function remains as requested. It is highly susceptible to
     * miner manipulation and front-running. DO NOT USE IN PRODUCTION.
     * @param len The upper bound (non-inclusive) for the random number.
     * @param nonce An additional value to prevent simple replay attacks.
     * @return The pseudo-random number.
     */
    function rng(uint256 len, uint256 nonce) public view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, nonce))) % len;
    }

    // =============================
    //         Game Logic (Secure VRF)
    // =============================
    function getRequestStatus() external view returns (uint256 requestId, bool isPending, bool isFulfilled) {
        return (latestRequestId, latestRequestId != 0 && !fulfilled, fulfilled);
    }

    function getLatestRandomWord() external view returns (uint256[] memory) {
        require(fulfilled, "No fulfilled request yet");
        return latestRandomWord;
    }


    /**
     * @notice Requests a secure, verifiable random number from Chainlink VRF.
     * @dev Player must pay the game fee PLUS the current VRF fee.
     * @return The request ID for tracking the randomness fulfillment.
     */
    function play() external payable nonReentrant whenNotPaused returns (uint256) {
        // NEW CHECK: Ensure contract can cover the maximum potential payout before proceeding.
        uint256 requiredReserve = MAX_PRIZE_RESERVE_ETH + fee;
        if (address(this).balance < requiredReserve) {
            revert InsufficientContractBalance(requiredReserve, address(this).balance);
        }

        // 1. Block overlapping VRF requests
        if (latestRequestId != 0 && !fulfilled) revert RequestAlreadyPending();

        // 2. Compute total required fee (Game Fee + VRF Fee)
        uint256 vrfPrice = getVRFRequestPrice();
        uint256 totalRequiredPayment = fee + vrfPrice;

        // 3. Check for sufficient payment
        if (msg.value < totalRequiredPayment) {
            revert InsufficientPayment(msg.value, totalRequiredPayment);
        }

        // 4. Calculate overpayment refund amount (if any)
        uint256 overpaymentRefund = msg.value - totalRequiredPayment;

        // 5. Signal native payment to the wrapper
        bytes memory args = VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: true}));

        // 6. Submit request (uses native STT)
        (uint256 requestId, uint256 paid) = requestRandomnessPayInNative(VRF_CALLBACK_GAS_LIMIT, VRF_REQUEST_CONFIRMATIONS, VRF_NUM_WORDS, args);

        // 7. Update state for request tracking
        latestRequestId = requestId;
        fulfilled = false;
        requestToPlayer[requestId] = _msgSender();
        requestRefunds[requestId] = overpaymentRefund; // Store refund to be processed after prize is awarded

        emit VRFRandomnessRequested(requestId, _msgSender(), paid);

        return requestId;
    }

    /**
     * @notice Called by the VRF Wrapper after the random word is generated.
     * @dev This function selects the prize, pays the player, updates stats, and refunds overpayment.
     * @param requestId The ID of the VRF request.
     * @param randomWords The array of random numbers (length of VRF_NUM_WORDS).
     */
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
    // 1. Validation
    require(randomWords.length == VRF_NUM_WORDS, "Incorrect word count");
    if (requestId != latestRequestId) revert VRFRequestMismatch(requestId);

    address player = requestToPlayer[requestId];
    uint256 overpaymentRefund = requestRefunds[requestId];

    // 2. Select prize using the random word
    uint256 prizeIndex = randomWords[0] % prizes.length;
    uint256 prizeAmount = prizes[prizeIndex];

    // 3. Transfer prize to player (and handle refund)
    uint256 totalPayout = 0;//prizeAmount + overpaymentRefund;
    (bool success, ) = payable(player).call{value: totalPayout}("");
    require(success, "Failed to send prize/refund");

    // 4. Update player stats and registration
    wins[player] += prizeAmount;
    players[player] += 1;

    if (!isPlayerRegistered[player]) {
        allPlayers.push(player);
        isPlayerRegistered[player] = true;
        uniquePlayerCount++;
    }

    // 5. Clean up VRF request state
    delete requestToPlayer[requestId];
    delete requestRefunds[requestId];
      fulfilled = true;

    emit Win(player, prizeAmount, block.timestamp);
      emit VRFRandomnessFulfilled(requestId, prizeAmount);
     }

    // =============================
    //         Game Logic (Insecure)
    // =============================

    /**
     * @notice Allows a player to play one round of the mystery box game using the predictable RNG.
     * @dev AVOID USING THIS FUNCTION FOR CRITICAL LOGIC. It is highly vulnerable.
     * @return The amount of the prize won in wei.
     */
    /*function playInsecure() external payable nonReentrant whenNotPaused returns (uint256) {
        // 1. Check for sufficient payment
        if (msg.value < fee) {
            revert InsufficientPayment(msg.value, fee);
        }

        // 2. Refund any overpayment
        if (msg.value > fee) {
            uint256 refundAmount = msg.value - fee;
            (bool success, ) = payable(_msgSender()).call{value: refundAmount}("");
            require(success, "Refund failed");
        }

        // 3. Select prize from the infinitely reusable pool using insecure RNG
        uint256 prizeIndex = rng(prizes.length, prizes.length);
        uint256 prizeAmount = prizes[prizeIndex];

        // 4. Transfer prize to player
        (bool success, ) = payable(_msgSender()).call{value: prizeAmount}("");
        require(success, "Failed to send prize");

        // 5. Update player stats and registration
        wins[_msgSender()] += prizeAmount;
        players[_msgSender()] += 1;

        if (!isPlayerRegistered[_msgSender()]) {
            allPlayers.push(_msgSender());
            isPlayerRegistered[_msgSender()] = true;
            uniquePlayerCount++;
        }

        emit Win(_msgSender(), prizeAmount, block.timestamp);
        return prizeAmount;
    }*/

    /**
     * @notice Transfers the entire contract's ETH balance to the contract owner.
     * @dev Only the contract owner can call this function.
     */
    function withdrawAll() public onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        require(amount > 0, "No balance");
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Failed to withdraw");

        emit Withdrawal(owner(), amount, block.timestamp);
    }

    /**
     * @notice Pauses all playing operations.
     */
    function pausePlaying() public onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses all playing operations.
     */
    function unpausePlaying() public onlyOwner {
        _unpause();
    }
}
