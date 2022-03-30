// SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

contract DAO {
	mapping(address => bool) public investors;
	mapping(address => uint) public shares;
	uint public totalShares;
	uint public availableFunds;
	uint public contributionEnd;
	struct Proposal {
		uint id;
		string name;
		uint amount;
		address payable recipient;
		uint votes;
		uint end;
		bool executed;
	}
	uint public nextProposalId;
	mapping(uint => Proposal) public proposals;
	mapping(address => mapping(uint => bool)) public votes;
	uint public voteTime;
	uint public quorum;
	address public admin;

	constructor(uint contributionTime, uint _voteTime, uint _quorum) {
		require(_quorum > 0 && _quorum < 100, "quorum must be between 0 and 100");
		contributionEnd = block.timestamp + contributionTime;
		voteTime = _voteTime;
		quorum = _quorum;
		admin = msg.sender;
	}

	/* 1 wei = 1 share */
	function contribute() payable external {
		require(block.timestamp < contributionEnd, "contribution window elapsed");
		investors[msg.sender] = true;
		shares[msg.sender] += msg.value;
		totalShares += msg.value;
		availableFunds += msg.value;
	}

	function redeemShare(uint amount) external {
		require(shares[msg.sender] >= amount, "not enough shares");
		require(availableFunds >= amount, "not enough liquidity");
		shares[msg.sender] -= amount;
		availableFunds -= amount;
		payable(msg.sender).transfer(amount);
	}

	function transferShare(uint amount, address payable to) external {
		require(shares[msg.sender] >= amount, "not enough shares");
		shares[msg.sender] -= amount;
		
		/* making sure that new address is also of a investor status */
		/* because it can also be an external address */
		investors[to] = true;
		to.transfer(amount);
	}

	function createProposal(string memory name, uint amount, address payable recipient) external onlyInvestor {
		require(availableFunds >= amount, "not enough liquidity");
		proposals[nextProposalId] = Proposal({ 
			id: nextProposalId, name: name, amount: amount, recipient: recipient, votes: 0, end: block.timestamp + voteTime, executed: false
		});
		
		/* By creating a proposal, the dao is commiting funds which can't be used anywhere else */
		/* funds will be available if proposal fails, otherwise they will be invested */
		availableFunds -= amount;
		nextProposalId++;
	}

	function vote(uint proposalId) external onlyInvestor {
		require(votes[msg.sender][proposalId] == false, "investor already voted");
		Proposal storage proposal = proposals[proposalId];
		require(block.timestamp < proposal.end, "voting is not active");
		votes[msg.sender][proposalId] = true;
		
		/* votes are weighted value of shares */
		proposal.votes += shares[msg.sender];
	}

	function executeProposal(uint proposalId) external onlyAdmin {
		Proposal storage proposal = proposals[proposalId];
		require(block.timestamp > proposal.end, "voting is still active");
		require(proposal.executed == false, "proposal is already executed");
		require(proposal.votes / totalShares * 100 >= quorum, "proposal doesn't staisfy the quorum");
		_transferEther(proposal.amount, proposal.recipient);
	}

	function withdrawEther(uint amount, address payable to) external onlyAdmin {
		_transferEther(amount, to);
	}

	function _transferEther(uint amount, address payable to) internal {
		require(amount <= availableFunds, "not enough liquidity");
		availableFunds -= amount;
		to.transfer(amount);
	}

	receive() payable external {
		availableFunds += msg.value;
	}

	modifier onlyInvestor() {
		require(investors[msg.sender] == true, "investor only");
		_;
	}

	modifier onlyAdmin() {
		require(msg.sender == admin, "only admin");
		_;
	}
}