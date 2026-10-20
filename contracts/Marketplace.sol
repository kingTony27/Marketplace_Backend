// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Marketplace is IERC721Receiver, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 price;
        address paymentToken; // address(0) = native currency
        bool active;
        bool featured;
    }

    uint256 public constant MAX_FEE_BPS = 1000; // 10% hard cap
    uint256 public constant MAX_FEATURED_FEE_BPS = 2000; // 20% hard cap
    uint256 public constant BPS_DENOMINATOR = 10_000;

    uint256 public feeBps;
    uint256 public featuredFeeBps;
    address public feeRecipient;
    address public immutable nftContract;
    uint256 public nextListingId;

    //----- Mappings ---------
    mapping(uint256 => Listing) public listings; // map lisitngs to their ID 
    mapping(address => bool) public acceptedPaymentTokens; // ERC20 whitelist (native handled separately)

    //---- Events -------------
    event Listed(uint256 indexed listingId, address indexed seller, uint256 tokenId, uint256 price, address paymentToken,  bool featured);
    event PriceUpdated(uint256 indexed listingId, uint256 newPrice);
    event FeeUpdated(uint256 newFeeBps);
    event FeeRecipientUpdated(address newRecipient);
    event PaymentTokenUpdated(address token, bool accepted);
    event ItemCancelled(uint256 indexed listingId, address indexed seller);
    event ItemSold(
        uint256 indexed listingId,
        address indexed seller,
        address indexed buyer,
        address nftContract,
        uint256 tokenId,
        uint256 price,
        uint256 fee,
        address paymentToken
    );

    //------Errors-------
    error NotOwnerOfNFT();
    error NotApprovedForMarketplace();
    error UnsupportedPaymentToken();
    error ListingNotActive();
    error NotSeller();
    error IncorrectPaymentMethod();
    error FeeExceedsCap();
    error TransferFailed();

    constructor(address initialFeeRecipient, uint256 initialFeeBps, uint256 initialFeaturedFeeBps, address _nftContract) Ownable(msg.sender) {
        if (initialFeeBps > MAX_FEE_BPS) revert FeeExceedsCap();
        if (initialFeaturedFeeBps > MAX_FEATURED_FEE_BPS) revert FeeExceedsCap();
        feeRecipient = initialFeeRecipient;
        feeBps = initialFeeBps;
        featuredFeeBps = initialFeaturedFeeBps;
        nftContract = _nftContract;
    }

    // ---------- Listing ----------

    function listItem(
        uint256 tokenId,
        uint256 price,
        address paymentToken,
        bool featured
    ) external whenNotPaused returns (uint256 listingId) {
        if (IERC721(nftContract).ownerOf(tokenId) != msg.sender) revert NotOwnerOfNFT();
        if (paymentToken != address(0) && !acceptedPaymentTokens[paymentToken]) revert UnsupportedPaymentToken();

       if (IERC721(nftContract).getApproved(tokenId) != address(this) &&
            !IERC721(nftContract).isApprovedForAll(msg.sender, address(this))) {
            revert NotApprovedForMarketplace();
        }

        listingId = nextListingId++;
        listings[listingId] = Listing({
            seller: msg.sender,
            tokenId: tokenId,
            price: price,
            paymentToken: paymentToken,
            active: true,
            featured: featured
        });

    // Pulls NFT into escrow — reverts if seller hasn't approved this contract
      IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);

        emit Listed(listingId, msg.sender, tokenId, price, paymentToken, featured);
    }

    function updateListingPrice(uint256 listingId, uint256 newPrice) external {
        Listing storage listing = listings[listingId];
        if (!listing.active) revert ListingNotActive();
        if (listing.seller != msg.sender) revert NotSeller();

        listing.price = newPrice;
        emit PriceUpdated(listingId, newPrice);
    }

    // ---------- Cancelling ----------

   function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        if (!listing.active) revert ListingNotActive();
        if (listing.seller != msg.sender) revert NotSeller();

        listing.active = false;
        IERC721(nftContract).safeTransferFrom(address(this), listing.seller, listing.tokenId);

        emit ItemCancelled(listingId, msg.sender);
   }

    // ---------- Buying ----------

    function buyItem(uint256 listingId) external payable nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];
        if (!listing.active) revert ListingNotActive();

        listing.active = false; // effects before interactions

        uint256 appliedFeeBps = listing.featured ? featuredFeeBps : feeBps;
        uint256 fee = (listing.price * appliedFeeBps) / BPS_DENOMINATOR;
        uint256 sellerProceeds = listing.price - fee;

        if (listing.paymentToken == address(0)) {
            if (msg.value != listing.price) revert IncorrectPaymentMethod();

            (bool sellerSent, ) = payable(listing.seller).call{value: sellerProceeds}("");
            if (!sellerSent) revert TransferFailed();

            if (fee > 0) {
                (bool feeSent, ) = payable(feeRecipient).call{value: fee}("");
                if (!feeSent) revert TransferFailed();
            }
        } else {
            if (msg.value != 0) revert IncorrectPaymentMethod(); // no stray ETH on ERC20 purchases

            IERC20(listing.paymentToken).safeTransferFrom(msg.sender, listing.seller, sellerProceeds);
            if (fee > 0) {
                IERC20(listing.paymentToken).safeTransferFrom(msg.sender, feeRecipient, fee);
            }
        }

        IERC721(nftContract).safeTransferFrom(address(this), msg.sender, listing.tokenId);

        emit ItemSold(
            listingId, listing.seller, msg.sender, nftContract, listing.tokenId, listing.price, fee, listing.paymentToken
        );
    }

    // ---------- Admin ----------

    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeExceedsCap();
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    function setPaymentTokenStatus(address token, bool accepted) external onlyOwner {
        acceptedPaymentTokens[token] = accepted;
        emit PaymentTokenUpdated(token, accepted);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------- Required for receiving NFTs ----------

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}




