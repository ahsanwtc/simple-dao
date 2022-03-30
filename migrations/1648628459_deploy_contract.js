const DAO = artifacts.require("DAO");

module.exports = function(_deployer) {
  _deployer.deploy(DAO, 2, 2, 50);
};
