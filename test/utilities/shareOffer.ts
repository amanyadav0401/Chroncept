const SIGNING_DOMAIN_NAME = "ChronNFT"; // encode krne ke liye salt lgti hai  ex:-  adding formula  values alg dono ki 2 persons
const SIGNING_DOMAIN_VERSION = "1";

class offerDetailsVoucher {
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
    offerNumber: any,
    offerer: any,
    tokenId: any,
    offeredPrice: any,
    quantityAsked: any,
    offeree: any
  ) {
    const voucher = {
      offerNumber,
      offerer,
      tokenId,
      offeredPrice,
      quantityAsked,
      offeree,
    };
    const domain = await this._signingDomain();
    const types = {
      offer:[
        { name: "offerNumber", type: "uint256" },
        { name: "offerer", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "offeredPrice", type: "uint256" },
        { name: "quantityAsked", type: "uint256" },
        { name: "offeree", type: "address" },
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

export default offerDetailsVoucher;
