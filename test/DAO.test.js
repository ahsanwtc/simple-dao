const { expectRevert, time} = require('@openzeppelin/test-helpers');
const DAO = artifacts.require("DAO");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("DAO", accounts => {
  let dao = null;
  const [admin, investor1, investor2, investor3, proposalAddress, nonInvestor] = accounts;
  const contributionTime = 5, voteTime = 5, quorum = 50;

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

  it('should create a proposal', async () => {
    await dao.contribute({ from: investor1, value: 500 });
    await dao.createProposal('proposal', 400, proposalAddress, { from: investor1 });
    const proposal = await dao.proposals(0);

    assert(proposal.id.toNumber() === 0);
    assert(proposal.name === 'proposal');
    assert(proposal.amount.toNumber() === 400);
    assert(proposal.recipient === proposalAddress);
    assert(proposal.votes.toNumber() === 0);
    assert(proposal.executed === false);
    assert((await dao.availableFunds()).toNumber() === 100);
  });

  it('should NOT create a proposal if sender is not an investor', async () => {
    await dao.contribute({ from: investor1, value: 500 });
    await expectRevert(
      dao.createProposal('proposal', 400, proposalAddress, { from: nonInvestor }),
      'investor only'
    );
  });

  it('should NOT create a proposal if less liquidity available', async () => {
    await dao.contribute({ from: investor1, value: 500 });
    await expectRevert(
      dao.createProposal('proposal', 600, proposalAddress, { from: investor1 }),
      'not enough liquidity'
    );
  });

  it('should vote', async () => {
    let proposal = null;
    await dao.contribute({ from: investor1, value: 500 });
    await dao.contribute({ from: investor2, value: 600 });

    await dao.createProposal('proposal', 400, proposalAddress, { from: investor1 });
    await dao.vote(0, { from: investor1 });

    assert(await dao.votes(investor1, 0) === true);
    proposal = await dao.proposals(0);
    assert(proposal.votes.toNumber() === 500);

    await dao.vote(0, { from: investor2 });
    assert(await dao.votes(investor2, 0) === true);
    proposal = await dao.proposals(0);
    assert(proposal.votes.toNumber() === 1100);
  });

  it('should NOT vote if sender is not an investor', async () => {
    await dao.contribute({ from: investor1, value: 500 });

    await dao.createProposal('proposal', 400, proposalAddress, { from: investor1 });
    await expectRevert(
      dao.vote(0, { from: nonInvestor }),
      'investor only'
    );    
  });
  
  it('should NOT vote if sender already voted', async () => {
    await dao.contribute({ from: investor1, value: 500 });
    await dao.createProposal('proposal', 400, proposalAddress, { from: investor1 });
    await dao.vote(0, { from: investor1 });
    await expectRevert(
      dao.vote(0, { from: investor1 }),
      'investor already voted'
    );    
  });

  it('should NOT vote if voting is not active', async () => {
    await dao.contribute({ from: investor1, value: 500 });
    await dao.createProposal('proposal', 400, proposalAddress, { from: investor1 });
    await time.increase(50001);
    await expectRevert(
      dao.vote(0, { from: investor1 }),
      'voting is not active'
    );    
  });

  it('should execute proposal', async () => {
    await dao.contribute({ from: investor1, value: 500 });
    await dao.contribute({ from: investor2, value: 600 });
    await dao.contribute({ from: investor3, value: 400 });

    await dao.createProposal('proposal', 400, proposalAddress, { from: investor1 });
    await dao.vote(0, { from: investor2 });
    await dao.vote(0, { from: investor3 });

    const balanceBefore = web3.utils.toBN(await web3.eth.getBalance(proposalAddress));
    await time.increase(5001);
    await dao.executeProposal(0, { from: admin });
    const balanceAfter = web3.utils.toBN(await web3.eth.getBalance(proposalAddress));

    await assert((await dao.availableFunds()).toNumber() === 700);
    assert(balanceAfter.sub(balanceBefore).toNumber() === 400);
  });

  it('should NOT execute proposal if sender is not admin', async () => {
    await dao.contribute({ from: investor1, value: 500 });

    await dao.createProposal('proposal', 400, proposalAddress, { from: investor1 });
    await dao.vote(0, { from: investor1 });
    await time.increase(5001);
    await expectRevert(
      dao.executeProposal(0, { from: investor1 }),
      'only admin'
    );    
  });

  it('should NOT execute proposal if voting is active', async () => {
    await dao.contribute({ from: investor1, value: 500 });

    await dao.createProposal('proposal', 400, proposalAddress, { from: investor1 });
    await dao.vote(0, { from: investor1 });
    await expectRevert(
      dao.executeProposal(0, { from: admin }),
      'voting is still active'
    );    
  });

  it('should NOT execute proposal if proposal is already executed', async () => {
    await dao.contribute({ from: investor1, value: 500 });
    await dao.contribute({ from: investor2, value: 600 });
    await dao.contribute({ from: investor3, value: 400 });

    await dao.createProposal('proposal', 400, proposalAddress, { from: investor1 });
    await dao.vote(0, { from: investor1 });
    await dao.vote(0, { from: investor2 });
    await dao.vote(0, { from: investor3 });

    await time.increase(5001);
    await dao.executeProposal(0, { from: admin });

    await expectRevert(
      dao.executeProposal(0, { from: admin }),
      'proposal is already executed'
    );    
  });

  it('should withdraw ether', async () => {
    await dao.contribute({ from: investor1, value: 500 });
    await dao.contribute({ from: investor2, value: 600 });

    const balanceBefore = web3.utils.toBN(await web3.eth.getBalance(nonInvestor));
    await dao.withdrawEther(500, nonInvestor, { from: admin });
    const balanceAfter = web3.utils.toBN(await web3.eth.getBalance(nonInvestor));
    assert(balanceAfter.sub(balanceBefore).toNumber() === 500);
  });

  it('should NOT withdraw ether if not admin', async () => {
    await dao.contribute({ from: investor1, value: 500 });
    await dao.contribute({ from: investor2, value: 600 });

    await expectRevert(
      dao.withdrawEther(500, nonInvestor, { from: nonInvestor }),
      'only admin'
    );
    
  });

  it('should NOT withdraw ether if amount too high', async () => {
    await dao.contribute({ from: investor1, value: 500 });

    await expectRevert(
      dao.withdrawEther(600, nonInvestor, { from: admin }),
      'not enough liquidity'
    );
    
  });

  it('should transfer shares', async () => {
    await dao.contribute({ from: investor1, value: 500 });
    await dao.contribute({ from: investor2, value: 600 });
    
    const balanceBefore = web3.utils.toBN(await web3.eth.getBalance(nonInvestor));
    await dao.transferShare(400, nonInvestor, { from: investor1 });
    const balanceAfter = web3.utils.toBN(await web3.eth.getBalance(nonInvestor));

    assert(balanceAfter.sub(balanceBefore).toNumber() === 400);
    assert((await dao.shares(investor1)).toNumber() === 100);
    assert((await dao.investors(nonInvestor)) === true);
  });

  it('should NOT transfer shares if transfer amount is more than shares', async () => {
    await dao.contribute({ from: investor1, value: 500 });
    
    await expectRevert(
      dao.transferShare(600, nonInvestor, { from: investor1 }),
      'not enough shares'
    );
  });

  it('should redeem shares', async () => {
    await dao.contribute({ from: investor1, value: 500 });
    await dao.contribute({ from: investor2, value: 600 });
    
    /**
     * there is some issue when comparing the balances of investor1
     * need to look into this issue.
     */
    // const balanceBefore = await web3.eth.getBalance(investor1);
    await dao.redeemShare(400, { from: investor1 });
    // const balanceAfter = await web3.eth.getBalance(investor1);

    // const balanceBeforeBN = web3.utils.toBN(balanceBefore);
    // const balanceAfterBN = web3.utils.toBN(balanceAfter);
    

    // console.log(balanceAfterBN.sub(balanceBeforeBN).toNumber());
    // assert(balanceAfter.sub(balanceBefore).toNumber() === 400, 'balance not correct');
    assert((await dao.shares(investor1)).toNumber() === 100, 'shares not correct');
    assert((await dao.availableFunds()).toNumber() === 700, 'availableFunds not correct');
  });

});
