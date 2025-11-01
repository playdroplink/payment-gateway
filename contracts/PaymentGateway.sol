// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title PaymentGateway
 * @dev Smart contract for handling checkout links and payments
 */
contract PaymentGateway {
    // Events
    event CheckoutLinkCreated(
        uint256 indexed linkId,
        address indexed merchant,
        uint256 amount,
        string productName,
        PaymentType paymentType
    );
    
    event PaymentProcessed(
        uint256 indexed linkId,
        address indexed payer,
        uint256 amount,
        bytes32 indexed txHash
    );
    
    event PaymentRefunded(
        uint256 indexed linkId,
        address indexed payer,
        uint256 amount
    );
    
    event CheckoutLinkCancelled(uint256 indexed linkId);
    
    // Enums
    enum PaymentType {
        Free,
        OneTime,
        Recurring
    }
    
    enum PaymentStatus {
        Pending,
        Approved,
        Completed,
        Cancelled,
        Refunded
    }
    
    // Structs
    struct CheckoutLink {
        uint256 linkId;
        address merchant;
        string productName;
        string description;
        uint256 amount;
        PaymentType paymentType;
        uint256 stock; // 0 means unlimited
        bool active;
        uint256 createdAt;
        string redirectUrl;
        string internalName;
    }
    
    struct Payment {
        uint256 linkId;
        address payer;
        uint256 amount;
        PaymentStatus status;
        bytes32 txHash;
        uint256 paidAt;
        bool refunded;
    }
    
    // State variables
    mapping(uint256 => CheckoutLink) public checkoutLinks;
    mapping(uint256 => Payment) public payments;
    mapping(address => uint256[]) public merchantLinks;
    mapping(uint256 => uint256) public linkStock; // Current stock for each link
    
    uint256 private nextLinkId = 1;
    uint256 private nextPaymentId = 1;
    address public owner;
    uint256 public platformFeePercentage = 250; // 2.5% (basis points)
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier validLink(uint256 linkId) {
        require(checkoutLinks[linkId].linkId != 0, "Link does not exist");
        require(checkoutLinks[linkId].active, "Link is not active");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Create a new checkout link
     */
    function createCheckoutLink(
        string memory productName,
        string memory description,
        uint256 amount,
        PaymentType paymentType,
        uint256 stock,
        string memory redirectUrl,
        string memory internalName
    ) external returns (uint256) {
        require(bytes(productName).length > 0, "Product name required");
        
        uint256 linkId = nextLinkId++;
        
        checkoutLinks[linkId] = CheckoutLink({
            linkId: linkId,
            merchant: msg.sender,
            productName: productName,
            description: description,
            amount: amount,
            paymentType: paymentType,
            stock: stock,
            active: true,
            createdAt: block.timestamp,
            redirectUrl: redirectUrl,
            internalName: internalName
        });
        
        if (stock > 0) {
            linkStock[linkId] = stock;
        }
        
        merchantLinks[msg.sender].push(linkId);
        
        emit CheckoutLinkCreated(linkId, msg.sender, amount, productName, paymentType);
        
        return linkId;
    }
    
    /**
     * @dev Process a payment for a checkout link
     */
    function processPayment(uint256 linkId, bytes32 txHash) 
        external 
        payable 
        validLink(linkId) 
    {
        CheckoutLink storage link = checkoutLinks[linkId];
        
        require(link.paymentType != PaymentType.Free || msg.value == 0, "Free link should have no payment");
        require(link.paymentType == PaymentType.Free || msg.value >= link.amount, "Insufficient payment");
        
        if (link.stock > 0) {
            require(linkStock[linkId] > 0, "Out of stock");
            linkStock[linkId]--;
        }
        
        uint256 paymentId = nextPaymentId++;
        
        payments[paymentId] = Payment({
            linkId: linkId,
            payer: msg.sender,
            amount: msg.value,
            status: PaymentStatus.Completed,
            txHash: txHash,
            paidAt: block.timestamp,
            refunded: false
        });
        
        // Transfer funds (minus platform fee)
        if (msg.value > 0) {
            uint256 platformFee = (msg.value * platformFeePercentage) / 10000;
            uint256 merchantAmount = msg.value - platformFee;
            
            payable(link.merchant).transfer(merchantAmount);
            if (platformFee > 0) {
                payable(owner).transfer(platformFee);
            }
        }
        
        emit PaymentProcessed(linkId, msg.sender, msg.value, txHash);
    }
    
    /**
     * @dev Approve a payment (for server-side approval flow)
     */
    function approvePayment(uint256 linkId) external validLink(linkId) {
        // This would typically be called by the merchant or authorized server
        // Implementation depends on your specific needs
    }
    
    /**
     * @dev Cancel a checkout link
     */
    function cancelCheckoutLink(uint256 linkId) external {
        CheckoutLink storage link = checkoutLinks[linkId];
        require(link.merchant == msg.sender || msg.sender == owner, "Not authorized");
        
        link.active = false;
        emit CheckoutLinkCancelled(linkId);
    }
    
    /**
     * @dev Refund a payment
     */
    function refundPayment(uint256 paymentId) external {
        Payment storage payment = payments[paymentId];
        require(payment.payer != address(0), "Payment does not exist");
        require(!payment.refunded, "Already refunded");
        require(payment.status == PaymentStatus.Completed, "Payment not completed");
        
        CheckoutLink storage link = checkoutLinks[payment.linkId];
        require(link.merchant == msg.sender || msg.sender == owner, "Not authorized");
        
        payment.refunded = true;
        payment.status = PaymentStatus.Refunded;
        
        // Refund the payment
        if (payment.amount > 0) {
            payable(payment.payer).transfer(payment.amount);
        }
        
        // Restore stock if applicable
        if (link.stock > 0) {
            linkStock[payment.linkId]++;
        }
        
        emit PaymentRefunded(payment.linkId, payment.payer, payment.amount);
    }
    
    /**
     * @dev Get checkout link details
     */
    function getCheckoutLink(uint256 linkId) 
        external 
        view 
        returns (
            address merchant,
            string memory productName,
            string memory description,
            uint256 amount,
            PaymentType paymentType,
            uint256 stock,
            bool active,
            uint256 availableStock
        ) 
    {
        CheckoutLink storage link = checkoutLinks[linkId];
        return (
            link.merchant,
            link.productName,
            link.description,
            link.amount,
            link.paymentType,
            link.stock,
            link.active,
            link.stock > 0 ? linkStock[linkId] : type(uint256).max
        );
    }
    
    /**
     * @dev Get payment details
     */
    function getPayment(uint256 paymentId) 
        external 
        view 
        returns (
            uint256 linkId,
            address payer,
            uint256 amount,
            PaymentStatus status,
            bytes32 txHash,
            uint256 paidAt,
            bool refunded
        ) 
    {
        Payment storage payment = payments[paymentId];
        return (
            payment.linkId,
            payment.payer,
            payment.amount,
            payment.status,
            payment.txHash,
            payment.paidAt,
            payment.refunded
        );
    }
    
    /**
     * @dev Get merchant's checkout links
     */
    function getMerchantLinks(address merchant) external view returns (uint256[] memory) {
        return merchantLinks[merchant];
    }
    
    /**
     * @dev Update platform fee (owner only)
     */
    function setPlatformFee(uint256 newFeePercentage) external onlyOwner {
        require(newFeePercentage <= 1000, "Fee too high"); // Max 10%
        platformFeePercentage = newFeePercentage;
    }
    
    /**
     * @dev Withdraw accumulated fees (owner only)
     */
    function withdrawFees() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    
    // Receive function
    receive() external payable {}
}

