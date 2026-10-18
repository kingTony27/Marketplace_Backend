import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { getAddress } from "viem";

describe("NFTCollection", async function () {
  const { viem } = await network.connect();

  async function deployCollection() {
    const collection = await viem.deployContract("NFTCollection", [
      "Tman NFTs",
      "TMAN",
    ]);
    const [owner, alice, bob] = await viem.getWalletClients();
    return { collection, owner, alice, bob };
  }

  it("mints exactly one token NFT per call, owned by the caller", async function () {
    const { collection, alice } = await deployCollection();
    const collectionAsAlice = await viem.getContractAt(
      "NFTCollection",
      collection.address,
      { client: { wallet: alice } },
    );

    await collectionAsAlice.write.createNFT(["ipfs://metadata-hash-1"]);

    assert.equal(await collection.read.ownerOf([0n]), getAddress(alice.account.address));
    assert.equal(await collection.read.tokenURI([0n]), "ipfs://metadata-hash-1");
    assert.equal(await collection.read.nextTokenId(), 1n);
  });

  it("increments token IDs across separate mints, including by different users", async function () {
    const { collection, alice, bob } = await deployCollection();
    const collectionAsAlice = await viem.getContractAt(
      "NFTCollection",
      collection.address,
      { client: { wallet: alice } },
    );
    const collectionAsBob = await viem.getContractAt(
      "NFTCollection",
      collection.address,
      { client: { wallet: bob } },
    );

    await collectionAsAlice.write.createNFT(["ipfs://alice-nft"]);
    await collectionAsBob.write.createNFT(["ipfs://bob-nft"]);

    assert.equal(await collection.read.ownerOf([0n]), getAddress(alice.account.address));
    assert.equal(await collection.read.ownerOf([1n]), getAddress(bob.account.address));
    assert.equal(await collection.read.nextTokenId(), 2n);
  });

  it("does not expose any batch-mint entry point", async function () {
    const { collection } = await deployCollection();
    // createNFT only ever accepts a single tokenURI string — this is really a
    // compile-time guarantee, but we assert the ABI surface as a guard against
    // someone adding a batch function later without noticing the requirement.
    const fnNames = collection.abi
      .filter((entry: any) => entry.type === "function")
      .map((entry: any) => entry.name);

    assert.ok(fnNames.includes("createNFT"));
    assert.ok(!fnNames.some((name: string) => /batch|Bulk|Multi/i.test(name)));
  });

  it("emits NFTCreated with the creator, tokenId, and tokenURI", async function () {
    const { collection, alice } = await deployCollection();
    const collectionAsAlice = await viem.getContractAt(
      "NFTCollection",
      collection.address,
      { client: { wallet: alice } },
    );

    const hash = await collectionAsAlice.write.createNFT(["ipfs://event-check"]);

    await viem.assertions.emitWithArgs(
      hash,
      collection,
      "NFTCreated",
      [getAddress(alice.account.address), 0n, "ipfs://event-check"],
    );
  });
});