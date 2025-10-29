// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

// Chainlink VRF V2.5 Imports (Direct Funding, Native Token Payment)
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {VRFV2PlusWrapperConsumerBase} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFV2PlusWrapperConsumerBase.sol"; // For Direct Funding
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/**
 * @title Booloot Game Contract - Secure VRF Only
 * @author Aratta Labs
 * @notice A mystery box game utilizing Chainlink VRF for secure, verifiable randomness. Winnings are stored for players to claim manually.
 * @dev The contract exclusively uses the secure 'play' function. The 'rng' function remains for potential off-chain testing/simulation but is not used internally for prize selection.
 * @custom:version 9
 * @custom:emoji 📊
 * @custom:security-contact atenyun@gmail.com
 */
contract Booloot is Pausable, ReentrancyGuard, VRFV2PlusWrapperConsumerBase, ConfirmedOwner {
    // =============================
    //          Custom Errors
    // =============================

    /// @dev Thrown when the payment sent is less than the required game fee plus VRF fee.
    error InsufficientPayment(uint256 providedAmount, uint256 requiredFee);
    /// @dev Thrown if an internal error occurs when trying to select a prize index. (Legacy error)
    error PrizeNotFound(uint256 attempts);
    /// @dev Thrown when a VRF request is made while a previous one is still pending fulfillment.
    error RequestAlreadyPending();
    /// @dev Thrown if the VRF fulfillment callback returns an unexpected Request ID.
    error VRFRequestMismatch(uint256 providedRequestId);
    /// @dev Thrown if the contract's current ETH balance cannot cover the maximum possible prize plus the game fee.
    error InsufficientContractBalance(uint256 required, uint256 current);

    // =============================
    //             Events
    // =============================

    /// @notice Emitted when a player successfully wins and receives a prize.
    /// @param player The address of the player who won.
    /// @param prizeAmount The amount of the prize won in wei.
    /// @param timestamp The time the event occurred.
    event Win(address indexed player, uint256 prizeAmount, uint256 timestamp);
    /// @notice Emitted when the owner successfully withdraws funds from the contract.
    /// @param recipient The address that received the withdrawn funds (contract owner).
    /// @param amount The amount of ETH withdrawn in wei.
    /// @param timestamp The time the event occurred.
    event Withdrawal(address indexed recipient, uint256 amount, uint256 timestamp);
    /// @notice Emitted when the contract owner updates the available prize pool array.
    /// @param newPrizes The array of new prize amounts.
    /// @param timestamp The time the event occurred.
    event PrizesUpdated(uint256[] newPrizes, uint256 timestamp);

    // VRF Events
    /// @notice Emitted immediately after a VRF request is successfully submitted to the Chainlink network.
    /// @param requestId The unique ID assigned to the randomness request.
    /// @param requester The address of the player who paid for and initiated the request.
    /// @param paidAmount The exact amount of native token (STT) paid to the VRF Wrapper.
    event VRFRandomnessRequested(uint256 indexed requestId, address indexed requester, uint256 paidAmount);
    /// @notice Emitted when the VRF callback successfully returns the random number and the player is paid.
    /// @param requestId The unique ID of the request that was fulfilled.
    /// @param prizeAmount The final prize amount awarded to the player.
    event VRFRandomnessFulfilled(uint256 indexed requestId, uint256 prizeAmount);

    // =============================
    //         State Variables
    // =============================

    /// @notice The fixed maximum prize amount (4 ETH), used for ensuring sufficient contract reserve before a game starts.
    uint256 public constant MAX_PRIZE_RESERVE_ETH = 4 ether;

    /// @notice The fixed fee (in wei) required from the player to play a single round of the game.
    uint256 public fee = 1 ether;

    /// @notice An array of fixed prizes available in the game, in wei. This pool is infinitely reusable.
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
        0.9 ether,
        1.1 ether,
        1.2 ether,
        1.5 ether,
        2 ether,
        2.5 ether,
        3.1 ether,
        3.3 ether,
        4 ether
    ];

    /// @notice The total number of unique players who have participated in the game.
    uint256 public uniquePlayerCount;

    /// @notice A mapping from player addresses to their total accumulated winnings (in wei).
    mapping(address => uint256) public wins;

    /// @notice A mapping from player addresses to the total number of games they have played.
    mapping(address => uint256) public players;

    /// @notice An array containing the addresses of all unique players who have played.
    address[] public allPlayers;

    /// @notice A mapping to quickly check if a player's address is already registered in the `allPlayers` array.
    mapping(address => bool) public isPlayerRegistered;

    /// @notice A mapping from player addresses to the total accumulated winnings (prize + refund) they can claim.
    mapping(address => uint256) public unclaimedWinnings;

    // Structs
    /// @notice Data structure to represent a player's statistics for leaderboard purposes.
    struct PlayerData {
        /// @notice The player's unique wallet address.
        address player;
        /// @notice The total accumulated winnings (in wei) of the player.
        uint256 wins;
        /// @notice The total number of times the player has played the game.
        uint256 played;
    }

    // =============================
    //         Chainlink VRF V2+
    // =============================

    /// @notice The maximum gas limit the VRF Wrapper can use when calling `fulfillRandomWords`.
    uint32 public constant VRF_CALLBACK_GAS_LIMIT = 2_100_000;
    /// @notice The number of block confirmations the oracle network waits for before fulfilling the request.
    uint16 public constant VRF_REQUEST_CONFIRMATIONS = 3;
    /// @notice The number of random words requested from VRF. One word is used for the prize index.
    uint32 public constant VRF_NUM_WORDS = 3;

    /// @notice The Request ID of the most recent secure VRF randomness request.
    uint256 public latestRequestId;

    /// @notice Status flag indicating if the latest randomness request has been fulfilled.
    bool public fulfilled = true;

    /// @notice Maps a VRF request ID to the address of the player who made the request.
    mapping(uint256 => address) public requestToPlayer;

    /// @notice Maps a VRF request ID to the overpayment refund amount owed to the player.
    mapping(uint256 => uint256) public requestRefunds;

    /// @notice Stores the latest random word(s) received from the Chainlink VRF fulfillment callback.
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
     * @notice Updates the fixed fee required to play the game.
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
        prizes = _prizes;
        emit PrizesUpdated(_prizes, block.timestamp);
    }

    // =============================
    //            Views
    // =============================

    /**
     * @notice Retrieves the current price required to pay the Chainlink VRF oracle.
     * @dev This should be used to calculate the total required payment (game fee + VRF fee) for `play()`.
     * @return The required VRF price in native token (STT in Somnia).
     */
    function getVRFRequestPrice() public view returns (uint256) {
        return i_vrfV2PlusWrapper.calculateRequestPriceNative(VRF_CALLBACK_GAS_LIMIT, VRF_NUM_WORDS);
    }

    /**
     * @notice Retrieves the entire array of fixed prizes currently available in the pool.
     * @return An array containing all prize amounts in wei.
     */
    function getAllPrizes() external view returns (uint256[] memory) {
        return prizes;
    }

    /**
     * @notice Retrieves a paginated batch of player addresses and their statistics for leaderboard construction.
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
     * @dev CRITICAL VULNERABILITY: This function remains for testing/simulation. It is highly susceptible to miner manipulation and front-running. DO NOT USE INTERNALLY FOR PRIZES.
     * @param len The upper bound (non-inclusive) for the random number (e.g., prizes.length).
     * @param nonce An additional value to prevent simple replay attacks.
     * @return The pseudo-random number, which can be manipulated.
     */
    function rng(uint256 len, uint256 nonce) public view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, nonce))) % len;
    }

    /**
     * @notice Returns the modulo of a random word by the prizes length. Used for testing the prize selection logic.
     * @param randomWords A simulated random word.
     * @return The index into the prize array.
     */
    function testTest(uint256 randomWords) public view returns (uint256) {
        return randomWords % prizes.length;
    }

    // =============================
    //         Game Logic (Secure VRF)
    // =============================

    /**
     * @notice Returns the status of the latest secure VRF request.
     * @return requestId The unique ID of the last request.
     * @return isPending True if the request has been submitted but not yet fulfilled.
     * @return isFulfilled True if the last request has successfully been fulfilled.
     */
    function getRequestStatus() external view returns (uint256 requestId, bool isPending, bool isFulfilled) {
        return (latestRequestId, latestRequestId != 0 && !fulfilled, fulfilled);
    }

    /**
     * @notice Returns the random word(s) from the most recently fulfilled VRF request.
     * @dev Requires that a request has already been successfully fulfilled (`fulfilled == true`).
     * @return An array containing the random word(s).
     */
    function getLatestRandomWord() external view returns (uint256[] memory) {
        require(fulfilled, "No fulfilled request yet");
        return latestRandomWord;
    }

    /**
     * @notice Requests a secure, verifiable random number from Chainlink VRF.
     * @dev Player must pay the game fee PLUS the current VRF fee. This function initiates an asynchronous process. The prize is awarded in `fulfillRandomWords`.
     * @return The request ID for tracking the randomness fulfillment.
     */
    function play() external payable nonReentrant whenNotPaused returns (uint256) {
        address player = _msgSender();

        // Enforce financial reserve check
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
        VRFV2PlusClient.ExtraArgsV1 memory extraArgs = VRFV2PlusClient.ExtraArgsV1({nativePayment: true});
        bytes memory args = VRFV2PlusClient._argsToBytes(extraArgs);

        // 6. Submit request (uses native STT)
        (uint256 requestId, uint256 paid) = requestRandomnessPayInNative(VRF_CALLBACK_GAS_LIMIT, VRF_REQUEST_CONFIRMATIONS, VRF_NUM_WORDS, args);

        // 7. Update state for request tracking - REFUND STORAGE RESTORED
        latestRequestId = requestId;
        fulfilled = false;
        requestToPlayer[requestId] = player;
        requestRefunds[requestId] = overpaymentRefund; // Store refund to be processed after prize is awarded

        players[player] += 1;

        if (!isPlayerRegistered[player]) {
            allPlayers.push(player);
            isPlayerRegistered[player] = true;
            uniquePlayerCount++;
        }

        emit VRFRandomnessRequested(requestId, _msgSender(), paid);

        return requestId;
    }

    /**
     * @notice Called by the VRF Wrapper after the random word is generated.
     * @dev This is the crucial callback function that verifies the VRF result, selects the prize, pays the player, updates stats, and saves winnings for later claiming.
     * @dev Note: https://docs.chain.link/vrf/v2-5/security#fulfillrandomwords-must-not-revert:~:text=If%20your%20fulfillRandomWords,Automation%20Node.
     * @param requestId The ID of the VRF request that was fulfilled.
     * @param randomWords The array of random numbers (must be length of VRF_NUM_WORDS).
     */
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        // 1. Validation (Cleaned up and precise validation restored)
        require(randomWords.length == VRF_NUM_WORDS, "Incorrect word count");
        require(requestId == latestRequestId, "VRFRequestMismatch");

        address player = requestToPlayer[requestId];
        uint256 overpaymentRefund = requestRefunds[requestId];

        // 2. Select prize using the random word
        uint256 prizeIndex = randomWords[0] % prizes.length;
        uint256 prizeAmount = prizes[prizeIndex];

        // 3. Instead of immediate transfer, add prize and refund to unclaimed winnings
        uint256 totalPayout = prizeAmount + overpaymentRefund;
        unclaimedWinnings[player] += totalPayout;

        // 4. Update player stats and registration
        // Note: 'wins' tracks the gross prize amount won, regardless of when it is claimed.
        wins[player] += totalPayout;

        // 5. Clean up VRF request state - RESTORED
        latestRandomWord = randomWords;
        // delete requestToPlayer[requestId];
        // delete requestRefunds[requestId];
        fulfilled = true;

        emit Win(player, prizeAmount, block.timestamp);
        emit VRFRandomnessFulfilled(requestId, prizes[prizeIndex]);
    }

    // =============================
    //          Claiming
    // =============================

    /**
     * @notice Allows a player to withdraw their accumulated unclaimed winnings and overpayment refunds.
     * @dev Uses a reentrancy guard. The player's balance is reset to zero before the transfer to prevent reentrancy attacks.
     */
    function claimWinnings() public nonReentrant {
        uint256 amount = unclaimedWinnings[msg.sender];
        require(amount > 0, "No unclaimed winnings to withdraw");

        // Set amount to zero BEFORE sending funds
        unclaimedWinnings[msg.sender] = 0;

        // Send funds to the player
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @notice Transfers the entire contract's ETH balance to the contract owner.
     * @dev Only the contract owner (`ConfirmedOwner`) can call this function. Uses a reentrancy guard.
     */
    function withdrawAll() public onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        require(amount > 0, "No balance");
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Failed to withdraw");

        emit Withdrawal(owner(), amount, block.timestamp);
    }

    /**
     * @notice Pauses the secure game playing operation (`play`).
     * @dev Only the contract owner can call this function.
     */
    function pausePlaying() public onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the secure game playing operation (`play`).
     * @dev Only the contract owner can call this function.
     */
    function unpausePlaying() public onlyOwner {
        _unpause();
    }
}
