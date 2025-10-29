// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Emitted when a withdrawal is successfully processed.
/// @param recipient The address that received the withdrawn amount.
/// @param amount The amount of tokens withdrawn.
/// @param timestamp The time at which the withdrawal occurred.
event Withdrawal(address indexed recipient, uint256 amount, uint256 timestamp);

/// @notice Emitted when a player wins a prize.
/// @param player The address of the winning player.
/// @param prize The prize amount won by the player.
/// @param timestamp The time at which the prize was won.
event Win(address indexed player, uint256 prize ,uint256 timestamp);

/// @notice Emitted when the available prizes are updated.
/// @param prizes A new array of prizes available for winning.
/// @param timestamp The time at which the prizes were updated.
event PrizesUpdated(uint256[] prizes ,uint256 timestamp);