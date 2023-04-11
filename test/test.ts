import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  ChronNFT,
  ChronNFT__factory,
  Marketplace,
  Marketplace__factory,
  Usd,
  Usd__factory,
} from "../typechain-types";
import shareSellerVoucher from "./utilities/shareSeller";
import offerDetailsVoucher from "./utilities/shareOffer";
import {
  expandTo15Decimals,
  expandTo16Decimals,
  expandTo18Decimals,
} from "./utilities/utilities";

describe("Chroncept", async () => {
  let NFT: ChronNFT;
  let marketplace: Marketplace;
  let signers: SignerWithAddress[];
  let owner: SignerWithAddress;
  let USDT: Usd;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    owner = signers[0];
    NFT = await new ChronNFT__factory(owner).deploy();
    USDT = await new Usd__factory(owner).deploy();
    marketplace = await new Marketplace__factory(owner).deploy();
    await NFT.initialize(
      "test_URI",
      owner.address,
      200,
      USDT.address,
      marketplace.address
    );
    await marketplace.initialize(
      owner.address,
      NFT.address,
      100,
      USDT.address,
      signers[7].address
    );
  });

  it("NFT initialize", async () => {
    await expect(
      NFT.initialize(
        "test_URI",
        owner.address,
        200,
        USDT.address,
        marketplace.address
      )
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("marketplace intitialize", async () => {
    let FeeWallet = signers[2];
    await expect(
      marketplace.initialize(
        owner.address,
        NFT.address,
        100,
        USDT.address,
        signers[4].address
      )
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("set royalty", async () => {
    await NFT.connect(owner).lazyMintNFT(
      1,
      5,
      signers[3].address,
      signers[2].address,
      "test"
    );
    expect(await NFT.balanceOf(signers[2].address, 1)).to.be.eq(5);

    await NFT.setRoyalty(100);
  });

  it("ERROR: non operator caller for lazyMint ", async () => {
    await expect(
      NFT.connect(signers[2]).lazyMintNFT(
        1,
        5,
        owner.address,
        signers[2].address,
        "test"
      )
    ).to.be.revertedWith("IC");
  });

  it(" burn NFT", async () => {
    await NFT.connect(owner).lazyMintNFT(
      1,
      5,
      signers[3].address,
      signers[2].address,
      "test"
    );

    expect(await NFT.balanceOf(signers[2].address, 1)).to.be.eq(5);
    await NFT.connect(owner).burn(signers[2].address, 1, 2);
    expect(await NFT.balanceOf(signers[2].address, 1)).to.be.eq(3);
  });

  it("ERROR: non admin caller for burn NFT", async () => {
    await NFT.connect(owner).lazyMintNFT(
      1,
      5,
      signers[3].address,
      signers[2].address,
      "test"
    );
    await expect(
      NFT.connect(signers[3]).burn(signers[2].address, 1, 2)
    ).to.be.revertedWith("NA");
  });

  it("ERROR: invalid token id for burn NFT", async () => {
    await NFT.connect(owner).lazyMintNFT(
      1,
      5,
      signers[3].address,
      signers[2].address,
      "test"
    );

    expect(await NFT.balanceOf(signers[2].address, 1)).to.be.eq(5);
    await expect(
      NFT.connect(owner).burn(signers[2].address, 2, 2)
    ).to.be.revertedWith("IT");
  });

  it("ERROR:invalid caller for set platform fee", async () => {
    await expect(NFT.connect(signers[1]).setPlatformfee(20)).to.be.revertedWith(
      "IC"
    );
  });

  // it("ERROR: zero address set for addOperator", async () => {
  //   await expect(NFT.connect(owner).addOperator("0x0000000000000000000000000000000000000000", true)).to.be.revertedWith("ZA");
  // });

  it("setAdmin", async () => {
    await NFT.connect(owner).setAdmin(signers[4].address);
  });
  it("ERROR: non admin caller for setAdmin", async () => {
    await expect(
      NFT.connect(signers[3]).setAdmin(signers[4].address)
    ).to.be.revertedWith("NA");
  });

  it("ERROR: zero address set for setAdmin", async () => {
    await expect(
      NFT.connect(owner).setAdmin("0x0000000000000000000000000000000000000000")
    ).to.be.revertedWith("ZA");
  });

  it("marketplace", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));
    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);

    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);

    // balance after primary sell
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000018)
    );

         
    expect(await marketplace.amountLeft(1)).to.be.eq(1);

    //Secondary buy
    const NFTSeller2 = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: signers[4],
    });
    // share sell amount more than balance
    const sellerVoucher2 = await NFTSeller2.createVoucher(
      signers[4].address,
      NFT.address,
      1,
      7,
      expandTo18Decimals(3),
      2,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[5]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    expect(await USDT.balanceOf(signers[6].address)).to.be.eq(0);
    //royalty address changed

    await NFT.connect(signers[4]).setApprovalForAll(marketplace.address, true);
    await marketplace
      .connect(signers[5])
      .buyShare(sellerVoucher2, 2, false, USDT.address);
    expect(await NFT.balanceOf(signers[5].address, 1)).to.be.eq(2);
  });

  it("marketplace, multiple currency ", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));
    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );

    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await marketplace
      .connect(signers[3])
      .buyShare(
        sellerVoucher,
        3,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(6) }
      );

    await marketplace
      .connect(signers[4])
      .buyShare(
        sellerVoucher,
        6,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(12) }
      );

    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    expect(await marketplace.amountLeft(1)).to.be.eq(1);

    //Secondary buy
    const NFTSeller2 = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: signers[4],
    });
    // share sell amount more than balance
    const sellerVoucher2 = await NFTSeller2.createVoucher(
      signers[4].address,
      NFT.address,
      1,
      7,
      expandTo18Decimals(3),
      2,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[5]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    expect(await USDT.balanceOf(signers[6].address)).to.be.eq(0);
    //royalty address changed
    await NFT.connect(owner).setRoyalty(200);
    await NFT.connect(signers[4]).setApprovalForAll(marketplace.address, true);
    await marketplace
      .connect(signers[5])
      .buyShare(
        sellerVoucher2,
        2,
        false,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(7) }
      );
    expect(await NFT.balanceOf(signers[5].address, 1)).to.be.eq(2);
  });

  it("ERROR:marketplace , primary sell multiple currency amount transfer failed for eth  ", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );

    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await expect(
      marketplace
        .connect(signers[3])
        .buyShare(
          sellerVoucher,
          3,
          true,
          "0x0000000000000000000000000000000000000001",
          { value: expandTo18Decimals(5) }
        )
    ).to.be.revertedWith("IA");
  });

  it("ERROR :marketplace,secondary sell amount transfer fail for eth ", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );

    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await marketplace
      .connect(signers[3])
      .buyShare(
        sellerVoucher,
        3,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(6) }
      );
    await marketplace
      .connect(signers[4])
      .buyShare(
        sellerVoucher,
        6,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(12) }
      );

    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);

         
    expect(await marketplace.amountLeft(1)).to.be.eq(1);

    //Secondary buy
    const NFTSeller2 = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: signers[4],
    });
    // share sell amount more than balance
    const sellerVoucher2 = await NFTSeller2.createVoucher(
      signers[4].address,
      NFT.address,
      1,
      7,
      expandTo18Decimals(3),
      2,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[5]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    expect(await USDT.balanceOf(signers[6].address)).to.be.eq(0);
    //royalty address changed
    await NFT.connect(owner).setRoyalty(200);
    await NFT.connect(signers[4]).setApprovalForAll(marketplace.address, true);

    await expect(
      marketplace
        .connect(signers[5])
        .buyShare(
          sellerVoucher2,
          2,
          false,
          "0x0000000000000000000000000000000000000001",
          { value: expandTo18Decimals(5) }
        )
    ).to.be.revertedWith("ATF");
  });

  it("marketplace, multiple currency(USDT)", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));
    await USDT.connect(owner).approve(owner.address, expandTo18Decimals(10000));
    await USDT.connect(owner).transferFrom(
      owner.address,
      owner.address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );

    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address, {
        value: expandTo18Decimals(6),
      });

    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address, {
        value: expandTo18Decimals(12),
      });

    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    expect(await marketplace.amountLeft(1)).to.be.eq(1);

    //Secondary buy
    const NFTSeller2 = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: signers[4],
    });
    // share sell amount more than balance
    const sellerVoucher2 = await NFTSeller2.createVoucher(
      signers[4].address,
      NFT.address,
      1,
      7,
      expandTo18Decimals(3),
      2,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[5]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    expect(await USDT.balanceOf(signers[6].address)).to.be.eq(0);
    //royalty address changed
    await NFT.connect(owner).setRoyalty(200);
    await NFT.connect(signers[4]).setApprovalForAll(marketplace.address, true);

    await marketplace
      .connect(signers[5])
      .buyShare(sellerVoucher2, 2, false, USDT.address);
    expect(await NFT.balanceOf(signers[5].address, 1)).to.be.eq(2);
  });
  it("ERROR: non admin seller for primary sell", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: signers[1],
    });
    const sellerVoucher = await NFTseller.createVoucher(
      signers[1].address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );
    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );
         
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await expect(
      marketplace
        .connect(signers[3])
        .buyShare(sellerVoucher, 3, true, USDT.address)
    ).to.be.revertedWith("NA");
  });

  it("ERROR:invalid seller, primary buy", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      signers[2].address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );
    await expect(
      marketplace
        .connect(signers[3])
        .buyShare(sellerVoucher, 3, true, USDT.address)
    ).to.be.revertedWith("IS");
  });

  it("ERROR: insufficient seller balance for secondary sell", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(100000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);

    //Secondary buy

    const NFTSeller2 = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: signers[4],
    });
    const sellerVoucher2 = await NFTSeller2.createVoucher(
      signers[4].address,
      NFT.address,
      1,
      7,
      expandTo18Decimals(3),
      2,
      "testURI"
    );
    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[5]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );
    await NFT.connect(signers[4]).setApprovalForAll(marketplace.address, true);
    await marketplace
      .connect(signers[5])
      .buyShare(sellerVoucher2, 3, false, USDT.address);

    await expect(
      marketplace
        .connect(signers[5])
        .buyShare(sellerVoucher2, 4, false, USDT.address)
    ).to.be.revertedWith("ISB");
  });
  it("Making an offer", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );

    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await marketplace
      .connect(signers[3])
      .buyShare(
        sellerVoucher,
        3,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(6) }
      );

    await marketplace
      .connect(signers[4])
      .buyShare(
        sellerVoucher,
        6,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(12) }
      );

    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    expect(await marketplace.amountLeft(1)).to.be.eq(1);

    //Secondary buy
    const NFTSeller2 = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: signers[4],
    });
    // share sell amount more than balance
    const sellerVoucher2 = await NFTSeller2.createVoucher(
      signers[4].address,
      NFT.address,
      1,
      7,
      expandTo18Decimals(3),
      2,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[5]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    expect(await USDT.balanceOf(signers[6].address)).to.be.eq(0);
    //royalty address changed
    await NFT.connect(owner).setRoyalty(200);
    await NFT.connect(signers[4]).setApprovalForAll(marketplace.address, true);

    await marketplace
      .connect(signers[5])
      .buyShare(
        sellerVoucher2,
        2,
        false,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(7) }
      );
    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[8],
    });
    await USDT.connect(owner).mint(
      signers[8].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[8]).approve(
      NFT.address,
      expandTo18Decimals(1000)
    );
    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[8].address,
      1,
      expandTo18Decimals(1000),
      2,
      signers[5].address
    );
    await NFT.connect(signers[8]).makeOffer(offerVoucher, false);
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(
      expandTo18Decimals(1000)
    );
  });

  it("Refund funds for single offer", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await marketplace
      .connect(signers[3])
      .buyShare(
        sellerVoucher,
        3,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(6) }
      );

    await marketplace
      .connect(signers[4])
      .buyShare(
        sellerVoucher,
        6,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(12) }
      );

    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);

    expect(await marketplace.amountLeft(1)).to.be.eq(1);

    //Secondary buy

    const NFTSeller2 = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: signers[4],
    });
    // share sell amount more than balance
    const sellerVoucher2 = await NFTSeller2.createVoucher(
      signers[4].address,
      NFT.address,
      1,
      7,
      expandTo18Decimals(3),
      2,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[5]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    expect(await USDT.balanceOf(signers[6].address)).to.be.eq(0);
    //royalty address changed
    await NFT.connect(owner).setRoyalty(200);
    await NFT.connect(signers[4]).setApprovalForAll(marketplace.address, true);
    await marketplace
      .connect(signers[5])
      .buyShare(
        sellerVoucher2,
        2,
        false,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(7) }
      );
    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[8],
    });
    await USDT.connect(owner).mint(
      signers[8].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[8]).approve(
      NFT.address,
      expandTo18Decimals(1000)
    );
    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[8].address,
      1,
      expandTo18Decimals(1000),
      2,
      signers[5].address
    );
    await NFT.connect(signers[8]).makeOffer(offerVoucher, false);
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(
      expandTo18Decimals(1000)
    );
    await NFT.connect(signers[8]).refundFunds(1, 1, false);
    expect(await USDT.balanceOf(signers[8].address)).to.be.eq(
      expandTo18Decimals(100000)
    );
  });

  it("ERROR: invalid token ID for Refund funds", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));
    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await marketplace
      .connect(signers[3])
      .buyShare(
        sellerVoucher,
        3,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(6) }
      );

    await marketplace
      .connect(signers[4])
      .buyShare(
        sellerVoucher,
        6,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(12) }
      );

    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);

    expect(await marketplace.amountLeft(1)).to.be.eq(1);

    //Secondary buy

    const NFTSeller2 = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: signers[4],
    });
    // share sell amount more than balance
    const sellerVoucher2 = await NFTSeller2.createVoucher(
      signers[4].address,
      NFT.address,
      1,
      7,
      expandTo18Decimals(3),
      2,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[5]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    expect(await USDT.balanceOf(signers[6].address)).to.be.eq(0);
    //royalty address changed
    await NFT.connect(owner).setRoyalty(200);
    await NFT.connect(signers[4]).setApprovalForAll(marketplace.address, true);
    await marketplace
      .connect(signers[5])
      .buyShare(
        sellerVoucher2,
        2,
        false,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(7) }
      );
    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[8],
    });
    await USDT.connect(owner).mint(
      signers[8].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[8]).approve(
      NFT.address,
      expandTo18Decimals(1000)
    );
    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[8].address,
      1,
      expandTo18Decimals(1000),
      2,
      signers[5].address
    );
    await NFT.connect(signers[8]).makeOffer(offerVoucher, false);
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(
      expandTo18Decimals(1000)
    );
    await expect(
      NFT.connect(signers[8]).refundFunds(0, 1, false)
    ).to.be.revertedWith("IT");
  });

  it("ERROR: invalid token ID for Refund funds", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));
    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await marketplace
      .connect(signers[3])
      .buyShare(
        sellerVoucher,
        3,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(6) }
      );

    await marketplace
      .connect(signers[4])
      .buyShare(
        sellerVoucher,
        6,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(12) }
      );

    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);

    expect(await marketplace.amountLeft(1)).to.be.eq(1);

    //Secondary buy

    const NFTSeller2 = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: signers[4],
    });
    // share sell amount more than balance
    const sellerVoucher2 = await NFTSeller2.createVoucher(
      signers[4].address,
      NFT.address,
      1,
      7,
      expandTo18Decimals(3),
      2,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[5]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    expect(await USDT.balanceOf(signers[6].address)).to.be.eq(0);
    //royalty address changed
    await NFT.connect(owner).setRoyalty(200);
    await NFT.connect(signers[4]).setApprovalForAll(marketplace.address, true);
    await marketplace
      .connect(signers[5])
      .buyShare(
        sellerVoucher2,
        2,
        false,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(7) }
      );
    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[8],
    });
    await USDT.connect(owner).mint(
      signers[8].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[8]).approve(
      NFT.address,
      expandTo18Decimals(1000)
    );
    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[8].address,
      1,
      expandTo18Decimals(1000),
      2,
      signers[5].address
    );
    await NFT.connect(signers[8]).makeOffer(offerVoucher, false);
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(
      expandTo18Decimals(1000)
    );
    await expect(
      NFT.connect(signers[8]).refundFunds(0, 1, false)
    ).to.be.revertedWith("IT");
  });

  it("ERROR: invalid offer number for Refund funds", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));
    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await marketplace
      .connect(signers[3])
      .buyShare(
        sellerVoucher,
        3,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(6) }
      );

    await marketplace
      .connect(signers[4])
      .buyShare(
        sellerVoucher,
        6,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(12) }
      );

    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);

    expect(await marketplace.amountLeft(1)).to.be.eq(1);

    //Secondary buy

    const NFTSeller2 = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: signers[4],
    });
    // share sell amount more than balance
    const sellerVoucher2 = await NFTSeller2.createVoucher(
      signers[4].address,
      NFT.address,
      1,
      7,
      expandTo18Decimals(3),
      2,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[5]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    expect(await USDT.balanceOf(signers[6].address)).to.be.eq(0);
    //royalty address changed
    await NFT.connect(owner).setRoyalty(200);
    await NFT.connect(signers[4]).setApprovalForAll(marketplace.address, true);
    await marketplace
      .connect(signers[5])
      .buyShare(
        sellerVoucher2,
        2,
        false,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(7) }
      );
    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[8],
    });
    await USDT.connect(owner).mint(
      signers[8].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[8]).approve(
      NFT.address,
      expandTo18Decimals(1000)
    );
    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[8].address,
      1,
      expandTo18Decimals(1000),
      2,
      signers[5].address
    );
    await NFT.connect(signers[8]).makeOffer(offerVoucher, false);
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(
      expandTo18Decimals(1000)
    );
    await expect(
      NFT.connect(signers[8]).refundFunds(1, 2, false)
    ).to.be.revertedWith("ION");
  });

  it("refund funds for global offer ", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));
    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await marketplace
      .connect(signers[3])
      .buyShare(
        sellerVoucher,
        3,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(6) }
      );

    await marketplace
      .connect(signers[4])
      .buyShare(
        sellerVoucher,
        6,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(12) }
      );

    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);

    expect(await marketplace.amountLeft(1)).to.be.eq(1);

    //Secondary buy

    const NFTSeller2 = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: signers[4],
    });
    // share sell amount more than balance
    const sellerVoucher2 = await NFTSeller2.createVoucher(
      signers[4].address,
      NFT.address,
      1,
      7,
      expandTo18Decimals(3),
      2,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[5]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    expect(await USDT.balanceOf(signers[6].address)).to.be.eq(0);
    //royalty address changed
    await NFT.connect(owner).setRoyalty(200);
    await NFT.connect(signers[4]).setApprovalForAll(marketplace.address, true);
    await marketplace
      .connect(signers[5])
      .buyShare(
        sellerVoucher2,
        2,
        false,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(7) }
      );
    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[8],
    });
    await USDT.connect(owner).mint(
      signers[8].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[8]).approve(
      NFT.address,
      expandTo18Decimals(1000)
    );
    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[8].address,
      1,
      expandTo18Decimals(1000),
      2,
      signers[5].address
    );
    await NFT.connect(signers[8]).makeOffer(offerVoucher, true);
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(
      expandTo18Decimals(1000)
    );
    await NFT.connect(signers[8]).refundFunds(1, 1, true);
    expect(await USDT.balanceOf(signers[8].address)).to.be.eq(
      expandTo18Decimals(100000)
    );
  });

  it("ERROR :invalid offer no. for refund funds in global offer ", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));
    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await marketplace
      .connect(signers[3])
      .buyShare(
        sellerVoucher,
        3,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(6) }
      );

    await marketplace
      .connect(signers[4])
      .buyShare(
        sellerVoucher,
        6,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(12) }
      );

    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);

    expect(await marketplace.amountLeft(1)).to.be.eq(1);

    //Secondary buy

    const NFTSeller2 = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: signers[4],
    });
    // share sell amount more than balance
    const sellerVoucher2 = await NFTSeller2.createVoucher(
      signers[4].address,
      NFT.address,
      1,
      7,
      expandTo18Decimals(3),
      2,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[5]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    expect(await USDT.balanceOf(signers[6].address)).to.be.eq(0);
    //royalty address changed
    await NFT.connect(owner).setRoyalty(200);
    await NFT.connect(signers[4]).setApprovalForAll(marketplace.address, true);
    await marketplace
      .connect(signers[5])
      .buyShare(
        sellerVoucher2,
        2,
        false,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(7) }
      );
    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[8],
    });
    await USDT.connect(owner).mint(
      signers[8].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[8]).approve(
      NFT.address,
      expandTo18Decimals(1000)
    );
    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[8].address,
      1,
      expandTo18Decimals(1000),
      2,
      signers[5].address
    );
    await NFT.connect(signers[8]).makeOffer(offerVoucher, true);
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(
      expandTo18Decimals(1000)
    );
    await expect(
      NFT.connect(signers[8]).refundFunds(1, 2, true)
    ).to.be.revertedWith("ION");
  });

  it("ERROR:non admin caller for set royalty ", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));
    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await marketplace
      .connect(signers[3])
      .buyShare(
        sellerVoucher,
        3,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(6) }
      );

    await marketplace
      .connect(signers[4])
      .buyShare(
        sellerVoucher,
        6,
        true,
        "0x0000000000000000000000000000000000000001",
        { value: expandTo18Decimals(12) }
      );

    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);

    expect(await marketplace.amountLeft(1)).to.be.eq(1);

    //Secondary buy

    const NFTSeller2 = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: signers[4],
    });
    // share sell amount more than balance
    const sellerVoucher2 = await NFTSeller2.createVoucher(
      signers[4].address,
      NFT.address,
      1,
      7,
      expandTo18Decimals(3),
      2,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[5]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    expect(await USDT.balanceOf(signers[6].address)).to.be.eq(0);
    //royalty address changed
    await expect(NFT.connect(signers[3]).setRoyalty(200)).to.be.revertedWith(
      "NA"
    );
  });

  it("ERROR: invalid buy amount for secondary sell", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(100000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);

    //Secondary buy

    const NFTSeller2 = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: signers[4],
    });
    const sellerVoucher2 = await NFTSeller2.createVoucher(
      signers[4].address,
      NFT.address,
      1,
      7,
      expandTo18Decimals(3),
      2,
      "testURI"
    );
    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[5]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );
    await NFT.connect(signers[4]).setApprovalForAll(marketplace.address, true);
    await marketplace
      .connect(signers[5])
      .buyShare(sellerVoucher2, 3, false, USDT.address);

    await expect(
      marketplace
        .connect(signers[5])
        .buyShare(sellerVoucher2, 4, false, USDT.address)
    ).to.be.revertedWith("ISB");
  });

  it("single offer", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(19));
    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );
    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    await USDT.connect(signers[4]).approve(
      NFT.address,
      expandTo18Decimals(10000)
    );
    //balance of offerer before making offer
    expect(await USDT.balanceOf(signers[4].address)).to.be.eq(
      expandTo18Decimals(7)
    );

    await USDT.connect(owner).approve(NFT.address, expandTo18Decimals(7));

    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[4],
    });
    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[4].address,
      1,
      expandTo18Decimals(7),
      3,
      signers[3].address
    );
    await NFT.connect(signers[4]).makeOffer(offerVoucher, false);

    //balance of offeree before accepting offer
    expect(await USDT.balanceOf(signers[3].address)).to.be.eq(0);
    //balance of offerer after making offer
    expect(await USDT.balanceOf(signers[4].address)).to.be.eq(0);
    // balance of admin before receiving fees
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000018)
    );

    await NFT.connect(signers[3]).transferShares(offerVoucher, false);
    //transferred amount to offeree after fee deduction
    expect(await USDT.balanceOf(signers[3].address)).to.be.eq(
      expandTo16Decimals(693)
    );
    // balance of admin after receiving fees

    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo16Decimals(100001807)
    );
  });

  it("ERROR: invalid quantity asked for make offer in single offer", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(100000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    await USDT.connect(signers[4]).approve(
      NFT.address,
      expandTo18Decimals(10000)
    );

    await USDT.connect(owner).approve(NFT.address, expandTo18Decimals(10000));

    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[4],
    });

    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[4].address,
      1,
      expandTo18Decimals(7),
      4,
      signers[3].address
    );

    await expect(
      NFT.connect(signers[4]).makeOffer(offerVoucher, false)
    ).to.be.revertedWith("INB");
  });

  it("upgrade single offer", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(100000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    await USDT.connect(signers[4]).approve(NFT.address, expandTo18Decimals(8));

    // balance before make offer
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(0);

    await USDT.connect(owner).approve(NFT.address, expandTo18Decimals(10000));

    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[4],
    });
    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[4].address,
      1,
      expandTo18Decimals(7),
      3,
      signers[3].address
    );
    await NFT.connect(signers[4]).makeOffer(offerVoucher, false);

    // balance after make offer
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(expandTo18Decimals(7));

    await NFT.connect(signers[4]).upgradeOffer(
      1,
      1,
      expandTo18Decimals(8),
      false
    );

    // balance after upgrade offer
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(expandTo18Decimals(8));
  });

  it("ERROR: invalid offer price for upgrade single offer", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(100000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    await USDT.connect(signers[4]).approve(NFT.address, expandTo18Decimals(8));

    // balance before make offer
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(0);

    await USDT.connect(owner).approve(NFT.address, expandTo18Decimals(10000));

    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[4],
    });
    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[4].address,
      1,
      expandTo18Decimals(7),
      3,
      signers[3].address
    );
    await NFT.connect(signers[4]).makeOffer(offerVoucher, false);

    // balance after make offer
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(expandTo18Decimals(7));

    await expect(
      NFT.connect(signers[4]).upgradeOffer(1, 1, expandTo18Decimals(6), false)
    ).to.be.revertedWith("IOP");
  });

  it("ERROR: invalid token for upgrade single offer", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(100000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    await USDT.connect(signers[4]).approve(NFT.address, expandTo18Decimals(8));

    // balance before make offer
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(0);

    await USDT.connect(owner).approve(NFT.address, expandTo18Decimals(10000));

    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[4],
    });
    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[4].address,
      1,
      expandTo18Decimals(7),
      3,
      signers[3].address
    );
    await NFT.connect(signers[4]).makeOffer(offerVoucher, false);

    // balance after make offer
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(expandTo18Decimals(7));

    await expect(
      NFT.connect(signers[4]).upgradeOffer(2, 1, expandTo18Decimals(7), false)
    ).to.be.revertedWith("IT");
  });

  it("ERROR: invalid offer Number for upgrade single offer", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(100000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    await USDT.connect(signers[4]).approve(NFT.address, expandTo18Decimals(8));

    // balance before make offer
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(0);

    await USDT.connect(owner).approve(NFT.address, expandTo18Decimals(10000));

    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[4],
    });
    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[4].address,
      1,
      expandTo18Decimals(7),
      3,
      signers[3].address
    );
    await NFT.connect(signers[4]).makeOffer(offerVoucher, false);

    // balance after make offer
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(expandTo18Decimals(7));

    await expect(
      NFT.connect(signers[4]).upgradeOffer(1, 2, expandTo18Decimals(8), false)
    ).to.be.revertedWith("ION");
  });

  it("upgrade single offer multiple times", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(100000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    await USDT.connect(signers[4]).approve(NFT.address, expandTo18Decimals(9));

    // balance before make offer
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(0);

    await USDT.connect(owner).approve(NFT.address, expandTo18Decimals(10000));

    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[4],
    });
    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[4].address,
      1,
      expandTo18Decimals(7),
      3,
      signers[3].address
    );
    await NFT.connect(signers[4]).makeOffer(offerVoucher, false);

    // balance after make offer
    expect(await USDT.balanceOf(NFT.address)).to.be.eq(expandTo18Decimals(7));

    await NFT.connect(signers[4]).upgradeOffer(
      1,
      1,
      expandTo18Decimals(8),
      false
    );

    await NFT.connect(signers[4]).upgradeOffer(
      1,
      1,
      expandTo18Decimals(9),
      false
    );
  });

  it("ERROR : invalid offerer for make offer", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(100000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    await USDT.connect(signers[4]).approve(
      NFT.address,
      expandTo18Decimals(10000)
    );
        
    await USDT.connect(owner).approve(NFT.address, expandTo18Decimals(10000));

    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[6],
    });

    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[4].address,
      1,
      expandTo18Decimals(7),
      3,
      signers[3].address
    );

    await expect(
      NFT.connect(signers[4]).makeOffer(offerVoucher, false)
    ).to.be.revertedWith("IO");
  });

  it("ERROR: invalid token for single offer", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(100000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    await USDT.connect(signers[4]).approve(
      NFT.address,
      expandTo18Decimals(10000)
    );

    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[4],
    });

    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[4].address,
      3,
      expandTo18Decimals(7),
      3,
      signers[3].address
    );

    await expect(
      NFT.connect(signers[4]).makeOffer(offerVoucher, false)
    ).to.be.revertedWith("IT");
  });

  it("ERROR: invalid caller for transfer share in single offer", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(100000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    await USDT.connect(signers[4]).approve(
      NFT.address,
      expandTo18Decimals(10000)
    );
        
    await USDT.connect(owner).approve(NFT.address, expandTo18Decimals(10000));

    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[4],
    });

    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[4].address,
      1,
      expandTo18Decimals(7),
      3,
      signers[3].address
    );

    await NFT.connect(signers[4]).makeOffer(offerVoucher, false);

    await expect(
      NFT.connect(signers[4]).transferShares(offerVoucher, false)
    ).to.be.revertedWith("OI");
  });

  it("ERROR:Insufficeient NFT balance for transfer share ", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(100000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    await USDT.connect(signers[4]).approve(
      NFT.address,
      expandTo18Decimals(10000)
    );
        
    await USDT.connect(owner).approve(NFT.address, expandTo18Decimals(10000));

    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[4],
    });

    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[4].address,
      1,
      expandTo18Decimals(7),
      3,
      signers[3].address
    );

    await NFT.connect(signers[4]).makeOffer(offerVoucher, false);

    await NFT.connect(signers[3]).transferShares(offerVoucher, false);

    await expect(
      NFT.connect(signers[3]).transferShares(offerVoucher, false)
    ).to.be.revertedWith("INB");
  });

  it("Redeem", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(20));

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 10, true, USDT.address);

    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(10);
    await NFT.connect(signers[3]).redeem(1);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
  });

  it("ERROR: invalid token Id ", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(20));

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 10, true, USDT.address);

    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(10);
    await expect(NFT.connect(signers[3]).redeem(2)).to.be.revertedWith("IT");
  });

  it("Redeem", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(20));

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 10, true, USDT.address);

    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(10);
    await NFT.connect(signers[3]).redeem(1);
    await expect(NFT.connect(signers[3]).redeem(1)).to.be.revertedWith("NE");
  });

  it("make global offer", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(1000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(1000)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    await USDT.connect(signers[5]).approve(
      NFT.address,
      expandTo18Decimals(1000)
    );

    await USDT.connect(owner).approve(NFT.address, expandTo18Decimals(1000));

    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[5],
    });

    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[5].address,
      1,
      expandTo18Decimals(7),
      0,
      signers[6].address
    );

    await NFT.connect(signers[5]).makeOffer(offerVoucher, true);

    await NFT.connect(signers[3]).transferShares(offerVoucher, true);
  });

  it("ERROR: Invalid tokenId for global offer", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(1000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(1000)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    await USDT.connect(signers[5]).approve(
      NFT.address,
      expandTo18Decimals(1000)
    );

    await USDT.connect(owner).approve(NFT.address, expandTo18Decimals(1000));

    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[5],
    });

    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[5].address,
      2,
      expandTo18Decimals(7),
      0,
      signers[6].address
    );
    await expect(
      NFT.connect(signers[5]).makeOffer(offerVoucher, true)
    ).to.be.revertedWith("IT");
  });

  it("upgrade global offer", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(1000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(1000)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    await USDT.connect(signers[5]).approve(
      NFT.address,
      expandTo18Decimals(1000)
    );

    await USDT.connect(owner).approve(NFT.address, expandTo18Decimals(1000));

    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[5],
    });

    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[5].address,
      1,
      expandTo18Decimals(7),
      0,
      signers[6].address
    );

    await NFT.connect(signers[5]).makeOffer(offerVoucher, true);
    await NFT.connect(signers[5]).upgradeOffer(
      1,
      1,
      expandTo18Decimals(8),
      true
    );
  });

  it("ERROR: invalid token for make global offer", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(1000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(1000)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    await USDT.connect(signers[5]).approve(
      NFT.address,
      expandTo18Decimals(1000)
    );

    await USDT.connect(owner).approve(NFT.address, expandTo18Decimals(1000));

    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[5],
    });

    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[5].address,
      1,
      expandTo18Decimals(7),
      0,
      signers[6].address
    );

    await NFT.connect(signers[5]).makeOffer(offerVoucher, true);
    await expect(
      NFT.connect(signers[5]).upgradeOffer(2, 1, expandTo18Decimals(8), true)
    ).to.be.revertedWith("IT");
  });

  it("ERROR: invalid offer price for make global offer", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(1000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(1000)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    await USDT.connect(signers[5]).approve(
      NFT.address,
      expandTo18Decimals(1000)
    );

    await USDT.connect(owner).approve(NFT.address, expandTo18Decimals(1000));

    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[5],
    });

    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[5].address,
      1,
      expandTo18Decimals(7),
      0,
      signers[6].address
    );

    await NFT.connect(signers[5]).makeOffer(offerVoucher, true);
    // upgrading offer multiple times
    await NFT.connect(signers[5]).upgradeOffer(
      1,
      1,
      expandTo18Decimals(8),
      true
    );
    await expect(
      NFT.connect(signers[5]).upgradeOffer(1, 1, expandTo18Decimals(8), true)
    ).to.be.revertedWith("IOP");
  });

  it("ERROR: invalid offer number for make global offer", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[3].address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(owner).mint(
      signers[4].address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(1000)
    );

    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(1000)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(1000)
    );

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    await USDT.connect(signers[5]).approve(
      NFT.address,
      expandTo18Decimals(1000)
    );

    await USDT.connect(owner).approve(NFT.address, expandTo18Decimals(1000));

    const offerMaker = await new offerDetailsVoucher({
      _contract: NFT,
      _signer: signers[5],
    });

    const offerVoucher = await offerMaker.createVoucher(
      1,
      signers[5].address,
      1,
      expandTo18Decimals(7),
      0,
      signers[6].address
    );

    await NFT.connect(signers[5]).makeOffer(offerVoucher, true);
    // upgrading offer multiple times
    await expect(
      NFT.connect(signers[5]).upgradeOffer(1, 2, expandTo18Decimals(8), true)
    ).to.be.revertedWith("ION");
  });

  it("set platform fee", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));
         
    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );
         
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);
    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);
    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);

    // platform fee transfered after primary buy

    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000018)
    );

    expect(await marketplace.amountLeft(1)).to.be.eq(1);

    //Secondary buy
    const NFTSeller2 = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: signers[4],
    });
    // share sell amount more than balance
    const sellerVoucher2 = await NFTSeller2.createVoucher(
      signers[4].address,
      NFT.address,
      1,
      7,
      expandTo18Decimals(3),
      2,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[5]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    await marketplace.connect(owner).setPlatformfee(250);

    // //royalty address changed
         
    await NFT.connect(signers[4]).setApprovalForAll(marketplace.address, true);
    await marketplace
      .connect(signers[5])
      .buyShare(sellerVoucher2, 2, false, USDT.address);
    // platform fee transfered for secondary buy
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo16Decimals(100001827)
    );

    // //royalty amount transferred
         
  });

  it("ERROR:non admin caller for set platform fee", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));
         
    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );
         
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);

    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    // platform fee and amount transferred after primary sell
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000018)
    );

         
    expect(await marketplace.amountLeft(1)).to.be.eq(1);

    await expect(
      marketplace.connect(signers[1]).setPlatformfee(150)
    ).to.be.revertedWith("NA");
  });

  it("ERROR :counter used", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));
         
    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );
         
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);

    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);

    // platform fee and amount trasferred after primary sell
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000018)
    );

         
    expect(await marketplace.amountLeft(1)).to.be.eq(1);

    //Secondary buy
    const NFTSeller2 = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: signers[4],
    });
    // share sell amount more than balance
    const sellerVoucher2 = await NFTSeller2.createVoucher(
      signers[4].address,
      NFT.address,
      1,
      6,
      expandTo18Decimals(3),
      2,
      "testURI"
    );

    await USDT.connect(owner).mint(
      signers[5].address,
      expandTo18Decimals(100000)
    );
    await USDT.connect(signers[5]).approve(
      marketplace.address,
      expandTo18Decimals(10000)
    );

    expect(await USDT.balanceOf(signers[6].address)).to.be.eq(0);

    await NFT.connect(signers[4]).setApprovalForAll(marketplace.address, true);
    await marketplace
      .connect(signers[5])
      .buyShare(sellerVoucher2, 2, false, USDT.address);

    expect(await marketplace.amountLeft(2)).to.be.eq(4);
    await marketplace
      .connect(signers[5])
      .buyShare(sellerVoucher2, 4, false, USDT.address);
    expect(await marketplace.amountLeft(2)).to.be.eq(0);
    await expect(
      marketplace
        .connect(signers[5])
        .buyShare(sellerVoucher2, 1, false, USDT.address)
    ).to.be.revertedWith("CU");
  });

  it("Set admin", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));
         
    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );
         
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);

    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);

    //platform fee and amount trasferred after primary sell
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000018)
    );

         
    expect(await marketplace.amountLeft(1)).to.be.eq(1);
    // updating admin
    await marketplace.connect(owner).setAdmin(signers[1].address);
    // function calling by new admin
    await marketplace.connect(signers[1]).setPlatformfee(20);
  });

  it("ERROR: non admin caller for Set admin", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));
         
    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );
         
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);

    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);
    // platform fee transferred

    // platform fee and amount transferred after primary sell
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000018)
    );

         
    expect(await marketplace.amountLeft(1)).to.be.eq(1);
    // updating admin
    await expect(
      marketplace.connect(signers[2]).setAdmin(signers[1].address)
    ).to.be.revertedWith("NA");
  });

  it("zero address set as admin", async () => {
    const NFTseller = await new shareSellerVoucher({
      _contract: marketplace,
      _signer: owner,
    });
    const sellerVoucher = await NFTseller.createVoucher(
      owner.address,
      NFT.address,
      1,
      10,
      expandTo18Decimals(2),
      1,
      "testURI"
    );
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000000)
    );

    await USDT.connect(owner).mint(signers[3].address, expandTo18Decimals(6));
    await USDT.connect(owner).mint(signers[4].address, expandTo18Decimals(12));
         
    await USDT.connect(signers[3]).approve(
      marketplace.address,
      expandTo18Decimals(6)
    );
    await USDT.connect(signers[4]).approve(
      marketplace.address,
      expandTo18Decimals(12)
    );
         
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(0);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(0);
    expect(await USDT.balanceOf(signers[2].address)).to.be.eq(0);

    await marketplace
      .connect(signers[3])
      .buyShare(sellerVoucher, 3, true, USDT.address);
    await marketplace
      .connect(signers[4])
      .buyShare(sellerVoucher, 6, true, USDT.address);

    // NFT share transferred
    expect(await NFT.balanceOf(signers[3].address, 1)).to.be.eq(3);
    expect(await NFT.balanceOf(signers[4].address, 1)).to.be.eq(6);

    //platform fee and amount transferred after primary sell
    expect(await USDT.balanceOf(owner.address)).to.be.eq(
      expandTo18Decimals(1000018)
    );

         
    expect(await marketplace.amountLeft(1)).to.be.eq(1);
    // zero address as admin
    await expect(
      marketplace
        .connect(owner)
        .setAdmin("0x0000000000000000000000000000000000000000")
    ).to.be.revertedWith("ZA");
  });
});
