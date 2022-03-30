const { expectRevert, time} = require('@openzeppelin/test-helpers');
const DAO = artifacts.require("DAO");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("DAO", accounts => {
  let dao = null;
  const [admin, investor1, investor2, investor3, nonInvestor] = accounts;
  const contributionTime = 5, voteTime = 2, quorum = 50;

  beforeEach(async () => {
    dao = await DAO.new(contributionTime, voteTime, quorum);
  });

  it('should be deployed correctly', async () => {
    assert((await dao.quorum()).toNumber() === quorum);
    assert((await dao.voteTime()).toNumber() === voteTime);
  });

  it('should accept contribution', async () => {
    await dao.contribute({ from: investor1, value: 500 });
    await dao.contribute({ from: investor2, value: 600 });
    await dao.contribute({ from: investor3, value: 100 });
    
    assert(await dao.investors(investor1) === true);
    assert(await dao.investors(investor2) === true);
    assert(await dao.investors(investor3) === true);
    assert((await dao.shares(investor1)).toNumber() === 500);
    assert((await dao.shares(investor2)).toNumber() === 600);
    assert((await dao.shares(investor3)).toNumber() === 100);
    assert((await dao.totalShares()).toNumber() === 1200);
    assert((await dao.availableFunds()).toNumber() === 1200);
  });

  it('should NOT accept contribution after contribution time has ended', async () => {
    await dao.contribute({ from: investor1, value: 500 });
    await time.increase(50001);
    await expectRevert(
      dao.contribute({ from: investor2, value: 600 }),
      'contribution window elapsed'
    );
  });


});
