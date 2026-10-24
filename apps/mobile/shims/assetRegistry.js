'use strict';

const assets = [];

function registerAsset(asset) {
  return assets.push(asset);
}

function getAssetByID(assetId) {
  return assets[assetId - 1];
}

const AssetRegistry = {
  registerAsset,
  getAssetByID,
};

module.exports = AssetRegistry;
module.exports.default = AssetRegistry;
module.exports.registerAsset = registerAsset;
module.exports.getAssetByID = getAssetByID;
