const SIGNING_DOMAIN_NAME = "Chroncept_MarketItem";
const SIGNING_DOMAIN_VERSION = "1";

/**
 *
 * LazyMinting is a helper class that creates NFTVoucher objects and signs them, to be redeemed later by the LazyNFT contract.
 */
class shareSellerVoucher {
  public contract: any;
  public signer: any;
  public _domain: any;
  public voucherCount: number = 0;
  public signer2: any;

  constructor(data: any) {
    const { _contract, _signer } = data;
    this.contract = _contract;
    this.signer = _signer;
  }

  async createVoucher(
    seller: any,
    NFTAddress: any,
    tokenId: any,
    shareSellAmount: any,
    sharePrice: any,
    counter: any,
    tokenUri: any
  ) {
    const voucher = {
      seller,
      NFTAddress,
      tokenId,
      shareSellAmount,
      sharePrice,
      counter,
      tokenUri,
    };
    const domain = await this._signingDomain();
    const types = {
      shareSeller: [
        { name: "seller", type: "address" },
        { name: "NFTAddress", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "shareSellAmount", type: "uint256" },
        { name: "sharePrice", type: "uint256" },
        { name: "counter", type: "uint256" },
        { name: "tokenUri", type: "string" },
      ],
    };

    const signature = await this.signer._signTypedData(domain, types, voucher);
    return {
      ...voucher,
      signature,
    };
  }

  async _signingDomain() {
    if (this._domain != null) {
      return this._domain;
    }
    const chainId = 31337;
    this._domain = {
      name: SIGNING_DOMAIN_NAME,
      version: SIGNING_DOMAIN_VERSION,
      verifyingContract: this.contract.address,
      chainId,
    };
    return this._domain;
  }
}

export default shareSellerVoucher;
