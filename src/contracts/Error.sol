// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title Errors
 * @author Aratta Labs
 * @dev This library contains custom errors used throughout the smart contracts.
 * Using custom errors is more gas-efficient than traditional `require` statements
 * with string messages, as the error data is stored as a selector and is logged
 * as part of the transaction's revert reason. This provides more granular feedback.
 */
library Errors {
    // ---------------------------------------------------------------- //
    //                      BALANCE & PAYMENT ERRORS                    //
    // ---------------------------------------------------------------- //

    /** @dev Emitted when the sent ETH value is less than the required amount for a transaction. */
    error InsufficientPayment(uint256 sent);
}
