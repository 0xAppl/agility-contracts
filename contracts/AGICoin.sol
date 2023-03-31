// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AGICoin is ERC20, ERC20Burnable, Pausable, Ownable {
    constructor() ERC20("AGI Coin", "AGI") {}

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        override
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}



// import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
// import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";


// contract AGICoin is Initializable, ERC20Upgradeable, ERC20BurnableUpgradeable, PausableUpgradeable, AccessControlUpgradeable, ERC20PermitUpgradeable, UUPSUpgradeable {
//   bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
//   bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
//   bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

//   /// @custom:oz-upgrades-unsafe-allow constructor
//   constructor() {
//     _disableInitializers();
//   }

//   function initialize() initializer public {
//     __ERC20_init("AGI Coin", "AGI");
//     __ERC20Burnable_init();
//     __Pausable_init();
//     __AccessControl_init();
//     __ERC20Permit_init("AGICoin");
//     __UUPSUpgradeable_init();

//     _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
//     _grantRole(PAUSER_ROLE, msg.sender);
//     _grantRole(MINTER_ROLE, msg.sender);
//     _grantRole(UPGRADER_ROLE, msg.sender);
//   }

//   function pause() public onlyRole(PAUSER_ROLE) {
//     _pause();
//   }

//   function unpause() public onlyRole(PAUSER_ROLE) {
//     _unpause();
//   }

//   function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
//     _mint(to, amount);
//   }

//   function _beforeTokenTransfer(address from, address to, uint256 amount)
//     internal
//     whenNotPaused
//     override
//   {
//     super._beforeTokenTransfer(from, to, amount);
//   }

//   function _authorizeUpgrade(address newImplementation)
//     internal
//     onlyRole(UPGRADER_ROLE)
//     override
//   {}
// }