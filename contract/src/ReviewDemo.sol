// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ReviewDemo {
    uint256 public constant MIN_PAYMENT = 0.6 ether;

    event PaymentReceived(
        address indexed sender,
        uint256 amount
    );

    error MinimumPaymentRequired();

    function payableAction() external payable {
        if (msg.value < MIN_PAYMENT) {
            revert MinimumPaymentRequired();
        }

        emit PaymentReceived(
            msg.sender,
            msg.value
        );
    }

    function withdraw() external {
    uint256 balance = address(this).balance;

    (bool success, ) =
        payable(msg.sender).call{value: balance}("");

    require(success, "Withdraw failed");
}
}