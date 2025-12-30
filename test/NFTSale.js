
const { maxTotalSupply, whitelistPrice, publicPrice, nftName, nftSymbol } = require("./Constants.js");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const { NFTSaleFixture } = require("./NFTSaleFixture.js");
const { expect } = require("chai");

describe("NFTSale", function () {
    describe("Deploy", function () {
        it("Init settings", async function () {
            const { admin, nftSale, adminRole, sbt } = await loadFixture(NFTSaleFixture);

            expect(await nftSale.hasRole(adminRole, admin.address)).to.equal(true);
            expect(await nftSale.owner()).to.equal(admin.address);
            expect(await nftSale.name()).to.equal(nftName);
            expect(await nftSale.symbol()).to.equal(nftSymbol);
            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await nftSale.SBT_PARTICIPATION()).to.equal(sbt.target);
            expect(await nftSale.MAX_TOTAL_SUPPLY()).to.equal(maxTotalSupply);
            expect(await nftSale.WHITELIST_PRICE()).to.equal(whitelistPrice);
            expect(await nftSale.PUBLIC_PRICE()).to.equal(publicPrice);
            expect(await nftSale.getState()).to.equal(0n);
            expect(await nftSale.getIdsOfOwner(admin.address)).to.eql([]);
            expect(await nftSale.receiver()).to.equal(ethers.ZeroAddress);
            expect(await nftSale.getTimestamps()).to.eql([0n, 0n, 0n]);
            expect(await nftSale.getStats()).to.eql([0n, 0n, 0n, 0n]);
            expect(await nftSale.getRoots()).to.eql([ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash]);
            expect(await nftSale.getUserData(admin.address)).to.eql([0n, 0n, 0n, 0n]);
            expect(await nftSale.supportsInterface("0x80d23b40")).to.equal(true);
            expect(await nftSale.supportsInterface("0x01ffc9a7")).to.equal(true);
        });

        it("Proxy", async function () {
            const { admin, user, nftSale, NFTSaleImplementation, SBTImplementation } = await loadFixture(NFTSaleFixture);

            await expect(nftSale.connect(user).upgradeToAndCall(
                user.address,
                "0x"
            )).to.be.revertedWithCustomError(nftSale, "AccessControlUnauthorizedAccount");

            await expect(nftSale.connect(user).initialize(
                user, "", ""
            )).to.be.revertedWith("ERC721A__Initializable: contract is already initialized");

            await expect(NFTSaleImplementation.connect(user).initialize(
                user, "", ""
            )).to.be.revertedWithCustomError(NFTSaleImplementation, "InvalidInitialization");

            await expect(nftSale.connect(user).initializeV2(
                user
            )).to.be.revertedWithCustomError(nftSale, "InvalidInitialization");

            const nftSaleImplMock = await ethers.getContractFactory("NFTSale", admin);
            const nftSalelementation = await nftSaleImplMock.deploy(admin.address, 0n, 0n, 0n);
            await nftSalelementation.waitForDeployment();

            await nftSale.connect(admin).upgradeToAndCall(nftSalelementation.target, "0x");

            expect(await nftSale.SBT_PARTICIPATION()).to.equal(admin.address);

            await expect(nftSale.connect(admin).upgradeToAndCall(SBTImplementation.target, "0x")).to.be.revertedWithoutReason();
        });
    });

    describe("Admin's functions", function () {
        it("setRoots()", async function () {
            const { user, nftSale, admin } = await loadFixture(NFTSaleFixture);

            await expect(nftSale.connect(user).setRoots(
                ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash
            )).to.be.revertedWithCustomError(nftSale, "AccessControlUnauthorizedAccount");

            await expect(nftSale.connect(admin).setRoots(
                ethers.keccak256(admin.address), ethers.keccak256(user.address), ethers.keccak256(nftSale.target)
            )).to.emit(nftSale, "RootsSet").withArgs(
                ethers.keccak256(admin.address),
                ethers.keccak256(user.address),
                ethers.keccak256(nftSale.target),
                admin.address
            );

            expect(await nftSale.getRoots()).to.eql([
                ethers.keccak256(admin.address),
                ethers.keccak256(user.address),
                ethers.keccak256(nftSale.target)
            ]);
        });

        it("setReceiver()", async function () {
            const { user, nftSale, admin } = await loadFixture(NFTSaleFixture);

            await expect(nftSale.connect(user).setReceiver(
                user.address
            )).to.be.revertedWithCustomError(nftSale, "AccessControlUnauthorizedAccount");

            await expect(nftSale.connect(admin).setReceiver(
                user.address
            )).to.emit(nftSale, "ReceiverSet").withArgs(
                user.address,
                admin.address
            );

            expect(await nftSale.receiver()).to.equal(user.address);
        });

        it("setBaseURI()", async function () {
            const { user, nftSale, admin } = await loadFixture(NFTSaleFixture);

            await nftSale.connect(admin).mintByAdmin([admin.address], [1n]);

            expect(await nftSale.tokenURI(0n)).to.equal("");

            const newBaseURI = "./";

            await expect(nftSale.connect(user).setBaseURI(
                newBaseURI
            )).to.be.revertedWithCustomError(nftSale, "AccessControlUnauthorizedAccount");

            await expect(nftSale.connect(admin).setBaseURI(
                newBaseURI
            )).to.emit(nftSale, "BaseURISet").withArgs(
                newBaseURI,
                admin.address
            );

            expect(await nftSale.tokenURI(0n)).to.equal("./0");

            await nftSale.connect(admin).mintByAdmin([user.address], [1n]);

            expect(await nftSale.tokenURI(1n)).to.equal("./1");
        });

        it("setTimestamps()", async function () {
            const { user, nftSale, admin } = await loadFixture(NFTSaleFixture);

            await expect(nftSale.connect(user).setTimestamps(
                0n, 0n, 0n
            )).to.be.revertedWithCustomError(nftSale, "AccessControlUnauthorizedAccount");

            await expect(nftSale.connect(admin).setTimestamps(
                await time.latest() - 100, 0n, 0n
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidTimestamp");

            await expect(nftSale.connect(admin).setTimestamps(
                await time.latest() - 100, await time.latest() + 100, await time.latest() + 200
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidTimestamp");

            await expect(nftSale.connect(admin).setTimestamps(
                await time.latest() + 1000, await time.latest() + 100, await time.latest() + 200
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidTimestamp");

            await expect(nftSale.connect(admin).setTimestamps(
                await time.latest() + 1000, await time.latest() + 2000, await time.latest() + 200
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidTimestamp");

            await expect(nftSale.connect(admin).setTimestamps(
                await time.latest() - 1000, await time.latest() + 2000, await time.latest() + 2500
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidTimestamp");

            let timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            expect(await nftSale.getTimestamps()).to.eql([BigInt(timeLatest + 1000), BigInt(timeLatest + 2000), BigInt(timeLatest + 3000)]);

            timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(
                timeLatest - 1000, timeLatest + 2000, timeLatest + 3000
            );

            expect(await nftSale.getTimestamps()).to.eql([BigInt(timeLatest - 1000), BigInt(timeLatest + 2000), BigInt(timeLatest + 3000)]);
        });

        it("mintByAdmin()", async function () {
            const { user, nftSale, admin } = await loadFixture(NFTSaleFixture);

            await expect(nftSale.connect(user).mintByAdmin(
                [], []
            )).to.be.revertedWithCustomError(nftSale, "AccessControlUnauthorizedAccount");

            await expect(nftSale.connect(admin).mintByAdmin(
                [admin.address], []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__ParamsLengthMismatch");

            await expect(nftSale.connect(admin).mintByAdmin(
                [], [1n]
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__ParamsLengthMismatch");

            await expect(nftSale.connect(admin).mintByAdmin(
                [admin.address], [1n, 2n]
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__ParamsLengthMismatch");

            await expect(nftSale.connect(admin).mintByAdmin(
                [admin.address], [1001n]
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__TotalSupplyExceeded");

            await expect(nftSale.connect(admin).mintByAdmin(
                [admin.address, user.address], [500n, 600n]
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__TotalSupplyExceeded");

            await expect(nftSale.connect(admin).mintByAdmin(
                [admin.address, user.address], [1000n, 1n]
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__TotalSupplyExceeded");

            await nftSale.connect(admin).mintByAdmin([admin.address, user.address], [999n, 1n]);

            expect(await nftSale.balanceOf(admin.address)).to.equal(999n);
            expect(await nftSale.balanceOf(user.address)).to.equal(1n);
        });
    });

    describe("View functions", function () {
        it("getState()", async function () {
            const { nftSale, admin } = await loadFixture(NFTSaleFixture);

            expect(await nftSale.getState()).to.equal(0n);

            let timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            expect(await nftSale.getState()).to.equal(0n);

            await time.increase(1000n);

            expect(await nftSale.getState()).to.equal(1n);

            await time.increase(900n);

            expect(await nftSale.getState()).to.equal(1n);

            await time.increase(200n);

            expect(await nftSale.getState()).to.equal(0n);

            await time.increase(1000n);

            expect(await nftSale.getState()).to.equal(2n);

            await time.increase(100000n);

            expect(await nftSale.getState()).to.equal(2n);

            await nftSale.connect(admin).setTimestamps(
                0n, timeLatest + 2000, timeLatest + 3000
            );

            expect(await nftSale.getState()).to.equal(0n);

            timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(
                timeLatest + 100, timeLatest + 2000, timeLatest + 2001
            );

            expect(await nftSale.getState()).to.equal(0n);

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[0]);

            expect(await nftSale.getState()).to.equal(1n);

            await time.increaseTo(timestamps[0] + (timestamps[1] - timestamps[0]) / 2n);

            expect(await nftSale.getState()).to.equal(1n);

            await time.increaseTo(timestamps[1]);

            expect(await nftSale.getState()).to.equal(1n);

            await time.increaseTo(timestamps[1] + 1n);

            expect(await nftSale.getState()).to.equal(2n);

            await time.increaseTo(timestamps[2] + 1n);

            expect(await nftSale.getState()).to.equal(2n);
        });

        it("getIdsOfOwner()", async function () {
            const { nftSale, admin, user } = await loadFixture(NFTSaleFixture);

            await nftSale.connect(admin).mintByAdmin([admin.address, user.address], [1n, 4n]);

            expect(await nftSale.getIdsOfOwner(admin.address)).to.eql([0n]);
            expect(await nftSale.getIdsOfOwner(user.address)).to.eql([1n, 2n, 3n, 4n]);

            await nftSale.connect(admin).mintByAdmin([admin.address, user.address], [3n, 1n]);

            expect(await nftSale.getIdsOfOwner(admin.address)).to.eql([0n, 5n, 6n, 7n]);
            expect(await nftSale.getIdsOfOwner(user.address)).to.eql([1n, 2n, 3n, 4n, 8n]);

            await nftSale.connect(admin).mintByAdmin([admin.address, user.address], [2, 2n]);

            expect(await nftSale.getIdsOfOwner(admin.address)).to.eql([0n, 5n, 6n, 7n, 9n, 10n]);
            expect(await nftSale.getIdsOfOwner(user.address)).to.eql([1n, 2n, 3n, 4n, 8n, 11n, 12n]);

            await nftSale.connect(admin).transferFrom(admin.address, user.address, 0n);
            await nftSale.connect(user).transferFrom(user.address, admin.address, 4n);

            expect(await nftSale.getIdsOfOwner(admin.address)).to.eql([4n, 5n, 6n, 7n, 9n, 10n]);
            expect(await nftSale.getIdsOfOwner(user.address)).to.eql([0n, 1n, 2n, 3n, 8n, 11n, 12n]);
        });
    });

    describe("deposit()", function () {
        it("NFTSale__IncorrectState", async function () {
            const { admin, nftSale } = await loadFixture(NFTSaleFixture);

            expect(await nftSale.getState()).to.equal(0n);

            await expect(nftSale.connect(admin).deposit(
                []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__IncorrectState");

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            expect(await nftSale.getState()).to.equal(0n);

            await expect(nftSale.connect(admin).deposit(
                []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__IncorrectState");

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[1] + 1n);

            expect(await nftSale.getState()).to.equal(0n);

            await expect(nftSale.connect(admin).deposit(
                []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__IncorrectState");

            await time.increaseTo(timestamps[2]);

            expect(await nftSale.getState()).to.equal(2n);

            await expect(nftSale.connect(admin).deposit(
                []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__IncorrectState");
        });

        it("NFTSale__InvalidValue", async function () {
            const { admin, nftSale, user } = await loadFixture(NFTSaleFixture);

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[0]);

            expect(await nftSale.getState()).to.equal(1n);

            await expect(nftSale.connect(admin).deposit(
                []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidValue");

            const treeValues = [[user.address], [admin.address]];
            const tree = StandardMerkleTree.of(treeValues, ["address"]);
            const whitelistRoot = tree.root;
            const adminProof = tree.getProof(1);
            const userProof = tree.getProof(0);

            await nftSale.connect(admin).setRoots(whitelistRoot, ethers.ZeroHash, ethers.ZeroHash);

            expect(await nftSale.getRoots()).to.eql([whitelistRoot, ethers.ZeroHash, ethers.ZeroHash]);

            await expect(nftSale.connect(admin).deposit(
                adminProof,
                { value: whitelistPrice - 1n }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidValue");

            await expect(nftSale.connect(user).deposit(
                userProof,
                { value: 1n }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidValue");

            await expect(nftSale.connect(user).deposit(
                [],
                { value: publicPrice + 1n }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidValue");

            await expect(nftSale.connect(user).deposit(
                [],
                { value: publicPrice - 1n }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidValue");

            await expect(nftSale.connect(user).deposit(
                [],
                { value: publicPrice * 10n + 1n }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidValue");

            await expect(nftSale.connect(user).deposit(
                [],
                { value: publicPrice * 2n - 1n }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidValue");
        });

        it("NFTSale__DepositedAlready", async function () {
            const { admin, nftSale, user } = await loadFixture(NFTSaleFixture);

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[0]);

            expect(await nftSale.getState()).to.equal(1n);

            const treeValues = [[admin.address], [user.address]];
            const tree = StandardMerkleTree.of(treeValues, ["address"]);
            const whitelistRoot = tree.root;
            const adminProof = tree.getProof(0);
            const userProof = tree.getProof(1);

            await nftSale.connect(admin).setRoots(whitelistRoot, ethers.ZeroHash, ethers.ZeroHash);

            expect(await nftSale.getRoots()).to.eql([whitelistRoot, ethers.ZeroHash, ethers.ZeroHash]);

            await expect(nftSale.connect(admin).deposit(
                adminProof,
                { value: whitelistPrice }
            )).to.emit(nftSale, "Deposited").withArgs(
                admin.address,
                whitelistPrice,
                true,
                0n
            );

            await expect(nftSale.connect(admin).deposit(
                adminProof,
                { value: whitelistPrice }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__DepositedAlready");

            await expect(nftSale.connect(user).deposit(
                userProof,
                { value: whitelistPrice }
            )).to.emit(nftSale, "Deposited").withArgs(
                user.address,
                whitelistPrice,
                true,
                0n
            );

            await expect(nftSale.connect(user).deposit(
                userProof,
                { value: whitelistPrice }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__DepositedAlready");
        });

        it("NFTSale__MerkleProofFailed", async function () {
            const { admin, nftSale, user, userTwo } = await loadFixture(NFTSaleFixture);

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[0]);

            expect(await nftSale.getState()).to.equal(1n);

            const treeValues = [[admin.address], [user.address]];
            const tree = StandardMerkleTree.of(treeValues, ["address"]);
            const whitelistRoot = tree.root;
            const adminProof = tree.getProof(0);
            const userProof = tree.getProof(1);

            await expect(nftSale.connect(admin).deposit(
                adminProof,
                { value: whitelistPrice }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(user).deposit(
                userProof,
                { value: whitelistPrice }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await nftSale.connect(admin).setRoots(whitelistRoot, ethers.ZeroHash, ethers.ZeroHash);

            expect(await nftSale.getRoots()).to.eql([whitelistRoot, ethers.ZeroHash, ethers.ZeroHash]);

            await expect(nftSale.connect(admin).deposit(
                userProof,
                { value: whitelistPrice }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(user).deposit(
                adminProof,
                { value: whitelistPrice }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(userTwo).deposit(
                userProof,
                { value: whitelistPrice }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await nftSale.connect(admin).setRoots("0xff" + whitelistRoot.slice(4), ethers.ZeroHash, ethers.ZeroHash);

            expect(await nftSale.getRoots()).to.eql(["0xff" + whitelistRoot.slice(4), ethers.ZeroHash, ethers.ZeroHash]);

            await expect(nftSale.connect(admin).deposit(
                adminProof,
                { value: whitelistPrice }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(user).deposit(
                userProof,
                { value: whitelistPrice }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(userTwo).deposit(
                userProof,
                { value: whitelistPrice }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");
        });

        it("Success (whitelist)", async function () {
            const { admin, nftSale, user, collector, sbt } = await loadFixture(NFTSaleFixture);

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[0]);

            expect(await nftSale.getState()).to.equal(1n);

            await nftSale.connect(admin).setReceiver(collector.address);

            const treeValues = [[admin.address], [user.address]];
            const tree = StandardMerkleTree.of(treeValues, ["address"]);
            const whitelistRoot = tree.root;
            const adminProof = tree.getProof(0);
            const userProof = tree.getProof(1);
            const receiverEtherBalanceBefore = await ethers.provider.getBalance(collector.address);

            await nftSale.connect(admin).setRoots(whitelistRoot, ethers.ZeroHash, ethers.ZeroHash);

            expect(await nftSale.getRoots()).to.eql([whitelistRoot, ethers.ZeroHash, ethers.ZeroHash]);

            expect(await sbt.balanceOf(admin.address)).to.equal(0n);

            await expect(nftSale.connect(admin).deposit(
                adminProof,
                { value: whitelistPrice }
            )).to.emit(nftSale, "Deposited").withArgs(
                admin.address,
                whitelistPrice,
                true,
                0n
            );

            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await sbt.totalSupply()).to.equal(1n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(receiverEtherBalanceBefore + whitelistPrice).to.equal(await ethers.provider.getBalance(collector.address));
            expect(await nftSale.getStats()).to.eql([1n, 0n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([1n, 0n, 0n, 0n]);

            await expect(nftSale.connect(user).deposit(
                userProof,
                { value: whitelistPrice }
            )).to.emit(nftSale, "Deposited").withArgs(
                user.address,
                whitelistPrice,
                true,
                0n
            );

            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await sbt.totalSupply()).to.equal(2n);
            expect(await sbt.balanceOf(user.address)).to.equal(1n);
            expect(receiverEtherBalanceBefore + whitelistPrice * 2n).to.equal(await ethers.provider.getBalance(collector.address));
            expect(await nftSale.getStats()).to.eql([2n, 0n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([1n, 0n, 0n, 0n]);
            expect(await nftSale.getUserData(user.address)).to.eql([1n, 0n, 0n, 0n]);
        });

        it("Success (public)", async function () {
            const { admin, nftSale, user, userTwo, collector, sbt } = await loadFixture(NFTSaleFixture);

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[0] + 500n);

            expect(await nftSale.getState()).to.equal(1n);

            await nftSale.connect(admin).setReceiver(collector.address);

            expect(await sbt.balanceOf(admin.address)).to.equal(0n);

            const receiverEtherBalanceBefore = await ethers.provider.getBalance(collector.address);

            await expect(nftSale.connect(user).deposit(
                [],
                { value: whitelistPrice }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidValue");

            await expect(nftSale.connect(admin).deposit(
                [],
                { value: publicPrice }
            )).to.emit(nftSale, "Deposited").withArgs(
                admin.address,
                publicPrice,
                false,
                1n
            );

            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await sbt.totalSupply()).to.equal(1n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(receiverEtherBalanceBefore).to.equal(await ethers.provider.getBalance(collector.address));
            expect(publicPrice).to.equal(await ethers.provider.getBalance(nftSale.target));
            expect(await nftSale.getStats()).to.eql([0n, 1n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([0n, 1n, 0n, 0n]);

            await expect(nftSale.connect(admin).deposit(
                [],
                { value: publicPrice }
            )).to.emit(nftSale, "Deposited").withArgs(
                admin.address,
                publicPrice,
                false,
                1n
            );

            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await sbt.totalSupply()).to.equal(1n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(receiverEtherBalanceBefore).to.equal(await ethers.provider.getBalance(collector.address));
            expect(publicPrice * 2n).to.equal(await ethers.provider.getBalance(nftSale.target));
            expect(await nftSale.getStats()).to.eql([0n, 2n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([0n, 2n, 0n, 0n]);
            expect(await nftSale.getUserData(user.address)).to.eql([0n, 0n, 0n, 0n]);

            await expect(nftSale.connect(user).deposit(
                [],
                { value: publicPrice * 10n }
            )).to.emit(nftSale, "Deposited").withArgs(
                user.address,
                publicPrice * 10n,
                false,
                10n
            );

            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await sbt.totalSupply()).to.equal(2n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(await sbt.balanceOf(user.address)).to.equal(1n);
            expect(receiverEtherBalanceBefore).to.equal(await ethers.provider.getBalance(collector.address));
            expect(publicPrice * 12n).to.equal(await ethers.provider.getBalance(nftSale.target));
            expect(await nftSale.getStats()).to.eql([0n, 12n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([0n, 2n, 0n, 0n]);
            expect(await nftSale.getUserData(user.address)).to.eql([0n, 10n, 0n, 0n]);

            await expect(nftSale.connect(userTwo).deposit(
                [],
                { value: publicPrice * 12n }
            )).to.emit(nftSale, "Deposited").withArgs(
                userTwo.address,
                publicPrice * 12n,
                false,
                12n
            );

            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await sbt.totalSupply()).to.equal(3n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(await sbt.balanceOf(user.address)).to.equal(1n);
            expect(await sbt.balanceOf(userTwo.address)).to.equal(1n);
            expect(receiverEtherBalanceBefore).to.equal(await ethers.provider.getBalance(collector.address));
            expect(publicPrice * 24n).to.equal(await ethers.provider.getBalance(nftSale.target));
            expect(await nftSale.getStats()).to.eql([0n, 24n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([0n, 2n, 0n, 0n]);
            expect(await nftSale.getUserData(user.address)).to.eql([0n, 10n, 0n, 0n]);
            expect(await nftSale.getUserData(userTwo.address)).to.eql([0n, 12n, 0n, 0n]);

            await expect(nftSale.connect(admin).deposit(
                [],
                { value: publicPrice * 100n }
            )).to.emit(nftSale, "Deposited").withArgs(
                admin.address,
                publicPrice * 100n,
                false,
                100n
            );

            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await sbt.totalSupply()).to.equal(3n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(await sbt.balanceOf(user.address)).to.equal(1n);
            expect(await sbt.balanceOf(userTwo.address)).to.equal(1n);
            expect(receiverEtherBalanceBefore).to.equal(await ethers.provider.getBalance(collector.address));
            expect(publicPrice * 124n).to.equal(await ethers.provider.getBalance(nftSale.target));
            expect(await nftSale.getStats()).to.eql([0n, 124n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([0n, 102n, 0n, 0n]);
            expect(await nftSale.getUserData(user.address)).to.eql([0n, 10n, 0n, 0n]);
            expect(await nftSale.getUserData(userTwo.address)).to.eql([0n, 12n, 0n, 0n]);

            await expect(nftSale.connect(user).deposit(
                [],
                { value: publicPrice * 21n }
            )).to.emit(nftSale, "Deposited").withArgs(
                user.address,
                publicPrice * 21n,
                false,
                21n
            );

            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await sbt.totalSupply()).to.equal(3n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(await sbt.balanceOf(user.address)).to.equal(1n);
            expect(await sbt.balanceOf(userTwo.address)).to.equal(1n);
            expect(receiverEtherBalanceBefore).to.equal(await ethers.provider.getBalance(collector.address));
            expect(publicPrice * 145n).to.equal(await ethers.provider.getBalance(nftSale.target));
            expect(await nftSale.getStats()).to.eql([0n, 145n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([0n, 102n, 0n, 0n]);
            expect(await nftSale.getUserData(user.address)).to.eql([0n, 31n, 0n, 0n]);
            expect(await nftSale.getUserData(userTwo.address)).to.eql([0n, 12n, 0n, 0n]);

            await expect(nftSale.connect(userTwo).deposit(
                [],
                { value: publicPrice * 10n }
            )).to.emit(nftSale, "Deposited").withArgs(
                userTwo.address,
                publicPrice * 10n,
                false,
                10n
            );

            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await sbt.totalSupply()).to.equal(3n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(await sbt.balanceOf(user.address)).to.equal(1n);
            expect(await sbt.balanceOf(userTwo.address)).to.equal(1n);
            expect(receiverEtherBalanceBefore).to.equal(await ethers.provider.getBalance(collector.address));
            expect(publicPrice * 155n).to.equal(await ethers.provider.getBalance(nftSale.target));
            expect(await nftSale.getStats()).to.eql([0n, 155n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([0n, 102n, 0n, 0n]);
            expect(await nftSale.getUserData(user.address)).to.eql([0n, 31n, 0n, 0n]);
            expect(await nftSale.getUserData(userTwo.address)).to.eql([0n, 22n, 0n, 0n]);

            await expect(nftSale.connect(admin).deposit(
                [],
                { value: publicPrice * 7n }
            )).to.emit(nftSale, "Deposited").withArgs(
                admin.address,
                publicPrice * 7n,
                false,
                7n
            );

            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await sbt.totalSupply()).to.equal(3n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(await sbt.balanceOf(user.address)).to.equal(1n);
            expect(await sbt.balanceOf(userTwo.address)).to.equal(1n);
            expect(receiverEtherBalanceBefore).to.equal(await ethers.provider.getBalance(collector.address));
            expect(publicPrice * 162n).to.equal(await ethers.provider.getBalance(nftSale.target));
            expect(await nftSale.getStats()).to.eql([0n, 162n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([0n, 109n, 0n, 0n]);
            expect(await nftSale.getUserData(user.address)).to.eql([0n, 31n, 0n, 0n]);
            expect(await nftSale.getUserData(userTwo.address)).to.eql([0n, 22n, 0n, 0n]);
        });

        it("Success (whitelist + public)", async function () {
            const { admin, nftSale, user, userTwo, collector, sbt } = await loadFixture(NFTSaleFixture);

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[0] + 500n);

            expect(await nftSale.getState()).to.equal(1n);

            await nftSale.connect(admin).setReceiver(collector.address);

            expect(await sbt.balanceOf(admin.address)).to.equal(0n);

            const treeValues = [[admin.address], [user.address], [userTwo.address]];
            const tree = StandardMerkleTree.of(treeValues, ["address"]);
            const whitelistRoot = tree.root;
            const adminProof = tree.getProof(0);
            const userProof = tree.getProof(1);
            const userTwoProof = tree.getProof(2);
            const receiverEtherBalanceBefore = await ethers.provider.getBalance(collector.address);

            await nftSale.connect(admin).setRoots(whitelistRoot, ethers.ZeroHash, ethers.ZeroHash);

            expect(await nftSale.getRoots()).to.eql([whitelistRoot, ethers.ZeroHash, ethers.ZeroHash]);

            await expect(nftSale.connect(user).deposit(
                userProof,
                { value: whitelistPrice + publicPrice + 1n }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidValue");

            await expect(nftSale.connect(user).deposit(
                userProof,
                { value: whitelistPrice + publicPrice - 1n }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidValue");

            await expect(nftSale.connect(user).deposit(
                userProof,
                { value: publicPrice }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidValue");

            await expect(nftSale.connect(admin).deposit(
                adminProof,
                { value: whitelistPrice + publicPrice }
            )).to.emit(nftSale, "Deposited").withArgs(
                admin.address,
                whitelistPrice + publicPrice,
                true,
                1n
            ).to.emit(sbt, "Transfer").withArgs(
                ethers.ZeroAddress,
                admin.address,
                0n
            );

            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await sbt.totalSupply()).to.equal(1n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(receiverEtherBalanceBefore + whitelistPrice).to.equal(await ethers.provider.getBalance(collector.address));
            expect(publicPrice).to.equal(await ethers.provider.getBalance(nftSale.target));
            expect(await nftSale.getStats()).to.eql([1n, 1n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([1n, 1n, 0n, 0n]);

            await expect(nftSale.connect(admin).deposit(
                adminProof,
                { value: whitelistPrice }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__DepositedAlready");

            await expect(nftSale.connect(admin).deposit(
                adminProof,
                { value: publicPrice }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__DepositedAlready");

            await expect(nftSale.connect(admin).deposit(
                adminProof,
                { value: whitelistPrice + publicPrice }
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__DepositedAlready");

            await expect(nftSale.connect(user).deposit(
                [],
                { value: publicPrice * 3n }
            )).to.emit(nftSale, "Deposited").withArgs(
                user.address,
                publicPrice * 3n,
                false,
                3n
            ).to.emit(sbt, "Transfer").withArgs(
                ethers.ZeroAddress,
                user.address,
                1n
            );

            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await sbt.totalSupply()).to.equal(2n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(await sbt.balanceOf(user.address)).to.equal(1n);
            expect(receiverEtherBalanceBefore + whitelistPrice).to.equal(await ethers.provider.getBalance(collector.address));
            expect(publicPrice * 4n).to.equal(await ethers.provider.getBalance(nftSale.target));
            expect(await nftSale.getStats()).to.eql([1n, 4n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([1n, 1n, 0n, 0n]);
            expect(await nftSale.getUserData(user.address)).to.eql([0n, 3n, 0n, 0n]);

            await expect(nftSale.connect(user).deposit(
                userProof,
                { value: whitelistPrice + publicPrice * 10n }
            )).to.emit(nftSale, "Deposited").withArgs(
                user.address,
                whitelistPrice + publicPrice * 10n,
                true,
                10n
            );

            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await sbt.totalSupply()).to.equal(2n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(await sbt.balanceOf(user.address)).to.equal(1n);
            expect(receiverEtherBalanceBefore + whitelistPrice * 2n).to.equal(await ethers.provider.getBalance(collector.address));
            expect(publicPrice * 14n).to.equal(await ethers.provider.getBalance(nftSale.target));
            expect(await nftSale.getStats()).to.eql([2n, 14n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([1n, 1n, 0n, 0n]);
            expect(await nftSale.getUserData(user.address)).to.eql([1n, 13n, 0n, 0n]);

            await expect(nftSale.connect(userTwo).deposit(
                [],
                { value: publicPrice * 10n }
            )).to.emit(nftSale, "Deposited").withArgs(
                userTwo.address,
                publicPrice * 10n,
                false,
                10n
            ).to.emit(sbt, "Transfer").withArgs(
                ethers.ZeroAddress,
                userTwo.address,
                2n
            );

            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await sbt.totalSupply()).to.equal(3n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(await sbt.balanceOf(user.address)).to.equal(1n);
            expect(await sbt.balanceOf(userTwo.address)).to.equal(1n);
            expect(receiverEtherBalanceBefore + whitelistPrice * 2n).to.equal(await ethers.provider.getBalance(collector.address));
            expect(publicPrice * 24n).to.equal(await ethers.provider.getBalance(nftSale.target));
            expect(await nftSale.getStats()).to.eql([2n, 24n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([1n, 1n, 0n, 0n]);
            expect(await nftSale.getUserData(user.address)).to.eql([1n, 13n, 0n, 0n]);
            expect(await nftSale.getUserData(userTwo.address)).to.eql([0n, 10n, 0n, 0n]);

            await expect(nftSale.connect(admin).deposit(
                [],
                { value: publicPrice * 100n }
            )).to.emit(nftSale, "Deposited").withArgs(
                admin.address,
                publicPrice * 100n,
                false,
                100n
            );

            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await sbt.totalSupply()).to.equal(3n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(await sbt.balanceOf(user.address)).to.equal(1n);
            expect(await sbt.balanceOf(userTwo.address)).to.equal(1n);
            expect(receiverEtherBalanceBefore + whitelistPrice * 2n).to.equal(await ethers.provider.getBalance(collector.address));
            expect(publicPrice * 124n).to.equal(await ethers.provider.getBalance(nftSale.target));
            expect(await nftSale.getStats()).to.eql([2n, 124n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([1n, 101n, 0n, 0n]);
            expect(await nftSale.getUserData(user.address)).to.eql([1n, 13n, 0n, 0n]);
            expect(await nftSale.getUserData(userTwo.address)).to.eql([0n, 10n, 0n, 0n]);

            await expect(nftSale.connect(userTwo).deposit(
                userTwoProof,
                { value: whitelistPrice + publicPrice * 30n }
            )).to.emit(nftSale, "Deposited").withArgs(
                userTwo.address,
                whitelistPrice + publicPrice * 30n,
                true,
                30n
            );

            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await sbt.totalSupply()).to.equal(3n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(await sbt.balanceOf(user.address)).to.equal(1n);
            expect(await sbt.balanceOf(userTwo.address)).to.equal(1n);
            expect(receiverEtherBalanceBefore + whitelistPrice * 3n).to.equal(await ethers.provider.getBalance(collector.address));
            expect(publicPrice * 154n).to.equal(await ethers.provider.getBalance(nftSale.target));
            expect(await nftSale.getStats()).to.eql([3n, 154n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([1n, 101n, 0n, 0n]);
            expect(await nftSale.getUserData(user.address)).to.eql([1n, 13n, 0n, 0n]);
            expect(await nftSale.getUserData(userTwo.address)).to.eql([1n, 40n, 0n, 0n]);

            await expect(nftSale.connect(user).deposit(
                [],
                { value: publicPrice * 21n }
            )).to.emit(nftSale, "Deposited").withArgs(
                user.address,
                publicPrice * 21n,
                false,
                21n
            );

            expect(await nftSale.totalSupply()).to.equal(0n);
            expect(await sbt.totalSupply()).to.equal(3n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(await sbt.balanceOf(user.address)).to.equal(1n);
            expect(await sbt.balanceOf(userTwo.address)).to.equal(1n);
            expect(receiverEtherBalanceBefore + whitelistPrice * 3n).to.equal(await ethers.provider.getBalance(collector.address));
            expect(publicPrice * 175n).to.equal(await ethers.provider.getBalance(nftSale.target));
            expect(await nftSale.getStats()).to.eql([3n, 175n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([1n, 101n, 0n, 0n]);
            expect(await nftSale.getUserData(user.address)).to.eql([1n, 34n, 0n, 0n]);
            expect(await nftSale.getUserData(userTwo.address)).to.eql([1n, 40n, 0n, 0n]);

            await expect(nftSale.connect(user).withdrawFunds(
                publicPrice * 175n
            )).to.be.revertedWithCustomError(nftSale, "AccessControlUnauthorizedAccount");

            await nftSale.connect(admin).withdrawFunds(publicPrice * 100n);

            expect(receiverEtherBalanceBefore + whitelistPrice * 3n + publicPrice * 100n).to.equal(await ethers.provider.getBalance(collector.address));
            expect(publicPrice * 75n).to.equal(await ethers.provider.getBalance(nftSale.target));
        });
    });

    describe("refund()", function () {
        it("NFTSale__IncorrectState", async function () {
            const { admin, nftSale } = await loadFixture(NFTSaleFixture);

            expect(await nftSale.getState()).to.equal(0n);

            await expect(nftSale.connect(admin).refund(
                0n, []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__IncorrectState");

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            expect(await nftSale.getState()).to.equal(0n);

            await expect(nftSale.connect(admin).refund(
                0n, []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__IncorrectState");

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[0] + 1n);

            expect(await nftSale.getState()).to.equal(1n);

            await expect(nftSale.connect(admin).refund(
                0n, []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__IncorrectState");

            await time.increaseTo(timestamps[1] - 10n);

            expect(await nftSale.getState()).to.equal(1n);

            await expect(nftSale.connect(admin).refund(
                0n, []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__IncorrectState");

            await time.increaseTo(timestamps[2] - 10n);

            expect(await nftSale.getState()).to.equal(0n);

            await expect(nftSale.connect(admin).refund(
                0n, []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__IncorrectState");
        });

        it("NFTSale__MerkleProofFailed", async function () {
            const { admin, nftSale, user, userTwo } = await loadFixture(NFTSaleFixture);

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[2] + 1n);

            expect(await nftSale.getState()).to.equal(2n);

            const treeValues = [[user.address, 1n], [admin.address, 2n]];
            const tree = StandardMerkleTree.of(treeValues, ["address", "uint256"]);
            const refundRoot = tree.root;
            const adminProof = tree.getProof(1);
            const userProof = tree.getProof(0);

            await nftSale.connect(admin).setRoots(ethers.ZeroHash, ethers.ZeroHash, refundRoot);

            expect(await nftSale.getRoots()).to.eql([ethers.ZeroHash, ethers.ZeroHash, refundRoot]);

            await expect(nftSale.connect(admin).refund(
                1n, []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(admin).refund(
                1n, adminProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(admin).refund(
                1n, userProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(admin).refund(
                2n, userProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(user).refund(
                2n, userProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(user).refund(
                1n, adminProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(user).refund(
                2n, adminProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(userTwo).refund(
                1n, userProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(userTwo).refund(
                2n, userProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(userTwo).refund(
                1n, adminProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(userTwo).refund(
                2n, adminProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");
        });

        it("NFTSale__NothingToClaim (zero deposited)", async function () {
            const { admin, nftSale, user } = await loadFixture(NFTSaleFixture);

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[2] + 1n);

            expect(await nftSale.getState()).to.equal(2n);

            const treeValues = [[user.address, 1n], [admin.address, 2n]];
            const tree = StandardMerkleTree.of(treeValues, ["address", "uint256"]);
            const refundRoot = tree.root;
            const adminProof = tree.getProof(1);
            const userProof = tree.getProof(0);

            await nftSale.connect(admin).setRoots(ethers.ZeroHash, ethers.ZeroHash, refundRoot);

            expect(await nftSale.getRoots()).to.eql([ethers.ZeroHash, ethers.ZeroHash, refundRoot]);

            await expect(nftSale.connect(user).refund(
                1n, userProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__NothingToClaim");

            await expect(nftSale.connect(admin).refund(
                2n, adminProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__NothingToClaim");
        });

        it("NFTSale__NothingToClaim (non-zero deposited)", async function () {
            const { admin, nftSale, user } = await loadFixture(NFTSaleFixture);

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[0] + 1n);

            await expect(nftSale.connect(admin).deposit(
                [],
                { value: publicPrice * 3n }
            )).to.emit(nftSale, "Deposited").withArgs(
                admin.address,
                publicPrice * 3n,
                false,
                3n
            );

            await expect(nftSale.connect(user).deposit(
                [],
                { value: publicPrice }
            )).to.emit(nftSale, "Deposited").withArgs(
                user.address,
                publicPrice,
                false,
                1n
            );

            expect(await nftSale.getStats()).to.eql([0n, 4n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([0n, 3n, 0n, 0n]);
            expect(await nftSale.getUserData(user.address)).to.eql([0n, 1n, 0n, 0n]);

            await time.increaseTo(timestamps[2] + 1n);

            expect(await nftSale.getState()).to.equal(2n);

            const treeValuesClaim = [[user.address, 1n], [admin.address, 1n]];
            const treeClaim = StandardMerkleTree.of(treeValuesClaim, ["address", "uint256"]);
            const claimRoot = treeClaim.root;
            const adminProofClaim = treeClaim.getProof(1);
            const userProofClaim = treeClaim.getProof(0);

            await nftSale.connect(admin).setRoots(ethers.ZeroHash, claimRoot, ethers.ZeroHash);

            expect(await nftSale.getRoots()).to.eql([ethers.ZeroHash, claimRoot, ethers.ZeroHash]);

            await nftSale.connect(admin).claim(1n, adminProofClaim);
            await nftSale.connect(user).claim(1n, userProofClaim);

            expect(await nftSale.getStats()).to.eql([0n, 4n, 0n, 2n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([0n, 3n, 0n, 1n]);
            expect(await nftSale.getUserData(user.address)).to.eql([0n, 1n, 0n, 1n]);

            const treeValues = [[user.address, 1n], [admin.address, 3n]];
            const tree = StandardMerkleTree.of(treeValues, ["address", "uint256"]);
            const refundRoot = tree.root;
            const adminProof = tree.getProof(1);
            const userProof = tree.getProof(0);

            await nftSale.connect(admin).setRoots(ethers.ZeroHash, claimRoot, refundRoot);

            expect(await nftSale.getRoots()).to.eql([ethers.ZeroHash, claimRoot, refundRoot]);

            await expect(nftSale.connect(user).refund(
                1n, userProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__NothingToClaim");

            await expect(nftSale.connect(admin).refund(
                3n, adminProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__NothingToClaim");
        });

        it("Success", async function () {
            const { admin, nftSale, user, userTwo, collector } = await loadFixture(NFTSaleFixture);

            const treeValuesWhitelist = [[admin.address], [user.address]];
            const treeWhitelist = StandardMerkleTree.of(treeValuesWhitelist, ["address"]);
            const whitelistRoot = treeWhitelist.root;
            const adminProofWhitelist = treeWhitelist.getProof(0);
            const userProofWhitelist = treeWhitelist.getProof(1);

            await nftSale.connect(admin).setRoots(whitelistRoot, ethers.ZeroHash, ethers.ZeroHash);

            expect(await nftSale.getRoots()).to.eql([whitelistRoot, ethers.ZeroHash, ethers.ZeroHash]);

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[0] + 1n);

            await expect(nftSale.connect(admin).deposit(
                adminProofWhitelist,
                { value: whitelistPrice + publicPrice * 2n }
            )).to.emit(nftSale, "Deposited").withArgs(
                admin.address,
                whitelistPrice + publicPrice * 2n,
                true,
                2n
            );

            await expect(nftSale.connect(user).deposit(
                userProofWhitelist,
                { value: whitelistPrice + publicPrice * 7n }
            )).to.emit(nftSale, "Deposited").withArgs(
                user.address,
                whitelistPrice + publicPrice * 7n,
                true,
                7n
            );

            await expect(nftSale.connect(userTwo).deposit(
                [],
                { value: publicPrice * 11n }
            )).to.emit(nftSale, "Deposited").withArgs(
                userTwo.address,
                publicPrice * 11n,
                false,
                11n
            );

            await expect(nftSale.connect(collector).deposit(
                [],
                { value: publicPrice * 160n }
            )).to.emit(nftSale, "Deposited").withArgs(
                collector.address,
                publicPrice * 160n,
                false,
                160n
            );

            expect(await nftSale.getStats()).to.eql([2n, 180n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([1n, 2n, 0n, 0n]);
            expect(await nftSale.getUserData(user.address)).to.eql([1n, 7n, 0n, 0n]);
            expect(await nftSale.getUserData(userTwo.address)).to.eql([0n, 11n, 0n, 0n]);
            expect(await nftSale.getUserData(collector.address)).to.eql([0n, 160n, 0n, 0n]);

            await time.increaseTo(timestamps[2] + 1n);

            expect(await nftSale.getState()).to.equal(2n);

            const treeValuesClaim = [[admin.address, 2n], [user.address, 4n], [userTwo.address, 9n]];
            const treeClaim = StandardMerkleTree.of(treeValuesClaim, ["address", "uint256"]);
            const claimRoot = treeClaim.root;
            const adminProofClaim = treeClaim.getProof(0);
            const userProofClaim = treeClaim.getProof(1);
            const userTwoProofClaim = treeClaim.getProof(2);

            await nftSale.connect(admin).setRoots(whitelistRoot, claimRoot, ethers.ZeroHash);

            expect(await nftSale.getRoots()).to.eql([whitelistRoot, claimRoot, ethers.ZeroHash]);

            await nftSale.connect(admin).claim(2n, adminProofClaim);
            await nftSale.connect(user).claim(4n, userProofClaim);
            await nftSale.connect(userTwo).claim(9n, userTwoProofClaim);

            expect(await nftSale.getStats()).to.eql([2n, 180n, 2n, 15n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([1n, 2n, 1n, 2n]);
            expect(await nftSale.getUserData(user.address)).to.eql([1n, 7n, 1n, 4n]);
            expect(await nftSale.getUserData(userTwo.address)).to.eql([0n, 11n, 0n, 9n]);

            const treeValuesRefund = [[admin.address, 1n], [user.address, 3n], [userTwo.address, 2n]];
            const treeRefund = StandardMerkleTree.of(treeValuesRefund, ["address", "uint256"]);
            const refundRoot = treeRefund.root;
            const adminProofRefund = treeRefund.getProof(0);
            const userProofRefund = treeRefund.getProof(1);
            const userTwoProofRefund = treeRefund.getProof(2);

            await nftSale.connect(admin).setRoots(whitelistRoot, claimRoot, refundRoot);

            expect(await nftSale.getRoots()).to.eql([whitelistRoot, claimRoot, refundRoot])

            await expect(nftSale.connect(admin).refund(
                1n, adminProofRefund
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__NothingToClaim");

            const userEtherBalanceBefore = await ethers.provider.getBalance(user.address);

            await expect(nftSale.connect(user).refund(
                3n, userProofRefund
            )).to.emit(nftSale, "Refunded").withArgs(
                user.address,
                publicPrice * 3n,
                3n
            );

            await expect(nftSale.connect(user).refund(
                3n, userProofRefund
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__NothingToClaim");

            expect(userEtherBalanceBefore + publicPrice * 3n).to.closeTo(await ethers.provider.getBalance(user.address), 1000000000000000n);
            expect(await nftSale.getStats()).to.eql([2n, 177n, 2n, 15n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([1n, 2n, 1n, 2n]);
            expect(await nftSale.getUserData(user.address)).to.eql([1n, 4n, 1n, 4n]);
            expect(await nftSale.getUserData(userTwo.address)).to.eql([0n, 11n, 0n, 9n]);

            const userTwoEtherBalanceBefore = await ethers.provider.getBalance(userTwo.address);

            await expect(nftSale.connect(userTwo).refund(
                2n, userTwoProofRefund
            )).to.emit(nftSale, "Refunded").withArgs(
                userTwo.address,
                publicPrice * 2n,
                2n
            );

            await expect(nftSale.connect(userTwo).refund(
                2n, userTwoProofRefund
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__NothingToClaim");

            expect(userTwoEtherBalanceBefore + publicPrice * 2n).to.closeTo(await ethers.provider.getBalance(userTwo.address), 1000000000000000n);
            expect(await nftSale.getStats()).to.eql([2n, 175n, 2n, 15n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([1n, 2n, 1n, 2n]);
            expect(await nftSale.getUserData(user.address)).to.eql([1n, 4n, 1n, 4n]);
            expect(await nftSale.getUserData(userTwo.address)).to.eql([0n, 9n, 0n, 9n]);
        });
    });

    describe("claim()", function () {
        it("NFTSale__IncorrectState", async function () {
            const { admin, nftSale } = await loadFixture(NFTSaleFixture);

            expect(await nftSale.getState()).to.equal(0n);

            await expect(nftSale.connect(admin).claim(
                0n, []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__IncorrectState");

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 100, timeLatest + 1337, timeLatest + 31337);

            expect(await nftSale.getState()).to.equal(0n);

            await expect(nftSale.connect(admin).claim(
                0n, []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__IncorrectState");

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[0] + 1n);

            expect(await nftSale.getState()).to.equal(1n);

            await expect(nftSale.connect(admin).claim(
                0n, []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__IncorrectState");

            await time.increaseTo(timestamps[1] - 10n);

            expect(await nftSale.getState()).to.equal(1n);

            await expect(nftSale.connect(admin).claim(
                0n, []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__IncorrectState");

            await time.increaseTo(timestamps[2] - 10n);

            expect(await nftSale.getState()).to.equal(0n);

            await expect(nftSale.connect(admin).claim(
                0n, []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__IncorrectState");
        });

        it("NFTSale__NothingToClaim (zero deposited)", async function () {
            const { admin, nftSale } = await loadFixture(NFTSaleFixture);

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 100, timeLatest + 1337, timeLatest + 31337);

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[2] + 10n);

            expect(await nftSale.getState()).to.equal(2n);

            await expect(nftSale.connect(admin).claim(
                0n, []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__NothingToClaim");
        });

        it("NFTSale__NothingToClaim (non-zero deposited)", async function () {
            const { admin, nftSale, user, userTwo } = await loadFixture(NFTSaleFixture);

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            const treeValuesWhitelist = [[admin.address], [userTwo.address]];
            const treeWhitelist = StandardMerkleTree.of(treeValuesWhitelist, ["address"]);
            const whitelistRoot = treeWhitelist.root;
            const userTwoProofWhitelist = treeWhitelist.getProof(1);

            await nftSale.connect(admin).setRoots(whitelistRoot, ethers.ZeroHash, ethers.ZeroHash);

            expect(await nftSale.getRoots()).to.eql([whitelistRoot, ethers.ZeroHash, ethers.ZeroHash]);

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[0] + 1n);

            await expect(nftSale.connect(admin).deposit(
                [],
                { value: publicPrice * 2n }
            )).to.emit(nftSale, "Deposited").withArgs(
                admin.address,
                publicPrice * 2n,
                false,
                2n
            );

            await expect(nftSale.connect(user).deposit(
                [],
                { value: publicPrice * 150n }
            )).to.emit(nftSale, "Deposited").withArgs(
                user.address,
                publicPrice * 150n,
                false,
                150
            );

            await expect(nftSale.connect(userTwo).deposit(
                userTwoProofWhitelist,
                { value: whitelistPrice }
            )).to.emit(nftSale, "Deposited").withArgs(
                userTwo.address,
                whitelistPrice,
                true,
                0
            );

            await time.increaseTo(timestamps[2] + 1n);

            expect(await nftSale.getState()).to.equal(2n);

            const treeValuesRefund = [[admin.address, 2n], [user.address, 3n], [userTwo.address, 2n]];
            const treeRefund = StandardMerkleTree.of(treeValuesRefund, ["address", "uint256"]);
            const refundRoot = treeRefund.root;
            const adminProofRefund = treeRefund.getProof(0);

            await nftSale.connect(admin).setRoots(whitelistRoot, ethers.ZeroHash, refundRoot);

            expect(await nftSale.getRoots()).to.eql([whitelistRoot, ethers.ZeroHash, refundRoot]);

            expect(await nftSale.getUserData(admin.address)).to.eql([0n, 2n, 0n, 0n]);

            await nftSale.connect(admin).refund(2n, adminProofRefund);

            expect(await nftSale.getUserData(admin.address)).to.eql([0n, 0n, 0n, 0n]);

            await expect(nftSale.connect(admin).claim(
                0n, []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__NothingToClaim");

            await nftSale.connect(userTwo).claim(0n, []);

            await expect(nftSale.connect(userTwo).claim(
                0n, []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__NothingToClaim");
        });

        it("NFTSale__MerkleProofFailed", async function () {
            const { admin, nftSale, user, userTwo } = await loadFixture(NFTSaleFixture);

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[0] + 1n);

            await expect(nftSale.connect(admin).deposit(
                [],
                { value: publicPrice * 10n }
            )).to.emit(nftSale, "Deposited").withArgs(
                admin.address,
                publicPrice * 10n,
                false,
                10n
            );

            await expect(nftSale.connect(user).deposit(
                [],
                { value: publicPrice * 150n }
            )).to.emit(nftSale, "Deposited").withArgs(
                user.address,
                publicPrice * 150n,
                false,
                150
            );

            await expect(nftSale.connect(userTwo).deposit(
                [],
                { value: publicPrice * 150n }
            )).to.emit(nftSale, "Deposited").withArgs(
                userTwo.address,
                publicPrice * 150n,
                false,
                150
            );

            await time.increaseTo(timestamps[2] + 1n);

            expect(await nftSale.getState()).to.equal(2n);

            const treeValues = [[user.address, 1n], [admin.address, 2n]];
            const tree = StandardMerkleTree.of(treeValues, ["address", "uint256"]);
            const claimRoot = tree.root;
            const adminProof = tree.getProof(1);
            const userProof = tree.getProof(0);

            await nftSale.connect(admin).setRoots(ethers.ZeroHash, claimRoot, ethers.ZeroHash,);

            expect(await nftSale.getRoots()).to.eql([ethers.ZeroHash, claimRoot, ethers.ZeroHash]);

            await expect(nftSale.connect(admin).claim(
                1n, adminProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(admin).claim(
                1n, userProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(admin).claim(
                2n, userProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(user).claim(
                2n, userProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(user).claim(
                1n, adminProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(user).claim(
                2n, adminProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(userTwo).claim(
                1n, userProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(userTwo).claim(
                2n, userProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(userTwo).claim(
                1n, adminProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");

            await expect(nftSale.connect(userTwo).claim(
                2n, adminProof
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__MerkleProofFailed");
        });

        it("NFTSale__TotalSupplyExceeded", async function () {
            const { admin, nftSale, user } = await loadFixture(NFTSaleFixture);

            const treeValuesWhitelist = [[admin.address], [user.address]];
            const treeWhitelist = StandardMerkleTree.of(treeValuesWhitelist, ["address"]);
            const whitelistRoot = treeWhitelist.root;
            const adminProofWhitelist = treeWhitelist.getProof(0);

            await nftSale.connect(admin).setRoots(whitelistRoot, ethers.ZeroHash, ethers.ZeroHash);

            expect(await nftSale.getRoots()).to.eql([whitelistRoot, ethers.ZeroHash, ethers.ZeroHash]);

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[0] + 1n);

            await expect(nftSale.connect(admin).deposit(
                adminProofWhitelist,
                { value: whitelistPrice }
            )).to.emit(nftSale, "Deposited").withArgs(
                admin.address,
                whitelistPrice,
                true,
                0n
            );

            await time.increaseTo(timestamps[2] + 10n);

            expect(await nftSale.getState()).to.equal(2n);

            await nftSale.connect(admin).mintByAdmin([admin.address], [maxTotalSupply])

            await expect(nftSale.connect(admin).claim(
                0n, []
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__TotalSupplyExceeded");
        });

        it("Success", async function () {
            const { admin, nftSale, user, userTwo } = await loadFixture(NFTSaleFixture);

            const timeLatest = await time.latest();

            await nftSale.connect(admin).setTimestamps(timeLatest + 1000, timeLatest + 2000, timeLatest + 3000);

            const treeValuesWhitelist = [[admin.address], [user.address]];
            const treeWhitelist = StandardMerkleTree.of(treeValuesWhitelist, ["address"]);
            const whitelistRoot = treeWhitelist.root;
            const adminProofWhitelist = treeWhitelist.getProof(0);
            const userProofWhitelist = treeWhitelist.getProof(1);

            await nftSale.connect(admin).setRoots(whitelistRoot, ethers.ZeroHash, ethers.ZeroHash);

            expect(await nftSale.getRoots()).to.eql([whitelistRoot, ethers.ZeroHash, ethers.ZeroHash]);

            const timestamps = await nftSale.getTimestamps();

            await time.increaseTo(timestamps[0] + 1n);

            await expect(nftSale.connect(admin).deposit(
                adminProofWhitelist,
                { value: whitelistPrice }
            )).to.emit(nftSale, "Deposited").withArgs(
                admin.address,
                whitelistPrice,
                true,
                0n
            );

            await expect(nftSale.connect(user).deposit(
                userProofWhitelist,
                { value: publicPrice * 10n + whitelistPrice }
            )).to.emit(nftSale, "Deposited").withArgs(
                user.address,
                publicPrice * 10n + whitelistPrice,
                true,
                10n
            );

            await expect(nftSale.connect(userTwo).deposit(
                [],
                { value: publicPrice * 5n }
            )).to.emit(nftSale, "Deposited").withArgs(
                userTwo.address,
                publicPrice * 5n,
                false,
                5n
            );

            await time.increaseTo(timestamps[2] + 1n);

            expect(await nftSale.getState()).to.equal(2n);
            expect(await nftSale.getStats()).to.eql([2n, 15n, 0n, 0n]);
            expect(await nftSale.getUserData(admin.address)).to.eql([1n, 0n, 0n, 0n]);
            expect(await nftSale.getUserData(user.address)).to.eql([1n, 10n, 0n, 0n]);
            expect(await nftSale.getUserData(userTwo.address)).to.eql([0n, 5n, 0n, 0n]);

            const treeValuesClaim = [[user.address, 7n], [userTwo.address, 5n]];
            const treeClaim = StandardMerkleTree.of(treeValuesClaim, ["address", "uint256"]);
            const claimRoot = treeClaim.root;
            const userProofClaim = treeClaim.getProof(0);
            const userTwoProofClaim = treeClaim.getProof(1);

            await nftSale.connect(admin).setRoots(whitelistRoot, claimRoot, ethers.ZeroHash,);

            expect(await nftSale.getRoots()).to.eql([whitelistRoot, claimRoot, ethers.ZeroHash]);

            const totalSupplyBefore = await nftSale.totalSupply();

            await expect(nftSale.connect(admin).claim(
                0, []
            )).to.emit(nftSale, "Claimed").withArgs(
                admin.address,
                true,
                0n
            );

            await expect(nftSale.connect(user).claim(
                7n, userProofClaim
            )).to.emit(nftSale, "Claimed").withArgs(
                user.address,
                true,
                7n
            );

            await expect(nftSale.connect(userTwo).claim(
                5n, userTwoProofClaim
            )).to.emit(nftSale, "Claimed").withArgs(
                userTwo.address,
                false,
                5n
            );

            expect(totalSupplyBefore + 14n).to.eql(await nftSale.totalSupply());
        });
    });

    describe("_authorizeUpgrade()", function () {
        it("NFTSale__InvalidImplementation", async function () {
            const { admin, nftSale } = await loadFixture(NFTSaleFixture);

            const NFTSaleMock = await ethers.getContractFactory("NFTSaleMock", admin);
            const mock = await NFTSaleMock.deploy(admin.address, 0n, 0n, 0n, 0n);
            await mock.waitForDeployment();

            await expect(nftSale.connect(admin).upgradeToAndCall(
                mock.target, "0x"
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidImplementation");

            const NFTSaleMockTwo = await ethers.getContractFactory("NFTSaleMockTwo", admin);
            const mockTwo = await NFTSaleMockTwo.deploy(admin.address, 0n, 0n, 0n, 0n);
            await mockTwo.waitForDeployment();

            await expect(nftSale.connect(admin).upgradeToAndCall(
                mockTwo.target, "0x"
            )).to.be.revertedWithCustomError(nftSale, "NFTSale__InvalidImplementation");
        });
    });
});