const DAO = artifacts.require("DAO");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("DAO", function (/* accounts */) {
  it("should assert true", async function () {
    await DAO.deployed();
    return assert.isTrue(true);
  });
});
