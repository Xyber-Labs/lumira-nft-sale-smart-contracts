const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { NFTSaleFixture } = require("./NFTSaleFixture.js");
const { sbtName, sbtSymbol } = require("./Constants.js");
const { expect } = require("chai");

describe("SBTParticipation", function () {
    describe("Deploy", function () {
        it("Init settings", async function () {
            const { admin, sbt, adminRole } = await loadFixture(NFTSaleFixture);

            expect(await sbt.hasRole(adminRole, admin.address)).to.equal(true);
            expect(await sbt.name()).to.equal(sbtName);
            expect(await sbt.symbol()).to.equal(sbtSymbol);
            expect(await sbt.tokenURI(0n)).to.equal("");
            expect(await sbt.totalSupply()).to.equal(0n);
            expect(await sbt.supportsInterface("0xa7375c5c")).to.equal(true);
            expect(await sbt.supportsInterface("0x01ffc9a7")).to.equal(true);
        });

        it("Proxy", async function () {
            const { admin, user, sbt, NFTSaleImplementation, SBTImplementation } = await loadFixture(NFTSaleFixture);

            await expect(sbt.connect(user).upgradeToAndCall(
                user.address,
                "0x"
            )).to.be.revertedWithCustomError(sbt, "AccessControlUnauthorizedAccount");

            await expect(sbt.connect(user).initialize(
                user, "", ""
            )).to.be.revertedWithCustomError(sbt, "InvalidInitialization");

            await expect(SBTImplementation.connect(user).initialize(
                user, "", ""
            )).to.be.revertedWithCustomError(sbt, "InvalidInitialization");

            const sbtImplMock = await ethers.getContractFactory("SBTParticipation", admin);
            const sbtImplementation = await sbtImplMock.deploy();
            await sbtImplementation.waitForDeployment();

            await sbt.connect(admin).upgradeToAndCall(sbtImplementation.target, "0x");

            await expect(sbt.connect(admin).upgradeToAndCall(NFTSaleImplementation.target, "0x")).to.be.revertedWithoutReason();
        });
    });

    describe("mint()", function () {
        it("AccessControl", async function () {
            const { admin, sbt } = await loadFixture(NFTSaleFixture);

            await expect(sbt.connect(admin).mint(
                admin.address
            )).to.be.revertedWithCustomError(sbt, "AccessControlUnauthorizedAccount");
        });

        it("Success", async function () {
            const { admin, user, sbt, minterRole } = await loadFixture(NFTSaleFixture);

            await sbt.connect(admin).grantRole(minterRole, admin.address);

            const totalSupply = await sbt.totalSupply();

            await expect(sbt.connect(admin).mint(
                admin.address
            )).to.emit(sbt, "Transfer").withArgs(
                ethers.ZeroAddress,
                admin.address,
                totalSupply
            );

            expect(await sbt.totalSupply()).to.equal(totalSupply + 1n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(await sbt.ownerOf(0n)).to.equal(admin.address);

            await expect(sbt.connect(admin).mint(
                admin.address
            )).to.not.emit(sbt, "Transfer");

            expect(await sbt.totalSupply()).to.equal(totalSupply + 1n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(await sbt.ownerOf(0n)).to.equal(admin.address);

            await expect(sbt.connect(admin).mint(
                user.address
            )).to.emit(sbt, "Transfer").withArgs(
                ethers.ZeroAddress,
                user.address,
                totalSupply + 1n
            );

            expect(await sbt.totalSupply()).to.equal(totalSupply + 2n);
            expect(await sbt.balanceOf(admin.address)).to.equal(1n);
            expect(await sbt.balanceOf(user.address)).to.equal(1n);
            expect(await sbt.ownerOf(0n)).to.equal(admin.address);
            expect(await sbt.ownerOf(1n)).to.equal(user.address);
        });
    });

    describe("setTokenURI()", function () {
        it("AccessControl", async function () {
            const { user, sbt } = await loadFixture(NFTSaleFixture);

            await expect(sbt.connect(user).setTokenURI(
                "test1"
            )).to.be.revertedWithCustomError(sbt, "AccessControlUnauthorizedAccount");
        });

        it("Success", async function () {
            const { admin, sbt } = await loadFixture(NFTSaleFixture);

            const newTokenURI = "test1";

            await expect(sbt.connect(admin).setTokenURI(
                newTokenURI
            )).to.emit(sbt, "TokenURISet").withArgs(
                newTokenURI,
                admin.address
            );

            expect(await sbt.tokenURI(0n)).to.equal(newTokenURI);
        });
    });

    describe("transferFrom()", function () {
        it("SBTParticipation__NonTransferableToken", async function () {
            const { admin, user, sbt, minterRole } = await loadFixture(NFTSaleFixture);

            await sbt.connect(admin).grantRole(minterRole, admin.address);

            const totalSupply = await sbt.totalSupply();

            await expect(sbt.connect(admin).mint(
                admin.address
            )).to.emit(sbt, "Transfer").withArgs(
                ethers.ZeroAddress,
                admin.address,
                totalSupply
            );

            await expect(sbt.connect(admin).transferFrom(
                admin.address,
                user.address,
                0n
            )).to.be.revertedWithCustomError(sbt, "SBTParticipation__NonTransferableToken");

            await expect(sbt.connect(admin).safeTransferFrom(
                admin.address,
                user.address,
                0n
            )).to.be.revertedWithCustomError(sbt, "SBTParticipation__NonTransferableToken");

            await sbt.connect(admin).approve(user.address, 0n);

            await expect(sbt.connect(user).transferFrom(
                admin.address,
                user.address,
                0n
            )).to.be.revertedWithCustomError(sbt, "SBTParticipation__NonTransferableToken");

            await expect(sbt.connect(user).safeTransferFrom(
                admin.address,
                user.address,
                0n
            )).to.be.revertedWithCustomError(sbt, "SBTParticipation__NonTransferableToken");

            await expect(sbt.connect(user)["safeTransferFrom(address,address,uint256,bytes)"](
                admin.address,
                user.address,
                0n,
                "0x"
            )).to.be.revertedWithCustomError(sbt, "SBTParticipation__NonTransferableToken");
        });
    });

    describe("_authorizeUpgrade()", function () {
        it("SBTParticipation__InvalidImplementation", async function () {
            const { admin, sbt } = await loadFixture(NFTSaleFixture);

            const SBTParticipationMock = await ethers.getContractFactory("SBTParticipationMock", admin);
            const mock = await SBTParticipationMock.deploy();
            await mock.waitForDeployment();

            await expect(sbt.connect(admin).upgradeToAndCall(
                mock.target, "0x"
            )).to.be.revertedWithCustomError(sbt, "SBTParticipation__InvalidImplementation");

            const SBTParticipationMockTwo = await ethers.getContractFactory("SBTParticipationMockTwo", admin);
            const mockTwo = await SBTParticipationMockTwo.deploy();
            await mockTwo.waitForDeployment();

            await expect(sbt.connect(admin).upgradeToAndCall(
                mockTwo.target, "0x"
            )).to.be.revertedWithCustomError(sbt, "SBTParticipation__InvalidImplementation");
        });
    });
});