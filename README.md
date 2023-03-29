<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/0xAppl/agility-contracts">
    <img src="https://www.gitbook.com/cdn-cgi/image/width=40,dpr=2,height=40,fit=contain,format=auto/https%3A%2F%2F1080441170-files.gitbook.io%2F~%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252F7Qtgg0IH78iVjcWtRYn8%252Ficon%252FQy7CgLESqimx16Cl4Gb6%252FIMG_6444.PNG%3Falt%3Dmedia%26token%3Dbfdf72f3-d55a-48d7-a734-e8735cf934f2" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">Agility Protocol</h3>

  <p align="center">
    Agility Protocol is a platform that aims to unlock liquidity for LSD (Liquid staked ETH) holders and explore more trading scenarios for LSD, as well as providing deep liquidity for other LSD-relative protocols. 
    <br />
    <a href="https://docs.agilitylsd.com/"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="http://agilitylsd.com/">View Website</a>
    ·
    <a href="https://github.com/cypfisher/lsdx-contracts/issues">Report Bug</a>
    ·
    <a href="https://github.com/cypfisher/lsdx-contracts/pulls">Pull Request</a>
  </p>
</div>



<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#usage">Features</a></li>
    <li><a href="#usage">Contributing</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project
  <a href="https://github.com/0xAppl/agility-contracts">
    <img src="https://1080441170-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F7Qtgg0IH78iVjcWtRYn8%2Fuploads%2FrKdr2N78176UD4g2Dk6M%2F%E6%88%AA%E5%B1%8F2023-03-28%2013.21.17.png?alt=media&token=50301cf9-12ea-40b2-8ded-4df18ef9179b">
  </a>


Agility Protocol is a platform that aims to unlock liquidity for LSD (Liquid staked ETH) holders and explore more trading scenarios for LSD, as well as providing deep liquidity for other LSD-relative protocols. There are two main system in Agility.

1. LSD Liquidity Distribute System
As LSD becomes the biggest narrative for Ethereum, more and more LSD-related protocols are expected to appear in the market. These protocols will need LSD/ETH liquidity to boost their initial liquidity. Agility Protocol can help provide this liquidity, making it easier for these protocols to launch and thrive in the market.

2. aUSD Trading System
Currently, the liquidity release path for LSD to USD is mainly through lending on AAVE and Compound. However, the borrow APY of USD is increasing on these platforms, making it expensive to release LSD liquidity to USD. Agility Protocol offers a cost-effective solution to this problem by providing a liquidity release path from LSD to aUSD at almost zero cost.

Agility Protocol is committed to providing a seamless user experience and deep liquidity for LSD and aUSD trading. We believe that our platform will play an important role in the LSD WAR and become a key player in the liquidity distribution and trading ecosystem.

Thank you for choosing Agility Protocol!


<p align="right">(<a href="#readme-top">back to top</a>)</p>


<!-- GETTING STARTED -->
## Getting Started


### Prerequisites
Install hardhat
  ```sh
  npm install --save-dev hardhat
  ```
Install dependencies
  ```sh
  npm install --save or yarn
  ```


### Compile Contracts

use npx:
  ```sh
 npx hardhat compile
  ```
use hardhat-shorthand:
  ```sh
 hh compile
  ```
use yarn:
```sh
yarn run hardhat compile
```
<p align="right">(<a href="#readme-top">back to top</a>)</p>


<!-- USAGE EXAMPLES -->
### Deploy Contracts

#### Prepare `.env` 

With same keys to `.env-example`

```sh
# deploy tokens
$ hh run scripts/deployAGIToken.ts --network <mainnet/goerli>
$ hh run scripts/deployESAGIToken.ts --network <mainnet/goerli>
```
```sh
# deploy staking pool factory
$ hh run scripts/deployStakingPoolFactory.ts --network <mainnet/goerli>
```

```sh
# deploy staking pool
$ hh run scripts/deployStakingPools.ts --network <mainnet/goerli>
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Run Test Cases

```sh
$ hh test
# To run test cases of a test file:
$ hh test ./test/xxx.ts
```
<p align="right">(<a href="#readme-top">back to top</a>)</p>


<!-- FEATURES -->
## Features

- stake ETH/LSD to get aETH/aLSD
- mint aUSD with aETH/aLSD collateral
- trade on Agility aUSD trading system
- stake AGI to get esAGI
- use esAGI to vote for increasing vaults’ emission ratio
- provide aLSD/aETH for vaults to get esAGI reward
- redeem esAGI to AGI

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch
3. Commit your Changes 
4. Push to the Branch
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

