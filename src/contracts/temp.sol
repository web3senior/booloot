// SPDX-License-Identifier: MIT
// Fosslexx 2025
pragma solidity ^0.8.19;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {VRFV2PlusWrapperConsumerBase} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFV2PlusWrapperConsumerBase.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";

contract LexxRandomNumberConsumer is VRFV2PlusWrapperConsumerBase, ConfirmedOwner {
    mapping(uint256 => address) public requesters;
    mapping(uint256 => bool) public requestFulfilled;
    mapping(uint256 => uint256[]) public randomWordsByRequest;
    mapping(address => uint256) public pendingRefunds;
    mapping(uint256 => uint256) public requestTimestamp;
    mapping(uint256 => bool) public requestExists;
    uint256[] public allRequestIds;

    uint32 public constant CALLBACK_GAS_LIMIT = 2_000_000;
    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    uint32 public constant NUM_WORDS = 1;

    event RandomNumberRequested(uint256 indexed requestId, address indexed requester, uint256 paid);
    event RandomNumberFulfilled(uint256 indexed requestId, uint256[] randomWord);
    event EmptyRandomWords(uint256 indexed requestId);
    event UnexpectedRequestId(uint256 indexed requestId);

    error InsufficientPayment(uint256 required, uint256 sent);
    error RequestDoesNotExist(uint256 requestId);

    constructor(address wrapper) 
        ConfirmedOwner(msg.sender)
        VRFV2PlusWrapperConsumerBase(wrapper) 
    {}

    function requestRandomNumber() external payable onlyOwner {
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
    
        requesters[requestId] = msg.sender;
        requestFulfilled[requestId] = false;
        requestTimestamp[requestId] = block.timestamp;
        requestExists[requestId] = true;
        allRequestIds.push(requestId);
        
        emit RandomNumberRequested(requestId, msg.sender, paid);

        if (msg.value > paid) {
            pendingRefunds[msg.sender] += msg.value - paid;
        }
    }

    // This allows users to claim refund
    function withdrawRefund() external {
        uint256 amount = pendingRefunds[msg.sender];
        require(amount > 0, "No refund available");

        pendingRefunds[msg.sender] = 0; // Prevent reentrancy

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Refund failed");
    }

    // This will be called by the VRF Wrapper
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        if (randomWords.length == 0) {
            emit EmptyRandomWords(requestId);
            return;
        }

        randomWordsByRequest[requestId] = randomWords;
        requestFulfilled[requestId] = true;

        emit RandomNumberFulfilled(requestId, randomWords);
    }

    function getRequestStatus(uint256 requestId) external view returns (
        address requester,
        bool isPending,
        uint256 pendingDuration
    ) {
        if (!requestExists[requestId]) {
            revert RequestDoesNotExist(requestId);
        }

        bool pending = !requestFulfilled[requestId];
        uint256 duration = pending ? block.timestamp - requestTimestamp[requestId] : 0;

        return (
            requesters[requestId],
            pending,
            duration
        );
    }

    function getLatestRandomWords(uint256 requestId) external view returns (uint256[] memory) {
        if (!requestExists[requestId]) {
            revert RequestDoesNotExist(requestId);
        }
        if (!requestFulfilled[requestId]) {
            uint256[] memory empty;
            return empty;
        }

        return  randomWordsByRequest[requestId];
    }

    /**
     * @notice Get the current price for a VRF request in native tokens
     * @return The price in wei for requesting random numbers
     */
    function getRequestPrice() public view returns (uint256) {
        return i_vrfV2PlusWrapper.calculateRequestPriceNative(CALLBACK_GAS_LIMIT, NUM_WORDS);
    }

    function getAllRequestIds() external view returns (uint256[] memory) {
        return allRequestIds;
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