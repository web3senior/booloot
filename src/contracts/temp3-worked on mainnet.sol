// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts@1.4.0/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts@1.4.0/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {VRFV2PlusWrapperConsumerBase} from "@chainlink/contracts@1.4.0/src/v0.8/vrf/dev/VRFV2PlusWrapperConsumerBase.sol";
import {ConfirmedOwner} from "@chainlink/contracts@1.4.0/src/v0.8/shared/access/ConfirmedOwner.sol";

contract RandomNumberConsumer is VRFV2PlusWrapperConsumerBase, ConfirmedOwner {
    uint256 public latestRequestId;
    uint256[] public latestRandomWord;
    bool public fulfilled;

    uint32 public constant CALLBACK_GAS_LIMIT = 2_100_000;
    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    uint32 public constant NUM_WORDS = 3;

    event RandomNumberRequested(uint256 indexed requestId, address indexed requester, uint256 paid);
    event RandomNumberFulfilled(uint256 indexed requestId, uint256[] randomWord);

    error InsufficientPayment(uint256 required, uint256 sent);
    error RequestAlreadyPending();

    constructor(address wrapper) 
        ConfirmedOwner(msg.sender)
        VRFV2PlusWrapperConsumerBase(wrapper) 
    {}

    function requestRandomNumber() external payable onlyOwner {
        // Check if there's already a pending request
        if (latestRequestId != 0 && !fulfilled) {
            revert RequestAlreadyPending();
        }
        
        // Calculate the required payment
        uint256 requestPrice = getRequestPrice();
        if (msg.value < requestPrice) {
            revert InsufficientPayment(requestPrice, msg.value);
        }
        
        // Prepare the extra arguments for native payment
        VRFV2PlusClient.ExtraArgsV1 memory extraArgs = VRFV2PlusClient.ExtraArgsV1({
            nativePayment: true
        });
        bytes memory args = VRFV2PlusClient._argsToBytes(extraArgs);

        // Request randomness
        (uint256 requestId, uint256 paid) = requestRandomnessPayInNative(
            CALLBACK_GAS_LIMIT, 
            REQUEST_CONFIRMATIONS, 
            NUM_WORDS, 
            args
        );

        latestRequestId = requestId;
        fulfilled = false;
        
        emit RandomNumberRequested(requestId, msg.sender, paid);
        
        // Refund excess payment
        if (msg.value > paid) {
            (bool success, ) = msg.sender.call{value: msg.value - paid}("");
            require(success, "Refund failed");
        }
    }

    // This will be called by the VRF Wrapper
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
    require(randomWords.length > 0, "No random word returned");
    require(requestId == latestRequestId, "Unexpected request ID");
    latestRandomWord = randomWords;
    fulfilled = true;

      emit RandomNumberFulfilled(requestId, randomWords);
    }

    function getRequestStatus() external view returns (
        uint256 requestId,
        bool isPending,
        bool isFulfilled
    ) {
        return (
            latestRequestId,
            latestRequestId != 0 && !fulfilled,
            fulfilled
        );
    }

    function getLatestRandomWord() external view returns (uint256[] memory) {
        require(fulfilled, "No fulfilled request yet");
        return latestRandomWord;
    }

    /**
     * @notice Get the current price for a VRF request in native tokens
     * @return The price in wei for requesting random numbers
     */
    function getRequestPrice() public view returns (uint256) {
        return i_vrfV2PlusWrapper.calculateRequestPriceNative(CALLBACK_GAS_LIMIT, NUM_WORDS);
    }

    /**
     * @notice Withdraw any excess native tokens from the contract
     * @dev Only callable by owner, useful for recovering overpayments
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    // Allow contract to receive STT for native payment
    receive() external payable {}
}