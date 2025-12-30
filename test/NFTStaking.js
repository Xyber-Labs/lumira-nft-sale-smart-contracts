
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { NFTSaleFixture } = require("./NFTSaleFixture.js");
const { expect } = require("chai");

describe("NFTStaking", function () {
    describe("Deploy", function () {
        it("Init settings", async function () {
            const { admin, nftStaking, adminRole, nftSale } = await loadFixture(NFTSaleFixture);

            expect(await nftStaking.hasRole(adminRole, admin.address)).to.equal(true);
            expect(await nftStaking.NFT_ADDRESS()).to.equal(nftSale.target);
            expect(await nftStaking.stakers()).to.eql([]);
            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([]);
            expect(await nftStaking.locks([0n])).to.eql([0n]);
            expect(await nftStaking.stakeData([0n])).to.eql([[ethers.ZeroAddress, 0n]]);
            expect(await nftStaking.stakeAtByStaker(admin.address)).to.eql([]);
            expect(await nftStaking.locksByStaker(admin.address)).to.eql([]);
            expect(await nftStaking.lockedUntilByStaker(admin.address)).to.eql([]);
            expect(await nftStaking.supportsInterface("0xce41bb9e")).to.equal(true);
            expect(await nftStaking.supportsInterface("0x01ffc9a7")).to.equal(true);
        });

        it("Proxy", async function () {
            const { admin, user, nftStaking, NFTStakingImplementation, SBTImplementation } = await loadFixture(NFTSaleFixture);

            await expect(nftStaking.connect(user).upgradeToAndCall(
                user.address,
                "0x"
            )).to.be.revertedWithCustomError(nftStaking, "AccessControlUnauthorizedAccount");

            await expect(nftStaking.connect(user).initialize(
                user
            )).to.be.revertedWithCustomError(nftStaking, "InvalidInitialization");

            await expect(NFTStakingImplementation.connect(user).initialize(
                user
            )).to.be.revertedWithCustomError(nftStaking, "InvalidInitialization");

            const nftStakingImplMock = await ethers.getContractFactory("NFTStaking", admin);
            const nftStakinglementation = await nftStakingImplMock.deploy(admin.address);
            await nftStakinglementation.waitForDeployment();

            await nftStaking.connect(admin).upgradeToAndCall(nftStakinglementation.target, "0x");

            expect(await nftStaking.NFT_ADDRESS()).to.equal(admin.address);

            await expect(nftStaking.connect(admin).upgradeToAndCall(SBTImplementation.target, "0x")).to.be.revertedWithoutReason();
        });
    });

    describe("stake() & unstake() & stakeWithLockOnBehalfOf()", function () {
        it("NFTStaking Stake NotAnOwner", async function () {
            const { user, nftSale, admin, nftStaking } = await loadFixture(NFTSaleFixture);

            await nftSale.connect(admin).mintByAdmin([user.address], [1n]);
            await nftSale.connect(admin).mintByAdmin([admin.address], [1n]);

            await nftSale.connect(user).approve(nftStaking.target, 0n);
            await nftSale.connect(admin).approve(nftStaking.target, 1n);

            await expect(nftStaking.connect(admin).stake(
                [0n]
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__NotAnOwner");

            await expect(nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n],
                [admin.address],
                [1n]
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__NotAnOwner");

            await expect(nftStaking.connect(admin).stake(
                [1n, 0n]
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__NotAnOwner");

            await expect(nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [1n, 0n],
                [admin.address, user.address],
                [1n, 0]
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__NotAnOwner");
        });

        it("NFTStaking Unstake NotAnOwner", async function () {
            const { user, nftSale, admin, nftStaking } = await loadFixture(NFTSaleFixture);

            await nftSale.connect(admin).mintByAdmin([user.address], [1n]);
            await nftSale.connect(admin).mintByAdmin([admin.address], [1n]);

            await nftSale.connect(user).approve(nftStaking.target, 0n);
            await nftSale.connect(admin).approve(nftStaking.target, 1n);

            await expect(nftStaking.connect(user).stake([0n])).to.emit(nftStaking, "Staked").withArgs(
                user.address,
                0n,
                anyValue
            );

            await expect(nftStaking.connect(admin).stake([1n])).to.emit(nftStaking, "Staked").withArgs(
                admin.address,
                1n,
                anyValue
            );

            await expect(nftStaking.connect(admin).unstake(
                [0n], admin.address
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__NotAnOwner");

            await expect(nftStaking.connect(admin).unstake(
                [1n, 0n], admin.address
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__NotAnOwner");
        });

        it("Unstake invalid receiver", async function () {
            const { user, nftSale, admin, nftStaking } = await loadFixture(NFTSaleFixture);

            await nftSale.connect(admin).mintByAdmin([user.address], [1n]);

            await nftSale.connect(user).approve(nftStaking.target, 0n);

            await expect(nftStaking.connect(user).stake([0n])).to.emit(nftStaking, "Staked").withArgs(
                user.address,
                0n,
                anyValue
            );

            await expect(nftStaking.connect(user).unstake(
                [0n], nftSale.target
            )).to.be.revertedWithCustomError(nftSale, "TransferToNonERC721ReceiverImplementer()");
        });

        it("NFTStaking__InvalidLength", async function () {
            const { user, nftStaking } = await loadFixture(NFTSaleFixture);

            await expect(nftStaking.connect(user).stake(
                []
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__InvalidLength");

            await expect(nftStaking.connect(user).unstake(
                [], user.address
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__InvalidLength");

            await expect(nftStaking.connect(user).stakeWithLockOnBehalfOf(
                [],
                [user.address, user.address],
                [1n, 0n]
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__InvalidLength");

            await expect(nftStaking.connect(user).stakeWithLockOnBehalfOf(
                [0n],
                [user.address, user.address],
                [1n, 0n]
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__InvalidLength");

            await expect(nftStaking.connect(user).stakeWithLockOnBehalfOf(
                [0n],
                [user.address],
                [1n, 0n]
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__InvalidLength");

            await expect(nftStaking.connect(user).stakeWithLockOnBehalfOf(
                [0n],
                [user.address, user.address],
                [1n]
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__InvalidLength");

            await expect(nftStaking.connect(user).stakeWithLockOnBehalfOf(
                [0n, 1n],
                [user.address, user.address],
                [1n]
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__InvalidLength");
        });

        it("Success single", async function () {
            const { user, nftSale, admin, nftStaking } = await loadFixture(NFTSaleFixture);

            await nftSale.connect(admin).mintByAdmin([user.address], [2n]);

            await nftSale.connect(user).approve(nftStaking.target, 0n);

            const lastTimestamp = await time.latest();

            await expect(nftStaking.connect(user).stake([0n])).to.emit(nftStaking, "Staked").withArgs(
                user.address,
                0n,
                anyValue
            );

            expect(await nftStaking.stakers()).to.eql([user.address]);
            expect(await nftStaking.stakedTokenIds(user.address)).to.eql([0n]);

            let stakeData = await nftStaking.stakeData([0n]);
            let stakeAtByUser = await nftStaking.stakeAtByStaker(user.address);
            let locks = await nftStaking.locks([0n]);
            let locksByStaker = await nftStaking.locksByStaker(user.address);
            let lockedUntilByStaker = await nftStaking.lockedUntilByStaker(user.address);

            expect(stakeData[0][0]).to.equal(user.address);
            expect(stakeData[0][1]).to.closeTo(lastTimestamp, 50);

            expect(stakeAtByUser[0][0]).to.equal(0n);
            expect(stakeAtByUser[0][1]).to.closeTo(lastTimestamp, 50);

            expect(locks[0]).to.equal(0n);

            expect(locksByStaker[0][0]).to.equal(0n);
            expect(locksByStaker[0][1]).to.equal(0n);

            expect(lockedUntilByStaker.length).to.equal(0n);

            await expect(nftStaking.connect(user).unstake([0n], admin.address)).to.emit(nftStaking, "Unstaked").withArgs(
                user.address,
                0n,
                admin.address
            );

            expect(await nftSale.ownerOf(0n)).to.equal(admin.address);

            expect(await nftStaking.stakers()).to.eql([]);
            expect(await nftStaking.stakedTokenIds(user.address)).to.eql([]);

            stakeData = await nftStaking.stakeData([0n]);
            stakeAtByUser = await nftStaking.stakeAtByStaker(user.address);
            locks = await nftStaking.locks([0n]);
            locksByStaker = await nftStaking.locksByStaker(user.address);
            lockedUntilByStaker = await nftStaking.lockedUntilByStaker(user.address);

            expect(stakeData[0][0]).to.equal(ethers.ZeroAddress);
            expect(stakeData[0][1]).to.equal(0n);

            expect(stakeAtByUser.length).to.equal(0n);

            expect(locks[0]).to.equal(0n);

            expect(locksByStaker.length).to.equal(0n);

            expect(lockedUntilByStaker.length).to.equal(0n);
        });

        it("Success multi", async function () {
            const { user, nftSale, admin, nftStaking } = await loadFixture(NFTSaleFixture);

            await nftSale.connect(admin).mintByAdmin([admin.address], [2n]);

            await nftSale.connect(admin).setApprovalForAll(nftStaking.target, true);

            const lastTimestamp = await time.latest();

            await expect(nftStaking.connect(admin).stake([0n, 1n])).to.emit(nftStaking, "Staked").withArgs(
                admin.address,
                0n,
                anyValue
            ).to.emit(nftStaking, "Staked").withArgs(
                admin.address,
                1n,
                anyValue
            );

            expect(await nftStaking.stakers()).to.eql([admin.address]);
            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([0n, 1n]);

            stakeData = await nftStaking.stakeData([0n, 1n]);
            stakeAtByUser = await nftStaking.stakeAtByStaker(admin.address);

            expect(stakeData[0][0]).to.equal(admin.address);
            expect(stakeData[0][1]).to.closeTo(lastTimestamp, 75);

            expect(stakeData[1][0]).to.equal(admin.address);
            expect(stakeData[1][1]).to.closeTo(lastTimestamp, 75);

            expect(stakeAtByUser[0][0]).to.equal(0n);
            expect(stakeAtByUser[0][1]).to.closeTo(lastTimestamp, 75);

            expect(stakeAtByUser[1][0]).to.equal(1n);
            expect(stakeAtByUser[1][1]).to.closeTo(lastTimestamp, 75);

            await expect(nftStaking.connect(admin).unstake([0n], admin.address)).to.emit(nftStaking, "Unstaked").withArgs(
                admin.address,
                0n,
                admin.address
            );

            expect(await nftStaking.stakers()).to.eql([admin.address]);
            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([1n]);

            stakeData = await nftStaking.stakeData([0n, 1n]);
            stakeAtByUser = await nftStaking.stakeAtByStaker(admin.address);

            expect(stakeData[0][0]).to.equal(ethers.ZeroAddress);
            expect(stakeData[0][1]).to.equal(0n);

            expect(stakeData[1][0]).to.equal(admin.address);
            expect(stakeData[1][1]).to.closeTo(lastTimestamp, 100);

            expect(stakeAtByUser[0][0]).to.equal(1n);
            expect(stakeAtByUser[0][1]).to.closeTo(lastTimestamp, 100);

            await nftSale.connect(admin).mintByAdmin([user.address], [3n]);

            await nftSale.connect(user).approve(nftStaking.target, 2n);

            await expect(nftStaking.connect(user).stake([2n])).to.emit(nftStaking, "Staked").withArgs(
                user.address,
                2n,
                anyValue
            );

            expect(await nftStaking.stakers()).to.eql([admin.address, user.address]);
            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([1n]);
            expect(await nftStaking.stakedTokenIds(user.address)).to.eql([2n]);

            stakeData = await nftStaking.stakeData([0n, 1n, 2n]);
            stakeAtByAdmin = await nftStaking.stakeAtByStaker(admin.address);
            stakeAtByUser = await nftStaking.stakeAtByStaker(user.address);

            expect(stakeData[0][0]).to.equal(ethers.ZeroAddress);
            expect(stakeData[0][1]).to.equal(0n);

            expect(stakeData[1][0]).to.equal(admin.address);
            expect(stakeData[1][1]).to.closeTo(lastTimestamp, 100);

            expect(stakeData[2][0]).to.equal(user.address);
            expect(stakeData[2][1]).to.closeTo(lastTimestamp, 100);

            expect(stakeAtByAdmin[0][0]).to.equal(1n);
            expect(stakeAtByAdmin[0][1]).to.closeTo(lastTimestamp, 100);

            expect(stakeAtByUser[0][0]).to.equal(2n);
            expect(stakeAtByUser[0][1]).to.closeTo(lastTimestamp, 100);

            expect(await nftSale.ownerOf(1n)).to.equal(nftStaking.target);

            await expect(nftStaking.connect(admin).unstake([1n], user.address)).to.emit(nftStaking, "Unstaked").withArgs(
                admin.address,
                1n,
                user.address
            );

            expect(await nftSale.ownerOf(1n)).to.equal(user.address);

            expect(await nftStaking.stakers()).to.eql([user.address]);
            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([]);
            expect(await nftStaking.stakedTokenIds(user.address)).to.eql([2n]);

            stakeData = await nftStaking.stakeData([0n, 1n, 2n]);
            stakeAtByAdmin = await nftStaking.stakeAtByStaker(admin.address);
            stakeAtByUser = await nftStaking.stakeAtByStaker(user.address);

            expect(stakeData[0][0]).to.equal(ethers.ZeroAddress);
            expect(stakeData[0][1]).to.equal(0n);

            expect(stakeData[1][0]).to.equal(ethers.ZeroAddress);
            expect(stakeData[1][1]).to.equal(0n);

            expect(stakeData[2][0]).to.equal(user.address);
            expect(stakeData[2][1]).to.closeTo(lastTimestamp, 100);

            expect(stakeAtByAdmin.length).to.equal(0);

            expect(stakeAtByUser[0][0]).to.equal(2n);
            expect(stakeAtByUser[0][1]).to.closeTo(lastTimestamp, 100);

            await nftSale.connect(user).approve(nftStaking.target, 3n);

            await expect(nftStaking.connect(user).stake([3n])).to.emit(nftStaking, "Staked").withArgs(
                user.address,
                3n,
                anyValue
            );

            await expect(nftStaking.connect(user).unstake([3n, 2n], user.address)).to.emit(nftStaking, "Unstaked").withArgs(
                user.address,
                3n,
                user.address
            ).to.emit(nftStaking, "Unstaked").withArgs(
                user.address,
                2n,
                user.address
            );

            expect(await nftStaking.stakers()).to.eql([]);
            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([]);
            expect(await nftStaking.stakedTokenIds(user.address)).to.eql([]);

            stakeData = await nftStaking.stakeData([0n, 1n, 2n, 3n]);
            stakeAtByAdmin = await nftStaking.stakeAtByStaker(admin.address);
            stakeAtByUser = await nftStaking.stakeAtByStaker(user.address);

            expect(stakeData[0][0]).to.equal(ethers.ZeroAddress);
            expect(stakeData[0][1]).to.equal(0n);

            expect(stakeData[1][0]).to.equal(ethers.ZeroAddress);
            expect(stakeData[1][1]).to.equal(0n);

            expect(stakeData[2][0]).to.equal(ethers.ZeroAddress);
            expect(stakeData[2][1]).to.equal(0n);

            expect(stakeData[3][0]).to.equal(ethers.ZeroAddress);
            expect(stakeData[3][1]).to.equal(0n);

            expect(stakeAtByAdmin.length).to.equal(0);
            expect(stakeAtByUser.length).to.equal(0);
        });

        it("Success multi with lock", async function () {
            const { user, nftSale, admin, nftStaking } = await loadFixture(NFTSaleFixture);

            await nftSale.connect(admin).mintByAdmin([admin.address], [2n]);

            await nftSale.connect(admin).setApprovalForAll(nftStaking.target, true);

            const lastTimestamp = await time.latest();

            await expect(nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n, 1n],
                [admin.address, ethers.ZeroAddress],
                [100000000n, 0n]
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__ZeroAddress");

            await expect(nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n, 1n],
                [admin.address, user.address],
                [100000000n, 0n]
            )).to.emit(nftStaking, "Staked").withArgs(
                admin.address,
                0n,
                anyValue
            ).to.emit(nftStaking, "Staked").withArgs(
                user.address,
                1n,
                anyValue
            );

            expect(await nftStaking.stakers()).to.eql([admin.address, user.address]);
            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([0n]);
            expect(await nftStaking.stakedTokenIds(user.address)).to.eql([1n]);

            let stakeData = await nftStaking.stakeData([0n, 1n]);
            let stakeAtByAdmin = await nftStaking.stakeAtByStaker(admin.address);
            let stakeAtByUser = await nftStaking.stakeAtByStaker(user.address);
            let locks = await nftStaking.locks([0n, 1n]);
            let locksByAdmin = await nftStaking.locksByStaker(admin.address);
            let locksByUser = await nftStaking.locksByStaker(user.address);
            let lockedUntilByAdmin = await nftStaking.lockedUntilByStaker(admin.address);
            let lockedUntilByUser = await nftStaking.lockedUntilByStaker(user.address);

            expect(stakeData[0][0]).to.equal(admin.address);
            expect(stakeData[0][1]).to.closeTo(lastTimestamp, 75);

            expect(stakeData[1][0]).to.equal(user.address);
            expect(stakeData[1][1]).to.closeTo(lastTimestamp, 75);

            expect(stakeAtByAdmin[0][0]).to.equal(0n);
            expect(stakeAtByAdmin[0][1]).to.closeTo(lastTimestamp, 75);

            expect(stakeAtByUser[0][0]).to.equal(1n);
            expect(stakeAtByUser[0][1]).to.closeTo(lastTimestamp, 75);

            expect(locks[0]).to.closeTo(lastTimestamp + 100000000, 75);
            expect(locks[1]).to.equal(0);

            expect(locksByAdmin[0][0]).to.equal(0n);
            expect(locksByAdmin[0][1]).closeTo(lastTimestamp + 100000000, 75);

            expect(locksByUser[0][0]).to.equal(1n);
            expect(locksByUser[0][1]).to.equal(0n);

            expect(lockedUntilByAdmin[0][0]).to.equal(0n);
            expect(lockedUntilByAdmin[0][1]).closeTo(lastTimestamp + 100000000, 75);

            expect(lockedUntilByUser.length).to.equal(0n);

            await expect(nftStaking.connect(admin).unstake(
                [0n],
                admin.address
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__LockedToken");

            await expect(nftStaking.connect(user).unstake([1n], user.address)).to.emit(nftStaking, "Unstaked").withArgs(
                user.address,
                1n,
                user.address
            );

            await time.increase(100000100);

            await expect(nftStaking.connect(admin).unstake([0n], admin.address)).to.emit(nftStaking, "Unstaked").withArgs(
                admin.address,
                0n,
                admin.address
            );

            expect(await nftSale.ownerOf(0n)).to.equal(admin.address);
            expect(await nftSale.ownerOf(1n)).to.equal(user.address);

            stakeData = await nftStaking.stakeData([0n, 1n]);
            stakeAtByAdmin = await nftStaking.stakeAtByStaker(admin.address);
            stakeAtByUser = await nftStaking.stakeAtByStaker(user.address);
            locks = await nftStaking.locks([0n, 1n]);
            locksByAdmin = await nftStaking.locksByStaker(admin.address);
            locksByUser = await nftStaking.locksByStaker(user.address);

            expect(stakeData[0]).to.eql([ethers.ZeroAddress, 0n]);
            expect(stakeData[1]).to.eql([ethers.ZeroAddress, 0n]);

            expect(stakeAtByAdmin.length).to.equal(0n);
            expect(stakeAtByUser.length).to.equal(0n);

            expect(locks).to.eql([0n, 0n]);

            expect(locksByAdmin.length).to.equal(0n);
            expect(locksByUser.length).to.equal(0n);
        });
    });

    describe("unstakeByAdmin()", function () {
        it("Success multi", async function () {
            const { user, nftSale, admin, nftStaking } = await loadFixture(NFTSaleFixture);

            await nftSale.connect(admin).mintByAdmin([admin.address], [3n]);

            await nftSale.connect(admin).setApprovalForAll(nftStaking.target, true);

            const lastTimestamp = await time.latest();

            await expect(nftStaking.connect(user).unstakeByAdmin(
                []
            )).to.be.revertedWithCustomError(nftStaking, "AccessControlUnauthorizedAccount");

            await expect(nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n, 1n],
                [admin.address, ethers.ZeroAddress],
                [100000000n, 0n]
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__ZeroAddress");

            await expect(nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n, 1n],
                [admin.address, user.address],
                [100000000n, 0n]
            )).to.emit(nftStaking, "Staked").withArgs(
                admin.address,
                0n,
                anyValue
            ).to.emit(nftStaking, "Staked").withArgs(
                user.address,
                1n,
                anyValue
            );

            expect(await nftStaking.stakers()).to.eql([admin.address, user.address]);
            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([0n]);
            expect(await nftStaking.stakedTokenIds(user.address)).to.eql([1n]);

            let stakeData = await nftStaking.stakeData([0n, 1n]);
            let stakeAtByAdmin = await nftStaking.stakeAtByStaker(admin.address);
            let stakeAtByUser = await nftStaking.stakeAtByStaker(user.address);
            let locks = await nftStaking.locks([0n, 1n]);
            let locksByAdmin = await nftStaking.locksByStaker(admin.address);
            let locksByUser = await nftStaking.locksByStaker(user.address);

            expect(stakeData[0][0]).to.equal(admin.address);
            expect(stakeData[0][1]).to.closeTo(lastTimestamp, 75);

            expect(stakeData[1][0]).to.equal(user.address);
            expect(stakeData[1][1]).to.closeTo(lastTimestamp, 75);

            expect(stakeAtByAdmin[0][0]).to.equal(0n);
            expect(stakeAtByAdmin[0][1]).to.closeTo(lastTimestamp, 75);

            expect(stakeAtByUser[0][0]).to.equal(1n);
            expect(stakeAtByUser[0][1]).to.closeTo(lastTimestamp, 75);

            expect(locks[0]).to.closeTo(lastTimestamp + 100000000, 75);
            expect(locks[1]).to.equal(0);

            expect(locksByAdmin[0][0]).to.equal(0n);
            expect(locksByAdmin[0][1]).closeTo(lastTimestamp + 100000000, 75);

            expect(locksByUser[0][0]).to.equal(1n);
            expect(locksByUser[0][1]).to.equal(0n);

            await expect(nftStaking.connect(admin).unstake(
                [0n],
                admin.address
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__LockedToken");

            await expect(nftStaking.connect(admin).unstakeByAdmin(
                []
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__InvalidLength");

            await expect(nftStaking.connect(admin).unstakeByAdmin(
                [2n]
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__UnstakedToken");

            await expect(nftStaking.connect(admin).unstakeByAdmin(
                [0n, 1n]
            )).to.emit(nftStaking, "Unstaked").withArgs(
                admin.address,
                0n,
                admin.address
            ).to.emit(nftStaking, "Unstaked").withArgs(
                user.address,
                1n,
                admin.address
            );

            expect(await nftSale.ownerOf(0n)).to.equal(admin.address);
            expect(await nftSale.ownerOf(1n)).to.equal(admin.address);

            stakeData = await nftStaking.stakeData([0n, 1n]);
            stakeAtByAdmin = await nftStaking.stakeAtByStaker(admin.address);
            stakeAtByUser = await nftStaking.stakeAtByStaker(user.address);
            locks = await nftStaking.locks([0n, 1n]);
            locksByAdmin = await nftStaking.locksByStaker(admin.address);
            locksByUser = await nftStaking.locksByStaker(user.address);

            expect(stakeData[0]).to.eql([ethers.ZeroAddress, 0n]);
            expect(stakeData[1]).to.eql([ethers.ZeroAddress, 0n]);

            expect(stakeAtByAdmin.length).to.equal(0n);
            expect(stakeAtByUser.length).to.equal(0n);

            expect(locks).to.eql([0n, 0n]);

            expect(locksByAdmin.length).to.equal(0n);
            expect(locksByUser.length).to.equal(0n);

            await expect(nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n, 1n, 2n],
                [admin.address, admin.address, admin.address],
                [0n, 100000000n, 0n]
            )).to.emit(nftStaking, "Staked").withArgs(
                admin.address,
                0n,
                anyValue
            ).to.emit(nftStaking, "Staked").withArgs(
                admin.address,
                1n,
                anyValue
            ).to.emit(nftStaking, "Staked").withArgs(
                admin.address,
                2n,
                anyValue
            );

            let lockedUntilByAdmin = await nftStaking.lockedUntilByStaker(admin.address);

            expect(lockedUntilByAdmin.length).to.equal(1n);
            expect(lockedUntilByAdmin[0][0]).to.equal(1n);
            expect(lockedUntilByAdmin[0][1]).closeTo(lastTimestamp + 100000000, 75);
        });
    });

    describe("setUnlockTimestamps()", function () {
        it("AccessControl", async function () {
            const { nftStaking, user } = await loadFixture(NFTSaleFixture);

            await expect(nftStaking.connect(user).setUnlockTimestamps(
                [],
                []
            )).to.be.revertedWithCustomError(nftStaking, "AccessControlUnauthorizedAccount");
        });

        it("NFTStaking__InvalidLength", async function () {
            const { admin, nftStaking } = await loadFixture(NFTSaleFixture);

            await expect(nftStaking.connect(admin).setUnlockTimestamps(
                [1n],
                []
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__InvalidLength");

            await expect(nftStaking.connect(admin).setUnlockTimestamps(
                [],
                []
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__InvalidLength");

            await expect(nftStaking.connect(admin).setUnlockTimestamps(
                [],
                [1n]
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__InvalidLength");

            await expect(nftStaking.connect(admin).setUnlockTimestamps(
                [2n, 3n],
                [1n]
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__InvalidLength");
        });

        it("Success", async function () {
            const { user, nftSale, admin, nftStaking } = await loadFixture(NFTSaleFixture);

            await nftSale.connect(admin).mintByAdmin([admin.address], [2n]);

            await nftSale.connect(admin).setApprovalForAll(nftStaking.target, true);

            const lastTimestamp = await time.latest();

            await expect(nftStaking.connect(user).unstakeByAdmin(
                []
            )).to.be.revertedWithCustomError(nftStaking, "AccessControlUnauthorizedAccount");

            await expect(nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n, 1n],
                [admin.address, ethers.ZeroAddress],
                [100000000n, 0n]
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__ZeroAddress");

            await expect(nftStaking.connect(admin).stakeWithLockOnBehalfOf(
                [0n, 1n],
                [admin.address, user.address],
                [100000000n, 0n]
            )).to.emit(nftStaking, "Staked").withArgs(
                admin.address,
                0n,
                anyValue
            ).to.emit(nftStaking, "Staked").withArgs(
                user.address,
                1n,
                anyValue
            );

            expect(await nftStaking.stakers()).to.eql([admin.address, user.address]);
            expect(await nftStaking.stakedTokenIds(admin.address)).to.eql([0n]);
            expect(await nftStaking.stakedTokenIds(user.address)).to.eql([1n]);

            let stakeData = await nftStaking.stakeData([0n, 1n]);
            let stakeAtByAdmin = await nftStaking.stakeAtByStaker(admin.address);
            let stakeAtByUser = await nftStaking.stakeAtByStaker(user.address);
            let locks = await nftStaking.locks([0n, 1n]);
            let locksByAdmin = await nftStaking.locksByStaker(admin.address);
            let locksByUser = await nftStaking.locksByStaker(user.address);

            expect(stakeData[0][0]).to.equal(admin.address);
            expect(stakeData[0][1]).to.closeTo(lastTimestamp, 75);

            expect(stakeData[1][0]).to.equal(user.address);
            expect(stakeData[1][1]).to.closeTo(lastTimestamp, 75);

            expect(stakeAtByAdmin[0][0]).to.equal(0n);
            expect(stakeAtByAdmin[0][1]).to.closeTo(lastTimestamp, 75);

            expect(stakeAtByUser[0][0]).to.equal(1n);
            expect(stakeAtByUser[0][1]).to.closeTo(lastTimestamp, 75);

            expect(locks[0]).to.closeTo(lastTimestamp + 100000000, 75);
            expect(locks[1]).to.equal(0);

            expect(locksByAdmin[0][0]).to.equal(0n);
            expect(locksByAdmin[0][1]).closeTo(lastTimestamp + 100000000, 75);

            expect(locksByUser[0][0]).to.equal(1n);
            expect(locksByUser[0][1]).to.equal(0n);

            await nftStaking.connect(admin).setUnlockTimestamps(
                [0n, 1n],
                [1234567890n, 9876543210n]
            );

            stakeData = await nftStaking.stakeData([0n, 1n]);
            stakeAtByAdmin = await nftStaking.stakeAtByStaker(admin.address);
            stakeAtByUser = await nftStaking.stakeAtByStaker(user.address);
            locks = await nftStaking.locks([0n, 1n]);
            locksByAdmin = await nftStaking.locksByStaker(admin.address);
            locksByUser = await nftStaking.locksByStaker(user.address);

            expect(stakeData[0][0]).to.equal(admin.address);
            expect(stakeData[0][1]).to.closeTo(lastTimestamp, 75);

            expect(stakeData[1][0]).to.equal(user.address);
            expect(stakeData[1][1]).to.closeTo(lastTimestamp, 75);

            expect(stakeAtByAdmin[0][0]).to.equal(0n);
            expect(stakeAtByAdmin[0][1]).to.closeTo(lastTimestamp, 75);

            expect(stakeAtByUser[0][0]).to.equal(1n);
            expect(stakeAtByUser[0][1]).to.closeTo(lastTimestamp, 75);

            expect(locks[0]).to.equal(1234567890n);
            expect(locks[1]).to.equal(9876543210n);

            expect(locksByAdmin[0][0]).to.equal(0n);
            expect(locksByAdmin[0][1]).equal(1234567890n);

            expect(locksByUser[0][0]).to.equal(1n);
            expect(locksByUser[0][1]).to.equal(9876543210n);
        });
    });

    describe("_authorizeUpgrade()", function () {
        it("NFTStaking__InvalidImplementation", async function () {
            const { admin, nftStaking } = await loadFixture(NFTSaleFixture);

            const NFTStakingMock = await ethers.getContractFactory("NFTStakingMock", admin);
            const mock = await NFTStakingMock.deploy(admin.address);
            await mock.waitForDeployment();

            await expect(nftStaking.connect(admin).upgradeToAndCall(
                mock.target, "0x"
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__InvalidImplementation");

            const NFTStakingMockTwo = await ethers.getContractFactory("NFTStakingMockTwo", admin);
            const mockTwo = await NFTStakingMockTwo.deploy(admin.address);
            await mockTwo.waitForDeployment();

            await expect(nftStaking.connect(admin).upgradeToAndCall(
                mockTwo.target, "0x"
            )).to.be.revertedWithCustomError(nftStaking, "NFTStaking__InvalidImplementation");
        });
    });
});